'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const { productImagesBucket } = require('../storage/supabaseStorage');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — a product photo, generously bounded
const IMAGE_EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Public-ish: any authenticated user can see the product catalogue.
router.get('/', requireAuth, async (req, res) => {
    res.json(await repos.products.all());
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, description, price, image } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const product = await repos.products.insert({
        id: `product-${uuidv4()}`,
        name,
        description: description || '',
        price: price ?? 0,
        image: image || null,
        created_at: new Date().toISOString(),
    });
    res.status(201).json(product);
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const updated = await repos.products.updateById(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const removed = await repos.products.removeById(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Product not found' });
    await repos.agentAssignments.removeWhere((a) => a.product_id === req.params.id);
    res.status(204).end();
});

// Uploaded from the admin's browser after (or instead of) create — see ProductsTab on the frontend.
router.post(
    '/:id/image',
    requireAuth,
    requireRole('admin'),
    express.raw({ type: 'image/*', limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
        const product = await repos.products.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'Empty image body' });

        const contentType = req.get('Content-Type');
        const ext = IMAGE_EXT_BY_TYPE[contentType];
        if (!ext) return res.status(415).json({ error: 'Image must be png, jpeg, or webp' });

        // Clean up a previously uploaded image with a different extension, if any.
        const staleRemovals = Object.values(IMAGE_EXT_BY_TYPE)
            .filter((otherExt) => otherExt !== ext)
            .map((otherExt) => `${req.params.id}.${otherExt}`);
        if (staleRemovals.length) await productImagesBucket.remove(staleRemovals);

        const filename = `${req.params.id}.${ext}`;
        const { error } = await productImagesBucket.upload(filename, req.body, { contentType, upsert: true });
        if (error) return res.status(502).json({ error: 'Image upload failed' });

        await repos.products.updateById(req.params.id, { image: filename });
        res.status(201).json({ image: filename });
    }
);

// Public — a plain <img src> can't carry an Authorization header, and a product
// photo is no more sensitive than the name/price/description already visible
// to any logged-in role via GET /products. The bucket itself is public, so
// this just redirects to its public URL rather than streaming bytes through Express.
router.get('/:id/image', async (req, res) => {
    const product = await repos.products.findById(req.params.id);
    if (!product || !product.image) return res.status(404).end();
    const { data } = productImagesBucket.getPublicUrl(product.image);
    res.redirect(data.publicUrl);
});

router.get('/:id/agents', requireAuth, requireRole('admin'), async (req, res) => {
    const assignments = await repos.agentAssignments.find((a) => a.product_id === req.params.id);
    const agentIds = assignments.map((a) => a.agent_id);
    const agents = (await repos.agents.find((a) => agentIds.includes(a.id))).map(({ password, ...rest }) => rest);
    res.json(agents);
});

router.post('/:id/assign', requireAuth, requireRole('admin'), async (req, res) => {
    const { agentId } = req.body;
    const product = await repos.products.findById(req.params.id);
    const agent = await repos.agents.findById(agentId);
    if (!product || !agent) return res.status(404).json({ error: 'Product or agent not found' });

    const exists = await repos.agentAssignments.findOne(
        (a) => a.product_id === req.params.id && a.agent_id === agentId
    );
    if (exists) return res.status(409).json({ error: 'Already assigned' });

    const assignment = await repos.agentAssignments.insert({ agent_id: agentId, product_id: req.params.id });
    res.status(201).json(assignment);
});

router.delete('/:id/assign/:agentId', requireAuth, requireRole('admin'), async (req, res) => {
    const removed = await repos.agentAssignments.removeWhere(
        (a) => a.product_id === req.params.id && a.agent_id === req.params.agentId
    );
    if (!removed) return res.status(404).json({ error: 'Assignment not found' });
    res.status(204).end();
});

module.exports = router;

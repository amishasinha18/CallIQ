'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

// Public-ish: any authenticated user can see the product catalogue.
router.get('/', requireAuth, (req, res) => {
    res.json(repos.products.all());
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
    const { name, description, price, image } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const product = repos.products.insert({
        id: `product-${uuidv4()}`,
        name,
        description: description || '',
        price: price ?? 0,
        image: image || null,
        created_at: new Date().toISOString(),
    });
    res.status(201).json(product);
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
    const updated = repos.products.updateById(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
    const removed = repos.products.removeById(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Product not found' });
    repos.agentAssignments.removeWhere((a) => a.product_id === req.params.id);
    res.status(204).end();
});

router.get('/:id/agents', requireAuth, requireRole('admin'), (req, res) => {
    const agentIds = repos.agentAssignments
        .find((a) => a.product_id === req.params.id)
        .map((a) => a.agent_id);
    const agents = repos.agents.find((a) => agentIds.includes(a.id)).map(({ password, ...rest }) => rest);
    res.json(agents);
});

router.post('/:id/assign', requireAuth, requireRole('admin'), (req, res) => {
    const { agentId } = req.body;
    const product = repos.products.findById(req.params.id);
    const agent = repos.agents.findById(agentId);
    if (!product || !agent) return res.status(404).json({ error: 'Product or agent not found' });

    const exists = repos.agentAssignments.findOne(
        (a) => a.product_id === req.params.id && a.agent_id === agentId
    );
    if (exists) return res.status(409).json({ error: 'Already assigned' });

    const assignment = repos.agentAssignments.insert({ agent_id: agentId, product_id: req.params.id });
    res.status(201).json(assignment);
});

router.delete('/:id/assign/:agentId', requireAuth, requireRole('admin'), (req, res) => {
    const removed = repos.agentAssignments.removeWhere(
        (a) => a.product_id === req.params.id && a.agent_id === req.params.agentId
    );
    if (!removed) return res.status(404).json({ error: 'Assignment not found' });
    res.status(204).end();
});

module.exports = router;

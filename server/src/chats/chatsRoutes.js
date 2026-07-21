'use strict';

const express = require('express');
const repos = require('../db/repositories');
const chatService = require('./chatService');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

async function enrich(chat) {
    const customer = await repos.customers.findById(chat.customer_id);
    const agent = chat.agent_id ? await repos.agents.findById(chat.agent_id) : null;
    return { ...chat, customer_name: customer?.name || chat.customer_name, agent_name: agent?.name || null };
}

// Visibility Check — customer product grid uses this to show/hide the Text button per product.
router.get('/availability', requireAuth, async (req, res) => {
    res.json(await chatService.availabilityByProduct());
});

// Admin: all chats. Agent: chats they're/were assigned to.
router.get('/history', requireAuth, requireRole('admin', 'agent'), async (req, res) => {
    let chats = await repos.chats.all();
    if (req.user.role === 'agent') chats = chats.filter((c) => c.agent_id === req.user.sub);
    const enriched = await Promise.all(chats.map(enrich));
    res.json(enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

router.get('/:id', requireAuth, requireRole('admin', 'agent', 'customer'), async (req, res) => {
    const chat = await repos.chats.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (req.user.role === 'agent' && chat.agent_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'customer' && chat.customer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    res.json(await enrich(chat));
});

router.get('/:id/messages', requireAuth, requireRole('admin', 'agent', 'customer'), async (req, res) => {
    const chat = await repos.chats.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (req.user.role === 'agent' && chat.agent_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'customer' && chat.customer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    res.json(await repos.chatMessages.find((m) => m.chat_id === req.params.id));
});

// Transfer Rules — only online agents assigned to this exact product, excluding the requester.
router.get('/:id/transfer-candidates', requireAuth, requireRole('agent'), async (req, res) => {
    try {
        const candidates = await chatService.transferCandidates(req.params.id, req.user.sub);
        res.json(candidates);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;

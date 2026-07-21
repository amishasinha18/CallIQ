'use strict';

const express = require('express');
const repos = require('../db/repositories');
const chatService = require('./chatService');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

function enrich(chat) {
    const customer = repos.customers.findById(chat.customer_id);
    const agent = chat.agent_id ? repos.agents.findById(chat.agent_id) : null;
    return { ...chat, customer_name: customer?.name || chat.customer_name, agent_name: agent?.name || null };
}

// Visibility Check — customer product grid uses this to show/hide the Text button per product.
router.get('/availability', requireAuth, async (req, res) => {
    res.json(await chatService.availabilityByProduct());
});

// Admin: all chats. Agent: chats they're/were assigned to.
router.get('/history', requireAuth, requireRole('admin', 'agent'), (req, res) => {
    let chats = repos.chats.all();
    if (req.user.role === 'agent') chats = chats.filter((c) => c.agent_id === req.user.sub);
    res.json(chats.map(enrich).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

router.get('/:id', requireAuth, requireRole('admin', 'agent', 'customer'), (req, res) => {
    const chat = repos.chats.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (req.user.role === 'agent' && chat.agent_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'customer' && chat.customer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    res.json(enrich(chat));
});

router.get('/:id/messages', requireAuth, requireRole('admin', 'agent', 'customer'), (req, res) => {
    const chat = repos.chats.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (req.user.role === 'agent' && chat.agent_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'customer' && chat.customer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    res.json(repos.chatMessages.find((m) => m.chat_id === req.params.id));
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

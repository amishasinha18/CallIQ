'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const authService = require('../auth/authService');
const agentState = require('../routing/agentStateService');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

const sanitizeAgent = ({ password, ...rest }) => rest;

// ── Admin: agent management ──────────────────────────
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    res.json((await repos.agents.all()).map(sanitizeAgent));
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await repos.agents.findOne((a) => a.email.toLowerCase() === email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const agent = await repos.agents.insert({
        id: `agent-${uuidv4()}`,
        name,
        email,
        password: authService.hashPassword(password),
        role: 'agent',
        status: 'offline',
        last_idle_at: null,
        created_at: new Date().toISOString(),
    });
    res.status(201).json(sanitizeAgent(agent));
});

router.patch('/:id/credentials', requireAuth, requireRole('admin'), async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password is required' });
    const updated = await repos.agents.updateById(req.params.id, { password: authService.hashPassword(password) });
    if (!updated) return res.status(404).json({ error: 'Agent not found' });
    res.json(sanitizeAgent(updated));
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const removed = await repos.agents.removeById(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Agent not found' });
    await repos.agentAssignments.removeWhere((a) => a.agent_id === req.params.id);
    res.status(204).end();
});

// ── Agent: self-service workspace ────────────────────
router.get('/me/products', requireAuth, requireRole('agent'), async (req, res) => {
    const productIds = await agentState.assignedProductIds(req.user.sub);
    res.json(await repos.products.find((p) => productIds.includes(p.id)));
});

router.patch('/me/status', requireAuth, requireRole('agent'), async (req, res) => {
    const { status } = req.body;
    if (!['available', 'break', 'offline'].includes(status)) {
        return res.status(400).json({ error: 'status must be available, break, or offline' });
    }
    await agentState.setStatus(req.user.sub, status);
    res.json({ status });
});

router.get('/me', requireAuth, requireRole('agent'), async (req, res) => {
    const agent = await repos.agents.findById(req.user.sub);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const status = await agentState.getStatus(req.user.sub);
    res.json({ ...sanitizeAgent(agent), status });
});

function dayKey(iso) {
    return new Date(iso).toISOString().slice(0, 10);
}

// Agent's own personalized stats + recent customer reviews for their dashboard.
router.get('/me/stats', requireAuth, requireRole('agent'), async (req, res) => {
    const myCalls = await repos.callLogs.find((c) => c.agent_id === req.user.sub);
    const myFeedback = await repos.feedback.find((f) => f.agent_id === req.user.sub);
    const today = dayKey(new Date().toISOString());

    const callsToday = myCalls.filter((c) => dayKey(c.started_at) === today).length;
    const completed = myCalls.filter((c) => c.status === 'completed');
    const attempted = myCalls.filter((c) => c.status !== 'no_agent_available');
    const avgCallDurationSeconds = completed.length
        ? Math.round(completed.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completed.length)
        : 0;
    const completionRate = attempted.length ? completed.length / attempted.length : 0;
    const avgOverallRating = myFeedback.length
        ? myFeedback.reduce((sum, f) => sum + f.ratings.overall, 0) / myFeedback.length
        : null;

    const recentReviews = await Promise.all(
        myFeedback
            .slice()
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10)
            .map(async (f) => {
                const customer = await repos.customers.findById(f.customer_id);
                return {
                    id: f.id,
                    customer_name: customer?.name || 'Customer',
                    ratings: f.ratings,
                    comment: f.comment,
                    created_at: f.created_at,
                };
            })
    );

    res.json({
        callsToday,
        callsHandledTotal: completed.length,
        avgCallDurationSeconds,
        completionRate,
        avgOverallRating,
        feedbackCount: myFeedback.length,
        recentReviews,
    });
});

module.exports = router;

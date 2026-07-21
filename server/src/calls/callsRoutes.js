'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const callService = require('./callService');
const env = require('../config/env');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();
const MAX_RECORDING_BYTES = 100 * 1024 * 1024; // 100MB — a full call's audio track, generously bounded

function enrich(log) {
    const customer = repos.customers.findById(log.customer_id);
    const agent = repos.agents.findById(log.agent_id);
    const product = repos.products.findById(log.product_id);
    return {
        ...log,
        customer_name: customer?.name || 'Unknown',
        agent_name: agent?.name || 'Unknown',
        product_name: product?.name || 'Unknown',
    };
}

// Admin: full history. Agent: only calls they personally handled.
router.get('/history', requireAuth, requireRole('admin', 'agent'), (req, res) => {
    let logs = repos.callLogs.all();
    if (req.user.role === 'agent') {
        logs = logs.filter((l) => l.agent_id === req.user.sub);
    }
    res.json(logs.map(enrich).sort((a, b) => new Date(b.started_at) - new Date(a.started_at)));
});

router.get('/live', requireAuth, requireRole('admin'), (req, res) => {
    res.json(callService.getLiveCalls());
});

router.get('/:id', requireAuth, requireRole('admin', 'agent'), (req, res) => {
    const log = repos.callLogs.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Call log not found' });
    if (req.user.role === 'agent' && log.agent_id !== req.user.sub) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(enrich(log));
});

// Mandatory post-call disposition — agent only, for their own call.
router.post('/:id/disposition', requireAuth, requireRole('agent'), (req, res) => {
    const { outcome, notes } = req.body;
    if (!['Success', 'Failed', 'Callback Required'].includes(outcome)) {
        return res.status(400).json({ error: 'outcome must be Success, Failed, or Callback Required' });
    }
    const log = repos.callLogs.findById(req.params.id);
    if (!log || log.agent_id !== req.user.sub) return res.status(404).json({ error: 'Call log not found' });

    const disposition = repos.dispositions.insert({
        id: `disp-${uuidv4()}`,
        call_log_id: req.params.id,
        outcome,
        notes: notes || '',
        created_at: new Date().toISOString(),
    });
    repos.callLogs.updateById(req.params.id, { disposition_id: disposition.id });
    res.status(201).json(disposition);
});

const FEEDBACK_PARAMS = ['professionalism', 'callQuality', 'resolution', 'overall'];

// Post-call customer feedback — customer only, for their own call, one per call.
router.post('/:id/feedback', requireAuth, requireRole('customer'), (req, res) => {
    const { ratings, comment } = req.body;
    const log = repos.callLogs.findById(req.params.id);
    if (!log || log.customer_id !== req.user.sub) return res.status(404).json({ error: 'Call log not found' });

    const existing = repos.feedback.findOne((f) => f.call_log_id === req.params.id);
    if (existing) return res.status(409).json({ error: 'Feedback already submitted for this call' });

    if (!ratings || FEEDBACK_PARAMS.some((p) => !Number.isInteger(ratings[p]) || ratings[p] < 1 || ratings[p] > 5)) {
        return res.status(400).json({ error: `ratings must include 1-5 integers for: ${FEEDBACK_PARAMS.join(', ')}` });
    }

    const entry = repos.feedback.insert({
        id: `fb-${uuidv4()}`,
        call_log_id: req.params.id,
        customer_id: req.user.sub,
        agent_id: log.agent_id,
        ratings,
        comment: comment || '',
        created_at: new Date().toISOString(),
    });
    res.status(201).json(entry);
});

// Admin live-call actions: Listen (silent), Whisper (agent-only), Barge (3-way).
router.post('/:id/monitor', requireAuth, requireRole('admin'), async (req, res) => {
    const { mode } = req.body;
    try {
        const result = await callService.startMonitor(req.params.id, { id: req.user.sub, name: req.user.name }, mode);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Force-terminate — admin action, or the agent/customer ending their own call.
router.post('/:id/hangup', requireAuth, requireRole('admin', 'agent', 'customer'), async (req, res) => {
    try {
        const log = await callService.endCall(req.params.id, req.user.role);
        res.json(log);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Uploaded once by the agent's browser right after a call ends (see CallRecorder on the frontend).
router.post(
    '/:id/recording',
    requireAuth,
    requireRole('agent'),
    express.raw({ type: '*/*', limit: MAX_RECORDING_BYTES }),
    (req, res) => {
        const log = repos.callLogs.findById(req.params.id);
        if (!log || log.agent_id !== req.user.sub) return res.status(404).json({ error: 'Call log not found' });
        if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'Empty recording body' });

        const filename = `${req.params.id}.webm`;
        fs.writeFileSync(path.join(env.recordingsDir, filename), req.body);
        repos.callLogs.updateById(req.params.id, { recording_path: filename });
        res.status(201).json({ recording_path: filename });
    }
);

// Playback — admin any call, agent only their own.
router.get('/:id/recording', requireAuth, requireRole('admin', 'agent'), (req, res) => {
    const log = repos.callLogs.findById(req.params.id);
    if (!log || !log.recording_path) return res.status(404).json({ error: 'No recording for this call' });
    if (req.user.role === 'agent' && log.agent_id !== req.user.sub) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(env.recordingsDir, log.recording_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Recording file missing' });
    res.type('audio/webm').sendFile(filePath);
});

// 1-click callback from a past log.
router.post('/outdial', requireAuth, requireRole('agent'), async (req, res) => {
    const { customerId, productId } = req.body;
    if (!customerId || !productId) return res.status(400).json({ error: 'customerId and productId are required' });
    try {
        const session = await callService.startOutdial({ agentId: req.user.sub, customerId, productId });
        res.status(201).json(session);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;

'use strict';

const express = require('express');
const repos = require('../db/repositories');
const agentState = require('../routing/agentStateService');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

function dayKey(iso) {
    return new Date(iso).toISOString().slice(0, 10);
}

function isToday(iso) {
    return dayKey(iso) === dayKey(new Date().toISOString());
}

router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
    const calls = await repos.callLogs.all();
    const chats = await repos.chats.all();
    const dispositions = await repos.dispositions.all();
    const agents = await repos.agents.all();
    const feedback = await repos.feedback.all();

    const callsToday = calls.filter((c) => isToday(c.started_at)).length;
    const chatsToday = chats.filter((c) => isToday(c.created_at)).length;

    const completed = calls.filter((c) => c.status === 'completed');
    const avgCallDurationSeconds = completed.length
        ? Math.round(completed.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completed.length)
        : 0;
    const attempted = calls.filter((c) => c.status !== 'no_agent_available');
    const completionRate = attempted.length ? completed.length / attempted.length : 0;

    // Last 7 days, oldest first, zero-filled for days with no calls.
    const callsLast7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dayKey(d.toISOString());
        callsLast7Days.push({
            date: key,
            count: calls.filter((c) => dayKey(c.started_at) === key).length,
        });
    }

    const dispositionBreakdown = { Success: 0, Failed: 0, 'Callback Required': 0 };
    dispositions.forEach((d) => {
        if (dispositionBreakdown[d.outcome] !== undefined) dispositionBreakdown[d.outcome] += 1;
    });

    const agentStatusBreakdown = { available: 0, busy: 0, break: 0, offline: 0 };
    const statuses = await Promise.all(agents.map((a) => agentState.getStatus(a.id)));
    statuses.forEach((s) => {
        if (agentStatusBreakdown[s] !== undefined) agentStatusBreakdown[s] += 1;
    });

    const avgOverallRating = feedback.length
        ? feedback.reduce((sum, f) => sum + f.ratings.overall, 0) / feedback.length
        : null;

    res.json({
        callsToday,
        chatsToday,
        avgCallDurationSeconds,
        completionRate,
        callsLast7Days,
        dispositionBreakdown,
        agentStatusBreakdown,
        avgOverallRating,
        feedbackCount: feedback.length,
    });
});

module.exports = router;

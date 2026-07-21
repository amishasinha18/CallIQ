'use strict';

const express = require('express');
const authService = require('./authService');

const router = express.Router();

// One login for every account type — no role picker; the server figures out
// which role an email belongs to.
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }
    try {
        const result = await authService.login(email, password);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Customer self-signup only — admin/agent accounts are provisioned by an admin.
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email and password are required' });
    }
    try {
        const result = await authService.signupCustomer({ name, email, password });
        res.status(201).json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;

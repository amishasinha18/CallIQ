'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const repos = require('../db/repositories');

const REPO_BY_ROLE = {
    admin: repos.admins,
    agent: repos.agents,
    customer: repos.customers,
};

/**
 * Seed data ships with plaintext passwords (see db/README notes in the plan).
 * Accept either a bcrypt hash or a legacy plaintext match so the seeded
 * demo accounts keep working; anything written going forward is hashed.
 */
function verifyPassword(plain, stored) {
    if (typeof stored === 'string' && stored.startsWith('$2')) {
        return bcrypt.compareSync(plain, stored);
    }
    return plain === stored;
}

function hashPassword(plain) {
    return bcrypt.hashSync(plain, 10);
}

function issueToken(user, role) {
    return jwt.sign(
        { sub: user.id, role, email: user.email, name: user.name },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
    );
}

function sanitize(user) {
    const { password, ...rest } = user;
    return rest;
}

/**
 * No role picker on the frontend anymore — find the account by email across
 * all three tables (assumes unique email per account across the whole
 * platform, true today) and verify the password against whichever matches.
 */
async function login(email, password) {
    for (const [role, repo] of Object.entries(REPO_BY_ROLE)) {
        const user = await repo.findOne((u) => u.email.toLowerCase() === String(email).toLowerCase());
        if (user && verifyPassword(password, user.password)) {
            const token = issueToken(user, role);
            return { token, user: { ...sanitize(user), role } };
        }
    }
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
}

async function signupCustomer({ name, email, password }) {
    const existing = await repos.customers.findOne((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

    const user = await repos.customers.insert({
        id: `cust-${uuidv4()}`,
        name,
        email,
        password: hashPassword(password),
        role: 'customer',
        oauth_provider: null,
        created_at: new Date().toISOString(),
    });

    const token = issueToken(user, 'customer');
    return { token, user: sanitize(user) };
}

function verifyToken(token) {
    return jwt.verify(token, env.jwtSecret);
}

module.exports = {
    login,
    signupCustomer,
    verifyToken,
    hashPassword,
    sanitize,
};

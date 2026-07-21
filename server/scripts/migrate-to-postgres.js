'use strict';

/**
 * One-time cutover: reads the current db/*.json files and bulk-inserts them
 * into the Postgres schema (server/db/schema.sql — apply that first). Run
 * once against the Supabase DATABASE_URL, before the app itself switches
 * over to PgCollection-backed repositories.
 *
 * Truncates each table before inserting (not ON CONFLICT DO NOTHING) — this
 * is a one-time clean cutover to match the JSON snapshot exactly, safe to
 * re-run.
 *
 *   node scripts/migrate-to-postgres.js   (reads DATABASE_URL from server/.env)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_DIR = path.join(__dirname, '..', '..', 'db');

function readJson(...parts) {
    const raw = fs.readFileSync(path.join(DB_DIR, ...parts), 'utf-8');
    return raw.trim() ? JSON.parse(raw) : [];
}

// Same reasoning as pgCollection.js's serializeValue: `pg` sends a raw JS
// array as a Postgres ARRAY literal (e.g. `{}` for empty), not JSON text —
// and `{}` also happens to be valid JSON (an empty object), so an empty
// array silently becomes an empty object in a jsonb column unless stringified.
function serializeValue(v) {
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
}

async function insertAll(client, table, rows) {
    for (const row of rows) {
        const keys = Object.keys(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        await client.query(
            `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`,
            Object.values(row).map(serializeValue)
        );
    }
    console.log(`  ${table}: ${rows.length} row(s)`);
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }

    const admins = readJson('users', 'admins.json');
    const agents = readJson('users', 'agents.json');
    const customers = readJson('users', 'customers.json');
    const products = readJson('products', 'products.json');
    const agentAssignments = readJson('products', 'agent_assignments.json');
    const callLogs = readJson('calls', 'call_logs.json');
    const dispositions = readJson('calls', 'dispositions.json');
    const chats = readJson('chats', 'chats.json');
    const quotations = readJson('calls', 'quotations.json');
    const messages = readJson('chats', 'messages.json');
    const feedback = readJson('calls', 'feedback.json');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('Truncating tables...');
        await client.query(
            `TRUNCATE admins, agents, customers, products, agent_assignments, call_logs,
             dispositions, chats, quotations, messages, feedback RESTART IDENTITY CASCADE`
        );

        console.log('Inserting (dependency order)...');
        await insertAll(client, 'admins', admins);
        await insertAll(client, 'agents', agents);
        await insertAll(client, 'customers', customers);
        await insertAll(client, 'products', products);
        await insertAll(client, 'agent_assignments', agentAssignments);
        await insertAll(client, 'call_logs', callLogs);
        await insertAll(client, 'dispositions', dispositions);
        await insertAll(client, 'chats', chats);
        await insertAll(client, 'quotations', quotations);
        await insertAll(client, 'messages', messages);
        await insertAll(client, 'feedback', feedback);

        await client.query('COMMIT');
        console.log('Migration complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});

'use strict';

const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({ connectionString: env.databaseUrl, ssl: { rejectUnauthorized: false } });

/**
 * `pg`'s default parameter serialization sends a plain JS array as a Postgres
 * ARRAY literal (e.g. `{}` for an empty one), not JSON text — and `{}` is
 * itself valid JSON (an empty object), so an empty array silently becomes an
 * empty object once it lands in a jsonb column. Explicitly stringifying any
 * object/array value sends real JSON text instead, which Postgres coerces
 * into the target jsonb column correctly either way.
 */
function serializeValue(v) {
    return v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v;
}

/**
 * Drop-in replacement for JsonCollection's shape, backed by Postgres instead
 * of a JSON file — see jsonCollection.js's own doc comment, this is the
 * migration it always anticipated. `find`/`findOne`/`removeWhere` still take
 * arbitrary JS predicates (not translatable to a WHERE clause in general), so
 * they fetch the whole table via `all()` and filter/act in JS, matching the
 * old semantics exactly — fine at this app's scale. `findById`/`insert`/
 * `updateById`/`removeById` do real parameterized SQL.
 *
 * Every method here is async (real network I/O) where JsonCollection's were
 * synchronous — every call site needs `await` added, there's no way around
 * that part of this migration.
 */
class PgCollection {
    constructor(table) {
        this.table = table;
    }

    async all() {
        const { rows } = await pool.query(`SELECT * FROM ${this.table}`);
        return rows;
    }

    async find(predicate) {
        return (await this.all()).filter(predicate);
    }

    async findOne(predicate) {
        return (await this.all()).find(predicate) || null;
    }

    async findById(id) {
        const { rows } = await pool.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
        return rows[0] || null;
    }

    async insert(record) {
        const keys = Object.keys(record);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        const { rows } = await pool.query(
            `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
            Object.values(record).map(serializeValue)
        );
        return rows[0];
    }

    async updateById(id, patch) {
        const keys = Object.keys(patch);
        if (keys.length === 0) return this.findById(id);
        const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const { rows } = await pool.query(
            `UPDATE ${this.table} SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...Object.values(patch).map(serializeValue)]
        );
        return rows[0] || null;
    }

    async removeById(id) {
        const { rowCount } = await pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
        return rowCount > 0;
    }

    async removeWhere(predicate) {
        const matches = (await this.all()).filter(predicate);
        if (matches.length === 0) return 0;

        // agent_assignments has no own `id` column — composite key, delete pair-wise.
        if (this.table === 'agent_assignments') {
            let removed = 0;
            for (const m of matches) {
                const { rowCount } = await pool.query(
                    'DELETE FROM agent_assignments WHERE agent_id = $1 AND product_id = $2',
                    [m.agent_id, m.product_id]
                );
                removed += rowCount;
            }
            return removed;
        }

        const ids = matches.map((r) => r.id);
        const { rowCount } = await pool.query(`DELETE FROM ${this.table} WHERE id = ANY($1)`, [ids]);
        return rowCount;
    }
}

module.exports = { PgCollection, pool };

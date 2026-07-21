'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Minimal file-backed JSON array "collection".
 * Synchronous reads/writes keep every operation atomic relative to Node's
 * event loop (no async interleaving), which is all the safety this scale needs.
 * Swap this class out for a Prisma repository later without touching callers.
 */
class JsonCollection {
    constructor(filePath) {
        this.filePath = filePath;
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]\n');
        }
    }

    all() {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return raw.trim() ? JSON.parse(raw) : [];
    }

    _write(records) {
        fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2) + '\n');
    }

    find(predicate) {
        return this.all().filter(predicate);
    }

    findOne(predicate) {
        return this.all().find(predicate) || null;
    }

    findById(id) {
        return this.findOne((r) => r.id === id);
    }

    insert(record) {
        const records = this.all();
        records.push(record);
        this._write(records);
        return record;
    }

    updateById(id, patch) {
        const records = this.all();
        const idx = records.findIndex((r) => r.id === id);
        if (idx === -1) return null;
        records[idx] = { ...records[idx], ...patch };
        this._write(records);
        return records[idx];
    }

    removeById(id) {
        const records = this.all();
        const next = records.filter((r) => r.id !== id);
        this._write(next);
        return next.length !== records.length;
    }

    removeWhere(predicate) {
        const records = this.all();
        const next = records.filter((r) => !predicate(r));
        this._write(next);
        return records.length - next.length;
    }
}

module.exports = JsonCollection;

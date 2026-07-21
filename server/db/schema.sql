-- CallIQ Postgres schema (Supabase). Run once via the Supabase SQL editor
-- or `psql "$DATABASE_URL" -f server/db/schema.sql` before running
-- server/scripts/migrate-to-postgres.js.
--
-- Mirrors the 11 JSON "tables" in db/*.json exactly. IDs are app-generated
-- strings (e.g. "agent-1", "disp-<uuid>") — never SERIAL/gen_random_uuid().

CREATE TABLE admins (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    password     TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'admin',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agents (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password       TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'agent',
    status         TEXT NOT NULL DEFAULT 'offline', -- informational only; Redis is the live source of truth
    last_idle_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password        TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'customer',
    oauth_provider  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    price        DOUBLE PRECISION NOT NULL DEFAULT 0,
    image        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_assignments (
    agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, product_id)
);

CREATE TABLE call_logs (
    id                TEXT PRIMARY KEY,
    customer_id       TEXT NOT NULL REFERENCES customers(id),
    agent_id          TEXT REFERENCES agents(id), -- nullable: no_agent_available
    product_id        TEXT NOT NULL REFERENCES products(id),
    status            TEXT NOT NULL, -- completed|missed|declined|no_agent_available
    started_at        TIMESTAMPTZ NOT NULL,
    answered_at       TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ NOT NULL,
    duration_seconds  INTEGER NOT NULL DEFAULT 0,
    recording_path    TEXT,
    disposition_id    TEXT, -- FK added below, after dispositions exists
    ended_by          TEXT NOT NULL -- agent|admin|customer|system
);

CREATE TABLE dispositions (
    id           TEXT PRIMARY KEY,
    call_log_id  TEXT NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
    outcome      TEXT NOT NULL, -- Success|Failed|Callback Required
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DEFERRABLE: the migration script inserts call_logs before dispositions
-- (matching JSON file order), and the JSON snapshot already has
-- disposition_id populated on completed calls — deferring the check to
-- transaction commit (instead of per-statement) makes that insert order safe.
ALTER TABLE call_logs
    ADD CONSTRAINT call_logs_disposition_fk
    FOREIGN KEY (disposition_id) REFERENCES dispositions(id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE chats (
    id                TEXT PRIMARY KEY,
    customer_id       TEXT NOT NULL REFERENCES customers(id),
    customer_name     TEXT NOT NULL,
    product_id        TEXT NOT NULL REFERENCES products(id),
    product_name      TEXT NOT NULL,
    status            TEXT NOT NULL, -- PENDING|ASSIGNED|ACTIVE|CLOSED
    agent_id          TEXT REFERENCES agents(id),
    transfer_history  JSONB NOT NULL DEFAULT '[]',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_at       TIMESTAMPTZ,
    closed_at         TIMESTAMPTZ
);

CREATE TABLE quotations (
    id                   TEXT PRIMARY KEY,
    call_log_id          TEXT REFERENCES call_logs(id),
    chat_id              TEXT REFERENCES chats(id),
    agent_id             TEXT NOT NULL REFERENCES agents(id),
    customer_id          TEXT NOT NULL REFERENCES customers(id),
    customer_name        TEXT NOT NULL,
    product_id           TEXT NOT NULL REFERENCES products(id),
    product_name         TEXT NOT NULL,
    product_description  TEXT NOT NULL DEFAULT '',
    price                DOUBLE PRECISION NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent                 BOOLEAN NOT NULL DEFAULT false,
    sent_at              TIMESTAMPTZ,
    status               TEXT NOT NULL DEFAULT 'pending' -- pending|accepted|rejected
);

CREATE TABLE messages (
    id            TEXT PRIMARY KEY,
    chat_id       TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_role   TEXT NOT NULL, -- customer|agent
    sender_id     TEXT NOT NULL,
    sender_name   TEXT NOT NULL,
    text          TEXT NOT NULL,
    type          TEXT, -- 'quotation' when present
    quotation_id  TEXT REFERENCES quotations(id) DEFERRABLE INITIALLY DEFERRED,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
    id           TEXT PRIMARY KEY,
    call_log_id  TEXT NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
    customer_id  TEXT NOT NULL REFERENCES customers(id),
    agent_id     TEXT REFERENCES agents(id),
    ratings      JSONB NOT NULL,
    comment      TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes matching the actual predicate patterns used across the route files
CREATE INDEX idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX idx_call_logs_customer_id ON call_logs(customer_id);
CREATE INDEX idx_chats_agent_id ON chats(agent_id);
CREATE INDEX idx_chats_customer_id ON chats(customer_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_quotations_agent_id ON quotations(agent_id);
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_chat_id ON quotations(chat_id);
CREATE INDEX idx_feedback_call_log_id ON feedback(call_log_id);

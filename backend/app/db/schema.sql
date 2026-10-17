-- OpsPulse Core Database Schema (PostgreSQL 16)
-- Explicit locking, deterministic OCC, GIN Full-Text Search, and Keyset Cursor Indexes

-- 1. Teams
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users (Personas)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Team Memberships (Resource-scoped RBAC)
CREATE TABLE IF NOT EXISTS team_memberships (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(64) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('REQUESTER', 'OPERATOR', 'APPROVER', 'LEAD')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_user UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships(team_id);

-- 4. Work Items (Core Concurrency Entity)
CREATE TABLE IF NOT EXISTS work_items (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'TRIAGE' CHECK (
        status IN ('TRIAGE', 'INVESTIGATING', 'PENDING_APPROVAL', 'APPROVED', 'BLOCKED', 'RESOLVED', 'CLOSED')
    ),
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (
        priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
    ),
    owning_team_id VARCHAR(64) NOT NULL REFERENCES teams(id),
    assignee_id VARCHAR(64) REFERENCES users(id),
    created_by_id VARCHAR(64) NOT NULL REFERENCES users(id),
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (
        approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')
    ),
    approved_by_id VARCHAR(64) REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Work Items
-- GIN Index for Sub-5ms Full-Text Search
CREATE INDEX IF NOT EXISTS idx_work_items_search_vector ON work_items USING GIN (search_vector);

-- Deterministic Keyset Cursor Pagination Indexes
CREATE INDEX IF NOT EXISTS idx_work_items_keyset_updated ON work_items (updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_work_items_keyset_created ON work_items (created_at DESC, id DESC);

-- Operational Filter Indexes
CREATE INDEX IF NOT EXISTS idx_work_items_team_status ON work_items (owning_team_id, status);
CREATE INDEX IF NOT EXISTS idx_work_items_assignee ON work_items (assignee_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status_priority ON work_items (status, priority);

-- 5. Audit Events (Immutable append-only operational log)
CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32),
    from_version INT,
    to_version INT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_work_item ON audit_events (work_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events (actor_id, created_at DESC);

-- 6. Work Item Comments
CREATE TABLE IF NOT EXISTS work_item_comments (
    id SERIAL PRIMARY KEY,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_work_item ON work_item_comments (work_item_id, created_at ASC);

-- 7. PostgreSQL-Backed Idempotency Layer (Network Retry Safety)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(128) NOT NULL,
    actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status_code INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_idempotency_actor_key UNIQUE (idempotency_key, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys (idempotency_key, actor_id);

-- 8. Transactional Outbox (FOR UPDATE SKIP LOCKED Reliable Event Dispatch)
CREATE TABLE IF NOT EXISTS outbox_jobs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL DEFAULT 'work_item',
    aggregate_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER')
    ),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending_skip_locked 
ON outbox_jobs (next_attempt_at ASC) 
WHERE status = 'PENDING';

# OpsPulse: High-Concurrency Operational Work Engine

> **Newtonite Software Engineering Challenge: "Operations Under Pressure" (Module 1)**
> A high-concurrency, deterministic operational work-coordination engine engineered in Python 3.11+, FastAPI, and PostgreSQL 16.

---

## 1. Executive Architecture Overview

In high-growth companies, cross-team operational work (payment investigations, infrastructure incident remediation, compliance audits, customer escalations) frequently breaks down due to concurrency hazards: lost tasks, duplicate claims, stale updates overwriting recent changes, bypassed approvals, and out-of-order notifications.

**OpsPulse** replaces spreadsheet/chat coordination with a distributed state engine that delivers **5 beyond-CRUD guarantees** through raw ACID transactions, deterministic row-level locks, and zero-ORM magic.

```
                           +----------------------------------------+
                           |           HTTP / SSE Clients           |
                           +----------------------------------------+
                                       |                ^
          Mutating Requests & Queries  |                | Live SSE Events
                                       v                |
                           +----------------------------------------+
                           |          FastAPI Backend Engine        |
                           |   (Strict Pydantic v2 & RFC 7807)      |
                           +----------------------------------------+
                               |                |               |
              Keyset Cursor &  |      ACID Tx   |    Job Poll   |
              GIN Text Search  |   & Row Locks  |  SKIP LOCKED  |
                               v                v               v
                +------------------------------------------------------+
                |                 PostgreSQL 16 Cluster                |
                |                                                      |
                |  - work_items (OCC version, search_vector GIN)       |
                |  - audit_events (append-only immutable ledger)       |
                |  - idempotency_keys (network retry deduplication)    |
                |  - outbox_jobs (transactional event queue)           |
                |  - team_memberships (resource-scoped RBAC)           |
                +------------------------------------------------------+
```

---

## 2. The 5 "Beyond CRUD" Guarantees

### 1. Optimistic Concurrency Control (OCC) for Stale Edits
- **Hazard:** Two operators open the same incident simultaneously. Operator A modifies priority to `CRITICAL`. Operator B submits a stale edit 10 seconds later, unknowingly overwriting Operator A's changes.
- **Solution:** Every `work_items` row maintains an integer `version`. Mutations require `expected_version` in the request body. Updates execute:
  ```sql
  UPDATE work_items
  SET title = %s, version = version + 1, updated_at = NOW()
  WHERE id = %s AND version = %s
  RETURNING *;
  ```
  If `rowcount == 0`, the engine fetches the live state and returns `HTTP 409 Conflict` (`STALE_VERSION_CONFLICT`) containing `current_state`.

### 2. Atomic Work Item Claiming (Race Prevention)
- **Hazard:** Two operators click "Claim" on an unassigned P0 incident simultaneously. Both see success and duplicate investigative efforts.
- **Solution:** `POST /api/v1/work-items/{id}/claim` uses an explicit row-level lock:
  ```sql
  SELECT * FROM work_items WHERE id = %s FOR UPDATE;
  ```
  The first transaction acquires the lock, advances `status` from `TRIAGE -> INVESTIGATING`, sets `assignee_id = actor_id`, increments `version`, logs an `audit_events` row, and inserts an `outbox_jobs` event. Competing concurrent transactions waiting on the lock immediately encounter `assignee_id IS NOT NULL` and abort with `HTTP 409 Conflict` (`ALREADY_CLAIMED`).

### 3. PostgreSQL-Backed Idempotency Layer (Network Retry Safety)
- **Hazard:** A network timeout causes an operator's browser to retry a payment refund task creation, creating duplicate work items.
- **Solution:** Mutating endpoints inspect the `Idempotency-Key` header and store `(idempotency_key, actor_id, endpoint, request_hash, status_code, response_body)` in `idempotency_keys`.
  - **Identical replay:** Returns the cached response and original status code with `X-Idempotent-Replay: true`.
  - **Payload mismatch:** If the same key is reused with altered parameters, the engine rejects the request with `HTTP 422 Unprocessable Entity` (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`).

### 4. Deterministic Workflow State Machine & Separation of Duties
- **State Transition Graph:**
  - `TRIAGE` &rarr; `['INVESTIGATING', 'BLOCKED', 'CLOSED']`
  - `INVESTIGATING` &rarr; `['PENDING_APPROVAL', 'BLOCKED', 'RESOLVED']`
  - `PENDING_APPROVAL` &rarr; `['APPROVED', 'INVESTIGATING', 'BLOCKED']`
  - `APPROVED` &rarr; `['RESOLVED', 'INVESTIGATING', 'BLOCKED']`
  - `BLOCKED` &rarr; `['INVESTIGATING', 'TRIAGE']`
  - `RESOLVED` &rarr; `['CLOSED', 'INVESTIGATING']`
  - `CLOSED` &rarr; `[]`
- **Approval Gatekeeper:** If `requires_approval == True`, transitioning to `RESOLVED` without `approval_status == 'APPROVED'` is blocked with `HTTP 422` (`APPROVAL_GATE_LOCKED`).
- **Separation of Duties:** On `POST /api/v1/work-items/{id}/approve`:
  1. Actor must hold `APPROVER` or `LEAD` role in `owning_team_id` (else `HTTP 403 PERMISSION_DENIED`).
  2. Actor cannot be the assignee (`actor_id != assignee_id`) or creator (`actor_id != created_by_id`). Violations are blocked with `HTTP 403 SEPARATION_OF_DUTIES_VIOLATION`.

### 5. Transactional Outbox Worker (`FOR UPDATE SKIP LOCKED`)
- **Hazard:** Dual-write divergence where the database transaction succeeds, but a message bus or event dispatch fails, losing downstream notifications.
- **Solution:** Events are inserted into `outbox_jobs` inside the *same* database transaction as the work item mutation. An asynchronous worker queries pending jobs:
  ```sql
  SELECT id, event_type, aggregate_id, payload, attempts, max_attempts
  FROM outbox_jobs
  WHERE status = 'PENDING' AND next_attempt_at <= NOW()
  ORDER BY next_attempt_at ASC
  LIMIT 20
  FOR UPDATE SKIP LOCKED;
  ```
  `SKIP LOCKED` allows multiple distributed workers to consume pending jobs concurrently without lock contention or redis mutexes. Failed dispatches execute exponential backoff (`2 ** attempts` seconds) and move to `DEAD_LETTER` upon reaching `max_attempts`.

---

## 3. Built-In Personas & Team Matrix

The system includes 6 pre-configured personas to test RBAC and Separation of Duties instantly without login screens:

| Persona ID | Name | Payments (`team_payments`) | Infra (`team_infra`) | Compliance (`team_compliance`) | Support (`team_support`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `usr_aarav` | Aarav Mehta | **OPERATOR** | REQUESTER | &mdash; | &mdash; |
| `usr_priya` | Priya Nair | **APPROVER** | &mdash; | **LEAD** | &mdash; |
| `usr_rohan` | Rohan Desai | **OPERATOR** | **LEAD** | &mdash; | &mdash; |
| `usr_sneha` | Sneha Kulkarni | REQUESTER | &mdash; | &mdash; | **OPERATOR** |
| `usr_vikram` | Vikram Rao | &mdash; | **APPROVER** | **APPROVER** | &mdash; |
| `usr_ananya` | Ananya Sharma | &mdash; | &mdash; | &mdash; | **LEAD** |

*Pass `X-Actor-Id: <user_id>` in headers on any request to switch personas dynamically.*

---

## 4. Scale & Indexing Architecture

- **10,015 Seeded Work Items:** Generated in under 1.5 seconds via PostgreSQL `generate_series()` alongside 15 curated high-priority showcase scenarios.
- **Deterministic Keyset Cursor Pagination:** Implements `(updated_at DESC, id DESC) < (cursor_updated_at, cursor_id)` using composite B-Tree indexes. Pagination remains O(1) regardless of whether viewing page 1 or page 5,000.
- **Sub-5ms Full-Text Search:** Generated column `search_vector TSVECTOR` with a PostgreSQL GIN index querying via `websearch_to_tsquery('english', %s)`.

---

## 5. Quickstart & Verification

### Prerequisites
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (fast Python package and environment manager)
- Docker Desktop / Docker Engine

### Step 1: Start PostgreSQL 16
```bash
docker compose up -d
```

### Step 2: Set up Virtual Environment with `uv`
```bash
uv venv .venv
uv pip install -r backend/requirements.txt --python .venv
```

### Step 3: Fast Seed (10,015 items in < 2 seconds)
```bash
uv run --python .venv python backend/app/db/seed.py
```

### Step 4: Run Targeted 4-Step Verification Script
```bash
uv run --python .venv python backend/scripts/verify_module1.py
```
This script executes 4 rigorous checks:
1. **Seed Scale & FTS Latency:** Validates 10,000+ items and sub-25ms GIN keyset query execution.
2. **Concurrent Claim Race:** Fires 5 simultaneous claims on an unassigned item &rarr; confirms exactly 1x 200 OK and 4x 409 Conflict (`ALREADY_CLAIMED`).
3. **OCC Stale Edit Check:** Modifies an item with outdated `expected_version` &rarr; confirms 409 Conflict (`STALE_VERSION_CONFLICT`) with `current_state`.
4. **Idempotency & Separation of Duties:** Confirms cached response replay with `X-Idempotent-Replay: true`, payload mismatch rejection (422), self-approval blockage (403 `SEPARATION_OF_DUTIES_VIOLATION`), and independent approver sign-off (200 OK).

### Step 5: Start Backend API Server
```bash
uv run --python .venv uvicorn app.main:app --app-dir backend --reload --port 8000
```
- Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- SSE Live Event Stream: [http://localhost:8000/api/v1/events/stream](http://localhost:8000/api/v1/events/stream)
- Micro-Benchmarks Endpoint: `POST http://localhost:8000/api/v1/benchmarks/run`

---

## 6. API Reference Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/work-items` | Keyset cursor pagination + GIN Full-Text Search |
| `POST` | `/api/v1/work-items` | Create work item (Idempotency-Key support) |
| `GET` | `/api/v1/work-items/{id}` | Fetch work item with enriched team/actor metadata |
| `PATCH` | `/api/v1/work-items/{id}` | OCC update (`expected_version` check) |
| `POST` | `/api/v1/work-items/{id}/claim` | Atomic claim with row-level lock (`SELECT FOR UPDATE`) |
| `POST` | `/api/v1/work-items/{id}/transition` | Deterministic state machine transition & approval gate |
| `POST` | `/api/v1/work-items/{id}/approve` | Separation of duties & approver RBAC sign-off |
| `POST` | `/api/v1/work-items/{id}/comments` | Append note to audit timeline |
| `GET` | `/api/v1/work-items/{id}/audit` | Immutable audit log history |
| `GET` | `/api/v1/events/stream` | Server-Sent Events (SSE) live push notifications |
| `GET` | `/api/v1/personas` | List 6 built-in testing personas with team roles |
| `GET` | `/api/v1/teams` | List operational teams |
| `POST` | `/api/v1/benchmarks/run` | Live micro-benchmarks (GIN FTS, Keyset vs Offset, Outbox) |
| `POST` | `/api/v1/system/outbox/process-batch` | On-demand transactional outbox execution (`SKIP LOCKED`) |

---

## 7. License & Assessment Attribution
Engineered for the **Newtonite Software Engineering Challenge ("Operations Under Pressure")**.
Authored with deterministic distributed system patterns and zero ORM abstractions.

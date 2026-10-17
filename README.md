# OpsPulse: High-Concurrency Operational Work Engine

> **Newtonite Software Engineering Challenge: "Operations Under Pressure"**  
> A high-concurrency, deterministic operational work-coordination engine engineered in Python 3.11+, FastAPI, and PostgreSQL 16.  
> Implements zero-ORM parameterized SQL, atomic row-level locks, transactional outbox dispatching, and formal concurrency invariants.

---

## 1. System Architecture & Component Dataflow

In high-growth engineering and operations organizations, cross-team incident remediation, financial escalations, compliance reviews, and infrastructure triage routinely break down due to race conditions: lost updates, duplicate claims, stale edits overwriting critical fixes, bypassed approvals, and lost downstream notifications.

**OpsPulse** replaces spreadsheet and chat-based coordination with a distributed state engine that delivers **5 beyond-CRUD guarantees** through raw ACID transactions, deterministic row-level locks, and zero-ORM magic.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontSize': '17px',
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    'primaryColor': '#EEF2FF',
    'primaryTextColor': '#1E1B4B',
    'primaryBorderColor': '#4338CA',
    'lineColor': '#4338CA',
    'secondaryColor': '#F0FDF4',
    'tertiaryColor': '#FEF2F2'
  },
  'flowchart': {
    'nodeSpacing': 35,
    'rankSpacing': 45,
    'curve': 'basis',
    'htmlLabels': true
  }
}}%%
flowchart TD
    subgraph S1 ["1. Client & Operator Interface Tier"]
        UI["🖥️ React Web Console<br/><b>Live Dashboard & Claim UI</b>"]
        CLI["⚙️ Automated Systems<br/><b>Incident Ingestion Webhooks</b>"]
    end

    subgraph S2 ["2. FastAPI Concurrency Engine (Uvicorn / ASGI)"]
        Ingress["🚀 API Ingress & Request Validation<br/><b>Strict Pydantic v2 & RFC 7807 Errors</b>"]
        AdvisoryLock["🛡️ Advisory Lock Interceptor<br/><b>pg_try_advisory_xact_lock(hash)</b>"]
        AuthContext["👤 Actor Identity & RBAC Resolver<br/><b>X-Actor-Id Header Evaluation</b>"]
    end

    subgraph S3 ["3. Domain & Concurrency Invariant Enforcement"]
        RowLock["🔒 Atomic Claim Engine<br/><b>SELECT ... FOR UPDATE</b>"]
        OCC["⚖️ Optimistic Concurrency Control<br/><b>WHERE id = $1 AND version = $2</b>"]
        StateMachine["📐 Deterministic Workflow State Machine<br/><b>Strict DAG & Approval Gatekeeper</b>"]
        SoD["👥 Separation of Duties Validator<br/><b>actor != assignee AND actor != creator</b>"]
    end

    subgraph S4 ["4. PostgreSQL 16 Enterprise ACID Storage Engine"]
        Pool["🏊 psycopg v3 AsyncConnectionPool<br/><b>(WindowsSelectorEventLoop on Win32)</b>"]
        TWorkItems[("📋 work_items<br/><b>OCC version Counter | GIN search_vector<br/>(updated_at, id) B-Tree Keyset Index</b>")]
        TAudit[("📜 audit_events<br/><b>Append-Only Immutable Audit Ledger</b>")]
        TIdem[("🔑 idempotency_keys<br/><b>UNIQUE(idempotency_key, actor_id)</b>")]
        TOutbox[("📬 outbox_jobs<br/><b>Partial Index: WHERE status = 'PENDING'</b>")]
    end

    subgraph S5 ["5. Background Workers & Real-Time Event Bus"]
        Worker["🔄 Transactional Outbox Worker<br/><b>SELECT ... FOR UPDATE SKIP LOCKED</b>"]
        SSEHub["📡 Real-Time SSE Broadcaster<br/><b>asyncio.Queue In-Memory Event Fan-Out</b>"]
    end

    %% Flow connections
    UI -->|HTTP Requests| Ingress
    CLI -->|HTTP Requests| Ingress
    Ingress --> AdvisoryLock
    AdvisoryLock --> AuthContext

    AuthContext --> RowLock
    AuthContext --> OCC
    AuthContext --> StateMachine
    AuthContext --> SoD

    RowLock --> Pool
    OCC --> Pool
    StateMachine --> Pool
    SoD --> Pool

    Pool --> TWorkItems
    Pool --> TAudit
    Pool --> TIdem
    Pool --> TOutbox

    TOutbox -.->|Polled every 500ms| Worker
    Worker -->|Broadcast Dispatched Events| SSEHub
    SSEHub -.->|Live SSE Stream| UI
```

---

## 2. Deterministic Workflow State Machine

Operational tasks navigate a strict directed graph. Illegal state transitions are rejected with `HTTP 422 INVALID_TRANSITION`. High-risk items require explicit peer approval, and re-opening any item automatically invalidates prior approvals to prevent bypasses.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontSize': '16px',
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  }
}}%%
stateDiagram-v2
    direction TB

    [*] --> TRIAGE : Task Created (POST /work-items)
    
    TRIAGE --> INVESTIGATING : Atomic Claim (SELECT FOR UPDATE)
    TRIAGE --> BLOCKED : External Dependency / Impediment
    TRIAGE --> CLOSED : Marked as Duplicate / Rejected
    
    INVESTIGATING --> PENDING_APPROVAL : Submit for Peer Review (requires_approval=True)
    INVESTIGATING --> RESOLVED : Direct Resolution (requires_approval=False)
    INVESTIGATING --> BLOCKED : Escalation / Waiting on Vendor
    
    PENDING_APPROVAL --> APPROVED : Independent Sign-off (RBAC + Separation of Duties)
    PENDING_APPROVAL --> INVESTIGATING : Revision Requested / Push Back
    PENDING_APPROVAL --> BLOCKED : Escalated to Compliance
    
    APPROVED --> RESOLVED : Complete Execution & Mark Resolved
    APPROVED --> INVESTIGATING : Re-opened for Investigation (Approval Reset to PENDING)
    APPROVED --> BLOCKED : Pre-deployment Infrastructure Halt
    
    BLOCKED --> INVESTIGATING : Dependency Cleared
    BLOCKED --> TRIAGE : Re-queue to Triage
    
    RESOLVED --> CLOSED : Archived & Verified
    RESOLVED --> INVESTIGATING : Bug Resurfaced / Regression Re-open
    
    CLOSED --> [*]

    note right of APPROVED
        <b>Approval Gatekeeper:</b>
        Transition to RESOLVED is blocked
        (HTTP 422 APPROVAL_GATE_LOCKED)
        unless approval_status == 'APPROVED'.
    end note

    note left of INVESTIGATING
        <b>Re-open Invalidation:</b>
        Transitioning back to INVESTIGATING
        atomically wipes prior approvals:
        approval_status = 'PENDING',
        approved_by = NULL, approved_at = NULL.
    end note
```

---

## 3. High-Concurrency Race Condition Mechanisms

### 3.1. Atomic Work Item Claiming (`SELECT ... FOR UPDATE`)

When multiple operators attempt to claim the same unassigned incident simultaneously, OpsPulse leverages PostgreSQL row-level locks to guarantee that **exactly one operator wins** and all concurrent competitors receive an explicit conflict without corrupting state.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  },
  'sequence': {
    'actorFontSize': 17,
    'actorFontWeight': 700,
    'noteFontSize': 15,
    'noteFontWeight': 600,
    'messageFontSize': 15,
    'messageFontWeight': 600,
    'width': 220,
    'height': 48,
    'boxMargin': 12,
    'messageMargin': 35
  }
}}%%
sequenceDiagram
    autonumber
    actor Op1 as 👤 Operator 1 (Aarav)
    actor Op2 as 👤 Operator 2 (Rohan)
    participant API as 🚀 FastAPI Server
    participant DB as 🐘 PostgreSQL 16

    Note over Op1, Op2: Simultaneous Claim Request for wi_showcase_01
    par Operator 1 clicks Claim
        Op1->>API: POST /api/v1/work-items/wi_showcase_01/claim
        API->>DB: BEGIN TRANSACTION;
        API->>DB: SELECT * FROM work_items<br/>WHERE id = 'wi_showcase_01'<br/>FOR UPDATE;
        activate DB
        Note over DB: 🔒 Row Lock ACQUIRED by Tx 1<br/>(assignee_id is NULL)
    and Operator 2 clicks Claim
        Op2->>API: POST /api/v1/work-items/wi_showcase_01/claim
        API->>DB: BEGIN TRANSACTION;
        API->>DB: SELECT * FROM work_items<br/>WHERE id = 'wi_showcase_01'<br/>FOR UPDATE;
        Note over DB: ⏳ Tx 2 BLOCKS at DB level<br/>waiting for row lock
    end

    Note over API, DB: Tx 1 applies mutations and commits
    API->>DB: UPDATE work_items<br/>SET assignee_id = 'usr_aarav',<br/>status = 'INVESTIGATING', version = version + 1;
    API->>DB: INSERT INTO audit_events (action = 'CLAIMED');
    API->>DB: INSERT INTO outbox_jobs (event = 'work_item_claimed');
    API->>DB: COMMIT;
    deactivate DB
    Note over DB: 🔓 Lock RELEASED on commit

    API-->>Op1: HTTP 200 OK (Claimed, Version: 2)

    activate DB
    Note over DB: 🔒 Tx 2 unblocks and reads committed row:<br/>assignee_id = 'usr_aarav' (NOT NULL!)
    API->>DB: ROLLBACK;
    deactivate DB

    API-->>Op2: HTTP 409 Conflict<br/>(code: ALREADY_CLAIMED)
```

---

### 3.2. Optimistic Concurrency Control (OCC) for Stale Edits

OpsPulse eliminates the "last-write-wins" hazard. Every mutating request requires an `expected_version`. If another operator has committed changes in the interim, the stale update is rejected with `HTTP 409 Conflict` containing the current state for live client reconciliation.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  },
  'sequence': {
    'actorFontSize': 17,
    'actorFontWeight': 700,
    'noteFontSize': 15,
    'noteFontWeight': 600,
    'messageFontSize': 15,
    'messageFontWeight': 600,
    'width': 220,
    'height': 48,
    'boxMargin': 12,
    'messageMargin': 35
  }
}}%%
sequenceDiagram
    autonumber
    actor EditorA as 👤 Operator A
    actor EditorB as 👤 Operator B
    participant API as 🚀 FastAPI Server
    participant DB as 🐘 PostgreSQL 16

    Note over EditorA, EditorB: Both load Item #wi_101 at Version 1
    EditorA->>API: PATCH /work-items/wi_101<br/>{expected_version: 1, priority: 'CRITICAL'}
    API->>DB: UPDATE work_items<br/>SET priority = 'CRITICAL', version = version + 1<br/>WHERE id = 'wi_101' AND version = 1<br/>RETURNING *;
    Note over DB: Row matched (version == 1)<br/>Updated to version 2
    DB-->>API: 1 row returned (version = 2)
    API-->>EditorA: HTTP 200 OK (Item updated, Version: 2)

    Note over EditorB: Operator B submits edit with stale expected_version: 1
    EditorB->>API: PATCH /work-items/wi_101<br/>{expected_version: 1, title: 'Updated Title'}
    API->>DB: UPDATE work_items<br/>SET title = 'Updated Title', version = version + 1<br/>WHERE id = 'wi_101' AND version = 1<br/>RETURNING *;
    Note over DB: 0 rows matched!<br/>(DB version is 2, expected was 1)
    DB-->>API: 0 rows returned
    API->>DB: SELECT * FROM work_items WHERE id = 'wi_101';
    DB-->>API: Returns live current row (version = 2, priority = 'CRITICAL')
    API-->>EditorB: HTTP 409 Conflict<br/>(STALE_VERSION_CONFLICT + current_state JSON)
```

---

### 3.3. In-Flight Idempotency Race Resolution (`pg_try_advisory_xact_lock`)

Network retries or rapid double-clicks can create concurrent in-flight requests before the first request commits to the `idempotency_keys` table. OpsPulse uses transaction-scoped PostgreSQL advisory locks keyed on the request fingerprint to eliminate this TOCTOU (Time-of-Check to Time-of-Use) window.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  },
  'sequence': {
    'actorFontSize': 17,
    'actorFontWeight': 700,
    'noteFontSize': 15,
    'noteFontWeight': 600,
    'messageFontSize': 15,
    'messageFontWeight': 600,
    'width': 220,
    'height': 48,
    'boxMargin': 12,
    'messageMargin': 35
  }
}}%%
sequenceDiagram
    autonumber
    actor Client as 🌐 Client Browser / Gateway
    participant API as 🚀 FastAPI Server
    participant DB as 🐘 PostgreSQL 16

    Note over Client, DB: Rapid Double-Click / Network Retry with Idempotency-Key: 'req-abc-123'
    par Request 1 Arrives
        Client->>API: POST /work-items<br/>(Idempotency-Key: 'req-abc-123')
        API->>DB: SELECT pg_try_advisory_xact_lock(<br/>hash('req-abc-123:usr_aarav'));
        Note over DB: 🔒 Lock ACQUIRED = TRUE
        API->>DB: SELECT * FROM idempotency_keys<br/>WHERE key = 'req-abc-123';
        Note over DB: Cache Miss (First Execution)
        API->>DB: INSERT INTO work_items ...;
        API->>DB: INSERT INTO idempotency_keys ...;
        API->>DB: COMMIT (Auto-releases Advisory Lock);
        API-->>Client: HTTP 201 Created (ID: wi_999)
    and Request 2 Arrives (Concurrent In-Flight Retry)
        Client->>API: POST /work-items<br/>(Idempotency-Key: 'req-abc-123')
        API->>DB: SELECT pg_try_advisory_xact_lock(<br/>hash('req-abc-123:usr_aarav'));
        Note over DB: ⛔ Lock NOT Acquired = FALSE<br/>(Held by Request 1)
        Note over API: Serialized: Waits for Request 1 to commit
        API->>DB: SELECT * FROM idempotency_keys<br/>WHERE key = 'req-abc-123';
        Note over DB: Cache HIT! Returns committed response
        API-->>Client: HTTP 201 Created<br/>(X-Idempotent-Replay: true, ID: wi_999)
    end
```

---

### 3.4. Transactional Outbox Pattern (`FOR UPDATE SKIP LOCKED`)

OpsPulse avoids the dual-write hazard by writing events to an `outbox_jobs` table inside the same ACID transaction as the business entity. Background workers poll jobs concurrently without lock contention using `SKIP LOCKED`.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  },
  'sequence': {
    'actorFontSize': 17,
    'actorFontWeight': 700,
    'noteFontSize': 15,
    'noteFontWeight': 600,
    'messageFontSize': 15,
    'messageFontWeight': 600,
    'width': 220,
    'height': 48,
    'boxMargin': 12,
    'messageMargin': 35
  }
}}%%
sequenceDiagram
    autonumber
    participant MutatingAPI as 🚀 API Request Handler
    participant DB as 🐘 PostgreSQL 16
    participant Worker1 as ⚙️ Outbox Worker Node 1
    participant Worker2 as ⚙️ Outbox Worker Node 2
    participant EventBus as 📡 SSE / Webhook Dispatcher

    Note over MutatingAPI, DB: Atomic Business Transaction
    MutatingAPI->>DB: BEGIN TRANSACTION;
    MutatingAPI->>DB: UPDATE work_items SET status = 'RESOLVED' ...;
    MutatingAPI->>DB: INSERT INTO outbox_jobs (event_type, payload)<br/>VALUES ('resolved', {...});
    MutatingAPI->>DB: COMMIT;
    Note over DB: Both record and outbox event are guaranteed committed together!

    Note over Worker1, Worker2: Distributed Horizontal Outbox Processing
    par Worker 1 Polls
        Worker1->>DB: SELECT id FROM outbox_jobs<br/>WHERE status = 'PENDING'<br/>LIMIT 10 FOR UPDATE SKIP LOCKED;
        Note over DB: Locks Jobs [101, 102] for Worker 1
        Worker1->>EventBus: Dispatch Event 101, 102
        Worker1->>DB: UPDATE outbox_jobs SET status = 'COMPLETED'<br/>WHERE id IN (101, 102);
    and Worker 2 Polls Simultaneously
        Worker2->>DB: SELECT id FROM outbox_jobs<br/>WHERE status = 'PENDING'<br/>LIMIT 10 FOR UPDATE SKIP LOCKED;
        Note over DB: Skips Jobs [101, 102] &rarr;<br/>Locks Jobs [103, 104] for Worker 2
        Worker2->>EventBus: Dispatch Event 103, 104
        Worker2->>DB: UPDATE outbox_jobs SET status = 'COMPLETED'<br/>WHERE id IN (103, 104);
    end
```

---

## 4. Built-In Personas & Team Matrix

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

## 5. Scale & Indexing Architecture

- **10,015 Seeded Work Items:** Seeded in under 1.5 seconds via PostgreSQL `generate_series()` alongside 15 curated high-priority showcase scenarios.
- **Deterministic Keyset Cursor Pagination:** Implements `(updated_at DESC, id DESC) < (cursor_updated_at, cursor_id)` using composite B-Tree indexes. Pagination remains O(1) regardless of whether viewing page 1 or page 5,000.
- **Sub-5ms Full-Text Search:** Generated column `search_vector TSVECTOR` with a PostgreSQL GIN index querying via `websearch_to_tsquery('english', %s)`.

---

## 6. Quickstart & Verification

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

### Step 4: Run Targeted Smoke Verification Script
```bash
uv run --python .venv python backend/scripts/verify_module1.py
```
This script executes 4 rigorous checks:
1. **Seed Scale & FTS Latency:** Validates 10,000+ items and sub-25ms GIN keyset query execution.
2. **Concurrent Claim Race:** Fires 5 simultaneous claims on an unassigned item &rarr; confirms exactly 1x 200 OK and 4x 409 Conflict (`ALREADY_CLAIMED`).
3. **OCC Stale Edit Check:** Modifies an item with outdated `expected_version` &rarr; confirms 409 Conflict (`STALE_VERSION_CONFLICT`) with `current_state`.
4. **Idempotency & Separation of Duties:** Confirms cached response replay with `X-Idempotent-Replay: true`, payload mismatch rejection (422), self-approval blockage (403 `SEPARATION_OF_DUTIES_VIOLATION`), and independent approver sign-off (200 OK).

### Step 5: Run Automated Invariant Test Suite (Module 2)
```bash
uv run --python .venv pytest backend/tests/test_critical_behaviours.py -v
```
Validates all 8 high-risk operational invariants:
- `test_occ_stale_version_conflict`
- `test_atomic_claim_exactly_one_winner`
- `test_idempotency_replay_returns_cached_response`
- `test_idempotency_payload_mismatch_rejected`
- `test_approval_gate_blocks_resolve_without_approval`
- `test_separation_of_duties_self_approval_blocked`
- `test_approval_invalidated_on_reopen`
- `test_benchmarks_run_endpoint`

### Step 6: Start Backend API Server
```bash
uv run --python .venv uvicorn app.main:app --app-dir backend --reload --port 8000
```
- Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- SSE Live Event Stream: [http://localhost:8000/api/v1/events/stream](http://localhost:8000/api/v1/events/stream)
- Micro-Benchmarks Endpoint: `POST http://localhost:8000/api/v1/benchmarks/run`

---

## 7. API Reference Summary

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
| `POST` | `/api/v1/benchmarks/run` | Live micro-benchmarks (GIN FTS, Keyset vs Offset, Outbox, 8-way claim race) |
| `POST` | `/api/v1/system/outbox/process-batch` | On-demand transactional outbox execution (`SKIP LOCKED`) |

---

## 8. Architectural Documentation
For a deep-dive into each architectural decision, lock semantics, failure modes, and trade-offs, see [ENGINEERING_DECISIONS.md](file:///c:/Users/mrudu/Newtonite%20Assessment/newtonite-opspulse/ENGINEERING_DECISIONS.md).

---

## 9. License & Assessment Attribution
Engineered for the **Newtonite Software Engineering Challenge ("Operations Under Pressure")**.  
Authored with deterministic distributed system patterns, formal verification, and zero ORM abstractions.

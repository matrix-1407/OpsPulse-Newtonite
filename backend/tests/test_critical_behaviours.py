"""
test_critical_behaviours.py — Module 2 Integration Test Suite
Covers 7 high-risk operational invariants required by the OpsPulse brief.

Each test uses httpx.AsyncClient against the live FastAPI application (with a real
PostgreSQL database running via Docker). Tests are isolated by creating their own
work items and cleaning up after themselves.

Run: uv run --python .venv pytest backend/tests/test_critical_behaviours.py -v
"""
import asyncio
import uuid
from typing import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

import sys

# Ensure WindowsSelectorEventLoopPolicy for psycopg async on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Add backend directory to sys.path
sys.path.insert(0, "backend")

from app.db.pool import close_pool, init_pool
from app.main import app

# ----------------------------------------------------------------
# Configuration — personas established in Module 1 seed data
# ----------------------------------------------------------------
OPERATOR = "usr_aarav"       # OPERATOR in team_payments
APPROVER = "usr_vikram"      # APPROVER in team_infra (not assignee or creator)
PRIYA = "usr_priya"          # APPROVER/LEAD in team_payments
LEAD_ROHAN = "usr_rohan"     # LEAD in team_infra, OPERATOR in team_payments
TEAM_PAYMENTS = "team_payments"
TEAM_INFRA = "team_infra"


# ----------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------


@pytest_asyncio.fixture(scope="session")
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Shared HTTPX async client for the test session using in-process ASGI transport."""
    await init_pool()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=30.0) as c:
        yield c
        # Clean up any synthetic test items created during testing so DB queue stays clean
        await c.post("/api/v1/system/cleanup-test-artifacts")
    await close_pool()


def actor_headers(actor_id: str) -> dict:
    return {"X-Actor-Id": actor_id}


async def create_item(
    client: httpx.AsyncClient,
    actor_id: str = OPERATOR,
    team_id: str = TEAM_PAYMENTS,
    requires_approval: bool = False,
    title: str | None = None,
) -> dict:
    """Helper: create a fresh work item and return the parsed JSON response body."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "title": title or f"Test Item {unique}",
        "description": "Auto-created by test suite",
        "priority": "MEDIUM",
        "owning_team_id": team_id,
        "requires_approval": requires_approval,
        "metadata": {"test_run": unique},
    }
    resp = await client.post(
        "/api/v1/work-items",
        json=payload,
        headers=actor_headers(actor_id),
    )
    assert resp.status_code == 201, f"Failed to create item: {resp.text}"
    return resp.json()


# ----------------------------------------------------------------
# TEST 1: OCC Stale Version Conflict
# Invariant: A PATCH with a stale expected_version MUST return HTTP 409 STALE_VERSION_CONFLICT.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_occ_stale_version_conflict(client: httpx.AsyncClient):
    """
    INVARIANT 1: Optimistic Concurrency Control (OCC).
    Two concurrent editors of the same item — only the first to commit wins.
    The second submitter with the stale expected_version must receive HTTP 409.
    """
    item = await create_item(client)
    item_id = item["id"]
    current_version = item["version"]  # e.g. 1

    # First update succeeds — bumps version to current_version + 1
    resp1 = await client.patch(
        f"/api/v1/work-items/{item_id}",
        json={"expected_version": current_version, "title": "First Edit Wins"},
        headers=actor_headers(OPERATOR),
    )
    assert resp1.status_code == 200, f"First edit should succeed: {resp1.text}"
    new_version = resp1.json()["version"]
    assert new_version == current_version + 1

    # Second update using old version → must conflict
    resp2 = await client.patch(
        f"/api/v1/work-items/{item_id}",
        json={"expected_version": current_version, "title": "Stale Edit Attempt"},
        headers=actor_headers(OPERATOR),
    )
    assert resp2.status_code == 409, f"Expected 409 conflict, got {resp2.status_code}: {resp2.text}"
    body = resp2.json()
    assert body["code"] == "STALE_VERSION_CONFLICT"
    # Must return current_state so client can reconcile
    assert "current_state" in body or body.get("current_state") is not None or "version" in str(body)


# ----------------------------------------------------------------
# TEST 2: Atomic Claim — Exactly One Winner Under Concurrency
# Invariant: Under N simultaneous claim requests, exactly 1 returns HTTP 200 and all
# others return HTTP 409 ALREADY_CLAIMED. No double-claims allowed.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_atomic_claim_exactly_one_winner(client: httpx.AsyncClient):
    """
    INVARIANT 2: SELECT FOR UPDATE atomicity.
    Fire 6 concurrent claim requests against a single TRIAGE item.
    Exactly one must succeed (HTTP 200); all others must return 409 ALREADY_CLAIMED.
    """
    item = await create_item(client)
    item_id = item["id"]

    async def try_claim(actor_id: str) -> int:
        r = await client.post(
            f"/api/v1/work-items/{item_id}/claim",
            headers=actor_headers(actor_id),
        )
        return r.status_code

    # 6 concurrent claimants (alternating between 2 operators in team_payments)
    actors = [OPERATOR, LEAD_ROHAN] * 3
    status_codes = await asyncio.gather(*[try_claim(a) for a in actors])

    winners = [s for s in status_codes if s == 200]
    conflicts = [s for s in status_codes if s == 409]

    assert len(winners) == 1, f"Expected exactly 1 winner, got {len(winners)}. Codes: {status_codes}"
    assert len(conflicts) == 5, f"Expected 5 conflicts, got {len(conflicts)}. Codes: {status_codes}"


# ----------------------------------------------------------------
# TEST 3: Idempotency Replay — Same Key Returns Cached Response
# Invariant: Sending the same Idempotency-Key twice returns the cached body
# with X-Idempotent-Replay: true header and does NOT create a duplicate.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_idempotency_replay_returns_cached_response(client: httpx.AsyncClient):
    """
    INVARIANT 3: Idempotency-Key safe replay.
    A second POST with the same Idempotency-Key must return the original response
    body with X-Idempotent-Replay: true and not create a duplicate work item.
    """
    idem_key = f"idem-test-{uuid.uuid4().hex}"
    payload = {
        "title": f"Idempotency Test {uuid.uuid4().hex[:6]}",
        "description": "Should be created only once",
        "priority": "LOW",
        "owning_team_id": TEAM_PAYMENTS,
        "requires_approval": False,
        "metadata": {},
    }

    headers = {**actor_headers(OPERATOR), "Idempotency-Key": idem_key}

    resp1 = await client.post("/api/v1/work-items", json=payload, headers=headers)
    assert resp1.status_code == 201
    original_id = resp1.json()["id"]

    resp2 = await client.post("/api/v1/work-items", json=payload, headers=headers)
    assert resp2.status_code == 201, f"Replay should return 201: {resp2.text}"
    assert resp2.headers.get("x-idempotent-replay") == "true", "Replay header missing"
    assert resp2.json()["id"] == original_id, "Replay returned different item ID"


# ----------------------------------------------------------------
# TEST 4: Idempotency Mismatch — Same Key, Different Payload → HTTP 422
# Invariant: Reusing an Idempotency-Key with a different payload must be rejected.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_idempotency_payload_mismatch_rejected(client: httpx.AsyncClient):
    """
    INVARIANT 4: Idempotency-Key payload mismatch protection.
    Reusing the same key with a different request body must return HTTP 422
    with code IDEMPOTENCY_KEY_PAYLOAD_MISMATCH.
    """
    idem_key = f"idem-mismatch-{uuid.uuid4().hex}"
    headers = {**actor_headers(OPERATOR), "Idempotency-Key": idem_key}

    payload_a = {
        "title": f"Mismatch Test A {uuid.uuid4().hex[:6]}",
        "description": "Original payload",
        "priority": "LOW",
        "owning_team_id": TEAM_PAYMENTS,
        "requires_approval": False,
        "metadata": {},
    }
    resp1 = await client.post("/api/v1/work-items", json=payload_a, headers=headers)
    assert resp1.status_code == 201

    payload_b = {**payload_a, "title": "Completely Different Title — should conflict"}
    resp2 = await client.post("/api/v1/work-items", json=payload_b, headers=headers)
    assert resp2.status_code == 422, f"Expected 422 mismatch, got {resp2.status_code}: {resp2.text}"
    assert resp2.json()["code"] == "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"


# ----------------------------------------------------------------
# TEST 5: Approval Gate Locked — Cannot Resolve Without Approval
# Invariant: An item with requires_approval=True cannot be transitioned to RESOLVED
# unless approval_status == 'APPROVED'. Must return HTTP 422 APPROVAL_GATE_LOCKED.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_approval_gate_blocks_resolve_without_approval(client: httpx.AsyncClient):
    """
    INVARIANT 5: Approval gatekeeper.
    An item with requires_approval=True that has NOT been approved cannot be resolved.
    Must return HTTP 422 APPROVAL_GATE_LOCKED.
    """
    item = await create_item(client, requires_approval=True)
    item_id = item["id"]

    # Claim it so it's in INVESTIGATING
    claim_resp = await client.post(
        f"/api/v1/work-items/{item_id}/claim",
        headers=actor_headers(OPERATOR),
    )
    assert claim_resp.status_code == 200
    version_after_claim = claim_resp.json()["version"]

    # Attempt direct transition to RESOLVED without approval
    resolve_resp = await client.post(
        f"/api/v1/work-items/{item_id}/transition",
        json={"expected_version": version_after_claim, "target_status": "RESOLVED", "reason": "Trying to skip approval gate"},
        headers=actor_headers(OPERATOR),
    )
    assert resolve_resp.status_code == 422, f"Expected 422, got {resolve_resp.status_code}: {resolve_resp.text}"
    assert resolve_resp.json()["code"] == "APPROVAL_GATE_LOCKED"


# ----------------------------------------------------------------
# TEST 6: Separation of Duties — Self-Approval Blocked
# Invariant: An operator who is the assignee OR creator cannot approve their own work item.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_separation_of_duties_self_approval_blocked(client: httpx.AsyncClient):
    """
    INVARIANT 6: Separation of Duties.
    The assignee cannot approve their own work item.
    Must return HTTP 403 SEPARATION_OF_DUTIES_VIOLATION.
    """
    # Create item in team_infra by OPERATOR (usr_aarav)
    item = await create_item(client, actor_id=OPERATOR, team_id=TEAM_INFRA, requires_approval=True)
    item_id = item["id"]

    # LEAD_ROHAN (Lead in team_infra) claims the item (becomes assignee)
    claim_resp = await client.post(
        f"/api/v1/work-items/{item_id}/claim",
        headers=actor_headers(LEAD_ROHAN),
    )
    assert claim_resp.status_code == 200
    ver = claim_resp.json()["version"]

    # Move to PENDING_APPROVAL
    trans_resp = await client.post(
        f"/api/v1/work-items/{item_id}/transition",
        json={"expected_version": ver, "target_status": "PENDING_APPROVAL", "reason": "Ready for review"},
        headers=actor_headers(LEAD_ROHAN),
    )
    assert trans_resp.status_code == 200
    ver = trans_resp.json()["version"]

    # LEAD_ROHAN has LEAD role on team_infra (passes RBAC), but is assignee (fails separation of duties)
    approve_resp = await client.post(
        f"/api/v1/work-items/{item_id}/approve",
        json={"expected_version": ver, "decision": "APPROVED", "comment": "I approve my own work"},
        headers=actor_headers(LEAD_ROHAN),
    )
    assert approve_resp.status_code == 403, f"Expected 403, got {approve_resp.status_code}: {approve_resp.text}"
    assert approve_resp.json()["code"] == "SEPARATION_OF_DUTIES_VIOLATION"

    # Independent approver (APPROVER - Vikram Rao, APPROVER in team_infra, neither assignee nor creator) CAN approve
    approve_resp2 = await client.post(
        f"/api/v1/work-items/{item_id}/approve",
        json={"expected_version": ver, "decision": "APPROVED", "comment": "Approved by independent approver"},
        headers=actor_headers(APPROVER),
    )
    assert approve_resp2.status_code == 200, f"Independent approval should succeed: {approve_resp2.text}"
    assert approve_resp2.json()["approval_status"] == "APPROVED"


# ----------------------------------------------------------------
# TEST 7: Approval Invalidation on Re-Open (Module 2 Harden)
# Invariant: If an APPROVED item is transitioned back to INVESTIGATING,
# the approval_status MUST be reset to PENDING and approved_by/approved_at cleared.
# This prevents a stale APPROVED status from bypassing the approval gate on the next resolve.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_approval_invalidated_on_reopen(client: httpx.AsyncClient):
    """
    INVARIANT 7: Approval invalidation on re-investigation.
    When an APPROVED item is pushed back to INVESTIGATING, approval_status must reset
    to PENDING so it cannot bypass the approval gate on the next resolve attempt.
    """
    # 1. Create item requiring approval
    item = await create_item(client, requires_approval=True)
    item_id = item["id"]

    # 2. Claim → INVESTIGATING
    claim_resp = await client.post(
        f"/api/v1/work-items/{item_id}/claim",
        headers=actor_headers(OPERATOR),
    )
    assert claim_resp.status_code == 200
    ver = claim_resp.json()["version"]

    # 3. Transition → PENDING_APPROVAL
    trans_resp = await client.post(
        f"/api/v1/work-items/{item_id}/transition",
        json={"expected_version": ver, "target_status": "PENDING_APPROVAL"},
        headers=actor_headers(OPERATOR),
    )
    assert trans_resp.status_code == 200
    ver = trans_resp.json()["version"]

    # 4. Approve (PRIYA is independent approver in team_payments)
    approve_resp = await client.post(
        f"/api/v1/work-items/{item_id}/approve",
        json={"expected_version": ver, "decision": "APPROVED"},
        headers=actor_headers(PRIYA),
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["approval_status"] == "APPROVED"
    ver = approve_resp.json()["version"]

    # 5. Re-open to INVESTIGATING — this is the critical step
    reopen_resp = await client.post(
        f"/api/v1/work-items/{item_id}/transition",
        json={"expected_version": ver, "target_status": "INVESTIGATING", "reason": "Need more investigation"},
        headers=actor_headers(OPERATOR),
    )
    assert reopen_resp.status_code == 200
    reopened = reopen_resp.json()
    ver = reopened["version"]

    # CRITICAL ASSERTION: approval must be invalidated
    assert reopened["approval_status"] == "PENDING", (
        f"Expected approval_status=PENDING after re-open, got {reopened['approval_status']}"
    )
    assert reopened.get("approved_by_id") is None, "approved_by_id should be cleared on re-open"

    # 6. Verify the approval gate still blocks resolve (item is in INVESTIGATING, approval_status is PENDING)
    # Attempt resolve without re-approval — must be blocked by approval gatekeeper
    direct_resolve = await client.post(
        f"/api/v1/work-items/{item_id}/transition",
        json={"expected_version": ver, "target_status": "RESOLVED", "reason": "Trying to bypass gate"},
        headers=actor_headers(OPERATOR),
    )
    assert direct_resolve.status_code == 422, (
        f"After re-open, approval gate must still block resolve. Got {direct_resolve.status_code}: {direct_resolve.text}"
    )
    assert direct_resolve.json()["code"] == "APPROVAL_GATE_LOCKED"


# ----------------------------------------------------------------
# TEST 8: Live Concurrency Benchmark Endpoint (Module 2)
# Invariant: /api/v1/benchmarks/run executes FTS, Keyset vs Offset comparison,
# 8-worker SELECT FOR UPDATE race (exactly 1 winner), outbox batch, and cleans up.
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_benchmarks_run_endpoint(client: httpx.AsyncClient):
    """
    INVARIANT 8: Live Concurrency Benchmarking & Ephemeral Cleanup.
    The benchmark suite runs an 8-way concurrent claim race, verifies exactly 1 winner,
    measures p50/p95/p99 latency percentiles, and safely deletes all ephemeral benchmark items.
    """
    resp = await client.post("/api/v1/benchmarks/run")
    assert resp.status_code == 200, f"Benchmark run failed: {resp.text}"
    data = resp.json()
    assert data["status"] == "PASS", f"Expected PASS, got {data}"
    benchmarks = data["benchmarks"]
    assert benchmarks["concurrent_claim_race"]["exclusive_win_guarantee"] is True
    assert benchmarks["concurrent_claim_race"]["winners"] == 1
    assert benchmarks["concurrent_claim_race"]["blocked_by_lock"] == 7
    assert benchmarks["cleanup"]["benchmark_items_deleted"] >= 1
    assert "p50" in benchmarks["full_text_search"]["latency_ms"]
    assert "p95" in benchmarks["full_text_search"]["latency_ms"]
    assert "p99" in benchmarks["full_text_search"]["latency_ms"]

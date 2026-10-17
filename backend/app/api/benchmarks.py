"""
Production Benchmark Endpoint — Module 2.
Runs live micro-benchmarks and a real concurrency stress test against the live database.
Returns p50/p95/p99 latency percentiles and race-condition outcome metrics.
"""
import asyncio
import json
import statistics
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from app.db.pool import get_db_connection, get_db_cursor
from app.domain.models import OutboxProcessResult
from app.services.outbox_worker import process_outbox_batch
from app.services.work_item_service import delete_benchmark_work_items

router = APIRouter(prefix="/api/v1", tags=["Benchmarks & System Operations"])

BENCHMARK_TAG = "benchmark_load_test"


def _percentile(sorted_data: List[float], pct: float) -> float:
    """Compute a percentile from a sorted list. Uses linear interpolation (nearest-rank)."""
    if not sorted_data:
        return 0.0
    n = len(sorted_data)
    idx = (pct / 100.0) * (n - 1)
    lower = int(idx)
    upper = min(lower + 1, n - 1)
    frac = idx - lower
    return round(sorted_data[lower] * (1 - frac) + sorted_data[upper] * frac, 3)


@router.post("/benchmarks/run")
async def run_live_micro_benchmarks() -> Dict[str, Any]:
    """
    Production benchmark suite running live against the 10,000-item dataset.
    Sections:
      1. GIN Full-Text Search latency (p50/p95/p99 over 20 iterations).
      2. Keyset Cursor vs Offset Pagination latency comparison at deep offset.
      3. Concurrent Claim Race (SELECT FOR UPDATE): 8 goroutines, 1 winner expected.
      4. Transactional Outbox SKIP LOCKED batch efficiency.
    All benchmark work items created during section 3 are cleaned up before returning.
    """
    results: Dict[str, Any] = {}

    # ----------------------------------------------------------------
    # 1. GIN Full-Text Search Benchmark — repeated 20x for stable percentiles
    # ----------------------------------------------------------------
    fts_queries = [
        "latency spike payment",
        "critical infra outage",
        "compliance audit failure",
        "database connection pool",
        "memory leak node service",
    ]
    fts_latencies: List[float] = []

    async with get_db_cursor(commit=False) as cur:
        for i in range(20):
            q = fts_queries[i % len(fts_queries)]
            t0 = time.perf_counter()
            await cur.execute(
                """
                SELECT id, title, ts_rank_cd(search_vector, websearch_to_tsquery('english', %s)) AS rank
                FROM work_items
                WHERE search_vector @@ websearch_to_tsquery('english', %s)
                ORDER BY rank DESC, updated_at DESC
                LIMIT 50;
                """,
                (q, q),
            )
            await cur.fetchall()
            fts_latencies.append((time.perf_counter() - t0) * 1000.0)

    fts_sorted = sorted(fts_latencies)
    results["full_text_search"] = {
        "iterations": 20,
        "query_samples": fts_queries,
        "latency_ms": {
            "p50": _percentile(fts_sorted, 50),
            "p95": _percentile(fts_sorted, 95),
            "p99": _percentile(fts_sorted, 99),
            "min": round(min(fts_latencies), 3),
            "max": round(max(fts_latencies), 3),
            "mean": round(statistics.mean(fts_latencies), 3),
        },
        "p99_guarantee_met": _percentile(fts_sorted, 99) < 25.0,
        "guarantee": "p99 < 25ms over GIN index on 10k+ items",
    }

    # ----------------------------------------------------------------
    # 2. Keyset Cursor vs High-Offset Pagination Benchmark
    # ----------------------------------------------------------------
    async with get_db_cursor(commit=False) as cur:
        offset_latencies: List[float] = []
        keyset_latencies: List[float] = []

        for _ in range(10):
            # High-offset scan (OFFSET 5000)
            t0 = time.perf_counter()
            await cur.execute(
                """
                SELECT id, title, updated_at
                FROM work_items
                ORDER BY updated_at DESC, id DESC
                OFFSET 5000 LIMIT 50;
                """
            )
            offset_rows = await cur.fetchall()
            offset_latencies.append((time.perf_counter() - t0) * 1000.0)

            # Keyset cursor targeting equivalent depth
            if offset_rows:
                target_updated_at = offset_rows[0]["updated_at"]
                target_id = offset_rows[0]["id"]
                t0 = time.perf_counter()
                await cur.execute(
                    """
                    SELECT id, title, updated_at
                    FROM work_items
                    WHERE (updated_at, id) <= (%s, %s)
                    ORDER BY updated_at DESC, id DESC
                    LIMIT 50;
                    """,
                    (target_updated_at, target_id),
                )
                await cur.fetchall()
                keyset_latencies.append((time.perf_counter() - t0) * 1000.0)

        offset_sorted = sorted(offset_latencies)
        keyset_sorted = sorted(keyset_latencies)

    results["pagination_benchmark"] = {
        "iterations": 10,
        "offset_5000": {
            "p50_ms": _percentile(offset_sorted, 50),
            "p95_ms": _percentile(offset_sorted, 95),
            "p99_ms": _percentile(offset_sorted, 99),
        },
        "keyset_cursor": {
            "p50_ms": _percentile(keyset_sorted, 50),
            "p95_ms": _percentile(keyset_sorted, 95),
            "p99_ms": _percentile(keyset_sorted, 99),
        },
        "speedup_factor_p50": (
            f"{round(_percentile(offset_sorted, 50) / max(_percentile(keyset_sorted, 50), 0.01), 1)}x faster"
            if keyset_latencies else "N/A"
        ),
        "advantage": "Keyset cursor uses O(1) B-Tree index seek; OFFSET requires sequential scan through N rows.",
    }

    # ----------------------------------------------------------------
    # 3. Concurrent Claim Race (SELECT FOR UPDATE) Stress Test
    # ----------------------------------------------------------------
    # Create a single ephemeral benchmark work item in TRIAGE status
    bench_item_id = f"wi_bench_{uuid.uuid4().hex[:12]}"
    bench_team_id = "team_payments"

    async with get_db_connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO work_items (
                        id, title, description, status, priority, owning_team_id,
                        created_by_id, requires_approval, version, metadata
                    ) VALUES (%s, %s, %s, 'TRIAGE', 'MEDIUM', %s, 'usr_aarav', false, 1, %s::jsonb)
                    RETURNING id;
                    """,
                    (
                        bench_item_id,
                        "Benchmark Concurrent Claim Test Item",
                        "Ephemeral item created by benchmark run for SELECT FOR UPDATE race test.",
                        bench_team_id,
                        json.dumps({"benchmark_tag": BENCHMARK_TAG}),
                    ),
                )

    # Personas with OPERATOR/LEAD role in team_payments
    claimant_ids = [
        "usr_aarav",
        "usr_rohan",
        "usr_aarav",  # duplicate to test idempotency-like behavior
        "usr_rohan",
        "usr_aarav",
        "usr_rohan",
        "usr_aarav",
        "usr_rohan",
    ]

    claim_results: List[Dict[str, Any]] = []
    claim_latencies: List[float] = []

    async def _attempt_claim(actor_id: str) -> Dict[str, Any]:
        t0 = time.perf_counter()
        try:
            async with get_db_connection() as conn:
                async with conn.transaction():
                    async with conn.cursor() as cur:
                        await cur.execute(
                            "SELECT * FROM work_items WHERE id = %s FOR UPDATE;",
                            (bench_item_id,),
                        )
                        item = await cur.fetchone()
                        if not item:
                            return {"actor": actor_id, "outcome": "NOT_FOUND", "latency_ms": 0}

                        if item["assignee_id"] is not None:
                            return {
                                "actor": actor_id,
                                "outcome": "ALREADY_CLAIMED",
                                "claimed_by": item["assignee_id"],
                                "latency_ms": round((time.perf_counter() - t0) * 1000, 3),
                            }

                        to_version = item["version"] + 1
                        await cur.execute(
                            """
                            UPDATE work_items
                            SET assignee_id = %s, status = 'INVESTIGATING', version = %s, updated_at = NOW()
                            WHERE id = %s;
                            """,
                            (actor_id, to_version, bench_item_id),
                        )
                        return {
                            "actor": actor_id,
                            "outcome": "CLAIMED",
                            "latency_ms": round((time.perf_counter() - t0) * 1000, 3),
                        }
        except Exception as exc:
            return {
                "actor": actor_id,
                "outcome": "ERROR",
                "error": str(exc)[:200],
                "latency_ms": round((time.perf_counter() - t0) * 1000, 3),
            }

    # Fire all 8 concurrent claims simultaneously
    race_start = time.perf_counter()
    claim_results = await asyncio.gather(*[_attempt_claim(a) for a in claimant_ids])
    race_total_ms = round((time.perf_counter() - race_start) * 1000, 2)

    claim_latencies = [r["latency_ms"] for r in claim_results]
    claim_latencies_sorted = sorted(claim_latencies)
    winners = [r for r in claim_results if r["outcome"] == "CLAIMED"]
    losers = [r for r in claim_results if r["outcome"] == "ALREADY_CLAIMED"]
    errors = [r for r in claim_results if r["outcome"] == "ERROR"]

    results["concurrent_claim_race"] = {
        "concurrent_claimants": len(claimant_ids),
        "winners": len(winners),
        "blocked_by_lock": len(losers),
        "errors": len(errors),
        "exclusive_win_guarantee": len(winners) == 1,
        "race_total_ms": race_total_ms,
        "claim_latency_ms": {
            "p50": _percentile(claim_latencies_sorted, 50),
            "p95": _percentile(claim_latencies_sorted, 95),
            "p99": _percentile(claim_latencies_sorted, 99),
        },
        "winner_detail": winners[0] if winners else None,
        "outcomes_summary": [{"actor": r["actor"], "outcome": r["outcome"]} for r in claim_results],
        "guarantee": "SELECT FOR UPDATE ensures exactly 1 winner under any concurrency level.",
    }

    # ----------------------------------------------------------------
    # 4. Transactional Outbox Batch Processing (SKIP LOCKED)
    # ----------------------------------------------------------------
    outbox_res = await process_outbox_batch(batch_size=20)
    results["outbox_skip_locked"] = {
        "processed_count": outbox_res.processed_count,
        "success_count": outbox_res.success_count,
        "failed_count": outbox_res.failed_count,
        "dead_letter_count": outbox_res.dead_letter_count,
        "latency_ms": outbox_res.duration_ms,
        "pattern": "SELECT ... FOR UPDATE SKIP LOCKED prevents worker contention without Redis locks.",
    }

    # ----------------------------------------------------------------
    # Cleanup: delete all benchmark-tagged items
    # ----------------------------------------------------------------
    deleted_count = await delete_benchmark_work_items(BENCHMARK_TAG)
    results["cleanup"] = {
        "benchmark_items_deleted": deleted_count,
        "tag": BENCHMARK_TAG,
    }

    return {
        "status": "PASS" if results["concurrent_claim_race"]["exclusive_win_guarantee"] else "FAIL",
        "benchmark_timestamp": time.time(),
        "benchmarks": results,
    }


@router.post("/system/outbox/process-batch", response_model=OutboxProcessResult)
async def trigger_outbox_batch(
    batch_size: int = Query(default=20, ge=1, le=100),
    simulate_failure_job_id: Optional[int] = Query(default=None),
):
    """Manually trigger a batch outbox processing run with optional failure simulation."""
    return await process_outbox_batch(
        batch_size=batch_size,
        simulate_failure_job_id=simulate_failure_job_id,
    )

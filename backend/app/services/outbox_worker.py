import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional
import psycopg
from app.config import settings
from app.db.pool import get_db_connection
from app.domain.models import OutboxProcessResult

logger = logging.getLogger(__name__)


async def enqueue_outbox_job(
    cur: psycopg.AsyncCursor,
    event_type: str,
    aggregate_id: str,
    payload: Dict[str, Any],
    aggregate_type: str = "work_item",
) -> int:
    """Insert an event into the transactional outbox table within the caller's transaction."""
    await cur.execute(
        """
        INSERT INTO outbox_jobs (
            event_type, aggregate_type, aggregate_id, payload, status, attempts, next_attempt_at
        ) VALUES (%s, %s, %s, %s::jsonb, 'PENDING', 0, NOW())
        RETURNING id;
        """,
        (event_type, aggregate_type, aggregate_id, json.dumps(payload, default=str)),
    )
    row = await cur.fetchone()
    return row["id"]


async def process_outbox_batch(
    batch_size: int = 20,
    simulate_failure_job_id: Optional[int] = None,
) -> OutboxProcessResult:
    """
    Poll and process pending outbox events using FOR UPDATE SKIP LOCKED.
    Provides safe, concurrent execution across multiple worker processes.
    """
    start_time = time.perf_counter()
    processed_count = 0
    success_count = 0
    failed_count = 0
    dead_letter_count = 0

    async with get_db_connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                # Atomically claim pending jobs using SKIP LOCKED
                await cur.execute(
                    """
                    SELECT id, event_type, aggregate_type, aggregate_id, payload, attempts, max_attempts
                    FROM outbox_jobs
                    WHERE status = 'PENDING' AND next_attempt_at <= NOW()
                    ORDER BY next_attempt_at ASC
                    LIMIT %s
                    FOR UPDATE SKIP LOCKED;
                    """,
                    (batch_size,),
                )
                jobs = await cur.fetchall()

                for job in jobs:
                    job_id = job["id"]
                    attempts = job["attempts"]
                    max_attempts = job["max_attempts"]
                    processed_count += 1

                    try:
                        # Simulated or real dispatch
                        if simulate_failure_job_id is not None and job_id == simulate_failure_job_id:
                            raise RuntimeError(f"Simulated external dispatch failure for job {job_id}")

                        # In a real environment, this sends to Kafka / webhook / external system.
                        # For OpsPulse engine, log and mark COMPLETED.
                        logger.debug("Dispatched outbox event %s for %s", job["event_type"], job["aggregate_id"])

                        await cur.execute(
                            """
                            UPDATE outbox_jobs
                            SET status = 'COMPLETED',
                                processed_at = NOW(),
                                last_error = NULL
                            WHERE id = %s;
                            """,
                            (job_id,),
                        )
                        success_count += 1

                    except Exception as exc:
                        failed_count += 1
                        new_attempts = attempts + 1
                        error_msg = str(exc)[:500]

                        if new_attempts >= max_attempts:
                            # Transition to DEAD_LETTER after max retries exceeded
                            dead_letter_count += 1
                            await cur.execute(
                                """
                                UPDATE outbox_jobs
                                SET status = 'DEAD_LETTER',
                                    attempts = %s,
                                    last_error = %s,
                                    processed_at = NOW()
                                WHERE id = %s;
                                """,
                                (new_attempts, error_msg, job_id),
                            )
                            logger.error("Outbox job %s moved to DEAD_LETTER after %s attempts: %s", job_id, new_attempts, error_msg)
                        else:
                            # Exponential backoff: 2 ** new_attempts seconds
                            backoff_seconds = 2 ** new_attempts
                            await cur.execute(
                                """
                                UPDATE outbox_jobs
                                SET status = 'PENDING',
                                    attempts = %s,
                                    last_error = %s,
                                    next_attempt_at = NOW() + (%s * INTERVAL '1 second')
                                WHERE id = %s;
                                """,
                                (new_attempts, error_msg, backoff_seconds, job_id),
                            )
                            logger.warning(
                                "Outbox job %s failed (attempt %s/%s). Retrying in %ss. Error: %s",
                                job_id, new_attempts, max_attempts, backoff_seconds, error_msg
                            )

    duration_ms = (time.perf_counter() - start_time) * 1000.0
    return OutboxProcessResult(
        processed_count=processed_count,
        success_count=success_count,
        failed_count=failed_count,
        dead_letter_count=dead_letter_count,
        duration_ms=round(duration_ms, 2),
    )


async def run_outbox_worker_loop(stop_event: asyncio.Event) -> None:
    """Continuous background worker loop executing outbox processing with graceful shutdown."""
    logger.info("Outbox background worker started (poll interval: %ss).", settings.OUTBOX_POLL_INTERVAL_SECONDS)
    while not stop_event.is_set():
        try:
            result = await process_outbox_batch(batch_size=settings.OUTBOX_BATCH_SIZE)
            if result.processed_count > 0:
                logger.info("Outbox processed %s jobs (%s succeeded, %s failed) in %sms",
                            result.processed_count, result.success_count, result.failed_count, result.duration_ms)
        except Exception as exc:
            logger.error("Error in outbox background loop: %s", exc)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=settings.OUTBOX_POLL_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass

    logger.info("Outbox background worker stopped.")

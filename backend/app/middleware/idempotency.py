import hashlib
import json
from typing import Any, Dict, Optional, Tuple
from fastapi.responses import JSONResponse
import psycopg
from app.domain.errors import IdempotencyMismatchError


def compute_request_hash(endpoint: str, body_data: Any) -> str:
    """Compute a deterministic SHA-256 hash of endpoint + sorted request body payload."""
    if body_data is None:
        normalized_body = ""
    elif isinstance(body_data, (dict, list)):
        normalized_body = json.dumps(body_data, sort_keys=True, default=str)
    else:
        normalized_body = str(body_data)

    payload_str = f"{endpoint}:{normalized_body}"
    return hashlib.sha256(payload_str.encode("utf-8")).hexdigest()


def _idempotency_advisory_key(idempotency_key: str, actor_id: str) -> int:
    """
    Convert (idempotency_key, actor_id) into a stable 64-bit integer for
    pg_try_advisory_xact_lock. Uses first 8 bytes of SHA-256 so it fits in bigint.
    """
    raw = hashlib.sha256(f"{idempotency_key}:{actor_id}".encode()).digest()
    # Interpret first 8 bytes as a signed 64-bit integer (big-endian)
    value = int.from_bytes(raw[:8], "big", signed=True)
    return value


async def acquire_idempotency_lock(
    cur: psycopg.AsyncCursor,
    idempotency_key: Optional[str],
    actor_id: str,
) -> bool:
    """
    HARDEN (In-flight Idempotency Race):
    Acquire a PostgreSQL transaction-scoped advisory lock keyed on (idempotency_key, actor_id).
    This ensures only one concurrent request with the same idempotency key can hold the lock
    at a time, serializing them at the DB level and eliminating the TOCTOU window between the
    idempotency check SELECT and the eventual INSERT.

    Returns True if the lock was acquired (proceed), False if another concurrent request already
    holds the lock (this request should wait/retry at the application layer or simply re-check).
    If idempotency_key is None, always returns True (no lock needed).
    """
    if not idempotency_key:
        return True

    lock_key = _idempotency_advisory_key(idempotency_key, actor_id)
    # pg_try_advisory_xact_lock is transaction-scoped: auto-released on commit or rollback.
    # Returns TRUE if lock acquired, FALSE if already held by another transaction.
    await cur.execute("SELECT pg_try_advisory_xact_lock(%s) AS acquired;", (lock_key,))
    row = await cur.fetchone()
    return bool(row["acquired"]) if row else False


async def check_idempotency_key(
    cur: psycopg.AsyncCursor,
    idempotency_key: Optional[str],
    actor_id: str,
    endpoint: str,
    request_hash: str,
) -> Optional[Tuple[int, Dict[str, Any]]]:
    """
    Check if an idempotency key was previously processed for this actor.
    If match: returns (status_code, response_body).
    If mismatch: raises IdempotencyMismatchError.
    If new: returns None.
    """
    if not idempotency_key:
        return None

    await cur.execute(
        """
        SELECT request_hash, status_code, response_body
        FROM idempotency_keys
        WHERE idempotency_key = %s AND actor_id = %s;
        """,
        (idempotency_key, actor_id),
    )
    record = await cur.fetchone()
    if not record:
        return None

    if record["request_hash"] != request_hash:
        raise IdempotencyMismatchError(idempotency_key=idempotency_key)

    return record["status_code"], record["response_body"]


async def save_idempotency_key(
    cur: psycopg.AsyncCursor,
    idempotency_key: Optional[str],
    actor_id: str,
    endpoint: str,
    request_hash: str,
    status_code: int,
    response_body: Dict[str, Any],
) -> None:
    """Save the completed transaction response for idempotent replay."""
    if not idempotency_key:
        return

    await cur.execute(
        """
        INSERT INTO idempotency_keys (
            idempotency_key, actor_id, endpoint, request_hash, status_code, response_body
        ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (idempotency_key, actor_id) DO NOTHING;
        """,
        (
            idempotency_key,
            actor_id,
            endpoint,
            request_hash,
            status_code,
            json.dumps(response_body, default=str),
        ),
    )


def make_idempotent_replay_response(status_code: int, body: Dict[str, Any]) -> JSONResponse:
    """Build a JSONResponse with the X-Idempotent-Replay header."""
    return JSONResponse(
        status_code=status_code,
        content=body,
        headers={"X-Idempotent-Replay": "true"},
    )

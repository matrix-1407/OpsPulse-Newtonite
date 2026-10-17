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

import asyncio
import json
import logging
from typing import AsyncGenerator, Dict, List, Set
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.db.pool import get_db_cursor
from app.domain.models import PersonaResponse, TeamResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["Events & Metadata"])

# In-memory subscriber queue set for SSE broadcasting
_subscribers: Set[asyncio.Queue] = set()


async def broadcast_event(event_type: str, payload: Dict):
    """Broadcast an event to all connected SSE clients."""
    if not _subscribers:
        return
    message = {
        "event": event_type,
        "data": payload,
    }
    dead_queues = []
    for queue in _subscribers:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            dead_queues.append(queue)

    for dead in dead_queues:
        _subscribers.discard(dead)


@router.get("/events/stream")
async def sse_event_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint broadcasting live work item updates,
    claims, approvals, and state transitions to connected operators.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(queue)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Initial connection confirmation
            yield f"event: connected\ndata: {json.dumps({'message': 'OpsPulse SSE stream connected'})}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    # Wait for an event with a 15-second heartbeat timeout
                    item = await asyncio.wait_for(queue.get(), timeout=15.0)
                    event_name = item.get("event", "message")
                    data_str = json.dumps(item.get("data", {}), default=str)
                    yield f"event: {event_name}\ndata: {data_str}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat ping
                    yield ": ping\n\n"
        finally:
            _subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/personas", response_model=List[PersonaResponse])
async def list_personas():
    """List all 6 built-in personas with hydrated per-team roles for quick testing."""
    async with get_db_cursor(commit=False) as cur:
        await cur.execute("SELECT id, email, name, avatar_url FROM users ORDER BY id ASC;")
        users = await cur.fetchall()

        await cur.execute("SELECT user_id, team_id, role FROM team_memberships ORDER BY user_id, team_id;")
        memberships = await cur.fetchall()

    user_roles: Dict[str, Dict[str, str]] = {}
    for m in memberships:
        user_roles.setdefault(m["user_id"], {})[m["team_id"]] = m["role"]

    return [
        PersonaResponse(
            id=u["id"],
            name=u["name"],
            email=u["email"],
            avatar_url=u["avatar_url"],
            roles=user_roles.get(u["id"], {}),
        )
        for u in users
    ]


@router.get("/teams", response_model=List[TeamResponse])
async def list_teams():
    """List all registered operational teams."""
    async with get_db_cursor(commit=False) as cur:
        await cur.execute("SELECT id, name, description, created_at FROM teams ORDER BY name ASC;")
        teams = await cur.fetchall()

    return [TeamResponse(**dict(t)) for t in teams]

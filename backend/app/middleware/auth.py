from typing import Dict, Optional
from fastapi import Header, Request
from pydantic import BaseModel
from app.db.pool import get_db_cursor
from app.domain.errors import ActorNotFoundError


class ActorContext(BaseModel):
    user_id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    team_roles: Dict[str, str] = {}  # team_id -> role


async def get_current_actor(
    request: Request,
    x_actor_id: Optional[str] = Header(default="usr_aarav", alias="X-Actor-Id"),
) -> ActorContext:
    """
    FastAPI dependency: resolves current actor from X-Actor-Id header
    and hydrates their team memberships and roles from the database.
    """
    actor_id = x_actor_id or "usr_aarav"

    async with get_db_cursor(commit=False) as cur:
        # Fetch user
        await cur.execute(
            "SELECT id, email, name, avatar_url FROM users WHERE id = %s;",
            (actor_id,),
        )
        user_row = await cur.fetchone()
        if not user_row:
            raise ActorNotFoundError(actor_id=actor_id)

        # Fetch team memberships
        await cur.execute(
            "SELECT team_id, role FROM team_memberships WHERE user_id = %s;",
            (actor_id,),
        )
        memberships = await cur.fetchall()

    team_roles = {m["team_id"]: m["role"] for m in memberships}

    actor = ActorContext(
        user_id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        avatar_url=user_row["avatar_url"],
        team_roles=team_roles,
    )

    # Store on request state for downstream handlers if needed
    request.state.actor = actor
    return actor

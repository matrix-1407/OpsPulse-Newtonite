import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.config import settings

# Psycopg 3 async requires WindowsSelectorEventLoopPolicy on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)

_pool: Optional[AsyncConnectionPool] = None


async def init_pool() -> AsyncConnectionPool:
    """Initialize the asynchronous PostgreSQL connection pool."""
    global _pool
    if _pool is None:
        logger.info("Initializing PostgreSQL AsyncConnectionPool: %s", settings.DATABASE_URL.split("@")[-1])
        _pool = AsyncConnectionPool(
            conninfo=settings.DATABASE_URL,
            min_size=settings.DB_MIN_CONNECTIONS,
            max_size=settings.DB_MAX_CONNECTIONS,
            open=False,
            kwargs={
                "row_factory": dict_row,
                "autocommit": False,
            },
        )
        await _pool.open()
        logger.info("PostgreSQL AsyncConnectionPool ready.")
    return _pool


async def close_pool() -> None:
    """Close all open connections in the pool."""
    global _pool
    if _pool is not None:
        logger.info("Closing PostgreSQL AsyncConnectionPool...")
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL AsyncConnectionPool closed.")


def get_pool() -> AsyncConnectionPool:
    """Retrieve the active pool instance."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialized. Call init_pool() first.")
    return _pool


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """Async context manager for acquiring a connection from the pool."""
    pool = get_pool()
    async with pool.connection() as conn:
        yield conn


@asynccontextmanager
async def get_db_cursor(commit: bool = False) -> AsyncGenerator[psycopg.AsyncCursor, None]:
    """
    Async context manager acquiring a connection and yielding an active cursor.
    If commit=True, commits on clean exit, rolls back on error or read-only completion.
    """
    async with get_db_connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            try:
                yield cur
                if commit:
                    await conn.commit()
                else:
                    await conn.rollback()
            except Exception:
                await conn.rollback()
                raise

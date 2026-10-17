import asyncio
import logging
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import benchmarks, events, work_items
from app.config import settings
from app.db.pool import close_pool, get_db_cursor, init_pool
from app.domain.errors import AppException
from app.services.outbox_worker import run_outbox_worker_loop

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("opspulse")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI application lifespan managing DB pool and background outbox loop."""
    logger.info("Starting OpsPulse Backend Engine (Env: %s)...", settings.ENVIRONMENT)

    # 1. Initialize PostgreSQL connection pool
    await init_pool()

    # 2. Verify DB connection
    async with get_db_cursor(commit=False) as cur:
        await cur.execute("SELECT 1 AS ready;")
        logger.info("PostgreSQL database connection verified.")

    # 3. Start background outbox processor task
    stop_event = asyncio.Event()
    worker_task = asyncio.create_task(run_outbox_worker_loop(stop_event))

    yield

    # Shutdown sequence
    logger.info("Initiating OpsPulse shutdown sequence...")
    stop_event.set()
    try:
        await asyncio.wait_for(worker_task, timeout=3.0)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        worker_task.cancel()

    await close_pool()
    logger.info("OpsPulse Backend Engine shutdown complete.")


app = FastAPI(
    title="OpsPulse Backend API",
    version="1.0.0",
    description="High-Concurrency Operational Work-Coordination Engine for Newtonite Challenge",
    lifespan=lifespan,
)

# CORS Middleware (Exposing X-Idempotent-Replay header to clients)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Idempotent-Replay", "X-Actor-Id"],
)

from fastapi.encoders import jsonable_encoder

# Custom RFC 7807 Error Handling
@app.exception_handler(AppException)
async def handle_app_exception(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(exc.to_dict()),
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "VALIDATION_ERROR",
            "message": "Invalid request parameters or payload body.",
            "details": exc.errors(),
        },
    )


@app.get("/health", tags=["System"])
async def health_check():
    """Health check verifying database connectivity."""
    async with get_db_cursor(commit=False) as cur:
        await cur.execute("SELECT count(*) AS total_items FROM work_items;")
        row = await cur.fetchone()

    return {
        "status": "HEALTHY",
        "service": "opspulse-backend",
        "database": "CONNECTED",
        "total_work_items": row["total_items"] if row else 0,
    }


# Include Core Operational Routers
app.include_router(work_items.router)
app.include_router(events.router)
app.include_router(benchmarks.router)

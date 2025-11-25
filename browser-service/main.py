"""
Production-ready FastAPI server for browser automation with Redis queue
"""
import os
import signal
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from redis import Redis
from rq import Queue
from rq.job import Job
import psutil

from config import get_settings
from logger import get_logger
from worker import browser_automation_job

settings = get_settings()
logger = get_logger(__name__)

# Global references for graceful shutdown
redis_conn: Optional[Redis] = None
job_queue: Optional[Queue] = None
shutdown_event = asyncio.Event()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global redis_conn, job_queue

    # Startup
    logger.info("Starting browser automation service", extra={
        "environment": settings.environment,
        "max_sessions": settings.max_browser_sessions
    })

    # Initialize Redis connection
    try:
        redis_conn = Redis.from_url(settings.redis_url, decode_responses=False)
        redis_conn.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise

    # Initialize job queue
    job_queue = Queue(
        name=settings.queue_name,
        connection=redis_conn,
        default_timeout=settings.job_timeout
    )
    logger.info(f"Job queue '{settings.queue_name}' initialized")

    # Setup signal handlers
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}, initiating graceful shutdown")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    yield

    # Shutdown
    logger.info("Shutting down browser automation service")

    # Close Redis connection
    if redis_conn:
        redis_conn.close()
        logger.info("Redis connection closed")


# Initialize FastAPI app
app = FastAPI(
    title="ResumeMax Browser Automation Service",
    description="Production-ready browser automation with job queue",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://resumemax.ai",
        "https://*.resumemax.ai",
        "https://www.resumemax.ai",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Models ====================

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    environment: str
    version: str


class BrowserHealthResponse(BaseModel):
    status: str
    browser_available: bool
    message: Optional[str] = None


class QueueHealthResponse(BaseModel):
    status: str
    redis_connected: bool
    queue_name: str
    queued_jobs: int
    workers: int


class MetricsResponse(BaseModel):
    queued_jobs: int
    active_jobs: int
    failed_jobs: int
    cpu_percent: float
    memory_percent: float
    redis_connected: bool


class JobSubmitRequest(BaseModel):
    user_id: str
    job_url: str
    user_profile: Dict[str, Any]
    resume_data: Dict[str, Any]
    session_id: str
    additional_params: Optional[Dict[str, Any]] = None


class JobSubmitResponse(BaseModel):
    job_id: str
    status: str
    message: str
    queue_position: Optional[int] = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # queued, started, finished, failed
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None


# ==================== Dependencies ====================

async def verify_api_key(x_api_key: str = Header(None)):
    """Verify internal API key for service authentication"""
    if settings.api_key and x_api_key != settings.api_key:
        logger.warning("Invalid API key attempt")
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# ==================== Health Check Endpoints ====================

@app.get("/", response_model=HealthResponse)
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Basic health check"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        environment=settings.environment,
        version="2.0.0"
    )


@app.get("/health/browser", response_model=BrowserHealthResponse)
async def browser_health():
    """Check if browser can be launched"""
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            await browser.close()

        return BrowserHealthResponse(
            status="healthy",
            browser_available=True,
            message="Browser launched successfully"
        )
    except Exception as e:
        logger.error(f"Browser health check failed: {e}")
        return BrowserHealthResponse(
            status="unhealthy",
            browser_available=False,
            message=str(e)
        )


@app.get("/health/queue", response_model=QueueHealthResponse)
async def queue_health():
    """Check Redis and queue status"""
    try:
        # Test Redis connection
        redis_conn.ping()

        # Get queue stats
        queue_length = len(job_queue)
        workers_count = len(job_queue.workers)

        return QueueHealthResponse(
            status="healthy",
            redis_connected=True,
            queue_name=settings.queue_name,
            queued_jobs=queue_length,
            workers=workers_count
        )
    except Exception as e:
        logger.error(f"Queue health check failed: {e}")
        return QueueHealthResponse(
            status="unhealthy",
            redis_connected=False,
            queue_name=settings.queue_name,
            queued_jobs=0,
            workers=0
        )


@app.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Get service metrics"""
    try:
        # Queue metrics
        queued = len(job_queue)
        started_registry = job_queue.started_job_registry
        failed_registry = job_queue.failed_job_registry

        # System metrics
        cpu = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory().percent

        # Redis check
        redis_ok = False
        try:
            redis_conn.ping()
            redis_ok = True
        except:
            pass

        return MetricsResponse(
            queued_jobs=queued,
            active_jobs=len(started_registry),
            failed_jobs=len(failed_registry),
            cpu_percent=cpu,
            memory_percent=memory,
            redis_connected=redis_ok
        )
    except Exception as e:
        logger.error(f"Metrics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Job Endpoints ====================

@app.post("/jobs/submit", response_model=JobSubmitResponse)
async def submit_job(
    request: JobSubmitRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Submit a browser automation job to the queue

    Requires X-API-Key header for authentication
    """
    try:
        logger.info(
            "Received job submission",
            extra={
                "user_id": request.user_id,
                "session_id": request.session_id,
                "job_url": request.job_url
            }
        )

        # Enqueue the job
        job = job_queue.enqueue(
            browser_automation_job,
            request.user_id,
            request.job_url,
            request.user_profile,
            request.resume_data,
            request.session_id,
            **(request.additional_params or {}),
            job_timeout=settings.job_timeout,
            result_ttl=settings.result_ttl,
            failure_ttl=settings.result_ttl
        )

        queue_position = job.get_position()

        logger.info(
            "Job enqueued successfully",
            extra={
                "job_id": job.id,
                "user_id": request.user_id,
                "queue_position": queue_position
            }
        )

        return JobSubmitResponse(
            job_id=job.id,
            status="queued",
            message="Job submitted successfully",
            queue_position=queue_position
        )

    except Exception as e:
        logger.error(
            "Job submission failed",
            extra={
                "user_id": request.user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    api_key: str = Depends(verify_api_key)
):
    """
    Get status and result of a job

    Requires X-API-Key header for authentication
    """
    try:
        job = Job.fetch(job_id, connection=redis_conn)

        # Map RQ job status to our status
        status_map = {
            'queued': 'queued',
            'started': 'started',
            'finished': 'finished',
            'failed': 'failed',
            'canceled': 'failed',
            'stopped': 'failed'
        }

        status = status_map.get(job.get_status(), 'unknown')

        response = JobStatusResponse(
            job_id=job.id,
            status=status,
            created_at=job.created_at.isoformat() if job.created_at else None,
            started_at=job.started_at.isoformat() if job.started_at else None,
            ended_at=job.ended_at.isoformat() if job.ended_at else None
        )

        # Add result if finished
        if job.is_finished:
            response.result = job.result

        # Add error if failed
        if job.is_failed:
            response.error = job.exc_info

        return response

    except Exception as e:
        logger.error(f"Failed to fetch job {job_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")


@app.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str,
    api_key: str = Depends(verify_api_key)
):
    """
    Cancel a queued or running job

    Requires X-API-Key header for authentication
    """
    try:
        job = Job.fetch(job_id, connection=redis_conn)

        # Can only cancel queued jobs
        if job.is_queued:
            job.cancel()
            logger.info(f"Job {job_id} cancelled")
            return {"message": "Job cancelled", "job_id": job_id}
        else:
            return {
                "message": f"Job cannot be cancelled (status: {job.get_status()})",
                "job_id": job_id
            }

    except Exception as e:
        logger.error(f"Failed to cancel job {job_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")


# ==================== Admin Endpoints ====================

@app.post("/admin/clear-failed-jobs")
async def clear_failed_jobs(api_key: str = Depends(verify_api_key)):
    """Clear all failed jobs from the queue"""
    try:
        failed_registry = job_queue.failed_job_registry
        count = len(failed_registry)

        # Clear failed jobs
        for job_id in failed_registry.get_job_ids():
            failed_registry.remove(job_id, delete_job=True)

        logger.info(f"Cleared {count} failed jobs")
        return {"message": f"Cleared {count} failed jobs"}

    except Exception as e:
        logger.error(f"Failed to clear jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=(settings.environment == "development"),
        log_level=settings.log_level.lower()
    )

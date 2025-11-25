"""
RQ Worker for browser automation background jobs
"""
import asyncio
import logging
from typing import Dict, Any
from datetime import datetime

from browser_agent import JobApplicationAgent
from config import get_settings
from logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


async def run_browser_automation(
    user_id: str,
    job_url: str,
    user_profile: Dict[str, Any],
    resume_data: Dict[str, Any],
    session_id: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Execute browser automation for job application

    Args:
        user_id: User identifier
        job_url: Job posting URL
        user_profile: User profile data
        resume_data: Resume/CV data
        session_id: Application session ID
        **kwargs: Additional parameters

    Returns:
        Dict with job results
    """
    start_time = datetime.utcnow()

    logger.info(
        "Starting browser automation job",
        extra={
            "user_id": user_id,
            "job_url": job_url,
            "session_id": session_id
        }
    )

    try:
        # Initialize browser agent
        agent = JobApplicationAgent()

        # Execute the automation
        result = await agent.apply_to_job(
            job_url=job_url,
            user_profile=user_profile,
            resume_data=resume_data,
            session_id=session_id,
            **kwargs
        )

        duration = (datetime.utcnow() - start_time).total_seconds()

        logger.info(
            "Browser automation completed successfully",
            extra={
                "user_id": user_id,
                "session_id": session_id,
                "duration_seconds": duration,
                "status": result.get("status")
            }
        )

        return {
            "success": True,
            "result": result,
            "duration_seconds": duration,
            "completed_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        duration = (datetime.utcnow() - start_time).total_seconds()

        logger.error(
            "Browser automation failed",
            extra={
                "user_id": user_id,
                "session_id": session_id,
                "duration_seconds": duration,
                "error": str(e)
            },
            exc_info=True
        )

        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "duration_seconds": duration,
            "completed_at": datetime.utcnow().isoformat()
        }


# Synchronous wrapper for RQ
def browser_automation_job(*args, **kwargs) -> Dict[str, Any]:
    """
    Synchronous wrapper for the async browser automation function
    Required for RQ compatibility
    """
    return asyncio.run(run_browser_automation(*args, **kwargs))


# Example job for testing
def test_job(message: str) -> Dict[str, Any]:
    """Simple test job to verify queue is working"""
    logger.info(f"Test job executed: {message}")
    return {
        "success": True,
        "message": f"Processed: {message}",
        "timestamp": datetime.utcnow().isoformat()
    }

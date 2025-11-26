"""
FastAPI server for browser-use job application automation
"""
import os
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

from browser_agent import JobApplicationAgent, ApplicationRequest, ApplicationResult
from gmail_handler import GmailVerificationHandler
import logging

# Load environment variables from explicit locations to avoid CWD issues
try:
    current_dir = Path(__file__).resolve().parent
    project_root = current_dir.parent

    svc_env = current_dir / '.env'
    root_env_local = project_root / '.env.local'
    root_env = project_root / '.env'

    if svc_env.exists():
        load_dotenv(svc_env)
    if root_env_local.exists():
        load_dotenv(root_env_local)
    if root_env.exists():
        load_dotenv(root_env)
except Exception:
    # Fallback to default behavior
    load_dotenv()

# Configure logging for main.py
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure local CDP connections are not routed through proxies
for var in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]:
    if var in os.environ:
        logger.info(f"Unsetting {var} to avoid proxying local CDP connections")
        os.environ.pop(var, None)

if not os.getenv("NO_PROXY"):
    os.environ["NO_PROXY"] = "localhost,127.0.0.1"
    logger.debug("Set NO_PROXY=localhost,127.0.0.1")

# Initialize FastAPI app
app = FastAPI(
    title="Browser-Use Job Application Service",
    description="AI-powered job application automation using browser-use",
    version="1.0.0"
)

# Add CORS middleware to allow Next.js to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://resumemax.ai",
        "https://www.resumemax.ai",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store for tracking active sessions (in-memory for now)
active_sessions: Dict[str, Dict[str, Any]] = {}


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str


class SessionStatusResponse(BaseModel):
    session_id: str
    status: str
    progress: Optional[str] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    action_log: Optional[list] = None


@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="browser-use-job-application"
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Detailed health check"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="browser-use-job-application"
    )


@app.post("/apply", response_model=SessionStatusResponse)
async def auto_apply(
    request: ApplicationRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a new job application session

    This endpoint initiates a browser-use agent to fill out a job application.
    The agent runs in the background and the session_id can be used to check status.
    """
    try:
        logger.info(f"🚀 Starting job application for: {request.job_url}")
        logger.debug(f"Request details: {request.dict()}")
        
        # Create agent instance
        logger.info("🤖 Creating JobApplicationAgent instance...")
        try:
            agent = JobApplicationAgent()
            logger.info("✅ Agent instance created successfully")
        except Exception as agent_init_error:
            logger.error(f"❌ Failed to create agent: {agent_init_error}")
            logger.error(f"Agent init error type: {type(agent_init_error)}")
            raise agent_init_error

        # Generate session ID
        session_id = request.session_id or f"session_{datetime.utcnow().timestamp()}"
        logger.info(f"📋 Session ID: {session_id}")

        # Initialize session tracking
        active_sessions[session_id] = {
            "status": "started",
            "progress": "Initializing browser agent...",
            "started_at": datetime.utcnow().isoformat(),
            "request": request.dict(),
            "logs": []  # Add logs array to track detailed progress
        }

        logger.info("🔄 Adding background task...")
        # Run the application in background
        background_tasks.add_task(
            run_application_task,
            agent,
            request,
            session_id
        )

        logger.info("✅ Background task added successfully")
        return SessionStatusResponse(
            session_id=session_id,
            status="started",
            progress="Job application initiated. Use /status/{session_id} to check progress."
        )

    except Exception as e:
        logger.error(f"❌ Failed to start application: {e}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start application: {str(e)}")


@app.get("/status/{session_id}", response_model=SessionStatusResponse)
async def get_status(session_id: str):
    """
    Get the status of a job application session with real-time action logs
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    session = active_sessions[session_id]

    return SessionStatusResponse(
        session_id=session_id,
        status=session.get("status", "unknown"),
        progress=session.get("progress"),
        error=session.get("error"),
        result=session.get("result"),
        action_log=session.get("action_log", [])
    )


async def run_application_task(
    agent: JobApplicationAgent,
    request: ApplicationRequest,
    session_id: str
):
    """
    Background task to run the job application with real-time action logging
    """
    # Initialize action log in session
    if "action_log" not in active_sessions[session_id]:
        active_sessions[session_id]["action_log"] = []

    def action_callback(action: str):
        """Callback to capture agent actions in real-time - shown in terminal"""
        timestamp = datetime.utcnow().isoformat()
        active_sessions[session_id]["action_log"].append({
            "timestamp": timestamp,
            "action": action
        })
        active_sessions[session_id]["progress"] = action

        # Enhanced terminal output with timestamp
        print(f"\n{'='*80}")
        print(f"🤖 [AI AGENT ACTION] Session: {session_id[:8]}...")
        print(f"⏰ Time: {datetime.utcnow().strftime('%H:%M:%S')}")
        print(f"📝 Action: {action}")
        print(f"{'='*80}\n")

    try:
        logger.info(f"🔄 Background task started for session: {session_id}")
        
        # Update status
        active_sessions[session_id]["status"] = "running"
        active_sessions[session_id]["progress"] = "Browser agent is filling out the application..."

        # Terminal output: Starting application
        print(f"\n{'#'*80}")
        print(f"🚀 STARTING JOB APPLICATION")
        print(f"📋 Session ID: {session_id}")
        print(f"🔗 Job URL: {request.job_url}")
        print(f"👤 User: {request.full_name}")
        print(f"{'#'*80}\n")

        logger.info(f"🤖 Calling agent.apply_to_job for session: {session_id}")
        
        # Run the agent with action callback
        try:
            result: ApplicationResult = await agent.apply_to_job(request, action_callback=action_callback)
            logger.info(f"✅ Agent completed for session: {session_id}")
            
        except Exception as apply_error:
            logger.error(f"❌ Agent apply_to_job failed for session {session_id}: {apply_error}")
            logger.error(f"Apply error type: {type(apply_error)}")
            logger.error(f"Apply error details: {str(apply_error)}")
            
            # Check if it's the provider error specifically
            if "provider" in str(apply_error).lower():
                logger.error("🔍 DETECTED: This is the 'provider' attribute error!")
                logger.error("🔧 The ChatOpenAI object is missing the 'provider' attribute that browser-use expects")
            
            raise apply_error

        # Update session with result
        active_sessions[session_id]["status"] = "completed" if result.success else "failed"
        active_sessions[session_id]["progress"] = "Application completed"
        active_sessions[session_id]["result"] = result.dict()
        active_sessions[session_id]["completed_at"] = datetime.utcnow().isoformat()

        # Persist status to Supabase so UI hooks can show it in the right tab
        try:
            import httpx, os
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            if supabase_url and supabase_key:
                base = supabase_url.rstrip('/')
                headers = {
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                }
                now_iso = datetime.utcnow().isoformat()
                if result.success:
                    # Mark as fully submitted so it appears in Submitted Applications
                    payload = {
                        "status": "submitted",
                        "filled_at": now_iso,
                        "submitted_at": now_iso,
                        "closed_at": now_iso,
                    }
                else:
                    payload = {
                        "status": "error",
                        "closed_at": now_iso,
                    }
                with httpx.Client(timeout=15.0, headers=headers) as client:
                    url = f"{base}/rest/v1/auto_apply_sessions?id=eq.{session_id}"
                    client.patch(url, json=payload)
        except Exception as e:
            logger.warning(f"Could not update session status in Supabase: {e}")

        if not result.success:
            active_sessions[session_id]["error"] = result.error_message
            # Terminal output: Failure
            print(f"\n{'!'*80}")
            print(f"❌ APPLICATION FAILED")
            print(f"📋 Session ID: {session_id}")
            print(f"🔗 Job URL: {request.job_url}")
            print(f"❗ Error: {result.error_message}")
            print(f"⏱️  Duration: {result.execution_time:.2f}s")
            print(f"{'!'*80}\n")
        else:
            # Terminal output: Success
            print(f"\n{'*'*80}")
            print(f"✅ APPLICATION COMPLETED SUCCESSFULLY!")
            print(f"📋 Session ID: {session_id}")
            print(f"🔗 Job URL: {request.job_url}")
            print(f"⏱️  Duration: {result.execution_time:.2f}s")
            print(f"📊 Actions taken: {len(result.agent_actions)}")
            print(f"{'*'*80}\n")

    except Exception as e:
        # Update session with error
        active_sessions[session_id]["status"] = "failed"
        active_sessions[session_id]["error"] = str(e)
        active_sessions[session_id]["progress"] = "Application failed"
        active_sessions[session_id]["completed_at"] = datetime.utcnow().isoformat()

        # Terminal output: Exception
        print(f"\n{'!'*80}")
        print(f"💥 APPLICATION EXCEPTION")
        print(f"📋 Session ID: {session_id}")
        print(f"🔗 Job URL: {request.job_url}")
        print(f"❗ Exception: {str(e)}")
        print(f"{'!'*80}\n")


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session from memory
    """
    if session_id in active_sessions:
        del active_sessions[session_id]
        return {"message": f"Session {session_id} deleted"}
    else:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("SERVICE_PORT", 8000))
    host = os.getenv("SERVICE_HOST", "0.0.0.0")

    print(f"🚀 Starting Browser-Use Job Application Service on {host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )

# Gmail OAuth2 endpoints
@app.post("/gmail/auth/{user_id}")
async def initiate_gmail_auth(user_id: str):
    """Initiate Gmail OAuth2 authentication for a user"""
    try:
        gmail_handler = GmailVerificationHandler()
        
        # Check if user already has valid credentials
        token_path = f"gmail_token_{user_id}.json"
        if os.path.exists(token_path):
            # Try to authenticate with existing credentials
            auth_success = await gmail_handler.authenticate_user(user_id)
            if auth_success:
                return {
                    "status": "already_authenticated",
                    "message": f"Gmail already authenticated for user {user_id}",
                    "email": gmail_handler.user_email
                }
        
        # Need new authentication
        from google_auth_oauthlib.flow import Flow
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv('GOOGLE_CLIENT_ID'),
                    "client_secret": os.getenv('GOOGLE_CLIENT_SECRET'),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/auth/callback')]
                }
            },
            scopes=['https://www.googleapis.com/auth/gmail.readonly']
        )
        flow.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/auth/callback')
        
        # Generate authorization URL
        auth_url, state = flow.authorization_url(
            prompt='consent',
            state=user_id  # Pass user_id as state
        )
        
        return {
            "status": "auth_required",
            "auth_url": auth_url,
            "message": "Please visit the auth_url to authorize Gmail access"
        }
        
    except Exception as e:
        logger.error(f"❌ Error initiating Gmail auth: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate Gmail authentication: {str(e)}")

@app.get("/auth/callback")
async def gmail_auth_callback(code: str, state: str):
    """Handle Gmail OAuth2 callback"""
    try:
        user_id = state  # user_id was passed as state
        
        from google_auth_oauthlib.flow import Flow
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv('GOOGLE_CLIENT_ID'),
                    "client_secret": os.getenv('GOOGLE_CLIENT_SECRET'),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/auth/callback')]
                }
            },
            scopes=['https://www.googleapis.com/auth/gmail.readonly']
        )
        flow.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/auth/callback')
        
        # Exchange authorization code for credentials
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Save credentials
        token_path = f"gmail_token_{user_id}.json"
        with open(token_path, 'w') as token_file:
            token_file.write(credentials.to_json())
        
        # Test the credentials
        gmail_handler = GmailVerificationHandler()
        auth_success = await gmail_handler.authenticate_user(user_id)
        
        if auth_success:
            return {
                "status": "success",
                "message": f"Gmail authentication successful for user {user_id}",
                "email": gmail_handler.user_email
            }
        else:
            raise HTTPException(status_code=500, detail="Authentication succeeded but failed to initialize Gmail service")
            
    except Exception as e:
        logger.error(f"❌ Error in Gmail auth callback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to complete Gmail authentication: {str(e)}")

@app.get("/gmail/status/{user_id}")
async def get_gmail_status(user_id: str):
    """Check Gmail authentication status for a user"""
    try:
        gmail_handler = GmailVerificationHandler()
        auth_success = await gmail_handler.authenticate_user(user_id)
        
        if auth_success:
            return {
                "status": "authenticated",
                "email": gmail_handler.user_email,
                "message": "Gmail access is working"
            }
        else:
            return {
                "status": "not_authenticated",
                "message": "Gmail authentication required"
            }
            
    except Exception as e:
        logger.error(f"❌ Error checking Gmail status: {e}")
        return {
            "status": "error",
            "message": f"Error checking Gmail status: {str(e)}"
        }

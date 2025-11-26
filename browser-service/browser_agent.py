"""
Browser-use agent for automated job applications
"""
import os
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime

from pydantic import BaseModel
from browser_use import Agent, Browser, BrowserConfig
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import urlparse
import tempfile
import mimetypes
import httpx
import base64
import glob
import logging
import requests
from gmail_handler import GmailVerificationHandler
import time
# We rely on browser-use's default LLM (configured via OPENAI_API_KEY)

# Minimum delay between field fills (in seconds)
FIELD_FILL_DELAY = 7

# Configure comprehensive logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # Console output
        logging.FileHandler('browser_agent.log')  # File output
    ]
)

# Create logger
logger = logging.getLogger(__name__)

# Load environment variables from explicit locations to avoid CWD issues
try:
    current_dir = Path(__file__).resolve().parent
    project_root = current_dir.parent

    # Load order: python-service/.env, project root .env.local, project root .env
    svc_env = current_dir / '.env'
    root_env_local = project_root / '.env.local'
    root_env = project_root / '.env'

    if svc_env.exists():
        load_dotenv(svc_env)
        logger.debug(f"Loaded env from {svc_env}")
    if root_env_local.exists():
        load_dotenv(root_env_local)
        logger.debug(f"Loaded env from {root_env_local}")
    if root_env.exists():
        load_dotenv(root_env)
        logger.debug(f"Loaded env from {root_env}")
except Exception as e:
    logger.warning(f"Could not load environment files via absolute paths: {e}")

# Ensure local CDP connections are not routed through proxies
for var in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]:
    if var in os.environ:
        logger.info(f"Unsetting {var} to avoid proxying local CDP connections")
        os.environ.pop(var, None)

if not os.getenv("NO_PROXY"):
    os.environ["NO_PROXY"] = "localhost,127.0.0.1"
    logger.debug("Set NO_PROXY=localhost,127.0.0.1")


class CaptchaSolver:
    """
    2captcha service integration for solving captchas
    """
    
    def __init__(self):
        # Use hardcoded API key for 2captcha
        self.api_key_2captcha = "c569a7db2c55491ff0b992a07748dbcf"
        logger.info("🤖 2captcha solver initialized with API key")
        
    async def solve_recaptcha_v2(self, site_key: str, page_url: str) -> Optional[str]:
        """
        Solve reCAPTCHA v2 using 2captcha service
        
        Args:
            site_key: The site key from the reCAPTCHA
            page_url: The URL where the captcha appears
            
        Returns:
            The captcha solution token or None if failed
        """
        logger.info("🤖 Attempting to solve reCAPTCHA v2 using 2captcha")
        
        if self.api_key_2captcha:
            return await self._solve_2captcha_recaptcha_v2(site_key, page_url)
        else:
            logger.warning("❌ No 2captcha API key configured")
            return None
    
    async def _solve_2captcha_recaptcha_v2(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve reCAPTCHA v2 using 2captcha service"""
        try:
            # Submit captcha
            submit_url = "http://2captcha.com/in.php"
            submit_data = {
                'key': self.api_key_2captcha,
                'method': 'userrecaptcha',
                'googlekey': site_key,
                'pageurl': page_url,
                'json': 1
            }
            
            response = requests.post(submit_url, data=submit_data, timeout=30)
            result = response.json()
            
            if result['status'] != 1:
                logger.error(f"❌ 2captcha submission failed: {result}")
                return None
                
            captcha_id = result['request']
            logger.info(f"✅ 2captcha captcha submitted, ID: {captcha_id}")
            
            # Poll for result
            result_url = "http://2captcha.com/res.php"
            max_attempts = 30  # 5 minutes max
            
            for attempt in range(max_attempts):
                await asyncio.sleep(10)  # Wait 10 seconds between attempts
                
                result_data = {
                    'key': self.api_key_2captcha,
                    'action': 'get',
                    'id': captcha_id,
                    'json': 1
                }
                
                response = requests.get(result_url, params=result_data, timeout=30)
                result = response.json()
                
                if result['status'] == 1:
                    logger.info("✅ 2captcha solved successfully")
                    return result['request']
                elif result['request'] == 'CAPCHA_NOT_READY':
                    logger.info(f"⏳ 2captcha still processing... (attempt {attempt + 1}/{max_attempts})")
                    continue
                else:
                    logger.error(f"❌ 2captcha error: {result}")
                    return None
                    
            logger.error("❌ 2captcha timeout - captcha not solved in time")
            return None
            
        except Exception as e:
            logger.error(f"❌ 2captcha exception: {e}")
            return None

    async def solve_image_captcha(self, image_path: str) -> Optional[str]:
        """
        Solve image-based captcha using 2captcha OCR service
        
        Args:
            image_path: Path to the captcha image
            
        Returns:
            The captcha text or None if failed
        """
        logger.info("🖼️ Attempting to solve image captcha using 2captcha")
        
        if self.api_key_2captcha:
            return await self._solve_2captcha_image(image_path)
        else:
            logger.warning("❌ No 2captcha API key configured")
            return None
    
    async def _solve_2captcha_image(self, image_path: str) -> Optional[str]:
        """Solve image captcha using 2captcha"""
        try:
            # Read and encode image
            with open(image_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Submit captcha
            submit_url = "http://2captcha.com/in.php"
            submit_data = {
                'key': self.api_key_2captcha,
                'method': 'base64',
                'body': image_data,
                'json': 1
            }
            
            response = requests.post(submit_url, data=submit_data, timeout=30)
            result = response.json()
            
            if result['status'] != 1:
                logger.error(f"❌ 2captcha image submission failed: {result}")
                return None
                
            captcha_id = result['request']
            logger.info(f"✅ 2captcha image submitted, ID: {captcha_id}")
            
            # Poll for result
            result_url = "http://2captcha.com/res.php"
            max_attempts = 20  # 3-4 minutes for image captchas
            
            for attempt in range(max_attempts):
                await asyncio.sleep(10)
                
                result_data = {
                    'key': self.api_key_2captcha,
                    'action': 'get',
                    'id': captcha_id,
                    'json': 1
                }
                
                response = requests.get(result_url, params=result_data, timeout=30)
                result = response.json()
                
                if result['status'] == 1:
                    logger.info(f"✅ 2captcha image solved: {result['request']}")
                    return result['request']
                elif result['request'] == 'CAPCHA_NOT_READY':
                    logger.info(f"⏳ 2captcha image processing... (attempt {attempt + 1}/{max_attempts})")
                    continue
                else:
                    logger.error(f"❌ 2captcha image error: {result}")
                    return None
                    
            logger.error("❌ 2captcha image timeout")
            return None
            
        except Exception as e:
            logger.error(f"❌ 2captcha image exception: {e}")
            return None


class ApplicationRequest(BaseModel):
    """Request model for job application"""
    session_id: Optional[str] = None
    job_url: str
    user_id: str

    # Basic user profile data
    full_name: str
    email: str
    phone: str
    location: str

    # Professional info
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None

    # Resume/CV data
    resume_text: Optional[str] = None
    resume_url: Optional[str] = None
    resume_file_path: Optional[str] = None
    resume_file_name: Optional[str] = None

    # Structured profile data
    work_experience: Optional[List[Dict[str, Any]]] = []
    education: Optional[List[Dict[str, Any]]] = []
    skills: Optional[Dict[str, List[str]]] = {}
    projects: Optional[List[Dict[str, Any]]] = []
    certifications: Optional[List[Dict[str, Any]]] = []

    # Career info
    years_of_experience: Optional[str] = None
    career_level: Optional[str] = None
    career_highlights: Optional[List[str]] = []

    # Generated content
    cover_letter: Optional[str] = None

    # Demographic data (optional)
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    veteran_status: Optional[str] = None
    disability_status: Optional[str] = None

    # Work authorization
    work_authorized: Optional[bool] = True
    requires_sponsorship: Optional[bool] = False
    work_arrangement: Optional[str] = None

    # Job search preferences
    desired_job_titles: Optional[List[str]] = []
    target_industries: Optional[List[str]] = []
    preferred_locations: Optional[List[str]] = []
    min_salary: Optional[int] = None
    job_type: Optional[str] = None
    start_availability: Optional[str] = None

    # Application preferences
    auto_apply_enabled: Optional[bool] = False
    applications_per_week: Optional[int] = None
    blacklisted_companies: Optional[List[str]] = []

    # Language skills
    language_skills: Optional[List[Dict[str, str]]] = []

    # Configuration
    headless: bool = True
    timeout: int = 300  # 5 minutes default


class ApplicationResult(BaseModel):
    """Result model for job application"""
    success: bool
    session_id: str
    job_url: str

    # Completion details
    fields_filled: int = 0
    total_fields: int = 0
    submission_confirmed: bool = False

    # Error tracking
    error_message: Optional[str] = None
    error_fields: List[str] = []

    # Media URLs (uploaded to Supabase)
    screenshot_url: Optional[str] = None
    video_url: Optional[str] = None

    # Execution metadata
    execution_time: float = 0.0
    agent_actions: List[str] = []

    # Timestamp
    completed_at: str = datetime.utcnow().isoformat()


class JobApplicationAgent:
    """
    AI agent for automated job applications using browser-use
    """

    def __init__(self):
        """Initialize the agent with OpenAI LLM and Browser"""
        logger.info("🚀 Initializing JobApplicationAgent...")
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("❌ OPENAI_API_KEY not found in environment variables")
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        redacted = api_key[:5] + "..." if len(api_key) > 8 else "***"
        logger.info(f"✅ OpenAI API key found (starts with {redacted})")

        # Use browser-use default LLM via OPENAI_API_KEY
        logger.info("🤖 Using browser-use default LLM (via OPENAI_API_KEY)")

        try:
            # Initialize Browser with config
            logger.info("🖥️ Initializing Browser...")
            browser_config = BrowserConfig(
                headless=True,  # Run in headless mode on Railway
                disable_security=False,
            )
            self.browser = Browser(config=browser_config)
            logger.info(f"✅ Browser initialized: {type(self.browser)}")

        except Exception as e:
            logger.error(f"❌ Failed to initialize Browser: {e}")
            raise

        # Initialize captcha solver
        self.captcha_solver = CaptchaSolver()
        logger.info("🤖 Captcha solver initialized")
        
        # Initialize Gmail verification handler
        self.gmail_handler = GmailVerificationHandler()
        logger.info("📧 Gmail verification handler initialized")
        
        # Register captcha solving functions for the agent
        self._register_captcha_functions()

        # Initialize agent reference
        self.agent: Optional[Agent] = None
        logger.info("✅ JobApplicationAgent initialization complete")
    
    def _register_captcha_functions(self):
        """Register captcha solving functions that the agent can call"""
        try:
            # Create captcha solving functions that can be called by the agent
            async def solve_recaptcha_v2(site_key: str, page_url: str) -> str:
                """Solve reCAPTCHA v2 using 2captcha service"""
                logger.info(f"🤖 Agent requested reCAPTCHA v2 solution for site_key: {site_key}")
                try:
                    solution = await self.captcha_solver.solve_recaptcha_v2(site_key, page_url)
                    logger.info(f"✅ reCAPTCHA v2 solved successfully")
                    return solution
                except Exception as e:
                    logger.error(f"❌ Failed to solve reCAPTCHA v2: {e}")
                    raise
            
            async def solve_image_captcha(image_base64: str) -> str:
                """Solve image captcha using 2captcha service"""
                logger.info(f"🤖 Agent requested image captcha solution")
                try:
                    solution = await self.captcha_solver.solve_image_captcha(image_base64)
                    logger.info(f"✅ Image captcha solved successfully")
                    return solution
                except Exception as e:
                    logger.error(f"❌ Failed to solve image captcha: {e}")
                    raise
            
            # Store functions for agent access
            self.solve_recaptcha_v2 = solve_recaptcha_v2
            self.solve_image_captcha = solve_image_captcha
            
            logger.info("✅ Captcha solving functions registered for agent access")
            
        except Exception as e:
            logger.error(f"❌ Failed to register captcha functions: {e}")
            raise
    
    async def _monitor_and_solve_captchas(self):
        """Monitor the browser for captchas and solve them automatically"""
        logger.info("🔍 Starting captcha monitoring...")
        
        try:
            while True:
                await asyncio.sleep(5)  # Check every 5 seconds
                
                if not self.agent or not hasattr(self.agent, 'browser') or not self.agent.browser:
                    continue
                
                try:
                    # Check for reCAPTCHA v2
                    recaptcha_check = await self.agent.browser.evaluate("""
                        () => {
                            const siteKeyElement = document.querySelector('[data-sitekey]');
                            const recaptchaFrame = document.querySelector('iframe[src*="recaptcha"]');
                            const responseField = document.getElementById('g-recaptcha-response');
                            
                            if (siteKeyElement && (!responseField || !responseField.value)) {
                                return {
                                    type: 'recaptcha_v2',
                                    siteKey: siteKeyElement.getAttribute('data-sitekey'),
                                    pageUrl: window.location.href,
                                    needsSolving: true
                                };
                            }
                            return { needsSolving: false };
                        }
                    """)
                    
                    if recaptcha_check.get('needsSolving'):
                        logger.info(f"🤖 reCAPTCHA v2 detected! Site key: {recaptcha_check.get('siteKey')}")
                        await self._solve_detected_recaptcha(recaptcha_check)
                        continue
                    
                    # Check for image captcha
                    image_captcha_check = await self.agent.browser.evaluate("""
                        () => {
                            const captchaImg = document.querySelector('img[src*="captcha"], img[alt*="captcha"], .captcha img, img[src*="challenge"]');
                            const captchaInput = document.querySelector('input[name*="captcha"], input[id*="captcha"], .captcha input');
                            
                            if (captchaImg && captchaInput && !captchaInput.value) {
                                // Convert image to base64
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = captchaImg.naturalWidth || captchaImg.width;
                                canvas.height = captchaImg.naturalHeight || captchaImg.height;
                                ctx.drawImage(captchaImg, 0, 0);
                                
                                return {
                                    type: 'image_captcha',
                                    imageBase64: canvas.toDataURL().split(',')[1],
                                    needsSolving: true
                                };
                            }
                            return { needsSolving: false };
                        }
                    """)
                    
                    if image_captcha_check.get('needsSolving'):
                        logger.info("🤖 Image captcha detected!")
                        await self._solve_detected_image_captcha(image_captcha_check)
                        continue
                        
                except Exception as check_error:
                    logger.debug(f"Captcha check error (normal): {check_error}")
                    continue
                    
        except asyncio.CancelledError:
            logger.info("🔍 Captcha monitoring stopped")
            raise
        except Exception as e:
            logger.error(f"❌ Captcha monitoring error: {e}")
    
    async def _solve_detected_recaptcha(self, captcha_info):
        """Solve a detected reCAPTCHA v2"""
        try:
            logger.info("🔧 Solving reCAPTCHA v2...")
            site_key = captcha_info['siteKey']
            page_url = captcha_info['pageUrl']
            
            # Use the captcha solver
            solution = await self.captcha_solver.solve_recaptcha_v2(site_key, page_url)
            
            # Inject the solution into the page
            await self.agent.browser.evaluate(f"""
                () => {{
                    const responseField = document.getElementById('g-recaptcha-response');
                    if (responseField) {{
                        responseField.value = '{solution}';
                        responseField.style.display = 'block';
                        
                        // Trigger change events
                        responseField.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        responseField.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        
                        // Try to trigger reCAPTCHA callback
                        if (window.grecaptcha && window.grecaptcha.getResponse) {{
                            try {{
                                window.grecaptcha.execute();
                            }} catch (e) {{
                                console.log('reCAPTCHA execute not available');
                            }}
                        }}
                        
                        console.log('✅ reCAPTCHA solution injected:', '{solution}');
                        return true;
                    }}
                    return false;
                }}
            """)
            
            logger.info("✅ reCAPTCHA v2 solved and injected!")
            
        except Exception as e:
            logger.error(f"❌ Failed to solve reCAPTCHA v2: {e}")
    
    async def _solve_detected_image_captcha(self, captcha_info):
        """Solve a detected image captcha"""
        try:
            logger.info("🔧 Solving image captcha...")
            image_base64 = captcha_info['imageBase64']
            
            # Use the captcha solver
            solution = await self.captcha_solver.solve_image_captcha(image_base64)
            
            # Inject the solution into the page
            await self.agent.browser.evaluate(f"""
                () => {{
                    const captchaInput = document.querySelector('input[name*="captcha"], input[id*="captcha"], .captcha input');
                    if (captchaInput) {{
                        captchaInput.value = '{solution}';
                        captchaInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        captchaInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        console.log('✅ Image captcha solution injected:', '{solution}');
                        return true;
                    }}
                    return false;
                }}
            """)
            
            logger.info("✅ Image captcha solved and injected!")
            
        except Exception as e:
            logger.error(f"❌ Failed to solve image captcha: {e}")
    
    async def handle_email_verification(self, user_id: str, user_email: str, sender_domain: str = None) -> Optional[Dict[str, Any]]:
        """
        Handle email verification during job application process
        """
        try:
            logger.info(f"📧 Starting email verification for user: {user_email}")
            
            # Use unified Gmail verification method (OAuth2 + browser fallback)
            logger.info("🔍 Starting unified Gmail verification code extraction...")
            verification_data = await self.gmail_handler.get_verification_code_unified(
                sender_domain=sender_domain,
                browser_agent=self
            )
            
            if verification_data:
                logger.info("✅ Verification email received!")
                return verification_data
            else:
                logger.warning("⏰ No verification email received within timeout")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error handling email verification: {e}")
            return None
    
    async def get_recent_verification_data(self, user_id: str, sender_domain: str = None) -> Optional[Dict[str, Any]]:
        """
        Get verification code/link from recent emails (for immediate use)
        """
        try:
            logger.info("📧 Checking recent emails for verification data...")
            
            # Use unified Gmail verification method (OAuth2 + browser fallback)
            verification_data = await self.gmail_handler.get_verification_code_unified(
                sender_domain=sender_domain,
                browser_agent=self
            )
            
            if verification_data:
                logger.info("✅ Found verification data in recent emails!")
                return verification_data
            else:
                logger.info("❌ No verification data found in recent emails")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error getting recent verification data: {e}")
            return None

    async def apply_to_job(self, request: ApplicationRequest, action_callback=None) -> ApplicationResult:
        """
        Main method to apply to a job using browser-use agent

        Args:
            request: ApplicationRequest with job URL and user data
            action_callback: Optional callback function to receive real-time action updates

        Returns:
            ApplicationResult with success status and details
        """
        start_time = datetime.utcnow()
        session_id = request.session_id or f"session_{start_time.timestamp()}"

        def log_action(action: str):
            """Helper to log actions both to terminal and callback"""
            # This will be picked up by the callback in main.py which formats it nicely
            if action_callback:
                action_callback(action)

        try:
            log_action(f"Initializing browser for job application: {request.job_url}")

            # Build the task description for the agent
            task_description = self._build_task_description(request)

            log_action("Task description created for AI agent")

            log_action("Using pre-configured browser instance")
            logger.info(f"🔧 Creating Agent with task: {task_description[:100]}...")
            logger.debug(f"Browser type: {type(self.browser)}")

            try:
                # Create the agent with browser instance (following working examples)
                logger.info("🤖 Creating browser-use Agent...")
                # Prepare media output directory per session and hint browser-use to store media there
                media_dir = (Path(tempfile.gettempdir()) / f"browser_use_media_{session_id}").resolve()
                media_dir.mkdir(parents=True, exist_ok=True)
                os.environ["BROWSER_USE_SAVE_DIR"] = str(media_dir)
                os.environ["BROWSER_USE_RECORD_VIDEO"] = os.getenv("BROWSER_USE_RECORD_VIDEO", "true")
                logger.info(f"📹 Media directory: {media_dir}")
                available_paths = self._prepare_available_file_paths(request)
                if available_paths:
                    logger.info(f"📎 Providing {len(available_paths)} available file path(s) to the agent for uploads")
                else:
                    logger.info("📎 No local resume file available; agent may skip file upload")

                # browser-use API: pass browser via Controller, not directly to Agent
                from browser_use import Controller

                controller = Controller()
                self.agent = Agent(
                    task=task_description,
                    controller=controller,
                )
                logger.info("✅ Agent created successfully")
                log_action("✅ AI Agent created successfully")

            except Exception as agent_error:
                logger.error(f"❌ Failed to create Agent: {agent_error}")
                logger.error(f"Agent error type: {type(agent_error)}")
                logger.error(f"Agent error details: {str(agent_error)}")
                
                # Check if it's the provider error
                if "provider" in str(agent_error).lower():
                    logger.error("🔍 This appears to be the 'provider' attribute error")
                    logger.debug(f"LLM has provider attribute: {hasattr(self.llm, 'provider')}")
                    if hasattr(self.llm, 'provider'):
                        logger.debug(f"LLM provider value: {getattr(self.llm, 'provider', 'NOT_SET')}")
                
                raise agent_error

            log_action(f"AI Agent created - navigating to {request.job_url}")
            log_action(f"Looking for job application form...")

            # Run the agent
            logger.info("🚀 Starting agent execution...")
            log_action("🚀 Starting AI agent execution...")
            
            try:
                # Start captcha monitoring in background
                captcha_monitor_task = asyncio.create_task(self._monitor_and_solve_captchas())
                
                try:
                    result = await self.agent.run()
                    logger.info("✅ Agent execution completed successfully")
                    log_action("✅ Agent execution completed successfully")
                    
                    # Keep browser open by preventing automatic cleanup
                    logger.info("🌐 Keeping browser open for manual verification...")
                    log_action("🌐 Browser kept open for verification")
                    
                finally:
                    # Cancel monitoring tasks
                    captcha_monitor_task.cancel()
                    try:
                        await captcha_monitor_task
                    except asyncio.CancelledError:
                        pass
                
            except Exception as run_error:
                logger.error(f"❌ Agent execution failed: {run_error}")
                logger.error(f"Run error type: {type(run_error)}")
                raise run_error

            # Extract results from agent execution
            execution_time = (datetime.utcnow() - start_time).total_seconds()

            # Get action history
            action_history = []
            try:
                for action in result.history():
                    action_str = str(action)
                    action_history.append(action_str)
                    log_action(f"Action taken: {action_str[:100]}...")
            except Exception as e:
                log_action(f"Could not extract full action history: {str(e)}")

            # Collect media artifacts if present and upload to storage
            screenshot_path = self._find_screenshot_file(media_dir)
            video_path = self._find_video_file(media_dir)
            uploaded_screenshot_url = None
            uploaded_video_url = None

            if screenshot_path or video_path:
                log_action("⬆️ Uploading media to storage")
                try:
                    uploaded_screenshot_url, uploaded_video_url = self._upload_media_to_supabase(
                        session_id=session_id,
                        screenshot_path=screenshot_path,
                        video_path=video_path,
                    )
                    logger.info(f"📤 Uploaded media: screenshot={uploaded_screenshot_url}, video={uploaded_video_url}")
                except Exception as upload_error:
                    logger.error(f"Failed to upload media: {upload_error}")

                # Try to update session record in DB with media URLs
                try:
                    if uploaded_screenshot_url or uploaded_video_url:
                        self._update_session_media_urls(
                            session_id=session_id,
                            screenshot_url=uploaded_screenshot_url,
                            video_url=uploaded_video_url,
                        )
                except Exception as update_error:
                    logger.error(f"Failed to update session with media URLs: {update_error}")

            # Parse the result and create ApplicationResult
            application_result = ApplicationResult(
                success=True,
                session_id=session_id,
                job_url=request.job_url,
                fields_filled=0,  # browser-use doesn't track individual fields
                total_fields=0,
                submission_confirmed=True,  # Assume success if no error
                screenshot_url=uploaded_screenshot_url,
                video_url=uploaded_video_url,
                execution_time=execution_time,
                agent_actions=action_history,
                completed_at=datetime.utcnow().isoformat()
            )

            log_action(f"✅ Application completed successfully in {execution_time:.2f}s")

            return application_result

        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds()

            log_action(f"❌ Application failed: {str(e)}")

            return ApplicationResult(
                success=False,
                session_id=session_id,
                job_url=request.job_url,
                error_message=str(e),
                screenshot_url=None,
                video_url=None,
                execution_time=execution_time,
                completed_at=datetime.utcnow().isoformat()
            )

        finally:
            # Keep browser open for verification - avoid any cleanup that might close it
            log_action("Browser kept open for verification and debugging")
            logger.info("🌐 Browser session remains open for manual verification")
            # Do not call any browser cleanup methods to keep it open

    def _build_task_description(self, request: ApplicationRequest) -> str:
        """
        Build a detailed natural language task description for the agent

        This is the key to browser-use - we describe what we want in natural language
        """
        task = f"""
Navigate to {request.job_url} and complete the job application form using the comprehensive user profile provided below.

YOUR TASK:
Fill out the entire job application form with the user's information provided below.
Complete ALL steps if it's a multi-page form.
Submit the application when all required fields are completed.

IMPORTANT: If email verification is required, try browser navigation to Gmail first (oduduabasiav@gmail.com / vavduke15@). If that fails, navigate to http://localhost:8080/oauth2-gmail-verification for OAuth2 fallback. Find the verification email that arrived RIGHT AFTER your submission (check timestamps), get the verification code, and return to complete the application.

CRITICAL REQUIREMENTS:
- MUST wait at least 7 seconds between filling each form field (7 seconds is MINIMUM, can be longer)
- This 7-second minimum delay is mandatory for every field interaction - never go faster than 7 seconds
- Take 7-15 seconds between fields to appear more human-like
- ENSURE ALL FIELDS ARE PROPERLY FILLED: Every dropdown must show a real selection (not "Select..."), every text field must have content, every required checkbox must be checked
- MANDATORY PRE-SUBMISSION CHECK: Before clicking Submit, scroll through ENTIRE form and verify EVERY field is filled
- DO NOT SUBMIT until you have confirmed all fields contain proper values (not empty, not placeholders)

INTELLIGENT FORM FILLING GUIDELINES:
- Use the exact information provided in the user profile below
- For fields not explicitly covered in the profile, generate intelligent, professional answers based on the user's background
- For "Why do you want to work here?" or similar questions, craft a thoughtful response based on the user's career level, skills, and experience
- For salary expectations, use industry standards based on the user's experience level and location
- For availability, use "Immediate" or "2 weeks notice" based on career level
- For "How did you hear about us?" select "Job Board", "Online", or "Company Website"
- Handle dropdowns, checkboxes, radio buttons, and text fields appropriately
- If the form has multiple pages/steps, complete each step thoroughly

SPECIFIC FIELD TYPE HANDLING:
- DROPDOWNS: Make sure they show actual selections, not "Select..." or blank
  * Interact with each dropdown until it displays a real selected value
  * Handle each dropdown appropriately - some need clicks, some need typing then clicking
  * VERIFY: Dropdown must show selected value, not placeholder text
  * Country: Use user's location or "United States" as default
  * State/Province: Select appropriate state based on user's location  
  * Gender: Use profile data or select "Prefer not to say"/"I prefer not to answer" if not available
  * Race/Ethnicity: Use profile data or select "Prefer not to say"/"I prefer not to answer" if not available
  * Disability Status: Select "I prefer not to answer"/"Prefer not to disclose" if not in profile
  * Veteran Status: Select "I prefer not to answer"/"Prefer not to disclose" if not in profile
  * IMPORTANT: For ALL EEO/demographic questions, if user hasn't provided the information, ALWAYS choose the "prefer not to answer" option
  * Work Authorization: Use profile data or select appropriate visa status
  * Education Level: Use highest degree from profile
  * VERIFICATION: After each dropdown selection, visually confirm the correct value is displayed
- CHECKBOXES: Check all required boxes, especially:
  * Terms and conditions agreements
  * Privacy policy agreements
  * Email communication preferences (if required)
- RADIO BUTTONS: Select appropriate option based on user profile
- TEXT AREAS: Fill with detailed, professional responses
- FILE UPLOADS: Always upload resume when requested
- DATE FIELDS: Use appropriate dates (start dates, graduation dates, etc.)

COMPLETION VERIFICATION PROCESS:
1. Fill all visible form fields with user's information (REMEMBER: minimum 7 seconds between each field - can take longer)
2. Scroll through entire form from top to bottom to find any missed fields
3. Visually check that ALL dropdowns have valid selections (not "Select..." or blank)
   - CRITICAL: Each dropdown must show an actual selected value
   - If any dropdown shows "Select...", "Choose...", or is blank, interact with it properly
   - VERIFY: Dropdown shows a real selection, not placeholder text
   - Do NOT proceed until every dropdown displays a properly selected option
4. Visually check that ALL required checkboxes are checked
5. Visually check that ALL text fields have content (not empty or placeholder text)
6. If any field is incomplete, fill it immediately (WAIT at least 7 seconds before next field)
7. PERFORM MANDATORY PRE-SUBMISSION VERIFICATION (see detailed process below)
8. Only click submit when you can see that every field is properly filled
9. After submit, wait for clear confirmation before marking as complete

STEALTH AND ANTI-DETECTION STRATEGIES:
- Move mouse naturally between form fields (avoid robotic movements)
- MANDATORY: Wait at least 7 seconds between filling each form field (7 seconds is MINIMUM - can take longer)
- Add realistic delays between actions (7-15 seconds between field fills for human-like behavior)
- Scroll naturally to bring form fields into view before interacting
- Use human-like typing patterns with occasional pauses
- If detected as bot, wait 30-60 seconds before retrying
- Avoid rapid-fire clicking or form submission
- Mimic human browsing behavior with occasional page scrolling
- CRITICAL: Never fill fields faster than 7 seconds apart - 7 seconds is the MINIMUM (can be longer for better stealth)

DROPDOWN HANDLING (CRITICAL - MUST CLICK DROPDOWNS):
- ⚠️ CRITICAL: Make sure EVERY dropdown has a proper selection, not "Select..." or blank
- ⚠️ CRITICAL: You MUST CLICK on dropdown options when they appear - DO NOT just type and press enter
- FOR EVERY DROPDOWN FIELD (country, location, state, gender, race, etc.):
  1. FIRST: Click the dropdown field to open it
  2. WAIT: Wait 2-3 seconds for the dropdown menu to fully appear on screen
  3. TYPE: Type the value to filter/search options (if it's a searchable dropdown)
  4. WAIT AGAIN: Wait 2-3 seconds for filtered options to appear
  5. LOOK: Visually identify the correct option in the dropdown list
  6. CLICK: CLICK ON THE ACTUAL DROPDOWN OPTION - NOT just the field, but the OPTION in the list
  7. VERIFY: After clicking, confirm the dropdown now shows your selected value (not "Select...")
- ⚠️ NEVER just type in a dropdown and press Enter - you MUST CLICK the visible dropdown option
- ⚠️ If the dropdown is still showing "Select..." or blank after your interaction, you did NOT click properly
- RETRY STRATEGY: If dropdown still blank after first attempt:
  1. Click the dropdown again to re-open it
  2. Wait 3 seconds for options to appear
  3. Find the option you want in the visible list
  4. CLICK DIRECTLY ON THAT OPTION (not the field, the option)
  5. Confirm selection appears
- Wait at least 7 seconds between each field interaction (minimum 7 seconds, can be longer)
- EXAMPLES OF DROPDOWNS THAT MUST BE CLICKED:
  * Country dropdown: Click dropdown → Wait → Type "United" → Wait → CLICK "United States" option
  * Location/City: Click dropdown → Wait → Type "San Francisco" → Wait → CLICK "San Francisco, CA" option
  * Gender: Click dropdown → Wait → CLICK "Male" or "Female" or "Prefer not to say" option
  * Race/Ethnicity: Click dropdown → Wait → CLICK appropriate option (e.g., "Asian", "White", "Prefer not to say")
  * Work Authorization: Click dropdown → Wait → CLICK appropriate option (e.g., "US Citizen", "H1B", "Green Card")

SMART FORM DETECTION AND SCROLLING:
- BEFORE scrolling endlessly, use JavaScript to detect if form fields exist on the page
- Execute: `document.querySelectorAll('input[type="text"], input[type="email"], textarea, select').length` to count form fields
- If form fields exist but aren't visible, scroll down in smaller increments (not full pages)
- If no form fields found after reasonable scrolling, the form might be on a different page or dynamically loaded
- Look for "Apply" buttons, "Submit Application" buttons, or form containers
- Try clicking "Apply Now" or similar buttons if form fields aren't immediately visible
- If stuck scrolling, take a screenshot to analyze the page structure

MANDATORY FORM COMPLETION RULES (CRITICAL):
- BEFORE clicking submit, scroll through the ENTIRE form from top to bottom
- Look for ANY empty fields, unfilled dropdowns, or unchecked required checkboxes
- Pay special attention to commonly missed fields:
  * Country/Location dropdowns (often default to "Select Country" - MUST CLICK to select actual country)
  * State/Province dropdowns (often require country selection first - MUST CLICK the state option)
  * Gender/Pronouns dropdowns (MUST CLICK option: "Male", "Female", or "Prefer not to say")
  * Race/Ethnicity dropdowns (MUST CLICK option like "Asian", "White", or "Prefer not to say")
  * Disability status dropdowns (MUST CLICK appropriate option)
  * Work authorization dropdowns (MUST CLICK option: "US Citizen", "H1B", "Green Card", etc.)
  * Salary expectation fields (enter reasonable amount based on experience)
  * Start date availability fields (enter "Immediate" or specific date)
- ⚠️ FOR DROPDOWNS showing "Select...", "Choose...", or blank - YOU MUST CLICK THE DROPDOWN OPTION:
  * Step 1: Click the dropdown field to open the option list
  * Step 2: Wait 2-3 seconds for options to appear on screen
  * Step 3: If searchable, type to filter options, then wait 2-3 seconds
  * Step 4: Visually locate the correct option in the dropdown list
  * Step 5: CLICK DIRECTLY ON THAT OPTION (not Enter key, CLICK with mouse)
  * Step 6: VERIFY the dropdown now displays your selected value (not "Select...")
  * Step 7: If still showing "Select..." or blank, REPEAT steps 1-6 until it works
- For required checkboxes (terms, privacy, etc.) - MUST check them
- If any field is empty or shows default placeholder text, fill it before submitting
- Only click submit when you have visually confirmed ALL fields are properly filled with actual values

VALIDATION AND ERROR HANDLING (CRITICAL):
- After filling the form, scroll through the ENTIRE form to check for validation errors
- Look for red borders, error messages, or required field indicators
- If ANY validation errors exist after clicking submit, DO NOT proceed to success
- Fix ALL validation errors by:
  1. Identifying the specific field with the error
  2. For DROPDOWNS with errors: YOU MUST CLICK THE DROPDOWN OPTION (not just type and Enter)
     - Step A: Click the dropdown field to open it
     - Step B: Wait 2-3 seconds for options to appear
     - Step C: Type to filter if needed, wait 2-3 seconds
     - Step D: CLICK THE OPTION you want (use mouse click, not keyboard)
     - Step E: Verify dropdown shows your selection (not "Select..." or blank)
     - Step F: If still blank/error, REPEAT steps A-E until dropdown shows real value
     - Step G: Wait at least 7 seconds before moving to next field
  3. For TEXT FIELDS: Fill with appropriate information from user profile (WAIT at least 7 seconds after filling)
  4. If no profile data exists for that field, generate a reasonable professional answer (WAIT at least 7 seconds after filling)
  5. Scroll through the form again to check for any other errors
- ⚠️ CRITICAL DROPDOWN ERROR FIX: If a dropdown has an error/is still showing "Select...":
  * DO NOT just type and press Enter - this does NOT work for most dropdowns
  * You MUST physically CLICK on the dropdown option in the list with your mouse
  * Open dropdown → Wait for list → Find option → CLICK it → Verify selection appears
- Repeat this process until NO validation errors remain and all fields are visually confirmed as filled
- REMEMBER: Always wait at least 7 seconds between filling any fields, even when fixing errors (7 seconds minimum)
- Only proceed to submit when the form is completely error-free and all required fields are filled

EMAIL VERIFICATION HANDLING (AGENT INSTRUCTIONS):
- If the form requests an email verification code, DO NOT give up
- ALWAYS use the email: oduduabasiav@gmail.com for verification
- WHEN EMAIL VERIFICATION IS NEEDED, YOU MUST TRY TWO METHODS:

METHOD 1 - BROWSER NAVIGATION (TRY THIS FIRST):
  1. Open a new browser tab (Ctrl+T or Cmd+T)
  2. Navigate to https://accounts.google.com/signin
  3. Log into Gmail using these credentials:
     - Email: oduduabasiav@gmail.com
     - Password: vavduke15@
  4. Go to Gmail inbox (https://mail.google.com)
  5. CRITICAL: Look for verification emails that arrived AFTER you submitted the application
     - Check email timestamps - look for emails received in the last 1-2 minutes
     - The verification email should have arrived RIGHT AFTER you clicked submit
     - Ignore older verification emails from previous applications (they may be from other job sites)
     - Look for emails with subjects containing "verification", "verify", "confirm", or "code"
     - EXAMPLE: If you submitted at 2:30 PM, look for emails received at 2:30-2:32 PM
     - The correct email will be the newest one that matches the submission timing
  6. Open the MOST RECENT verification email that matches the timing
  7. Find the verification code (4-8 digits) in the email content
  8. Copy or remember the verification code
  9. Return to the original job application tab
  10. Enter the verification code in the verification field
  11. Continue with the job application submission

METHOD 2 - OAUTH2 FALLBACK (IF BROWSER METHOD FAILS):
  If you cannot access Gmail through browser navigation (login fails, 2FA required, etc.):
  1. Open a new browser tab (Ctrl+T or Cmd+T)
  2. Navigate to: http://localhost:8080/oauth2-gmail-verification
  3. This will trigger the OAuth2 Gmail authentication process
  4. Follow the OAuth2 flow to authenticate with Gmail
  5. The page will display the verification code once retrieved
  6. Copy the verification code from the OAuth2 page
  7. Return to the original job application tab
  8. Enter the verification code in the job application form
  9. Close the OAuth2 tab and continue with the application submission

- TIMING IS CRUCIAL: The verification email arrives within 30 seconds to 2 minutes after submission
- If you don't see a recent verification email, wait 30 seconds and refresh Gmail
- SUPPORTED CODE FORMATS: 4-8 digit codes, alphanumeric codes
- Close the Gmail tab after getting the code (for Method 1)
- DO NOT abandon the application due to email verification - try both methods
- IMPORTANT: Always use oduduabasiav@gmail.com as the email address in forms

MANDATORY PRE-SUBMISSION VERIFICATION (CRITICAL - DO NOT SKIP):
Before clicking Submit, you MUST perform this complete verification process:

1. SCROLL TO TOP of the form and start systematic field-by-field verification
2. CHECK EVERY SINGLE FIELD on the page:
   - Text inputs: Must contain actual text (not empty, not placeholder text)
   - Dropdowns: Must show a selected value (not "Select...", "Choose...", or blank)
   - Checkboxes: Must be checked if required
   - Radio buttons: Must have one option selected if required
   - File uploads: Must show uploaded file name if required
   - Text areas: Must contain actual content if required

3. SCROLL THROUGH THE ENTIRE FORM systematically:
   - Start from the very top
   - Check each field one by one
   - Scroll down slowly to ensure no fields are missed
   - Pay special attention to fields that might be hidden or in collapsed sections

4. IF ANY FIELD IS EMPTY OR INCOMPLETE:
   - DO NOT SUBMIT YET
   - Fill the missing field immediately
   - Wait at least 7 seconds after filling
   - Start the verification process again from step 1

5. ONLY SUBMIT when you can confirm:
   - Every single field has a proper value
   - No field shows placeholder text
   - No dropdown shows "Select..." or similar
   - All required fields are completely filled
   - You have scrolled through the entire form and verified everything

6. DOUBLE-CHECK BEFORE CLICKING SUBMIT:
   - Scroll through one final time
   - Verify all fields are still filled (sometimes they reset)
   - Only then click the Submit button

CONFIRMATION AFTER SUBMITTING (BLOCK UNTIL CONFIRMED):
- After clicking Submit, DO NOT mark as complete until you see CLEAR confirmation
- Wait at least 10-15 seconds for page to process and show confirmation
- Confirmation indicators (look for ANY of these):
  - URL change to a thank-you/confirmation page
  - "Thank you for applying" or "Application submitted" message
  - "Your application has been received" text
  - Success banner or modal popup
  - Form disappears and is replaced with confirmation content
  - "Application complete" or similar success message
- If NO confirmation appears after 30 seconds, check for validation errors:
  - Scroll through entire form looking for red borders or error messages
  - Fill any missed required fields
  - Try submitting again
- DO NOT use the done() action unless you have CLEAR visual confirmation of successful submission
- If stuck without confirmation after multiple attempts, take a screenshot and report the issue

BROWSER SESSION MANAGEMENT (CRITICAL):
- NEVER close the browser window or session yourself
- NEVER call browser.close() or any cleanup methods
- Keep the browser open even after task completion for verification and debugging
- The browser will remain open so the user can verify the application was submitted correctly
- When using done(), do NOT close the browser - leave it open for manual verification
- This allows manual verification of successful submissions and debugging of any issues
- The user will manually close the browser when they are satisfied with the results

RESUME UPLOAD STRATEGY (IMPORTANT):
- Use the provided local resume file path when attaching files (do NOT rely on node IDs)
- Prefer clicking the file input label, then select the file from available files
- If the file input is inside a shadow DOM, pierce the shadow root and set files on the underlying <input type="file"> element
- If a drag-and-drop area is present, use it to drop the resume file
- Retry with an alternative method if the first attempt fails (label click → direct input → drag-and-drop)
- Confirm the file attachment succeeded before continuing to next step

EMAIL VERIFICATION HANDLING (CRITICAL):
- If the application process requires email verification, PAUSE and wait for verification email
- Look for buttons like "Send verification email", "Verify email address", or "Confirm email"
- After clicking verification button, wait 30-60 seconds for email to arrive
- The system will automatically check Gmail for verification codes and links
- If verification code is found, enter it in the appropriate field
- If verification link is found, the system will handle clicking it
- Common verification scenarios:
  * Email confirmation during account creation
  * Two-factor authentication codes
  * Application confirmation links
  * Account activation emails
- Wait for verification to complete before continuing with application

CAPTCHA AVOIDANCE & HANDLING STRATEGY (CRITICAL):
- PRIMARY GOAL: Avoid triggering captchas through stealth behavior (cloud browser mode enabled)
- Use human-like interactions to avoid bot detection that triggers captchas

CAPTCHA SOLVING INSTRUCTIONS (When captcha appears):

**STEP 1: IDENTIFY AND EXTRACT CAPTCHA INFORMATION**
- For reCAPTCHA v2: Extract the site key using: `document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey')`
- For image captcha: Take a screenshot of the captcha image
- Log the captcha type and extracted information clearly

**STEP 2: PAUSE AND WAIT FOR AUTOMATIC SOLVING**
- When you encounter a captcha, PAUSE the current task
- Log: "🤖 CAPTCHA DETECTED - Requesting automatic solution..."
- The Python backend will automatically detect the captcha and solve it using 2captcha service
- Wait 30-60 seconds for the captcha to be automatically solved

**STEP 3: VERIFY SOLUTION AND CONTINUE**
- Check if the captcha field is now filled (g-recaptcha-response for reCAPTCHA)
- If solved, continue with form submission
- If not solved after 60 seconds, try refreshing the page and retry (up to 3 attempts)

**IMPORTANT NOTES:**
- DO NOT try to solve captchas manually
- DO NOT execute JavaScript to call external APIs (CORS restrictions)
- The 2captcha integration is handled automatically by the Python backend
- Your job is to detect, pause, wait, and verify - the solving happens automatically
- If captcha solving fails after 3 attempts, mark as "CAPTCHA_UNSOLVED" error

COMPREHENSIVE USER PROFILE:

BASIC INFORMATION:
- Full Name: {request.full_name}
- Email: oduduabasiav@gmail.com (ALWAYS use this email for all applications)
- Phone: {request.phone}
- Location: {request.location}"""

        # Add professional links
        if request.linkedin_url:
            task += f"\n- LinkedIn: {request.linkedin_url}"
        if request.portfolio_url:
            task += f"\n- Portfolio: {request.portfolio_url}"

        # Add career information
        if request.years_of_experience:
            task += f"\n- Years of Experience: {request.years_of_experience}"
        if request.career_level:
            task += f"\n- Career Level: {request.career_level}"

        # Add resume information
        if request.resume_url:
            task += f"\n- Resume URL: {request.resume_url}"
        if request.resume_file_path:
            task += f"\n- Resume File Path: {request.resume_file_path}"

        # Add detailed work experience
        if request.work_experience and len(request.work_experience) > 0:
            task += "\n\nWORK EXPERIENCE:"
            for i, exp in enumerate(request.work_experience, 1):
                task += f"\n{i}. {exp.get('title', 'N/A')} at {exp.get('company', 'N/A')}"
                task += f"\n   Duration: {exp.get('duration', 'N/A')}"
                if exp.get('description'):
                    task += f"\n   Description: {exp.get('description')}"
                if exp.get('achievements'):
                    task += f"\n   Key Achievements: {', '.join(exp.get('achievements', []))}"
                if exp.get('technologies'):
                    task += f"\n   Technologies Used: {', '.join(exp.get('technologies', []))}"

        # Add education
        if request.education and len(request.education) > 0:
            task += "\n\nEDUCATION:"
            for i, edu in enumerate(request.education, 1):
                task += f"\n{i}. {edu.get('degree', 'N/A')} in {edu.get('field', 'N/A')}"
                task += f"\n   School: {edu.get('school', 'N/A')}"
                task += f"\n   Year: {edu.get('year', 'N/A')}"
                if edu.get('gpa'):
                    task += f"\n   GPA: {edu.get('gpa')}"

        # Add skills
        if request.skills:
            task += "\n\nSKILLS:"
            if request.skills.get('technical'):
                task += f"\n- Technical Skills: {', '.join(request.skills.get('technical', []))}"
            if request.skills.get('languages'):
                task += f"\n- Programming Languages: {', '.join(request.skills.get('languages', []))}"
            if request.skills.get('frameworks'):
                task += f"\n- Frameworks: {', '.join(request.skills.get('frameworks', []))}"
            if request.skills.get('tools'):
                task += f"\n- Tools: {', '.join(request.skills.get('tools', []))}"
            if request.skills.get('soft'):
                task += f"\n- Soft Skills: {', '.join(request.skills.get('soft', []))}"

        # Add projects
        if request.projects and len(request.projects) > 0:
            task += "\n\nNOTABLE PROJECTS:"
            for i, project in enumerate(request.projects, 1):
                task += f"\n{i}. {project.get('name', 'N/A')}"
                task += f"\n   Description: {project.get('description', 'N/A')}"
                if project.get('technologies'):
                    task += f"\n   Technologies: {', '.join(project.get('technologies', []))}"
                if project.get('url'):
                    task += f"\n   URL: {project.get('url')}"

        # Add certifications
        if request.certifications and len(request.certifications) > 0:
            task += "\n\nCERTIFICATIONS:"
            for i, cert in enumerate(request.certifications, 1):
                task += f"\n{i}. {cert.get('name', 'N/A')} - {cert.get('issuer', 'N/A')}"
                task += f"\n   Date: {cert.get('date', 'N/A')}"
                if cert.get('url'):
                    task += f"\n   Verification URL: {cert.get('url')}"

        # Add career highlights
        if request.career_highlights and len(request.career_highlights) > 0:
            task += "\n\nCAREER HIGHLIGHTS:"
            for highlight in request.career_highlights:
                task += f"\n- {highlight}"

        # Add cover letter if provided
        if request.cover_letter:
            task += f"\n\nCOVER LETTER TEMPLATE:\n{request.cover_letter}"

        # Add demographic data if provided (for EEO forms)
        if any([request.gender, request.ethnicity, request.veteran_status, request.disability_status]):
            task += "\n\nDEMOGRAPHIC INFORMATION (Optional - only fill if form requests):"
            if request.gender:
                task += f"\n- Gender: {request.gender}"
            if request.ethnicity:
                task += f"\n- Ethnicity: {request.ethnicity}"
            if request.veteran_status:
                task += f"\n- Veteran Status: {request.veteran_status}"
            if request.disability_status:
                task += f"\n- Disability Status: {request.disability_status}"

        task += """

INTELLIGENT ANSWER GENERATION:
For questions not directly covered in the profile above, generate professional answers based on:
- The user's experience level and career trajectory
- Their technical skills and industry background
- Their education and professional achievements
- Standard industry practices and expectations

Examples of intelligent answers:
- "Why do you want to work here?" → Reference the company's mission, technology stack alignment with user's skills, growth opportunities
- "What are your salary expectations?" → Use industry standards for the user's experience level and location
- "When can you start?" → "Immediate" for entry-level, "2 weeks notice" for experienced professionals
- "What motivates you?" → Reference career growth, technical challenges, team collaboration based on user's background

SUCCESS CRITERIA:
- ALL form fields are filled with appropriate, professional information
- NO validation errors remain on any part of the form
- Form submitted successfully with confirmation message visible
- Resume uploaded successfully if file upload field exists

FAILURE CONDITIONS:
- Any required field remains empty after submission attempt
- Any validation errors persist after submission attempt
- No confirmation message appears after submission

If you cannot complete due to technical issues, explain the specific blocking issue clearly and what you tried.
"""

        return task

    async def _handle_captcha_if_present(self, page_url: str) -> bool:
        """
        Detect and solve captchas on the current page
        
        Args:
            page_url: The current page URL for captcha solving context
            
        Returns:
            True if captcha was handled successfully or no captcha found, False if failed
        """
        try:
            # This would be called by the browser-use agent when it detects a captcha
            # For now, we'll rely on the agent's instructions to handle captchas
            # In the future, we could add more sophisticated detection here
            
            logger.info("🔍 Checking for captchas on the page...")
            
            # The actual captcha detection and solving will be handled by the browser-use agent
            # following the instructions in the task description
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error handling captcha: {e}")
            return False

    def _prepare_available_file_paths(self, request: ApplicationRequest) -> List[str]:
        """
        Build a list of local file paths the agent is allowed to upload.
        Priority:
          1) Explicit resume_file_path if exists
          2) Latest resume from database (resumes.file_content) for this user_id
          3) resume_url: if local path, use directly; if http(s), download to temp file
          4) resume_text: write to a temp .txt file
        """
        paths: List[str] = []

        try:
            # 1) Explicit local path
            if request.resume_file_path:
                p = Path(request.resume_file_path).expanduser().resolve()
                if p.exists() and p.is_file():
                    paths.append(str(p))
                    return paths
                else:
                    logger.warning(f"Provided resume_file_path does not exist: {p}")

            # 2) Fetch latest resume from DB for this user (if configured)
            db_path = self._fetch_resume_from_database(user_id=request.user_id)
            if db_path:
                paths.append(db_path)
                return paths

            # 2) URL or local path in resume_url
            if request.resume_url:
                parsed = urlparse(request.resume_url)
                if parsed.scheme in ("http", "https"):
                    try:
                        logger.info(f"⬇️  Downloading resume from URL: {request.resume_url}")
                        headers = {"User-Agent": "Mozilla/5.0"}
                        with httpx.Client(timeout=30.0, headers=headers) as client:
                            r = client.get(request.resume_url)
                            r.raise_for_status()

                            # Determine filename/extension
                            filename = Path(parsed.path).name or "resume.pdf"
                            if not Path(filename).suffix:
                                ctype = r.headers.get("content-type", "application/pdf")
                                ext = mimetypes.guess_extension(ctype.split(";")[0].strip()) or ".pdf"
                                filename = f"resume{ext}"

                            tmp_dir = Path(tempfile.gettempdir())
                            tmp_path = (tmp_dir / filename).resolve()
                            tmp_path.write_bytes(r.content)
                            logger.info(f"💾 Saved resume to {tmp_path}")
                            paths.append(str(tmp_path))
                            return paths
                    except Exception as e:
                        logger.error(f"Failed to download resume from URL: {e}")
                else:
                    # Treat as local path
                    p2 = Path(request.resume_url).expanduser().resolve()
                    if p2.exists() and p2.is_file():
                        paths.append(str(p2))
                        return paths
                    else:
                        logger.warning(f"resume_url not a valid local file: {p2}")

            # 3) Fallback to resume_text
            if request.resume_text:
                logger.info("📝 Writing resume_text to temporary file for upload")
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.txt')
                with open(tmp.name, 'w', encoding='utf-8') as f:
                    f.write(request.resume_text)
                paths.append(str(Path(tmp.name).resolve()))
                return paths

        except Exception as e:
            logger.error(f"Error preparing available_file_paths: {e}")

        return paths

    def _find_screenshot_file(self, media_dir: Path) -> Optional[str]:
        try:
            candidates = []
            candidates += glob.glob(str(media_dir / "**/*.png"), recursive=True)
            candidates += glob.glob(str(media_dir / "**/*screenshot*.png"), recursive=True)
            return candidates[0] if candidates else None
        except Exception:
            return None

    def _find_video_file(self, media_dir: Path) -> Optional[str]:
        try:
            candidates = []
            candidates += glob.glob(str(media_dir / "**/*.webm"), recursive=True)
            candidates += glob.glob(str(media_dir / "**/*.mp4"), recursive=True)
            return candidates[0] if candidates else None
        except Exception:
            return None

    def _upload_media_to_supabase(
        self,
        session_id: str,
        screenshot_path: Optional[str] = None,
        video_path: Optional[str] = None,
    ) -> tuple[Optional[str], Optional[str]]:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
            logger.debug("Supabase env not set; skipping media upload")
            return (None, None)

        base = supabase_url.rstrip('/')
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
        }
        screenshot_url = None
        video_url = None

        with httpx.Client(timeout=60.0, headers=headers) as client:
            # Screenshot
            if screenshot_path and Path(screenshot_path).exists():
                key = f"application-media/{session_id}/screenshot.png"
                upload_url = f"{base}/storage/v1/object/{key}"
                data = Path(screenshot_path).read_bytes()
                r = client.post(upload_url, content=data, headers={**headers, "Content-Type": "image/png"})
                if r.status_code in (200, 201):
                    screenshot_url = f"{base}/storage/v1/object/public/application-media/{session_id}/screenshot.png"
                else:
                    logger.error(f"Screenshot upload failed: {r.status_code} {r.text}")

            # Video
            if video_path and Path(video_path).exists():
                key = f"application-media/{session_id}/recording.webm"
                upload_url = f"{base}/storage/v1/object/{key}"
                data = Path(video_path).read_bytes()
                r = client.post(upload_url, content=data, headers={**headers, "Content-Type": "video/webm"})
                if r.status_code in (200, 201):
                    video_url = f"{base}/storage/v1/object/public/application-media/{session_id}/recording.webm"
                else:
                    logger.error(f"Video upload failed: {r.status_code} {r.text}")

        # Best-effort cleanup of local files
        for p in [screenshot_path, video_path]:
            try:
                if p and Path(p).exists():
                    Path(p).unlink()
            except Exception:
                pass

        return (screenshot_url, video_url)

    def _update_session_media_urls(
        self,
        session_id: str,
        screenshot_url: Optional[str],
        video_url: Optional[str],
    ) -> None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if not supabase_url or not supabase_key:
            return

        base = supabase_url.rstrip('/')
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        payload: Dict[str, Any] = {}
        if screenshot_url:
            payload["screenshot_url"] = screenshot_url
        if video_url:
            payload["video_url"] = video_url
        if not payload:
            return

        with httpx.Client(timeout=20.0, headers=headers) as client:
            url = f"{base}/rest/v1/auto_apply_sessions?id=eq.{session_id}"
            r = client.patch(url, json=payload)
            if r.status_code not in (200, 204):
                logger.error(f"Failed to update session media URLs: {r.status_code} {r.text}")

    def _fetch_resume_from_database(self, user_id: str) -> Optional[str]:
        """
        Fetch the latest resume for the user from Supabase via REST and write to a temp file.
        Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY with read access).
        Returns local file path if successful, else None.
        """
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if not supabase_url or not supabase_key:
            logger.debug("Supabase env not set; skipping DB resume fetch")
            return None

        try:
            rest_url = f"{supabase_url.rstrip('/')}/rest/v1/resumes"
            params = {
                "user_id": f"eq.{user_id}",
                "select": "id,file_name,file_content,file_type,updated_at",
                "order": "updated_at.desc",
                "limit": 1,
            }
            headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Accept": "application/json",
            }
            with httpx.Client(timeout=20.0, headers=headers) as client:
                r = client.get(rest_url, params=params)
                r.raise_for_status()
                rows = r.json()
                if not rows:
                    logger.info("No resume rows found for user in database")
                    return None
                row = rows[0]

                content = row.get("file_content")
                if not content:
                    logger.info("Resume row has no file_content; skipping DB fetch")
                    return None

                # Decode bytea: try hex (\\x...) then base64
                bytes_data: bytes
                if isinstance(content, str) and content.startswith("\\x"):
                    bytes_data = bytes.fromhex(content[2:])
                else:
                    try:
                        bytes_data = base64.b64decode(content)
                    except Exception:
                        # Fallback: assume utf-8 text
                        bytes_data = str(content).encode("utf-8")

                filename = row.get("file_name") or "resume.pdf"
                suffix = Path(filename).suffix or ".pdf"
                tmp_path = (Path(tempfile.gettempdir()) / f"resume_{row.get('id','tmp')}{suffix}").resolve()
                tmp_path.write_bytes(bytes_data)
                logger.info(f"💾 Loaded resume from DB into {tmp_path}")
                return str(tmp_path)

        except Exception as e:
            logger.error(f"Failed to fetch resume from database: {e}")
            return None

    async def _monitor_and_handle_email_verification(self, user_email: str):
        """
        Monitor for email verification requests and automatically handle them by opening Gmail in new tab
        """
        try:
            logger.info("📧 Starting email verification monitoring...")
            
            while True:
                await asyncio.sleep(5)  # Check every 5 seconds
                
                if not hasattr(self, 'agent') or not self.agent:
                    continue
                
                try:
                    # Check if there are any email verification fields on the page
                    page_content = await self.agent.browser.get_current_page().content()
                    
                    # Look for common verification field patterns
                    verification_patterns = [
                        'verification code',
                        'email code',
                        'confirm code',
                        'enter code',
                        'verification',
                        'code sent to',
                        'check your email',
                        'enter the code',
                        'verify your email'
                    ]
                    
                    page_text = page_content.lower()
                    has_verification = any(pattern in page_text for pattern in verification_patterns)
                    
                    if has_verification:
                        logger.info("🔍 Email verification detected on page - opening Gmail in new tab")
                        
                        # Open Gmail in new tab and get verification code
                        verification_code = await self._open_gmail_and_get_code()
                        
                        if verification_code:
                            logger.info(f"✅ Retrieved verification code from Gmail: {verification_code}")
                            
                            # Fill the verification code in the original tab
                            await self._fill_verification_code(verification_code)
                            
                        else:
                            logger.warning("⚠️ No verification code found in Gmail")
                
                except Exception as e:
                    logger.debug(f"Email verification check error: {e}")
                    continue
                    
        except asyncio.CancelledError:
            logger.info("📧 Email verification monitoring cancelled")
        except Exception as e:
            logger.error(f"❌ Email verification monitoring error: {e}")

    def _extract_sender_domain(self, page_content: str) -> str:
        """Extract sender domain from page content"""
        import re
        
        # Look for common patterns like "sent to email@domain.com"
        email_patterns = [
            r'sent to [^\s]*@([^\s\.]+\.[^\s]+)',
            r'check your email at [^\s]*@([^\s\.]+\.[^\s]+)',
            r'code sent to [^\s]*@([^\s\.]+\.[^\s]+)'
        ]
        
        for pattern in email_patterns:
            match = re.search(pattern, page_content.lower())
            if match:
                return match.group(1)
        
        return None

    async def _open_gmail_and_get_code(self) -> str:
        """
        Open Gmail in new tab, log in, and extract verification code
        """
        try:
            logger.info("🌐 Opening new tab for Gmail access")
            
            # Get current page to return to later
            original_page = self.agent.browser.get_current_page()
            
            # Create new tab
            context = await self.agent.browser.browser.new_context()
            gmail_page = await context.new_page()
            
            # Navigate to Gmail login
            logger.info("📧 Navigating to Gmail login")
            await gmail_page.goto("https://accounts.google.com/signin")
            await asyncio.sleep(3)
            
            # Enter email
            logger.info("✉️ Entering email address")
            email_input = await gmail_page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill("oduduabasiav@gmail.com")
            await gmail_page.click('button:has-text("Next")')
            await asyncio.sleep(3)
            
            # Enter password
            logger.info("🔑 Entering password")
            password_input = await gmail_page.wait_for_selector('input[type="password"]', timeout=10000)
            await password_input.fill("vavduke15@")
            await gmail_page.click('button:has-text("Next")')
            await asyncio.sleep(5)
            
            # Navigate to Gmail
            logger.info("📬 Accessing Gmail inbox")
            await gmail_page.goto("https://mail.google.com/mail/u/0/#inbox")
            await asyncio.sleep(5)
            
            # Search for verification emails
            logger.info("🔍 Searching for verification emails")
            
            # Try to find search box and search for verification emails
            try:
                search_box = await gmail_page.wait_for_selector('input[aria-label="Search mail"]', timeout=5000)
                await search_box.fill("verification code OR verify OR confirm")
                await gmail_page.keyboard.press('Enter')
                await asyncio.sleep(3)
            except:
                logger.info("📧 Using default inbox view")
            
            # Look for recent emails (first few in the list)
            verification_code = None
            
            # Try different selectors for email list
            email_selectors = [
                'tr[role="row"]',
                '.zA',
                '[data-thread-id]',
                'tr.zA'
            ]
            
            for selector in email_selectors:
                try:
                    emails = await gmail_page.query_selector_all(selector)
                    if emails:
                        logger.info(f"📧 Found {len(emails)} emails using selector {selector}")
                        
                        # Check first 5 emails
                        for i, email in enumerate(emails[:5]):
                            try:
                                # Click on email to open it
                                await email.click()
                                await asyncio.sleep(2)
                                
                                # Get email content
                                email_content = await gmail_page.text_content('body')
                                
                                if email_content:
                                    # Extract verification code using regex
                                    verification_code = self._extract_code_from_text(email_content)
                                    
                                    if verification_code:
                                        logger.info(f"✅ Found verification code in email {i+1}: {verification_code}")
                                        break
                                
                                # Go back to email list
                                await gmail_page.go_back()
                                await asyncio.sleep(1)
                                
                            except Exception as e:
                                logger.debug(f"Error processing email {i}: {e}")
                                continue
                        
                        if verification_code:
                            break
                            
                except Exception as e:
                    logger.debug(f"Error with selector {selector}: {e}")
                    continue
            
            # Close Gmail tab
            await context.close()
            
            return verification_code
            
        except Exception as e:
            logger.error(f"❌ Error opening Gmail and getting code: {e}")
            try:
                await context.close()
            except:
                pass
            return None

    def _extract_code_from_text(self, text: str) -> str:
        """Extract verification code from email text"""
        import re
        
        # Common verification code patterns
        patterns = [
            r'verification code[:\s]+([A-Z0-9]{4,8})',
            r'code[:\s]+([0-9]{4,8})',
            r'your code is[:\s]+([A-Z0-9]{4,8})',
            r'enter code[:\s]+([A-Z0-9]{4,8})',
            r'confirm.*code[:\s]+([A-Z0-9]{4,8})',
            r'([0-9]{4,8})\s*is your verification code',
            r'use code[:\s]+([A-Z0-9]{4,8})',
            r'security code[:\s]+([A-Z0-9]{4,8})',
            r'\b([0-9]{4,8})\b',  # Any 4-8 digit number
            r'\b([A-Z0-9]{6})\b'  # Any 6-character alphanumeric
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                code = match.group(1)
                # Validate code length
                if 4 <= len(code) <= 8:
                    return code
        
        return None

    async def _fill_verification_code(self, code: str):
        """Fill verification code in the form"""
        try:
            page = self.agent.browser.get_current_page()
            
            # Common selectors for verification code fields
            code_selectors = [
                'input[name*="code"]',
                'input[name*="verification"]',
                'input[placeholder*="code"]',
                'input[placeholder*="verification"]',
                'input[type="text"][maxlength="6"]',
                'input[type="text"][maxlength="8"]',
                '.verification-code input',
                '.email-code input'
            ]
            
            for selector in code_selectors:
                try:
                    element = await page.wait_for_selector(selector, timeout=2000)
                    if element:
                        await element.fill(code)
                        logger.info(f"✅ Filled verification code in field: {selector}")
                        
                        # Try to submit or continue
                        submit_selectors = [
                            'button[type="submit"]',
                            'button:has-text("verify")',
                            'button:has-text("continue")',
                            'button:has-text("confirm")'
                        ]
                        
                        for submit_selector in submit_selectors:
                            try:
                                submit_btn = await page.wait_for_selector(submit_selector, timeout=1000)
                                if submit_btn:
                                    await submit_btn.click()
                                    logger.info("✅ Clicked verification submit button")
                                    return
                            except:
                                continue
                        
                        return
                except:
                    continue
                    
            logger.warning("⚠️ Could not find verification code field")
            
        except Exception as e:
            logger.error(f"❌ Error filling verification code: {e}")

    async def _cleanup_browser(self):
        """Keep browser open - do not clean up browser resources"""
        try:
            if self.browser:
                # Explicitly keep browser open for verification
                logger.info("🌐 Browser kept open for manual verification")
                pass
        except Exception as e:
            logger.warning(f"⚠️ Warning during browser state check: {e}")


# Example usage (for testing)
async def test_agent():
    """Test function to verify agent works"""
    agent = JobApplicationAgent()

    test_request = ApplicationRequest(
        job_url="https://jobs.lever.co/example/apply",
        user_id="test_user_123",
        full_name="John Doe",
        email="john.doe@example.com",
        phone="+1234567890",
        location="San Francisco, CA",
        work_experience=[
            {
                "title": "Software Engineer",
                "company": "Tech Corp",
                "duration": "2020-2023",
                "description": "Built amazing things"
            }
        ],
        education=[
            {
                "degree": "Bachelor of Science",
                "field": "Computer Science",
                "school": "University of Example",
                "year": "2020"
            }
        ],
        headless=False  # Show browser for testing
    )

    result = await agent.apply_to_job(test_request)
    print(f"\n📊 Result: {result}")


if __name__ == "__main__":
    # Run test
    asyncio.run(test_agent())

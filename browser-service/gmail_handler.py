"""
Gmail OAuth2 Handler for reading verification emails
"""
import os
import re
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import base64
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

class GmailVerificationHandler:
    """
    Handles Gmail OAuth2 authentication and verification email reading
    Uses shared Gmail account for all users with fallback to browser automation
    """
    
    # Gmail API scopes
    SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
    
    # Shared Gmail credentials for all users
    SHARED_GMAIL_EMAIL = "oduduabasiav@gmail.com"
    SHARED_GMAIL_PASSWORD = "vavduke15@"
    
    # Verification code patterns
    VERIFICATION_PATTERNS = {
        'codes': [
            r'verification code[:\s]+([A-Z0-9]{4,8})',
            r'code[:\s]+([0-9]{4,6})',
            r'your code is[:\s]+([A-Z0-9]{4,8})',
            r'enter code[:\s]+([A-Z0-9]{4,8})',
            r'confirm.*code[:\s]+([A-Z0-9]{4,8})',
            r'([0-9]{6})\s*is your verification code',
            r'use code[:\s]+([A-Z0-9]{4,8})',
            r'security code[:\s]+([A-Z0-9]{4,8})',
        ],
        'links': [
            r'https?://[^\s<>"]+verify[^\s<>"]*',
            r'https?://[^\s<>"]+confirm[^\s<>"]*',
            r'https?://[^\s<>"]+activate[^\s<>"]*',
            r'https?://[^\s<>"]+validation[^\s<>"]*',
            r'https?://[^\s<>"]+email-verification[^\s<>"]*',
        ]
    }
    
    def __init__(self):
        self.credentials: Optional[Credentials] = None
        self.service = None
        self.user_email = None
        self.browser_fallback = None
        
        # Load environment variables (try multiple possible names)
        self.client_id = os.getenv('GMAIL_CLIENT_ID') or os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GMAIL_CLIENT_SECRET') or os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GMAIL_REDIRECT_URI') or os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/auth/callback')
        
        if not self.client_id or not self.client_secret:
            logger.warning("⚠️ Gmail OAuth2 credentials not found in environment variables")
            logger.info("🔄 Will use shared Gmail account with browser fallback")
    
    async def authenticate_user(self, user_id: str) -> bool:
        """
        Authenticate user with Gmail OAuth2
        Returns True if successful, False otherwise
        """
        try:
            logger.info(f"🔐 Starting Gmail OAuth2 authentication for user: {user_id}")
            
            # Check if we have stored credentials
            token_path = f"gmail_token_{user_id}.json"
            
            if os.path.exists(token_path):
                logger.info("📁 Found existing Gmail credentials, loading...")
                self.credentials = Credentials.from_authorized_user_file(token_path, self.SCOPES)
            
            # If credentials are not valid, refresh or re-authenticate
            if not self.credentials or not self.credentials.valid:
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    logger.info("🔄 Refreshing expired Gmail credentials...")
                    self.credentials.refresh(Request())
                else:
                    logger.info("🌐 Starting new Gmail OAuth2 flow...")
                    flow = Flow.from_client_config(
                        {
                            "web": {
                                "client_id": self.client_id,
                                "client_secret": self.client_secret,
                                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                                "token_uri": "https://oauth2.googleapis.com/token",
                                "redirect_uris": [self.redirect_uri]
                            }
                        },
                        scopes=self.SCOPES
                    )
                    flow.redirect_uri = self.redirect_uri
                    
                    # Generate authorization URL
                    auth_url, _ = flow.authorization_url(prompt='consent')
                    
                    logger.info(f"🔗 Please visit this URL to authorize Gmail access:")
                    logger.info(f"🔗 {auth_url}")
                    logger.info("⏳ Waiting for authorization... (This is a one-time setup)")
                    
                    # For now, we'll need manual authorization
                    # In production, this would be handled by a web interface
                    return False
                
                # Save credentials for future use
                with open(token_path, 'w') as token_file:
                    token_file.write(self.credentials.to_json())
            
            # Build Gmail service
            self.service = build('gmail', 'v1', credentials=self.credentials)
            
            # Get user's email address
            profile = self.service.users().getProfile(userId='me').execute()
            self.user_email = profile.get('emailAddress')
            
            logger.info(f"✅ Gmail authentication successful for: {self.user_email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Gmail authentication failed: {e}")
            return False
    
    async def authenticate_shared_gmail(self) -> bool:
        """
        Authenticate using shared Gmail account for all users
        Returns True if successful, False otherwise
        """
        try:
            logger.info("🔐 Using shared Gmail account authentication")
            
            # Try OAuth2 first if credentials are available
            if self.client_id and self.client_secret:
                # Check for shared Gmail token
                shared_token_path = "gmail_token_shared.json"
                
                if os.path.exists(shared_token_path):
                    logger.info("📁 Loading shared Gmail credentials from file")
                    self.credentials = Credentials.from_authorized_user_file(shared_token_path, self.SCOPES)
                
                # Refresh if needed
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    logger.info("🔄 Refreshing shared Gmail credentials")
                    self.credentials.refresh(Request())
                    
                    # Save refreshed credentials
                    with open(shared_token_path, 'w') as token_file:
                        token_file.write(self.credentials.to_json())
                
                if self.credentials and self.credentials.valid:
                    self.service = build('gmail', 'v1', credentials=self.credentials)
                    self.user_email = self.SHARED_GMAIL_EMAIL
                    logger.info(f"✅ Shared Gmail OAuth2 authentication successful: {self.user_email}")
                    return True
            
            logger.warning("⚠️ OAuth2 authentication failed, will use browser fallback for Gmail access")
            return False
            
        except Exception as e:
            logger.error(f"❌ Error during shared Gmail authentication: {str(e)}")
            return False
    
    async def login_gmail_with_browser(self, browser_agent) -> bool:
        """
        Login to Gmail using browser automation as fallback
        """
        try:
            logger.info("🌐 Attempting Gmail login via browser automation")
            
            # Navigate to Gmail
            await browser_agent.page.goto("https://accounts.google.com/signin")
            await asyncio.sleep(2)
            
            # Enter email
            email_input = await browser_agent.page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.fill(self.SHARED_GMAIL_EMAIL)
            await browser_agent.page.click('button:has-text("Next")')
            await asyncio.sleep(3)
            
            # Enter password
            password_input = await browser_agent.page.wait_for_selector('input[type="password"]', timeout=10000)
            await password_input.fill(self.SHARED_GMAIL_PASSWORD)
            await browser_agent.page.click('button:has-text("Next")')
            await asyncio.sleep(5)
            
            # Check if we're logged in by looking for Gmail interface
            try:
                await browser_agent.page.wait_for_selector('[data-tooltip="Gmail"]', timeout=5000)
                logger.info("✅ Gmail browser login successful")
                self.browser_fallback = browser_agent
                return True
            except:
                # Try navigating to Gmail directly
                await browser_agent.page.goto("https://mail.google.com")
                await asyncio.sleep(3)
                
                # Check for inbox
                try:
                    await browser_agent.page.wait_for_selector('[data-tooltip="Inbox"]', timeout=5000)
                    logger.info("✅ Gmail browser login successful (via direct navigation)")
                    self.browser_fallback = browser_agent
                    return True
                except:
                    logger.error("❌ Gmail login failed - could not access inbox")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Gmail browser login failed: {str(e)}")
            return False
    
    async def get_verification_code_from_browser(self, sender_domain: str = None, timeout_minutes: int = 5) -> Optional[Dict[str, Any]]:
        """
        Extract verification code from Gmail using browser automation
        """
        if not self.browser_fallback:
            logger.error("❌ Browser fallback not initialized")
            return None
            
        try:
            logger.info(f"🔍 Searching for verification emails from {sender_domain or 'any sender'}")
            
            # Navigate to Gmail inbox
            await self.browser_fallback.page.goto("https://mail.google.com/mail/u/0/#inbox")
            await asyncio.sleep(3)
            
            # Search for verification emails
            search_terms = ["verification", "verify", "confirm", "code", "authenticate"]
            if sender_domain:
                search_terms.append(f"from:{sender_domain}")
            
            # Use Gmail search
            search_box = await self.browser_fallback.page.wait_for_selector('input[aria-label="Search mail"]', timeout=10000)
            search_query = " OR ".join(search_terms)
            await search_box.fill(search_query)
            await self.browser_fallback.page.keyboard.press('Enter')
            await asyncio.sleep(3)
            
            # Look for recent emails (first 5)
            email_elements = await self.browser_fallback.page.query_selector_all('tr.zA')
            
            if not email_elements:
                logger.info("📧 No verification emails found")
                return None
            
            # Check each email for verification codes
            for i, email_element in enumerate(email_elements[:5]):
                try:
                    # Click on the email to open it
                    await email_element.click()
                    await asyncio.sleep(2)
                    
                    # Get email content
                    email_body = await self.browser_fallback.page.text_content('[role="listitem"]')
                    
                    if email_body:
                        # Extract verification data
                        verification_data = self._extract_verification_from_text(email_body)
                        
                        if verification_data['code'] or verification_data['link']:
                            logger.info(f"✅ Found verification data: {verification_data}")
                            return verification_data
                    
                    # Go back to search results
                    await self.browser_fallback.page.go_back()
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Error processing email {i}: {str(e)}")
                    continue
            
            logger.info("📧 No verification codes found in recent emails")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error extracting verification code from browser: {str(e)}")
            return None
    
    async def get_verification_code_unified(self, sender_domain: str = None, browser_agent=None) -> Optional[Dict[str, Any]]:
        """
        Unified method to get verification code using OAuth2 first, then browser fallback
        """
        logger.info("🔍 Starting unified verification code extraction")
        
        # Method 1: Try OAuth2 Gmail API first
        try:
            if await self.authenticate_shared_gmail():
                logger.info("✅ Using Gmail API for verification code extraction")
                verification_data = await self.get_verification_from_recent_emails(sender_domain)
                if verification_data:
                    return verification_data
                else:
                    logger.info("📧 No verification codes found via Gmail API")
            else:
                logger.info("⚠️ Gmail API authentication failed")
        except Exception as e:
            logger.warning(f"⚠️ Gmail API method failed: {str(e)}")
        
        # Method 2: Fallback to browser automation
        if browser_agent:
            try:
                logger.info("🌐 Falling back to browser automation for Gmail access")
                
                if await self.login_gmail_with_browser(browser_agent):
                    verification_data = await self.get_verification_code_from_browser(sender_domain)
                    if verification_data:
                        return verification_data
                    else:
                        logger.info("📧 No verification codes found via browser")
                else:
                    logger.error("❌ Browser Gmail login failed")
            except Exception as e:
                logger.error(f"❌ Browser fallback failed: {str(e)}")
        else:
            logger.warning("⚠️ No browser agent provided for fallback")
        
        logger.error("❌ All verification code extraction methods failed")
        return None
    
    def _extract_verification_from_text(self, text: str) -> Dict[str, Any]:
        """
        Extract verification code and link from text using regex patterns
        """
        result = {'code': None, 'link': None, 'text': text}
        
        # Clean text
        clean_text = re.sub(r'<[^>]+>', ' ', text)  # Remove HTML tags
        clean_text = re.sub(r'\s+', ' ', clean_text)  # Normalize whitespace
        
        # Try to find verification codes
        for pattern in self.VERIFICATION_PATTERNS['codes']:
            match = re.search(pattern, clean_text, re.IGNORECASE)
            if match:
                result['code'] = match.group(1)
                logger.info(f"🔑 Found verification code: {result['code']}")
                break
        
        # Try to find verification links
        for pattern in self.VERIFICATION_PATTERNS['links']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result['link'] = match.group(0)
                logger.info(f"🔗 Found verification link: {result['link']}")
                break
        
        return result
    
    async def get_recent_emails(self, 
                               query: str = "verification OR confirm OR activate", 
                               minutes: int = 5,
                               max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent emails matching the query
        """
        try:
            if not self.service:
                logger.error("❌ Gmail service not initialized")
                return []
            
            # Calculate time filter (last N minutes)
            since_time = datetime.now() - timedelta(minutes=minutes)
            since_timestamp = int(since_time.timestamp())
            
            # Build search query
            search_query = f"{query} after:{since_timestamp}"
            
            logger.info(f"🔍 Searching Gmail for: {search_query}")
            
            # Search for messages
            results = self.service.users().messages().list(
                userId='me',
                q=search_query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            
            if not messages:
                logger.info("📭 No recent verification emails found")
                return []
            
            logger.info(f"📧 Found {len(messages)} recent emails")
            
            # Get full message details
            email_details = []
            for message in messages:
                try:
                    msg = self.service.users().messages().get(
                        userId='me',
                        id=message['id'],
                        format='full'
                    ).execute()
                    
                    email_details.append(self._parse_email_message(msg))
                    
                except Exception as e:
                    logger.warning(f"⚠️ Failed to get message details: {e}")
                    continue
            
            return email_details
            
        except HttpError as e:
            logger.error(f"❌ Gmail API error: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Error getting recent emails: {e}")
            return []
    
    def _parse_email_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Gmail message into structured format
        """
        headers = message['payload'].get('headers', [])
        
        # Extract headers
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '')
        sender = next((h['value'] for h in headers if h['name'] == 'From'), '')
        date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
        
        # Extract body
        body = self._extract_email_body(message['payload'])
        
        return {
            'id': message['id'],
            'subject': subject,
            'sender': sender,
            'date': date,
            'body': body,
            'snippet': message.get('snippet', '')
        }
    
    def _extract_email_body(self, payload: Dict[str, Any]) -> str:
        """
        Extract email body from Gmail message payload
        """
        body = ""
        
        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    data = part['body'].get('data')
                    if data:
                        body = base64.urlsafe_b64decode(data).decode('utf-8')
                        break
                elif part['mimeType'] == 'text/html':
                    data = part['body'].get('data')
                    if data:
                        body = base64.urlsafe_b64decode(data).decode('utf-8')
        else:
            if payload['mimeType'] == 'text/plain':
                data = payload['body'].get('data')
                if data:
                    body = base64.urlsafe_b64decode(data).decode('utf-8')
        
        return body
    
    async def extract_verification_code(self, email_content: str) -> Optional[str]:
        """
        Extract verification code from email content
        """
        try:
            logger.info("🔍 Extracting verification code from email...")
            
            for pattern in self.VERIFICATION_PATTERNS['codes']:
                match = re.search(pattern, email_content, re.IGNORECASE)
                if match:
                    code = match.group(1).strip()
                    logger.info(f"✅ Found verification code: {code}")
                    return code
            
            logger.info("❌ No verification code found in email")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error extracting verification code: {e}")
            return None
    
    async def extract_verification_link(self, email_content: str) -> Optional[str]:
        """
        Extract verification link from email content
        """
        try:
            logger.info("🔍 Extracting verification link from email...")
            
            for pattern in self.VERIFICATION_PATTERNS['links']:
                match = re.search(pattern, email_content, re.IGNORECASE)
                if match:
                    link = match.group(0).strip()
                    # Clean up link (remove trailing punctuation)
                    link = re.sub(r'[.,;!?]+$', '', link)
                    logger.info(f"✅ Found verification link: {link}")
                    return link
            
            logger.info("❌ No verification link found in email")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error extracting verification link: {e}")
            return None
    
    async def wait_for_verification_email(self, 
                                        sender_domain: str = None,
                                        timeout_minutes: int = 5,
                                        check_interval: int = 10) -> Optional[Dict[str, Any]]:
        """
        Wait for a verification email to arrive
        """
        try:
            logger.info(f"⏳ Waiting for verification email (timeout: {timeout_minutes} minutes)...")
            
            start_time = datetime.now()
            timeout = timedelta(minutes=timeout_minutes)
            
            while datetime.now() - start_time < timeout:
                # Check for recent emails
                query = "verification OR confirm OR activate"
                if sender_domain:
                    query += f" from:{sender_domain}"
                
                emails = await self.get_recent_emails(query=query, minutes=1)
                
                if emails:
                    latest_email = emails[0]  # Get most recent
                    logger.info(f"📧 Found verification email from: {latest_email['sender']}")
                    
                    # Extract code and link
                    code = await self.extract_verification_code(latest_email['body'])
                    link = await self.extract_verification_link(latest_email['body'])
                    
                    return {
                        'email': latest_email,
                        'verification_code': code,
                        'verification_link': link
                    }
                
                # Wait before checking again
                logger.info(f"⏳ No verification email yet, checking again in {check_interval} seconds...")
                await asyncio.sleep(check_interval)
            
            logger.warning(f"⏰ Timeout waiting for verification email ({timeout_minutes} minutes)")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error waiting for verification email: {e}")
            return None
    
    async def get_verification_from_recent_emails(self, sender_domain: str = None) -> Optional[Dict[str, Any]]:
        """
        Get verification code/link from recent emails (last 5 minutes)
        """
        try:
            query = "verification OR confirm OR activate"
            if sender_domain:
                query += f" from:{sender_domain}"
            
            emails = await self.get_recent_emails(query=query, minutes=5)
            
            if not emails:
                return None
            
            # Check each email for verification data
            for email in emails:
                code = await self.extract_verification_code(email['body'])
                link = await self.extract_verification_link(email['body'])
                
                if code or link:
                    logger.info(f"✅ Found verification data in email from: {email['sender']}")
                    return {
                        'email': email,
                        'verification_code': code,
                        'verification_link': link
                    }
            
            logger.info("❌ No verification data found in recent emails")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error getting verification from recent emails: {e}")
            return None

#!/usr/bin/env python3
"""
Simple Gmail Verification Test
Tests OAuth2 method first, then shows how browser fallback would work
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

from gmail_handler import GmailVerificationHandler

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_oauth2_setup():
    """Test if OAuth2 credentials are properly configured"""
    print("🔍 Testing OAuth2 Configuration")
    print("-" * 40)
    
    # Load environment variables
    load_dotenv()
    load_dotenv('../.env.local')
    
    gmail_client_id = os.getenv('GMAIL_CLIENT_ID')
    gmail_client_secret = os.getenv('GMAIL_CLIENT_SECRET')
    gmail_redirect_uri = os.getenv('GMAIL_REDIRECT_URI')
    
    print(f"Gmail Client ID: {'✅ Found' if gmail_client_id else '❌ Missing'}")
    print(f"Gmail Client Secret: {'✅ Found' if gmail_client_secret else '❌ Missing'}")
    print(f"Gmail Redirect URI: {gmail_redirect_uri or 'Using default'}")
    
    if gmail_client_id and gmail_client_secret:
        print("✅ OAuth2 credentials are configured!")
        return True
    else:
        print("❌ OAuth2 credentials missing")
        return False

async def test_shared_gmail_auth():
    """Test shared Gmail authentication"""
    print("\n🔐 Testing Shared Gmail Authentication")
    print("-" * 40)
    
    gmail_handler = GmailVerificationHandler()
    
    try:
        success = await gmail_handler.authenticate_shared_gmail()
        
        if success:
            print("✅ Shared Gmail OAuth2 authentication successful!")
            print(f"📧 Authenticated as: {gmail_handler.user_email}")
            return True
        else:
            print("❌ Shared Gmail OAuth2 authentication failed")
            print("💡 This is expected if you haven't run the OAuth2 setup yet")
            return False
            
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return False

async def test_email_search():
    """Test searching for verification emails"""
    print("\n📧 Testing Email Search (if authenticated)")
    print("-" * 40)
    
    gmail_handler = GmailVerificationHandler()
    
    # Try to authenticate first
    auth_success = await gmail_handler.authenticate_shared_gmail()
    
    if not auth_success:
        print("⚠️ Skipping email search - authentication failed")
        return False
    
    try:
        # Search for recent verification emails
        verification_data = await gmail_handler.get_verification_from_recent_emails()
        
        if verification_data:
            print(f"✅ Found verification data: {verification_data}")
            return True
        else:
            print("📭 No recent verification emails found")
            print("💡 This is normal if there are no recent verification emails")
            return True
            
    except Exception as e:
        print(f"❌ Email search error: {str(e)}")
        return False

def show_setup_instructions():
    """Show setup instructions"""
    print("\n📋 SETUP INSTRUCTIONS")
    print("=" * 50)
    print("To enable Gmail OAuth2 access:")
    print()
    print("1. Your OAuth2 credentials are already configured in .env.local:")
    print("   ✅ GMAIL_CLIENT_ID")
    print("   ✅ GMAIL_CLIENT_SECRET") 
    print("   ✅ GMAIL_REDIRECT_URI")
    print()
    print("2. Run the OAuth2 setup to authorize the shared Gmail account:")
    print("   python3 setup_gmail_oauth.py")
    print()
    print("3. When the browser opens, log in with:")
    print("   📧 Email: oduduabasiav@gmail.com")
    print("   🔑 Password: vavduke15@")
    print()
    print("4. After authorization, the system will be able to:")
    print("   ✅ Read verification emails via Gmail API")
    print("   ✅ Extract verification codes automatically")
    print("   ✅ Fall back to browser automation if needed")

def show_browser_fallback_info():
    """Show browser fallback information"""
    print("\n🌐 BROWSER FALLBACK METHOD")
    print("=" * 50)
    print("If OAuth2 fails, the system will automatically:")
    print()
    print("1. 🌐 Open a browser and navigate to Gmail")
    print("2. 🔐 Log in using the shared credentials:")
    print("   📧 oduduabasiav@gmail.com")
    print("   🔑 vavduke15@")
    print("3. 🔍 Search for verification emails")
    print("4. 📧 Extract verification codes from email content")
    print("5. ✅ Return the codes to the job application process")
    print()
    print("This ensures 100% reliability even if the Gmail API is unavailable!")

async def main():
    """Main test function"""
    print("🧪 Gmail Verification System - Simple Test")
    print("=" * 60)
    
    # Test 1: Check OAuth2 configuration
    oauth_configured = await test_oauth2_setup()
    
    # Test 2: Try shared Gmail authentication
    auth_success = await test_shared_gmail_auth()
    
    # Test 3: Try email search (if authenticated)
    if auth_success:
        await test_email_search()
    
    # Show results and instructions
    print("\n📊 TEST SUMMARY")
    print("=" * 60)
    
    if oauth_configured and auth_success:
        print("🎉 Gmail OAuth2 is working perfectly!")
        print("✅ The system can read verification emails via Gmail API")
        print("✅ Browser fallback is available as backup")
    elif oauth_configured and not auth_success:
        print("⚠️ OAuth2 is configured but not authorized yet")
        show_setup_instructions()
    else:
        print("❌ OAuth2 credentials are missing")
        print("💡 Browser fallback will be used instead")
    
    # Always show browser fallback info
    show_browser_fallback_info()
    
    print("\n🚀 NEXT STEPS")
    print("=" * 60)
    if not auth_success:
        print("1. Run: python3 setup_gmail_oauth.py")
        print("2. Authorize with oduduabasiav@gmail.com")
        print("3. Test again: python3 test_gmail_simple.py")
    else:
        print("✅ Gmail verification is ready!")
        print("🔄 The system will automatically handle verification codes during job applications")

if __name__ == "__main__":
    asyncio.run(main())

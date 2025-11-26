#!/usr/bin/env python3
"""
Test Gmail Verification System
Tests both OAuth2 and browser fallback methods
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
from browser_agent import JobApplicationAgent

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_oauth2_method():
    """Test Gmail OAuth2 API method"""
    print("\n" + "="*50)
    print("🔍 TESTING OAUTH2 METHOD")
    print("="*50)
    
    gmail_handler = GmailVerificationHandler()
    
    try:
        # Test OAuth2 authentication
        success = await gmail_handler.authenticate_shared_gmail()
        
        if success:
            print("✅ OAuth2 authentication successful!")
            
            # Test getting recent verification emails
            verification_data = await gmail_handler.get_verification_from_recent_emails()
            
            if verification_data:
                print(f"✅ Found verification data: {verification_data}")
                return True
            else:
                print("📧 No verification emails found (this is normal if no recent emails)")
                return True
        else:
            print("❌ OAuth2 authentication failed")
            return False
            
    except Exception as e:
        print(f"❌ OAuth2 method error: {str(e)}")
        return False

async def test_browser_fallback():
    """Test browser automation fallback"""
    print("\n" + "="*50)
    print("🌐 TESTING BROWSER FALLBACK METHOD")
    print("="*50)
    
    try:
        # Initialize browser agent
        browser_agent = JobApplicationAgent()
        gmail_handler = GmailVerificationHandler()
        
        # Start browser session
        await browser_agent.start_session()
        print("✅ Browser session started")
        
        # Test Gmail login
        login_success = await gmail_handler.login_gmail_with_browser(browser_agent)
        
        if login_success:
            print("✅ Gmail browser login successful!")
            
            # Test verification code extraction
            verification_data = await gmail_handler.get_verification_code_from_browser()
            
            if verification_data:
                print(f"✅ Found verification data: {verification_data}")
            else:
                print("📧 No verification emails found (this is normal if no recent emails)")
            
            return True
        else:
            print("❌ Gmail browser login failed")
            return False
            
    except Exception as e:
        print(f"❌ Browser fallback error: {str(e)}")
        return False
    finally:
        try:
            await browser_agent.cleanup()
            print("🧹 Browser session cleaned up")
        except:
            pass

async def test_unified_method():
    """Test the unified method (OAuth2 + browser fallback)"""
    print("\n" + "="*50)
    print("🔄 TESTING UNIFIED METHOD")
    print("="*50)
    
    try:
        browser_agent = JobApplicationAgent()
        gmail_handler = GmailVerificationHandler()
        
        # Start browser session for fallback
        await browser_agent.start_session()
        
        # Test unified method
        verification_data = await gmail_handler.get_verification_code_unified(
            sender_domain=None,  # Search all domains
            browser_agent=browser_agent
        )
        
        if verification_data:
            print(f"✅ Unified method found verification data: {verification_data}")
            return True
        else:
            print("📧 No verification emails found (this is normal if no recent emails)")
            return True
            
    except Exception as e:
        print(f"❌ Unified method error: {str(e)}")
        return False
    finally:
        try:
            await browser_agent.cleanup()
        except:
            pass

async def main():
    """Main test function"""
    print("🧪 Gmail Verification System Test")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    load_dotenv('.env.local')
    
    # Check for required credentials
    gmail_client_id = os.getenv('GMAIL_CLIENT_ID')
    gmail_client_secret = os.getenv('GMAIL_CLIENT_SECRET')
    
    print(f"📋 Environment Check:")
    print(f"   Gmail Client ID: {'✅ Found' if gmail_client_id else '❌ Missing'}")
    print(f"   Gmail Client Secret: {'✅ Found' if gmail_client_secret else '❌ Missing'}")
    print(f"   OpenAI API Key: {'✅ Found' if os.getenv('OPENAI_API_KEY') else '❌ Missing'}")
    
    results = {}
    
    # Test 1: OAuth2 Method
    try:
        results['oauth2'] = await test_oauth2_method()
    except Exception as e:
        print(f"❌ OAuth2 test failed: {str(e)}")
        results['oauth2'] = False
    
    # Test 2: Browser Fallback Method
    try:
        results['browser'] = await test_browser_fallback()
    except Exception as e:
        print(f"❌ Browser test failed: {str(e)}")
        results['browser'] = False
    
    # Test 3: Unified Method
    try:
        results['unified'] = await test_unified_method()
    except Exception as e:
        print(f"❌ Unified test failed: {str(e)}")
        results['unified'] = False
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST RESULTS SUMMARY")
    print("="*60)
    
    for method, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {method.upper()} Method: {status}")
    
    if any(results.values()):
        print("\n🎉 At least one method is working! Gmail verification is ready.")
    else:
        print("\n⚠️  All methods failed. Please check your setup.")
    
    print("\n💡 Next Steps:")
    if results.get('oauth2'):
        print("   - OAuth2 is working! This is the preferred method.")
    elif results.get('browser'):
        print("   - Browser fallback is working! This will be used as backup.")
    else:
        print("   - Check your Gmail credentials and internet connection.")
        print("   - Make sure the shared Gmail account is accessible.")

if __name__ == "__main__":
    asyncio.run(main())

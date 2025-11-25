#!/usr/bin/env python3
"""
Check and suggest redirect URIs for Gmail OAuth2
"""

def show_redirect_uri_fix():
    """Show detailed instructions for fixing redirect URI"""
    print("🔧 REDIRECT URI TROUBLESHOOTING")
    print("=" * 50)
    print()
    print("The redirect_uri_mismatch error means Google Cloud Console")
    print("doesn't have the correct redirect URI configured.")
    print()
    print("📋 STEP-BY-STEP FIX:")
    print()
    print("1. Go to Google Cloud Console:")
    print("   https://console.cloud.google.com/apis/credentials")
    print()
    print("2. Find your OAuth 2.0 Client ID:")
    print("   26851912397-rvfnv7c5ifvc65qs4ja439hgohpshht0.apps.googleusercontent.com")
    print()
    print("3. Click the EDIT (pencil) icon")
    print()
    print("4. Under 'Authorized redirect URIs', ADD ALL of these:")
    print("   ✅ http://localhost:8080/")
    print("   ✅ http://localhost:8080")
    print("   ✅ http://127.0.0.1:8080/")
    print("   ✅ http://127.0.0.1:8080")
    print("   ✅ http://localhost:3000/api/auth/gmail/callback")
    print()
    print("5. Click SAVE")
    print()
    print("6. Wait 2-3 minutes for changes to propagate")
    print()
    print("7. Try the setup again")
    print()
    print("💡 ALTERNATIVE: Test Browser Fallback")
    print("If OAuth2 continues to fail, we can test the browser")
    print("automation fallback method instead.")
    print()

def show_browser_fallback_test():
    """Show how to test browser fallback"""
    print("🌐 TESTING BROWSER FALLBACK METHOD")
    print("=" * 50)
    print()
    print("Since OAuth2 is having issues, let's test the browser")
    print("automation method that will be used as fallback:")
    print()
    print("This method will:")
    print("1. 🌐 Open a browser automatically")
    print("2. 🔐 Navigate to Gmail and log in")
    print("3. 📧 Search for verification emails")
    print("4. 🔍 Extract verification codes")
    print("5. ✅ Return codes to job applications")
    print()
    print("To test this method:")
    print("python3 test_browser_fallback.py")
    print()

if __name__ == "__main__":
    print("Gmail OAuth2 Redirect URI Troubleshooting")
    print("=" * 60)
    
    show_redirect_uri_fix()
    show_browser_fallback_test()
    
    print("🎯 RECOMMENDATION:")
    print("1. Fix the redirect URIs in Google Cloud Console")
    print("2. If that doesn't work, use browser fallback")
    print("3. Both methods will work for job applications!")

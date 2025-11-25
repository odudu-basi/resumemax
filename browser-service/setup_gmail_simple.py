#!/usr/bin/env python3
"""
Simple Gmail OAuth2 Setup
Uses standard localhost:8080 redirect URI
"""

import os
import json
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def setup_gmail_oauth():
    """
    Set up Gmail OAuth2 credentials for the shared account
    """
    print("🔧 Setting up Gmail OAuth2 for shared account...")
    
    # Use your credentials directly
    client_id = "26851912397-rvfnv7c5ifvc65qs4ja439hgohpshht0.apps.googleusercontent.com"
    client_secret = "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"
    
    print("✅ Using configured OAuth2 credentials")
    
    # Create credentials dict with standard localhost redirect
    credentials_info = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": ["http://localhost:8080/"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }
    
    # Save temporary credentials file
    temp_creds_path = "temp_gmail_credentials.json"
    with open(temp_creds_path, 'w') as f:
        json.dump(credentials_info, f)
    
    try:
        # Run OAuth2 flow
        flow = InstalledAppFlow.from_client_secrets_file(
            temp_creds_path, SCOPES)
        
        print("🌐 Opening browser for Gmail authorization...")
        print("📧 Please log in with: oduduabasiav@gmail.com")
        print("🔑 Password: vavduke15@")
        print()
        print("⚠️  If you get a redirect_uri_mismatch error:")
        print("   1. Go to Google Cloud Console")
        print("   2. Navigate to APIs & Services > Credentials")
        print("   3. Edit your OAuth 2.0 Client ID")
        print("   4. Add 'http://localhost:8080/' to Authorized redirect URIs")
        print("   5. Save and try again")
        print()
        
        creds = flow.run_local_server(port=8080)
        
        # Save the credentials for shared use
        shared_token_path = "gmail_token_shared.json"
        with open(shared_token_path, 'w') as token:
            token.write(creds.to_json())
        
        print(f"✅ Gmail OAuth2 setup complete!")
        print(f"📁 Credentials saved to: {shared_token_path}")
        
        # Clean up temp file
        os.remove(temp_creds_path)
        
        return True
        
    except Exception as e:
        print(f"❌ OAuth2 setup failed: {str(e)}")
        
        if "redirect_uri_mismatch" in str(e):
            print()
            print("🔧 REDIRECT URI FIX NEEDED:")
            print("1. Go to: https://console.cloud.google.com/apis/credentials")
            print("2. Find your OAuth 2.0 Client ID")
            print("3. Click Edit")
            print("4. Under 'Authorized redirect URIs', add:")
            print("   http://localhost:8080/")
            print("5. Click Save")
            print("6. Run this script again")
        
        # Clean up temp file
        if os.path.exists(temp_creds_path):
            os.remove(temp_creds_path)
        return False

if __name__ == "__main__":
    print("Gmail OAuth2 Setup for ResumeMax")
    print("=" * 40)
    
    success = setup_gmail_oauth()
    
    if success:
        print("\n🎉 Setup complete! Gmail verification is now ready.")
        print("✅ Run 'python3 test_gmail_simple.py' to test it")
    else:
        print("\n❌ Setup failed. Please fix the redirect URI and try again.")

#!/usr/bin/env python3
"""
Gmail OAuth2 Setup Script
Run this to set up Gmail API access for the shared account
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
    
    # Check for environment variables (try multiple possible names)
    client_id = os.getenv('GMAIL_CLIENT_ID') or os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GMAIL_CLIENT_SECRET') or os.getenv('GOOGLE_CLIENT_SECRET')
    redirect_uri = os.getenv('GMAIL_REDIRECT_URI') or "http://localhost:8080/"
    
    if not client_id or not client_secret:
        print("❌ Missing Google OAuth2 credentials in environment variables")
        print("Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET")
        return False
    
    print(f"Using redirect URI: {redirect_uri}")
    
    # Create credentials dict
    credentials_info = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": [redirect_uri],
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
        print("Please log in with: oduduabasiav@gmail.com")
        
        # Extract port from redirect URI if it's localhost
        port = 8080  # default
        if "localhost:" in redirect_uri:
            try:
                port = int(redirect_uri.split("localhost:")[1].split("/")[0])
            except:
                port = 8080
        
        creds = flow.run_local_server(port=port)
        
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
        # Clean up temp file
        if os.path.exists(temp_creds_path):
            os.remove(temp_creds_path)
        return False

if __name__ == "__main__":
    print("Gmail OAuth2 Setup for ResumeMax")
    print("=" * 40)
    
    success = setup_gmail_oauth()
    
    if success:
        print("\n🎉 Setup complete! The browser automation can now access Gmail.")
    else:
        print("\n❌ Setup failed. Please check your Google OAuth2 credentials.")

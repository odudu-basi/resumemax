#!/usr/bin/env python3
"""
Simple OAuth2 Gmail Verification Server
Provides a web interface for the AI agent to trigger OAuth2 Gmail verification
"""
import asyncio
import logging
from flask import Flask, render_template_string, jsonify, request
from gmail_handler import GmailVerificationHandler
import threading
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# HTML template for the OAuth2 verification page
OAUTH2_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>OAuth2 Gmail Verification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .loading {
            color: #2196F3;
            font-size: 18px;
            margin: 20px 0;
        }
        .success {
            color: #4CAF50;
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
        }
        .error {
            color: #f44336;
            font-size: 18px;
            margin: 20px 0;
        }
        .code-display {
            background: #e8f5e8;
            border: 2px solid #4CAF50;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-size: 32px;
            font-weight: bold;
            font-family: monospace;
            color: #2e7d32;
        }
        .instructions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .retry-btn {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .retry-btn:hover {
            background: #1976D2;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔑 OAuth2 Gmail Verification</h1>
        
        <div id="status">
            <div class="loading">
                <div class="spinner"></div>
                Authenticating with Gmail via OAuth2...
            </div>
        </div>
        
        <div id="instructions" class="instructions" style="display: none;">
            <strong>Instructions:</strong>
            <ol>
                <li>Copy the verification code displayed above</li>
                <li>Return to the job application tab</li>
                <li>Paste the code in the verification field</li>
                <li>Continue with your application</li>
                <li>Close this tab when done</li>
            </ol>
        </div>
        
        <button id="retryBtn" class="retry-btn" style="display: none;" onclick="retryVerification()">
            🔄 Retry Verification
        </button>
    </div>

    <script>
        let retryCount = 0;
        const maxRetries = 3;

        async function getVerificationCode() {
            try {
                const response = await fetch('/api/get-verification-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                const data = await response.json();
                
                if (data.success && data.code) {
                    document.getElementById('status').innerHTML = `
                        <div class="success">✅ Verification Code Retrieved!</div>
                        <div class="code-display">${data.code}</div>
                    `;
                    document.getElementById('instructions').style.display = 'block';
                } else {
                    throw new Error(data.error || 'Failed to retrieve verification code');
                }
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('status').innerHTML = `
                    <div class="error">❌ Error: ${error.message}</div>
                    <div style="margin-top: 15px;">
                        <small>Possible issues:</small><br>
                        <small>• No recent verification emails found</small><br>
                        <small>• OAuth2 authentication failed</small><br>
                        <small>• Gmail API access denied</small>
                    </div>
                `;
                
                if (retryCount < maxRetries) {
                    document.getElementById('retryBtn').style.display = 'inline-block';
                }
            }
        }

        function retryVerification() {
            if (retryCount >= maxRetries) {
                alert('Maximum retry attempts reached. Please try manual Gmail access.');
                return;
            }
            
            retryCount++;
            document.getElementById('status').innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Retrying OAuth2 authentication... (Attempt ${retryCount + 1}/${maxRetries + 1})
                </div>
            `;
            document.getElementById('retryBtn').style.display = 'none';
            document.getElementById('instructions').style.display = 'none';
            
            setTimeout(getVerificationCode, 1000);
        }

        // Start verification process when page loads
        window.onload = function() {
            setTimeout(getVerificationCode, 2000); // Wait 2 seconds for better UX
        };
    </script>
</body>
</html>
"""

@app.route('/')
@app.route('/oauth2-gmail-verification')
def oauth2_verification():
    """Main OAuth2 Gmail verification page"""
    return render_template_string(OAUTH2_TEMPLATE)

@app.route('/api/get-verification-code', methods=['POST'])
def get_verification_code():
    """API endpoint to retrieve verification code via OAuth2"""
    try:
        logger.info("🔑 Processing OAuth2 Gmail verification request...")
        
        # Initialize Gmail handler
        gmail_handler = GmailVerificationHandler()
        
        # Run async function in thread
        def run_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # Try OAuth2 first
                result = loop.run_until_complete(gmail_handler.authenticate_shared_gmail())
                if result:
                    verification_data = loop.run_until_complete(
                        gmail_handler.get_verification_from_recent_emails()
                    )
                    return verification_data
                else:
                    return None
            finally:
                loop.close()
        
        verification_data = run_async()
        
        if verification_data and verification_data.get('code'):
            code = verification_data['code']
            logger.info(f"✅ Retrieved verification code via OAuth2: {code}")
            
            return jsonify({
                'success': True,
                'code': code,
                'method': 'oauth2',
                'timestamp': verification_data.get('timestamp'),
                'sender': verification_data.get('sender')
            })
        else:
            logger.warning("⚠️ No verification code found via OAuth2")
            return jsonify({
                'success': False,
                'error': 'No recent verification emails found. Please ensure you submitted the job application first.'
            }), 404
            
    except Exception as e:
        logger.error(f"❌ OAuth2 Gmail verification error: {e}")
        return jsonify({
            'success': False,
            'error': f'OAuth2 authentication failed: {str(e)}'
        }), 500

def run_server():
    """Run the Flask server"""
    logger.info("🚀 Starting OAuth2 Gmail verification server on http://localhost:8080")
    app.run(host='localhost', port=8080, debug=False, use_reloader=False)

if __name__ == '__main__':
    run_server()

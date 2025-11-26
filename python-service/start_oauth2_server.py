#!/usr/bin/env python3
"""
Startup script for OAuth2 Gmail verification server
Run this in the background to enable OAuth2 fallback for the AI agent
"""
import subprocess
import sys
import os
import time
import signal
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_port_available(port=8080):
    """Check if port is available"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('localhost', port))
            return True
        except OSError:
            return False

def start_oauth2_server():
    """Start the OAuth2 Gmail verification server"""
    if not check_port_available(8080):
        logger.warning("⚠️ Port 8080 is already in use. OAuth2 server may already be running.")
        return None
    
    try:
        logger.info("🚀 Starting OAuth2 Gmail verification server...")
        
        # Get the directory of this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        server_script = os.path.join(script_dir, 'oauth2_gmail_server.py')
        
        # Start the server as a subprocess
        process = subprocess.Popen([
            sys.executable, server_script
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Give it a moment to start
        time.sleep(2)
        
        # Check if it's still running
        if process.poll() is None:
            logger.info("✅ OAuth2 Gmail verification server started successfully on http://localhost:8080")
            logger.info("🔑 AI agents can now use OAuth2 fallback by navigating to: http://localhost:8080/oauth2-gmail-verification")
            return process
        else:
            stdout, stderr = process.communicate()
            logger.error(f"❌ OAuth2 server failed to start:")
            logger.error(f"STDOUT: {stdout.decode()}")
            logger.error(f"STDERR: {stderr.decode()}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Failed to start OAuth2 server: {e}")
        return None

def stop_oauth2_server(process):
    """Stop the OAuth2 server"""
    if process and process.poll() is None:
        logger.info("🛑 Stopping OAuth2 Gmail verification server...")
        process.terminate()
        try:
            process.wait(timeout=5)
            logger.info("✅ OAuth2 server stopped successfully")
        except subprocess.TimeoutExpired:
            logger.warning("⚠️ OAuth2 server didn't stop gracefully, forcing...")
            process.kill()
            process.wait()

def main():
    """Main function"""
    process = None
    
    def signal_handler(signum, frame):
        logger.info("🔄 Received shutdown signal...")
        stop_oauth2_server(process)
        sys.exit(0)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        process = start_oauth2_server()
        
        if process:
            logger.info("📧 OAuth2 Gmail verification server is running...")
            logger.info("💡 Press Ctrl+C to stop the server")
            
            # Keep the main process alive
            while True:
                time.sleep(1)
                
                # Check if server is still running
                if process.poll() is not None:
                    logger.error("❌ OAuth2 server stopped unexpectedly")
                    break
        else:
            logger.error("❌ Failed to start OAuth2 server")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("🔄 Received keyboard interrupt...")
    finally:
        stop_oauth2_server(process)

if __name__ == '__main__':
    main()

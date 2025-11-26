'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface GmailConnectionBannerProps {
  userId: string;
}

export function GmailConnectionBanner({ userId }: GmailConnectionBannerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check Gmail connection status
    checkGmailStatus();

    // Remove the prompt flag if it exists
    const shouldPrompt = localStorage.getItem('prompt_gmail_connection');
    if (shouldPrompt === 'true') {
      localStorage.removeItem('prompt_gmail_connection');
    }
  }, [userId]);

  const checkGmailStatus = async () => {
    try {
      const response = await fetch(`/api/user/gmail-status?userId=${userId}`);
      const data = await response.json();
      setIsConnected(data.connected);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = `/api/auth/gmail/authorize?userId=${userId}`;
  };

  // Don't show banner if loading or already connected
  if (isLoading || isConnected) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  Connect Your Gmail for Automatic Verification
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Enable auto-apply to automatically handle email verification codes and
                  confirmation links during job applications. We&apos;ll securely check your
                  inbox and complete verification steps for you.
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Auto-fill verification codes</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Click confirmation links</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Secure OAuth2 connection</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleConnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Connect Gmail
                  </Button>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 ml-16">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <p>
                We only request read-only permission for Gmail to search for verification codes.
                We cannot send, delete, or modify your emails.
              </p>
            </div>
          </div>
    </motion.div>
  );
}

// Component to show current Gmail connection status
export function GmailConnectionStatus({ userId }: { userId: string }) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkGmailStatus();
  }, [userId]);

  const checkGmailStatus = async () => {
    try {
      const response = await fetch(`/api/user/gmail-status?userId=${userId}`);
      const data = await response.json();
      setIsConnected(data.connected);
      setConnectedAt(data.connectedAt);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = `/api/auth/gmail/authorize?userId=${userId}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        <span>Checking Gmail connection...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <Mail className={`w-5 h-5 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
        <div>
          <p className="text-sm font-medium text-gray-900">
            Gmail Integration
          </p>
          {isConnected ? (
            <p className="text-xs text-gray-600">
              Connected {connectedAt && `• ${new Date(connectedAt).toLocaleDateString()}`}
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              Not connected
            </p>
          )}
        </div>
      </div>

      {isConnected ? (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-xs text-green-600 font-medium">Active</span>
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Connect
        </Button>
      )}
    </div>
  );
}

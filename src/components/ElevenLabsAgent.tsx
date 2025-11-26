"use client";

import { useState, useEffect } from 'react';
import { MessageCircle, X, Mic, MicOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

interface ElevenLabsAgentProps {
  agentId?: string;
  apiKey?: string;
  className?: string;
}

export default function ElevenLabsAgent({ 
  agentId = "agent_1601k8w2hhypfhrvy1zfyhts2ww3",
  apiKey = "81d07c0a0a1a21be201b904e20e67adfb5eca5cefea411cdee05b0fa10730be0",
  className = ""
}: ElevenLabsAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Load ElevenLabs Conversational AI Widget
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create the widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'elevenlabs-convai-widget';
    widgetContainer.style.display = 'none'; // Initially hidden
    document.body.appendChild(widgetContainer);

    // Load the ElevenLabs widget script
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.setAttribute('data-agent-id', agentId);
    if (apiKey) {
      script.setAttribute('data-api-key', apiKey);
    }
    
    script.onload = () => {
      console.log('✅ ElevenLabs widget script loaded');
      setIsLoaded(true);
      
      // Initialize the widget with API key
      setTimeout(() => {
        if (window.ElevenLabs && window.ElevenLabs.ConvAI) {
          const config: any = {
            agentId: agentId,
            containerId: 'elevenlabs-convai-widget'
          };
          
          if (apiKey) {
            config.apiKey = apiKey;
          }
          
          window.ElevenLabs.ConvAI.widget(config);
          setWidgetLoaded(true);
          console.log('✅ ElevenLabs widget initialized with API key');
        } else {
          console.log('⚠️ ElevenLabs ConvAI not available, using fallback');
          setIsLoaded(true);
        }
      }, 1500);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load ElevenLabs widget script');
    };
    
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      if (document.body.contains(widgetContainer)) {
        document.body.removeChild(widgetContainer);
      }
    };
  }, [agentId]);

  const openElevenLabsAgent = () => {
    // Open ElevenLabs agent in a new window/tab
    const agentUrl = `https://elevenlabs.io/agents/${agentId}`;
    window.open(agentUrl, 'elevenlabs-agent', 'width=400,height=600,scrollbars=yes,resizable=yes');
    console.log('🎯 Opening ElevenLabs agent in new window');
  };

  const startDirectConversation = async () => {
    if (!apiKey) {
      console.error('API key required for direct conversation');
      return;
    }

    setIsConnecting(true);
    
    try {
      // Use ElevenLabs API directly for conversation
      const response = await fetch('/api/elevenlabs/start-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agentId,
          apiKey: apiKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Direct conversation started:', data);
        setIsConnected(true);
      } else {
        console.error('❌ Failed to start direct conversation');
      }
    } catch (error) {
      console.error('❌ Error starting direct conversation:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const showEmbeddedWidget = () => {
    if (widgetLoaded) {
      const widgetContainer = document.getElementById('elevenlabs-convai-widget');
      if (widgetContainer) {
        widgetContainer.style.display = widgetContainer.style.display === 'none' ? 'block' : 'none';
      }
    }
  };

  const handleToggle = () => {
    if (isOpen) {
      // Reset connection state when closing
      setIsConnected(false);
      setIsConnecting(false);
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <Button
                onClick={handleToggle}
                size="lg"
                className="h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <MessageCircle className="h-6 w-6 text-white" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Widget */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="absolute bottom-0 right-0 mb-4"
            >
              <Card className="w-80 h-96 shadow-2xl border-0 bg-white">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">JJ</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">AI Career Assistant</h3>
                        <p className="text-xs opacity-90">
                          {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Ready to help'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggle}
                      className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Content */}
                  <CardContent className="flex-1 p-4 flex flex-col justify-center items-center">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <MessageCircle className="h-8 w-8 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Talk to JJ
                        </h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Get personalized career advice and job search help from your AI assistant.
                        </p>
                      </div>
                      
                      <div className="space-y-2 w-full">
                        <Button
                          onClick={openElevenLabsAgent}
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 w-full"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open JJ (New Window)
                        </Button>
                        
                        {apiKey && (
                          <Button
                            onClick={startDirectConversation}
                            disabled={isConnecting}
                            variant="outline"
                            className="w-full"
                          >
                            <Mic className="h-4 w-4 mr-2" />
                            {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
                          </Button>
                        )}
                        
                        {widgetLoaded && (
                          <Button
                            onClick={showEmbeddedWidget}
                            variant="outline"
                            className="w-full"
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Show Embedded Widget
                          </Button>
                        )}
                        
                        {!widgetLoaded && isLoaded && (
                          <p className="text-xs text-gray-500">
                            Embedded widget loading...
                          </p>
                        )}
                        
                        {apiKey && (
                          <p className="text-xs text-green-600 text-center">
                            ✅ API Key Configured
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    ElevenLabs: any;
  }
}

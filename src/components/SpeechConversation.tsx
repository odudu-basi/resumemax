"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import AnimatedSphere from './AnimatedSphere';
import { useAuth } from '@/src/contexts/AuthContext';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SpeechConversationProps {
  resumeContext?: string;
  interviewPrep?: string;
}

export default function SpeechConversation({ resumeContext, interviewPrep }: SpeechConversationProps) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [voiceActivityThreshold, setVoiceActivityThreshold] = useState(0.1);
  const [continuousListening, setContinuousListening] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceDetectionRef = useRef<boolean>(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context for visualization
  useEffect(() => {
    const initAudioContext = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    };

    initAudioContext();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Analyze resume when component mounts
  useEffect(() => {
    if (user && !hasAnalyzed && !resumeContext) {
      analyzeResume();
    }
  }, [user, hasAnalyzed, resumeContext]);

  const analyzeResume = async () => {
    if (!user) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze resume');
      }

      const data = await response.json();
      
      if (data.success) {
        setHasAnalyzed(true);
        // Add initial AI greeting
        setConversationHistory([{
          role: 'assistant',
          content: `Hello! I've analyzed your resume and I'm excited to help you prepare for interviews. I can see you have some great experiences we should dive deeper into. Let's start by talking about your background - what would you like to focus on first?`,
          timestamp: new Date()
        }]);
      } else {
        setError(data.error || 'Failed to analyze resume');
      }
    } catch (error) {
      console.error('Resume analysis error:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze resume');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startListening = async () => {
    try {
      setError(null);
      
      // Stop any current AI speech
      if (isSpeaking) {
        stopSpeaking();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // Set up audio visualization and voice activity detection
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const updateAudioLevel = () => {
          if (analyserRef.current && isListening) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const normalizedLevel = average / 255;
            setAudioLevel(normalizedLevel);
            
            // Voice activity detection
            const hasVoice = normalizedLevel > voiceActivityThreshold;
            
            if (hasVoice && !voiceDetectionRef.current) {
              voiceDetectionRef.current = true;
              // Clear silence timeout when voice is detected
              if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
              }
            } else if (!hasVoice && voiceDetectionRef.current) {
              // Start silence timeout
              silenceTimeoutRef.current = setTimeout(() => {
                if (isListening && !isProcessing) {
                  console.log('Silence detected, stopping recording');
                  stopListening();
                }
              }, 2000); // 2 seconds of silence
            }
            
            requestAnimationFrame(updateAudioLevel);
          }
        };
        
        updateAudioLevel();
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudio(audioBlob);
        }
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      // Start recording with timeslice for better data handling
      mediaRecorderRef.current.start(100);
      setIsListening(true);
      voiceDetectionRef.current = false;
      
      // Auto-stop after 30 seconds max
      recordingTimeoutRef.current = setTimeout(() => {
        if (isListening) {
          console.log('Max recording time reached');
          stopListening();
        }
      }, 30000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to access microphone. Please check permissions and try again.');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setAudioLevel(0);
      voiceDetectionRef.current = false;
      
      // Clear timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert audio blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

      // Send to speech conversation API
      const response = await fetch('/api/speech-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: audioBase64,
          resumeContext: resumeContext || 'Resume analysis in progress...',
          conversationHistory: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process conversation');
      }

      const data = await response.json();
      
      if (data.success) {
        // Add user message
        setConversationHistory(prev => [...prev, {
          role: 'user',
          content: data.userTranscription,
          timestamp: new Date()
        }]);

        // Add AI response
        setConversationHistory(prev => [...prev, {
          role: 'assistant',
          content: data.aiResponse,
          timestamp: new Date()
        }]);

        // Play AI response audio
        if (data.audioResponse) {
          await playAudioResponse(data.audioResponse);
        }
      } else {
        setError(data.error || 'Failed to process conversation');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setError(error instanceof Error ? error.message : 'Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudioResponse = async (audioBase64: string) => {
    try {
      setIsSpeaking(true);
      
      // Convert base64 to audio blob
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('Playing AI response audio...');
      
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.volume = 0.8; // Set volume
      
      // Set up event listeners
      audioRef.current.onloadeddata = () => {
        console.log('Audio loaded, duration:', audioRef.current?.duration);
      };
      
      audioRef.current.onplay = () => {
        console.log('Audio started playing');
      };
      
      audioRef.current.onended = () => {
        console.log('Audio finished playing');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        
        // Auto-start listening for next user input
        if (!isProcessing) {
          setTimeout(() => {
            startListening();
          }, 500);
        }
      };
      
      audioRef.current.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        setError('Failed to play audio response');
      };
      
      // Play the audio
      try {
        await audioRef.current.play();
        console.log('Audio play() succeeded');
      } catch (playError) {
        console.error('Audio play() failed:', playError);
        setError('Failed to play audio. Please check your browser audio settings.');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      }
      
    } catch (error) {
      console.error('Error setting up audio playback:', error);
      setIsSpeaking(false);
      setError('Failed to process audio response');
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  };

  const handleSphereClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      // Start listening immediately when user interrupts AI
      setTimeout(() => startListening(), 100);
    } else if (isListening) {
      stopListening();
    } else if (!isProcessing) {
      startListening();
    }
  };

  // Set up continuous voice activity detection during AI speech
  useEffect(() => {
    let voiceDetectionInterval: NodeJS.Timeout;
    
    if (isSpeaking && !isListening) {
      // Monitor for user interruption while AI is speaking
      const checkForUserVoice = async () => {
        try {
          if (!streamRef.current) {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              } 
            });
            streamRef.current = stream;
            
            if (audioContextRef.current && analyserRef.current) {
              const source = audioContextRef.current.createMediaStreamSource(stream);
              source.connect(analyserRef.current);
            }
          }
          
          if (analyserRef.current && streamRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const normalizedLevel = average / 255;
            
            // If user starts speaking while AI is talking, interrupt
            if (normalizedLevel > voiceActivityThreshold * 2) { // Higher threshold to avoid false positives
              console.log('User interruption detected, stopping AI speech');
              stopSpeaking();
              setTimeout(() => startListening(), 200);
            }
          }
        } catch (error) {
          console.error('Error monitoring user voice:', error);
        }
      };
      
      voiceDetectionInterval = setInterval(checkForUserVoice, 200);
    }
    
    return () => {
      if (voiceDetectionInterval) {
        clearInterval(voiceDetectionInterval);
      }
    };
  }, [isSpeaking, isListening, voiceActivityThreshold]);

  if (isAnalyzing) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <h3 className="text-xl font-semibold">Analyzing Your Resume</h3>
              <p className="text-gray-600">
                Preparing personalized interview questions based on your experience...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main Conversation Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">AI Interview Practice</CardTitle>
          <p className="text-center text-gray-600">
            Practice your interview skills with our AI coach
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-6">
            {/* Animated Sphere */}
            <div className="w-48 h-48">
              <AnimatedSphere
                isListening={isListening}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                onClick={handleSphereClick}
                className="w-full h-full"
              />
            </div>

            {/* Status and Controls */}
            <div className="text-center space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing your response...</span>
                </div>
              )}

              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isSpeaking ? stopSpeaking : undefined}
                  disabled={!isSpeaking}
                >
                  {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {isSpeaking ? 'Stop AI' : 'Audio'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVoiceActivityThreshold(prev => prev === 0.1 ? 0.05 : 0.1)}
                >
                  Sensitivity: {voiceActivityThreshold === 0.1 ? 'Normal' : 'High'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {conversationHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interview Preparation Tips */}
      {interviewPrep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interview Preparation Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                {interviewPrep}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

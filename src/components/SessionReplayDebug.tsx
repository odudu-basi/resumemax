'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Video, VideoOff, ExternalLink, Copy } from 'lucide-react';
import MixpanelService from '@/src/lib/mixpanel';

export default function SessionReplayDebug() {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check recording status periodically
    const interval = setInterval(() => {
      const url = MixpanelService.getSessionReplayUrl();
      setSessionUrl(url);
      setIsRecording(!!url);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleStartRecording = () => {
    MixpanelService.startRecording();
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    MixpanelService.stopRecording();
    setIsRecording(false);
  };

  const copySessionUrl = () => {
    if (sessionUrl) {
      navigator.clipboard.writeText(sessionUrl);
      alert('Session replay URL copied to clipboard!');
    }
  };

  const openSessionReplay = () => {
    if (sessionUrl) {
      window.open(sessionUrl, '_blank');
    }
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="mb-4 border-2 border-purple-200 bg-purple-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-600" />
            🎥 Session Replay Debug
          </CardTitle>
          <Badge variant={isRecording ? "default" : "secondary"} className={isRecording ? "bg-red-500" : ""}>
            {isRecording ? (
              <><div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>Recording</>
            ) : (
              'Stopped'
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={handleStartRecording}
            disabled={isRecording}
            className="flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            Start Recording
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleStopRecording}
            disabled={!isRecording}
            className="flex items-center gap-1"
          >
            <EyeOff className="h-3 w-3" />
            Stop Recording
          </Button>
        </div>

        {sessionUrl && (
          <div className="p-3 bg-white rounded border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Session Replay URL:</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={copySessionUrl}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={openSessionReplay}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <code className="text-xs text-gray-600 break-all">
              {sessionUrl}
            </code>
          </div>
        )}

        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Privacy Classes Available:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><code>mp-mask</code> - Masks text content (shows ****)</li>
            <li><code>mp-no-record</code> - Completely blocks element from recording</li>
            <li><code>data-mp-mask</code> - Alternative mask attribute</li>
            <li><code>data-mp-no-record</code> - Alternative block attribute</li>
          </ul>
          <p className="mt-2"><strong>Auto-blocked:</strong> Password inputs, elements with above classes</p>
        </div>
      </CardContent>
    </Card>
  );
}

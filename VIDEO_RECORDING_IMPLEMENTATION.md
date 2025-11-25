# 🎥 Video Recording System Implementation Guide

## Overview
Record the AI agent's application process and display it to users when they click on the job card after completion.

## Architecture

```
User clicks "Auto Apply"
    ↓
Browser Agent starts with screen recording
    ↓
Records entire application process (2-5 minutes)
    ↓
Saves video to Supabase Storage
    ↓
Updates auto_apply_sessions.video_path
    ↓
User clicks job card → Modal shows video playback
```

---

## Implementation Steps

### Step 1: Set Up Supabase Storage Bucket

#### 1.1 Create Storage Bucket in Supabase Dashboard

Go to Supabase Dashboard → Storage → Create bucket:
- **Name**: `application-videos`
- **Public**: No (private)
- **File size limit**: 50MB (videos will be 5-20MB typically)
- **Allowed MIME types**: `video/webm, video/mp4`

#### 1.2 Set Up Storage Policies

Run this SQL in Supabase SQL Editor:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-videos', 'application-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own videos
CREATE POLICY "Users can upload their own application videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'application-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own videos
CREATE POLICY "Users can view their own application videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own videos
CREATE POLICY "Users can delete their own application videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'application-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### Step 2: Update Browser Service to Record Video

#### 2.1 Install Additional Dependencies

Update `browser-service/requirements.txt`:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
playwright==1.40.0
browser-use>=0.1.0
openai>=1.3.0
supabase>=2.0.0
pydantic>=2.5.0
pydantic-settings>=2.0.0
python-dotenv==1.0.0
requests==2.31.0

# NEW: For video processing
opencv-python==4.8.1.78
ffmpeg-python==0.2.0
```

#### 2.2 Update Dockerfile

Add FFmpeg to your `browser-service/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install system dependencies INCLUDING FFMPEG
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    ffmpeg \
    libsm6 \
    libxext6 \
    fonts-liberation \
    libasound2 \
    # ... (rest of dependencies)
    && rm -rf /var/lib/apt/lists/*

# ... rest of Dockerfile
```

#### 2.3 Create Video Recording Module

Create `browser-service/video_recorder.py`:

```python
"""
Video recording for browser automation sessions
"""
import os
import asyncio
from typing import Optional
from playwright.async_api import Page, Browser
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)


class VideoRecorder:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.video_path: Optional[str] = None

    async def start_recording(self, page: Page, session_id: str, user_id: str) -> str:
        """
        Start recording the browser page

        Returns:
            Local path to video file
        """
        try:
            # Create recordings directory
            recordings_dir = "/tmp/recordings"
            os.makedirs(recordings_dir, exist_ok=True)

            # Video file path
            video_filename = f"{session_id}.webm"
            self.video_path = os.path.join(recordings_dir, video_filename)

            # Start video recording using Playwright's built-in feature
            await page.video.path()  # This ensures video is being recorded

            logger.info(f"Video recording started for session {session_id}")
            return self.video_path

        except Exception as e:
            logger.error(f"Failed to start video recording: {str(e)}")
            raise

    async def stop_recording_and_upload(
        self,
        page: Page,
        session_id: str,
        user_id: str
    ) -> Optional[str]:
        """
        Stop recording and upload to Supabase Storage

        Returns:
            Public URL of uploaded video or None if failed
        """
        try:
            # Stop recording and get video path
            await page.close()  # Closing page finalizes video

            # Wait a moment for video to be fully written
            await asyncio.sleep(2)

            # Get the actual video path from Playwright
            video_path = await page.video.path()

            if not video_path or not os.path.exists(video_path):
                logger.warning(f"Video file not found at {video_path}")
                return None

            # Upload to Supabase Storage
            storage_path = f"{user_id}/{session_id}.webm"

            with open(video_path, 'rb') as video_file:
                response = self.supabase.storage.from_('application-videos').upload(
                    path=storage_path,
                    file=video_file,
                    file_options={"content-type": "video/webm"}
                )

            if response.error:
                logger.error(f"Failed to upload video: {response.error}")
                return None

            # Get signed URL (valid for 1 year)
            signed_url_response = self.supabase.storage.from_('application-videos').create_signed_url(
                path=storage_path,
                expires_in=31536000  # 1 year in seconds
            )

            if signed_url_response.get('error'):
                logger.error(f"Failed to create signed URL: {signed_url_response.get('error')}")
                return None

            video_url = signed_url_response.get('signedURL')

            # Clean up local file
            try:
                os.remove(video_path)
            except Exception as e:
                logger.warning(f"Failed to delete local video file: {e}")

            logger.info(f"Video uploaded successfully for session {session_id}")
            return video_url

        except Exception as e:
            logger.error(f"Failed to stop recording and upload: {str(e)}", exc_info=True)
            return None
```

#### 2.4 Update Browser Agent to Use Video Recording

Update `browser-service/browser_agent.py` (or your agent file):

```python
from playwright.async_api import async_playwright
from video_recorder import VideoRecorder
import os

class JobApplicationAgent:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.video_recorder = VideoRecorder(self.supabase_url, self.supabase_key)

    async def apply_to_job(
        self,
        job_url: str,
        user_profile: dict,
        resume_data: dict,
        session_id: str,
        **kwargs
    ):
        """Apply to job with video recording"""

        async with async_playwright() as p:
            # Launch browser with video recording enabled
            browser = await p.chromium.launch(
                headless=kwargs.get('headless', True),
                args=['--disable-blink-features=AutomationControlled']
            )

            # Create context with video recording
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                record_video_dir="/tmp/recordings",  # Enable video recording
                record_video_size={'width': 1920, 'height': 1080}
            )

            page = await context.new_page()
            user_id = user_profile.get('user_id') or user_profile.get('id')

            try:
                # Navigate to job
                await page.goto(job_url)

                # TODO: Your actual application logic here
                # Fill forms, click buttons, etc.

                result = {
                    "status": "success",
                    "message": "Application completed",
                    "action_log": []
                }

            except Exception as e:
                result = {
                    "status": "failed",
                    "error": str(e),
                    "action_log": []
                }

            finally:
                # Stop recording and upload video
                video_url = await self.video_recorder.stop_recording_and_upload(
                    page=page,
                    session_id=session_id,
                    user_id=user_id
                )

                # Update session with video URL
                if video_url:
                    await self.update_session_video(session_id, video_url)
                    result['video_url'] = video_url

                await context.close()
                await browser.close()

            return result

    async def update_session_video(self, session_id: str, video_url: str):
        """Update auto_apply_sessions with video URL"""
        try:
            from supabase import create_client
            supabase = create_client(self.supabase_url, self.supabase_key)

            supabase.table('auto_apply_sessions').update({
                'video_path': video_url,
                'updated_at': 'now()'
            }).eq('id', session_id).execute()

            logger.info(f"Updated session {session_id} with video URL")
        except Exception as e:
            logger.error(f"Failed to update session with video: {e}")
```

---

### Step 3: Create Video Modal Component

Create `components/ApplicationVideoModal.tsx`:

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, Download } from 'lucide-react';

interface ApplicationVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  jobTitle: string;
  companyName: string;
  appliedAt?: string;
  status?: string;
}

export default function ApplicationVideoModal({
  isOpen,
  onClose,
  videoUrl,
  jobTitle,
  companyName,
  appliedAt,
  status,
}: ApplicationVideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset video when modal closes
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }
  }, [isOpen]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const downloadVideo = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${companyName}-${jobTitle}-application.webm`;
    a.click();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl mx-4 bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">{jobTitle}</h2>
            <p className="text-sm text-gray-400">{companyName}</p>
          </div>

          <div className="flex items-center gap-4">
            {status && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  status === 'submitted'
                    ? 'bg-green-500/20 text-green-400'
                    : status === 'error'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full aspect-video"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          />

          {/* Play Overlay (shown when paused) */}
          {!isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={togglePlay}
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-6">
                <Play size={48} className="text-white fill-white" />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
          {/* Progress Bar */}
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-4
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:cursor-pointer"
          />

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <button
                onClick={toggleMute}
                className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <span className="text-sm text-gray-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadVideo}
                className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Download video"
              >
                <Download size={20} />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Fullscreen"
              >
                <Maximize2 size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        {appliedAt && (
          <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-800">
            <p className="text-xs text-gray-400">
              Application recorded on {new Date(appliedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 4: Update JobCard Component

Update your JobCard component to show video modal:

```typescript
'use client';

import { useState } from 'react';
import ApplicationVideoModal from '@/components/ApplicationVideoModal';

interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string;
    url: string;
    // ... other fields
  };
  session?: {
    id: string;
    status: string;
    video_path?: string;
    submitted_at?: string;
  };
}

export default function JobCard({ job, session }: JobCardProps) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleAutoApply = async () => {
    if (session?.video_path) {
      // If video exists, show it instead of applying again
      setIsVideoModalOpen(true);
      return;
    }

    // Start auto-apply process
    setIsApplying(true);

    try {
      const response = await fetch('/api/browser-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl: job.url,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Poll for completion
        const sessionId = data.sessionId;
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/browser-apply?sessionId=${sessionId}`);
          const status = await statusRes.json();

          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollInterval);
            setIsApplying(false);

            // Refresh page or update state to show video button
            window.location.reload();
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Auto-apply error:', error);
      setIsApplying(false);
    }
  };

  return (
    <>
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold">{job.title}</h3>
        <p className="text-gray-600">{job.company}</p>

        <button
          onClick={handleAutoApply}
          disabled={isApplying}
          className={`mt-4 px-4 py-2 rounded-lg ${
            session?.video_path
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-green-600 hover:bg-green-700'
          } text-white disabled:opacity-50`}
        >
          {isApplying
            ? 'Applying...'
            : session?.video_path
            ? 'View Application'
            : 'Auto Apply'}
        </button>

        {session?.status && (
          <p className="text-sm text-gray-500 mt-2">
            Status: {session.status}
          </p>
        )}
      </div>

      {/* Video Modal */}
      {session?.video_path && (
        <ApplicationVideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoUrl={session.video_path}
          jobTitle={job.title}
          companyName={job.company}
          appliedAt={session.submitted_at}
          status={session.status}
        />
      )}
    </>
  );
}
```

---

### Step 5: Query Sessions with Video in Dashboard

Update your dashboard to fetch sessions with videos:

```typescript
// In your dashboard page
const { data: sessions } = await supabase
  .from('auto_apply_sessions')
  .select('*')
  .eq('user_id', user.id)
  .not('video_path', 'is', null)
  .order('created_at', { ascending: false });
```

---

## Testing Checklist

- [ ] Supabase Storage bucket created
- [ ] Storage policies applied
- [ ] Video recording dependencies installed
- [ ] Browser agent updated with video recording
- [ ] Video modal component created
- [ ] JobCard updated to show video button
- [ ] Test: Click Auto Apply and verify video is recorded
- [ ] Test: Click job card again and verify video plays
- [ ] Test: Video controls work (play, pause, seek, fullscreen)
- [ ] Test: Download video button works

---

## Performance Considerations

1. **Video Size**: WebM format keeps videos 5-20MB for 2-5 minute recordings
2. **Storage Limits**: Monitor Supabase storage usage
3. **Signed URLs**: Valid for 1 year, regenerate if needed
4. **Cleanup**: Consider deleting videos older than 90 days

---

## Future Enhancements

- [ ] Add thumbnail generation for video preview
- [ ] Add video compression to reduce file size
- [ ] Add ability to share video links
- [ ] Add video analytics (how many times watched)
- [ ] Add ability to delete videos from UI

---

**Ready to implement? Start with Step 1!** 🚀

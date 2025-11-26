'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Download, Play, Pause, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

interface ValidationError {
  field: string;
  message: string;
}

interface ApplicationSession {
  id: string;
  job_title: string;
  company_name: string;
  job_url: string;
  status: string;
  screenshot_url?: string;
  video_url?: string;
  screenshot_path?: string;
  video_path?: string;
  created_at: string;
  closed_at?: string;
  submitted_at?: string;
  validation_errors?: ValidationError[];
}

interface ApplicationDetailModalProps {
  session: ApplicationSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ApplicationDetailModal({ session, isOpen, onClose }: ApplicationDetailModalProps) {
  const hasErrors = session?.validation_errors && session.validation_errors.length > 0;
  const hasScreenshot = session?.screenshot_url || session?.screenshot_path;
  const hasVideo = session?.video_url || session?.video_path;

  // Auto-select errors tab if there are validation errors, otherwise screenshot
  const defaultTab = hasErrors ? 'errors' : (hasScreenshot ? 'screenshot' : 'video');
  const [activeTab, setActiveTab] = useState<'screenshot' | 'video' | 'errors'>(defaultTab);
  const [screenshotZoom, setScreenshotZoom] = useState(100);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Update tab when session changes
  React.useEffect(() => {
    if (session) {
      const newHasErrors = session.validation_errors && session.validation_errors.length > 0;
      if (newHasErrors) {
        setActiveTab('errors');
      }
    }
  }, [session?.id]);

  if (!session) return null;

  // Prefer Supabase Storage URLs (production) over local paths (development)
  const screenshotSrc = session.screenshot_url || session.screenshot_path;
  const videoSrc = session.video_url || session.video_path;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string }> = {
      'submitted': { bg: 'bg-green-100', text: 'text-green-800' },
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'failed': { bg: 'bg-red-100', text: 'text-red-800' },
      'in_progress': { bg: 'bg-blue-100', text: 'text-blue-800' },
    };

    const variant = variants[status] || variants['pending'];

    return (
      <Badge className={`${variant.bg} ${variant.text} border-0`}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const handleDownloadScreenshot = () => {
    if (screenshotSrc) {
      window.open(screenshotSrc, '_blank');
    }
  };

  const handleDownloadVideo = () => {
    if (videoSrc) {
      window.open(videoSrc, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold mb-2">
                {session.job_title}
              </DialogTitle>
              <p className="text-gray-600 mb-2">{session.company_name}</p>
              <div className="flex items-center gap-2">
                {getStatusBadge(session.status)}
                <span className="text-sm text-gray-500">
                  Applied {new Date(session.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-4">
            {hasScreenshot && (
              <button
                onClick={() => setActiveTab('screenshot')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'screenshot'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Screenshot
              </button>
            )}
            {hasVideo && (
              <button
                onClick={() => setActiveTab('video')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'video'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Video Recording
              </button>
            )}
            {hasErrors && (
              <button
                onClick={() => setActiveTab('errors')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'errors'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-red-500 hover:text-red-700'
                }`}
              >
                Validation Errors ({session.validation_errors?.length || 0})
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {activeTab === 'screenshot' && hasScreenshot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Zoom Controls */}
              <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Zoom:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScreenshotZoom(Math.max(25, screenshotZoom - 25))}
                    disabled={screenshotZoom <= 25}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[60px] text-center">
                    {screenshotZoom}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScreenshotZoom(Math.min(200, screenshotZoom + 25))}
                    disabled={screenshotZoom >= 200}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadScreenshot}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>

              {/* Screenshot Image */}
              <div className="bg-white rounded-lg shadow-sm p-4 overflow-auto max-h-[600px]">
                <img
                  src={screenshotSrc}
                  alt="Application Screenshot"
                  style={{ width: `${screenshotZoom}%` }}
                  className="mx-auto"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'video' && hasVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Video Controls */}
              <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Recording of application process</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadVideo}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Video
                </Button>
              </div>

              {/* Video Player */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <video
                  controls
                  className="w-full max-h-[600px] rounded"
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                >
                  <source src={videoSrc} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </motion.div>
          )}

          {activeTab === 'errors' && hasErrors && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Error Summary */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-900 mb-1">
                      Application Submission Failed
                    </h3>
                    <p className="text-sm text-red-700">
                      The form could not be submitted due to {session.validation_errors?.length} validation error{session.validation_errors?.length !== 1 ? 's' : ''}.
                      Please review the errors below and fix them manually.
                    </p>
                  </div>
                </div>
              </div>

              {/* Errors List */}
              <div className="bg-white rounded-lg shadow-sm divide-y">
                {session.validation_errors?.map((error, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-xs font-semibold text-red-600">{index + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {error.field}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {error.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <a
                  href={session.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Fix Errors Manually
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}

          {!hasScreenshot && !hasVideo && !hasErrors && (
            <div className="text-center py-12 text-gray-500">
              <p>No media available for this application</p>
              <p className="text-sm mt-2">Screenshot and video recording are available for auto-applied jobs</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-white flex items-center justify-between">
          <a
            href={session.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View Job Posting
            <ExternalLink className="w-4 h-4" />
          </a>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

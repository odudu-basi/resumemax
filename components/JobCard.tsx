"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  MapPin,
  DollarSign,
  CheckCircle2,
  Zap,
  Globe,
  Loader2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Video,
  X,
  Clock,
} from "lucide-react";
import { useAutoApplySessions } from "@/src/hooks/useAutoApplySessions";
import { SessionTimer } from "@/components/SessionTimer";

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: {
    min: number;
    max: number;
  };
  applicationUrl: string;
  remoteType?: string;
  source?: string;
  matchCriteria?: {
    overallScore: number;
    breakdown: {
      skillsMatch: number;
      experienceMatch: number;
      salaryMatch: number;
      locationMatch: number;
      visaMatch: number;
      roleMatch: number;
      cultureFit: number;
    };
    matchReasons: string[];
    concerns: string[];
    recommendation: 'highly-recommended' | 'good-fit' | 'possible-fit' | 'not-recommended';
  };
  description?: string;
}

interface JobCardProps {
  job: JobCardData;
  userId: string | null;
  onAutoApply?: (job: JobCardData) => void;
  onCloudApply?: (job: JobCardData) => void;
  autoApplyLoading?: boolean;
  cloudApplyLoading?: boolean;
  notification?: {
    type: 'success' | 'error';
    message: string;
  } | null;
  cloudNotification?: {
    type: 'success' | 'error';
    message: string;
    liveUrl?: string;
  } | null;
  showAutoApply?: boolean;
  autoApplyEnabled?: boolean;
  className?: string;
}

export function JobCard({
  job,
  userId,
  onAutoApply,
  onCloudApply,
  autoApplyLoading = false,
  cloudApplyLoading = false,
  notification = null,
  cloudNotification = null,
  showAutoApply = true,
  autoApplyEnabled = true,
  className = "",
}: JobCardProps) {
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMedia, setCurrentMedia] = useState<{type: 'screenshot' | 'video', url: string} | null>(null);
  const [showLiveViewModal, setShowLiveViewModal] = useState(false);

  // Fetch active sessions for this user
  const { sessions } = useAutoApplySessions(userId);

  // Find active session for this specific job
  const activeSession = sessions.find(s => s.job_url === job.applicationUrl);
  const hasNotification = !!notification;

  // Handle re-filling the form
  const handleRefillForm = async () => {
    if (!activeSession) return;

    setIsRefilling(true);
    try {
      console.log('🔄 Re-filling form with session:', activeSession.id);

      const response = await fetch('/api/refill-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Form re-filled successfully:', result);
        const message = result.sessionExtended 
          ? `Session extended! Form re-filled with ${result.fieldsFilled} fields. Please check the browser window to review and submit.`
          : `Form re-filled! ${result.fieldsFilled} fields filled. Please check the browser window to review and submit.`;
        alert(message);
      } else {
        console.error('❌ Re-fill failed:', result.error);
        // Provide more helpful error messages
        let errorMessage = result.error;
        if (result.error.includes('expired')) {
          errorMessage = 'Session expired. Please try clicking "Extend & Review" to extend the session and try again.';
        }
        alert(`Failed to re-fill form: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('❌ Re-fill error:', error);
      alert(`Error re-filling form: ${error.message}`);
    } finally {
      setIsRefilling(false);
    }
  };

  return (
    <>
      <Card
        className={`hover:shadow-lg transition-all relative ${
          hasNotification ? 'ring-2 ring-red-200 bg-red-50/30' : ''
        } ${activeSession ? 'cursor-pointer' : ''} ${className}`}
        onClick={() => {
          if (activeSession) {
            setShowSessionDetails(true);
          }
        }}
      >
      {/* Ready to Submit Badge - Top Right */}
      {activeSession && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ready to Submit
          </Badge>
        </div>
      )}

      {/* Notification indicator - Top Right (if no session) */}
      {hasNotification && !activeSession && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className={`w-4 h-4 rounded-full ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } animate-pulse`} />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Match Score */}
              {job.matchCriteria && (
                <Badge
                  variant={
                    job.matchCriteria.overallScore >= 90
                      ? "default"
                      : "secondary"
                  }
                  className="text-base px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMatchDetails(true);
                  }}
                >
                  {job.matchCriteria.overallScore}% Match
                </Badge>
              )}

              {/* Source */}
              {job.source && (
                <Badge variant="outline">{job.source}</Badge>
              )}

              {/* Notification Badge */}
              {hasNotification && (
                <Badge
                  variant={notification.type === 'success' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {notification.type === 'success' ? 'Applied' : 'Failed'}
                </Badge>
              )}
            </div>

            <CardTitle className="text-xl mb-1">{job.title}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {job.company}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Location and Remote Type */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {job.location}
          </span>
          {job.remoteType && (
            <Badge variant="outline">{job.remoteType}</Badge>
          )}
        </div>

        {/* Salary */}
        {job.salary && (
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <DollarSign className="h-4 w-4" />
            ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}
          </div>
        )}

        {/* Match Reasons */}
        {job.matchCriteria && job.matchCriteria.matchReasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Why this matches:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {job.matchCriteria.matchReasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Concerns */}
        {job.matchCriteria && job.matchCriteria.concerns.length > 0 && (
          <div className="p-2 bg-yellow-50 rounded text-sm text-yellow-800">
            ⚠️ {job.matchCriteria.concerns[0]}
          </div>
        )}

        {/* Action Buttons */}
        {showAutoApply && (
          <div className="flex gap-2">
            {/* Auto Apply Button */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (activeSession) {
                  // If there's an active session, re-fill the form
                  handleRefillForm();
                } else if (onAutoApply) {
                  // Otherwise, start auto-apply
                  onAutoApply(job);
                }
              }}
              disabled={autoApplyLoading || hasNotification || isRefilling}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {autoApplyLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : isRefilling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening Browser...
                </>
              ) : activeSession ? (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Review & Submit
                </>
              ) : hasNotification ? (
                <>
                  {notification.type === 'success' ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <AlertCircle className="mr-2 h-4 w-4" />
                  )}
                  {notification.type === 'success' ? 'Applied' : 'Failed'}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  {autoApplyEnabled ? 'Auto Apply' : 'Apply & Review'}
                </>
              )}
            </Button>

            {/* Cloud Apply Button */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (onCloudApply) {
                  onCloudApply(job);
                }
              }}
              disabled={cloudApplyLoading || (cloudNotification !== null)}
              className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
            >
              {cloudApplyLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (cloudNotification !== null) ? (
                <>
                  {cloudNotification.type === 'success' ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <AlertCircle className="mr-2 h-4 w-4" />
                  )}
                  {cloudNotification.type === 'success' ? 'Applied' : 'Failed'}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Apply
                </>
              )}
            </Button>

            {/* Watch Live Button - Shows when cloud task is in progress or completed with live URL */}
            {cloudNotification?.liveUrl && (
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLiveViewModal(true);
                }}
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <Video className="mr-2 h-4 w-4" />
                Watch Live
              </Button>
            )}

            {/* View Job Button */}
            <Button
              variant="outline"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Session Details Modal */}
      {showSessionDetails && activeSession && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowSessionDetails(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-600">{job.company}</p>
              </div>
              <button
                onClick={() => setShowSessionDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Application Ready</p>
                <p className="text-sm text-green-600">Form filled and ready for review</p>
              </div>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{activeSession.fields_filled}</p>
                <p className="text-xs text-gray-600">Filled</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{activeSession.fields_skipped}</p>
                <p className="text-xs text-gray-600">Skipped</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{activeSession.success_rate}%</p>
                <p className="text-xs text-gray-600">Success</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {/* Screenshot Button */}
              {activeSession.screenshot_path && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setCurrentMedia({type: 'screenshot', url: activeSession.screenshot_path || ''});
                    setShowMediaViewer(true);
                  }}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  View Screenshot
                </Button>
              )}

              {/* Video Button */}
              {activeSession.video_path && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setCurrentMedia({type: 'video', url: activeSession.video_path || ''});
                    setShowMediaViewer(true);
                  }}
                >
                  <Video className="h-4 w-4 mr-2" />
                  View Recording
                </Button>
              )}

              {/* Review & Submit Button */}
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setShowSessionDetails(false);
                  handleRefillForm();
                }}
                disabled={isRefilling}
              >
                {isRefilling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Opening Browser...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Review & Submit
                  </>
                )}
              </Button>
            </div>

            {/* Info Text */}
            <p className="text-xs text-gray-500 text-center">
              Click "Review & Submit" to open a browser with the form pre-filled. Review and submit it manually.
            </p>
          </div>
        </div>
      )}

      {/* Match Details Modal */}
      {showMatchDetails && job.matchCriteria && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowMatchDetails(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Match Analysis</h3>
                <p className="text-sm text-gray-600">{job.title} at {job.company}</p>
              </div>
              <button
                onClick={() => setShowMatchDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overall Score */}
            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {job.matchCriteria.overallScore}%
              </div>
              <div className="text-sm text-gray-600 mb-2">Overall Match Score</div>
              <Badge
                variant={
                  job.matchCriteria.recommendation === 'highly-recommended' ? 'default' :
                  job.matchCriteria.recommendation === 'good-fit' ? 'secondary' :
                  job.matchCriteria.recommendation === 'possible-fit' ? 'outline' : 'destructive'
                }
                className="text-sm"
              >
                {job.matchCriteria.recommendation.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Score Breakdown</h4>
              
              {/* Role Match */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium">Role Match</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.roleMatch}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.roleMatch}%</span>
                </div>
              </div>

              {/* Location Match */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Location Match</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.locationMatch}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.locationMatch}%</span>
                </div>
              </div>

              {/* Skills Match */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium">Skills Match</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.skillsMatch}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.skillsMatch}%</span>
                </div>
              </div>

              {/* Visa Match */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-sm font-medium">Visa Match</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.visaMatch}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.visaMatch}%</span>
                </div>
              </div>

              {/* Experience Match */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span className="text-sm font-medium">Experience Match</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.experienceMatch}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.experienceMatch}%</span>
                </div>
              </div>

              {/* Salary Match */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm font-medium">Salary Match</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.salaryMatch}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.salaryMatch}%</span>
                </div>
              </div>

              {/* Culture Fit */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                  <span className="text-sm font-medium">Culture Fit</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-pink-500 h-2 rounded-full" 
                      style={{ width: `${job.matchCriteria.breakdown.cultureFit}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold w-8">{job.matchCriteria.breakdown.cultureFit}%</span>
                </div>
              </div>
            </div>

            {/* Match Reasons */}
            {job.matchCriteria.matchReasons.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Why This Job Matches</h4>
                <div className="space-y-2">
                  {job.matchCriteria.matchReasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-green-50 rounded text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-green-800">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concerns */}
            {job.matchCriteria.concerns.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Potential Concerns</h4>
                <div className="space-y-2">
                  {job.matchCriteria.concerns.map((concern, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-yellow-50 rounded text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <span className="text-yellow-800">{concern}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => setShowMatchDetails(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {showMediaViewer && currentMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {currentMedia.type === 'screenshot' ? 'Application Screenshot' : 'Application Recording'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowMediaViewer(false);
                  setCurrentMedia(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Media Content */}
            <div className="p-4 max-h-[calc(90vh-120px)] overflow-auto">
              {currentMedia.type === 'screenshot' ? (
                <img 
                  src={currentMedia.url} 
                  alt="Application Screenshot"
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              ) : (
                <video 
                  src={currentMedia.url} 
                  controls
                  className="w-full h-auto rounded-lg shadow-lg"
                  style={{ maxHeight: 'calc(90vh - 200px)' }}
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live View Modal */}
      {showLiveViewModal && cloudNotification?.liveUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          {/* Header Bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-black bg-opacity-80 z-10">
            <h3 className="text-lg font-semibold text-white">
              Live Session View
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLiveViewModal(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Iframe Container */}
          <div className="w-full h-full pt-16">
            <iframe
              src={cloudNotification.liveUrl}
              sandbox="allow-same-origin allow-scripts"
              allow="clipboard-read; clipboard-write"
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none',
                pointerEvents: 'none'
              }}
              title="Live Session View"
            />
          </div>
        </div>
      )}
    </>
  );
}

// Simple job card variant for list views
export function SimpleJobCard({
  job,
  userId,
  onClick,
  className = "",
}: {
  job: JobCardData;
  userId: string | null;
  onClick?: () => void;
  className?: string;
}) {
  const { sessions } = useAutoApplySessions(userId);
  const activeSession = sessions.find(s => s.job_url === job.applicationUrl);

  return (
    <Card
      className={`hover:shadow-md transition-all cursor-pointer relative ${className}`}
      onClick={onClick}
    >
      {activeSession && (
        <div className="absolute top-2 right-2 z-10">
          <SessionTimer
            session={activeSession}
            onReviewClick={(url: string) => {
              window.open(url, '_blank');
            }}
          />
        </div>
      )}

      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{job.title}</CardTitle>
        <CardDescription className="flex items-center gap-1 text-sm">
          <Building2 className="h-3 w-3" />
          {job.company}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <MapPin className="h-3 w-3" />
          {job.location}
          {job.remoteType && (
            <Badge variant="outline" className="text-xs">{job.remoteType}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

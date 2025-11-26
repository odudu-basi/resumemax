"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ExternalLink, AlertCircle, Image as ImageIcon, Video, ChevronDown, ChevronUp } from "lucide-react";
import type { ActiveSession } from "@/src/hooks/useAutoApplySessions";

interface SessionTimerProps {
  session: ActiveSession;
  onReviewClick: (jobUrl: string) => void;
}

export function SessionTimer({ session, onReviewClick }: SessionTimerProps) {
  const [expanded, setExpanded] = useState(false);
  const isExpiring = session.timeRemaining < 5 * 60 * 1000; // Less than 5 minutes
  const isExpired = session.expired;

  return (
    <div className="absolute top-2 right-2 z-10">
      <div className="flex flex-col items-end gap-2">
        {/* Timer Badge */}
        <Badge
          variant={isExpired ? "destructive" : isExpiring ? "default" : "secondary"}
          className={`text-xs flex items-center gap-1 cursor-pointer ${
            isExpiring && !isExpired ? "animate-pulse" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {isExpired ? (
            <>
              <AlertCircle className="h-3 w-3" />
              Expired
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              {session.formattedTime}
            </>
          )}
          {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Badge>

        {/* Expanded Media Links */}
        {expanded && !isExpired && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2 min-w-[180px]">
            {/* Screenshot Link */}
            {session.screenshot_path && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs justify-start"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(session.screenshot_path || '', '_blank');
                }}
              >
                <ImageIcon className="h-3 w-3 mr-2" />
                View Screenshot
              </Button>
            )}

            {/* Video Link */}
            {session.video_path && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs justify-start"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(session.video_path || '', '_blank');
                }}
              >
                <Video className="h-3 w-3 mr-2" />
                View Recording
              </Button>
            )}

            {/* Open Application Button */}
            <Button
              size="sm"
              variant="default"
              className="w-full text-xs bg-green-600 hover:bg-green-700"
              onClick={(e) => {
                e.stopPropagation();
                onReviewClick(session.job_url);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              Open & Submit
            </Button>
          </div>
        )}

        {/* Quick Open Button (when collapsed) */}
        {!expanded && !isExpired && (
          <Button
            size="sm"
            variant="default"
            className="text-xs bg-green-600 hover:bg-green-700"
            onClick={(e) => {
              e.stopPropagation();
              onReviewClick(session.job_url);
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open & Submit
          </Button>
        )}

        {/* Expired Session Actions */}
        {isExpired && (
          <div className="bg-white border border-red-200 rounded-lg shadow-lg p-3 space-y-2 min-w-[180px]">
            <div className="text-xs text-red-600 font-medium text-center">
              Session Expired
            </div>
            <Button
              size="sm"
              variant="default"
              className="w-full text-xs bg-blue-600 hover:bg-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                onReviewClick(session.job_url);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              Extend & Review
            </Button>
            <div className="text-xs text-gray-500 text-center">
              Click to extend session by 15 minutes
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple timer badge component for displaying in list view
interface SessionTimerBadgeProps {
  formattedTime: string;
  expired: boolean;
}

export function SessionTimerBadge({ formattedTime, expired }: SessionTimerBadgeProps) {
  return (
    <Badge
      variant={expired ? "destructive" : "default"}
      className={`text-xs flex items-center gap-1 ${!expired ? "animate-pulse" : ""}`}
    >
      {expired ? (
        <>
          <AlertCircle className="h-3 w-3" />
          Expired
        </>
      ) : (
        <>
          <Clock className="h-3 w-3" />
          {formattedTime}
        </>
      )}
    </Badge>
  );
}

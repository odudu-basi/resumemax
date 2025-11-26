"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

type VoiceBubbleProps = {
  title?: string;
  hint?: string;
  onTranscript?: (text: string) => void;
  className?: string;
};

export default function VoiceBubble({
  title = "Voice Mode",
  hint = "Tap the bubble to speak",
  onTranscript,
  className = "",
}: VoiceBubbleProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup media tracks when unmounting
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start(100); // collect small chunks
      setIsRecording(true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Microphone access denied");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    try {
      const mr = mediaRecorderRef.current;
      if (!mr) return;
      await new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
        mr.stop();
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], "recording.webm", { type: "audio/webm" });
      chunksRef.current = [];
      await transcribe(file);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to stop recording");
    }
  };

  const transcribe = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch("/api/transcribe-audio", { method: "POST", body: form });
      if (!res.ok) {
        const t = await res.json().catch(() => ({}));
        throw new Error(t?.error || `Transcription failed: ${res.status}`);
      }
      const data = await res.json();
      const text = data.transcription || "";
      setTranscript(text);
      onTranscript?.(text);
    } catch (err: any) {
      setErrorMessage(err?.message || "Transcription error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggle = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      <div className="text-center mb-3">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{isRecording ? "Listening..." : hint}</p>
      </div>

      <button
        onClick={handleToggle}
        disabled={isProcessing}
        className={`relative h-28 w-28 rounded-full focus:outline-none transition-transform ${
          isRecording ? "scale-105" : "hover:scale-105"
        }`}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {/* Bubble visual */}
        <div
          className={`absolute inset-0 rounded-full ${
            isRecording ? "animate-ping" : ""
          } bg-gradient-to-tr from-pink-300 via-purple-300 to-blue-300 opacity-60`}
        />
        <div className="absolute inset-1 rounded-full bg-white" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-200 via-purple-200 to-blue-200 opacity-70 blur-2xl" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-400 via-purple-400 to-blue-400 opacity-40" />

        {/* Icon layer */}
        <div className="relative z-10 h-full w-full rounded-full flex items-center justify-center">
          {isProcessing ? (
            <Loader2 className="h-7 w-7 animate-spin text-purple-700" />
          ) : isRecording ? (
            <Square className="h-8 w-8 text-purple-700" />
          ) : (
            <Mic className="h-8 w-8 text-purple-700" />
          )}
        </div>
      </button>

      {errorMessage && (
        <p className="mt-3 text-xs text-red-600 text-center max-w-sm">{errorMessage}</p>
      )}
      {transcript && (
        <div className="mt-4 w-full max-w-xl p-3 rounded-lg border bg-white">
          <p className="text-xs font-medium text-gray-700 mb-1">Transcript</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
    </div>
  );
}



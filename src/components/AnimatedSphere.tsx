"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedSphereProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  className?: string;
  onClick?: () => void;
}

export default function AnimatedSphere({ 
  isListening = false, 
  isSpeaking = false, 
  audioLevel = 0, 
  className = "",
  onClick 
}: AnimatedSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [time, setTime] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      setTime(prev => prev + 0.02);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(canvas.width, canvas.height) * 0.3;
      
      // Calculate dynamic radius based on audio level and state
      let radiusMultiplier = 1;
      if (isListening) {
        radiusMultiplier = 1 + (audioLevel * 0.3) + Math.sin(time * 8) * 0.1;
      } else if (isSpeaking) {
        radiusMultiplier = 1 + Math.sin(time * 6) * 0.15;
      } else {
        radiusMultiplier = 1 + Math.sin(time * 2) * 0.05;
      }
      
      const radius = baseRadius * radiusMultiplier;
      
      // Create gradient for the sphere
      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3, 
        centerY - radius * 0.3, 
        0,
        centerX, 
        centerY, 
        radius
      );
      
      // Dynamic colors based on state
      if (isListening) {
        gradient.addColorStop(0, `hsla(${240 + Math.sin(time) * 20}, 80%, 85%, 0.9)`);
        gradient.addColorStop(0.3, `hsla(${280 + Math.cos(time * 1.2) * 30}, 70%, 75%, 0.7)`);
        gradient.addColorStop(0.7, `hsla(${320 + Math.sin(time * 0.8) * 25}, 75%, 65%, 0.5)`);
        gradient.addColorStop(1, `hsla(${260 + Math.cos(time * 1.5) * 20}, 60%, 55%, 0.3)`);
      } else if (isSpeaking) {
        gradient.addColorStop(0, `hsla(${300 + Math.sin(time) * 15}, 75%, 80%, 0.9)`);
        gradient.addColorStop(0.3, `hsla(${260 + Math.cos(time * 1.1) * 25}, 70%, 70%, 0.7)`);
        gradient.addColorStop(0.7, `hsla(${220 + Math.sin(time * 0.9) * 20}, 65%, 60%, 0.5)`);
        gradient.addColorStop(1, `hsla(${280 + Math.cos(time * 1.3) * 15}, 55%, 50%, 0.3)`);
      } else {
        gradient.addColorStop(0, `hsla(${220 + Math.sin(time * 0.5) * 10}, 70%, 80%, 0.8)`);
        gradient.addColorStop(0.3, `hsla(${260 + Math.cos(time * 0.7) * 15}, 65%, 70%, 0.6)`);
        gradient.addColorStop(0.7, `hsla(${300 + Math.sin(time * 0.6) * 12}, 60%, 60%, 0.4)`);
        gradient.addColorStop(1, `hsla(${240 + Math.cos(time * 0.8) * 10}, 50%, 50%, 0.2)`);
      }
      
      // Draw main sphere
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Add swirly patterns
      for (let i = 0; i < 3; i++) {
        const swirlyGradient = ctx.createRadialGradient(
          centerX + Math.cos(time + i * 2) * radius * 0.3,
          centerY + Math.sin(time + i * 2) * radius * 0.3,
          0,
          centerX,
          centerY,
          radius * 0.8
        );
        
        swirlyGradient.addColorStop(0, `hsla(${180 + i * 60 + time * 20}, 80%, 90%, 0.3)`);
        swirlyGradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(
          centerX + Math.cos(time * 0.5 + i * 2) * radius * 0.2,
          centerY + Math.sin(time * 0.5 + i * 2) * radius * 0.2,
          radius * (0.6 + Math.sin(time + i) * 0.1),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = swirlyGradient;
        ctx.fill();
      }
      
      // Add highlight for glassy effect
      const highlightGradient = ctx.createRadialGradient(
        centerX - radius * 0.4,
        centerY - radius * 0.4,
        0,
        centerX - radius * 0.4,
        centerY - radius * 0.4,
        radius * 0.6
      );
      
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
      highlightGradient.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(centerX - radius * 0.2, centerY - radius * 0.2, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = highlightGradient;
      ctx.fill();
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isSpeaking, audioLevel, time]);

  return (
    <div className={`relative ${className}`}>
      {/* Background glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-xl transition-all duration-300 ${
          isListening 
            ? 'bg-gradient-to-r from-blue-400/30 to-purple-400/30 scale-150' 
            : isSpeaking
            ? 'bg-gradient-to-r from-purple-400/30 to-pink-400/30 scale-140'
            : 'bg-gradient-to-r from-blue-300/20 to-purple-300/20 scale-125'
        }`}
      />
      
      {/* Main sphere container */}
      <motion.div
        className="relative cursor-pointer"
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          scale: isListening ? [1, 1.1, 1] : isSpeaking ? [1, 1.05, 1] : 1,
        }}
        transition={{
          duration: isListening ? 0.5 : isSpeaking ? 0.8 : 2,
          repeat: (isListening || isSpeaking) ? Infinity : 0,
          ease: "easeInOut"
        }}
      >
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          className="w-full h-full"
          style={{ filter: 'blur(0.5px)' }}
        />
      </motion.div>
      
      {/* State indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className={`text-white/80 text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm ${
            isListening 
              ? 'bg-blue-500/20' 
              : isSpeaking 
              ? 'bg-purple-500/20' 
              : 'bg-gray-500/10'
          }`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Tap to talk'}
        </motion.div>
      </div>
    </div>
  );
}

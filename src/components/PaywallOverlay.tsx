'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Zap, Lock } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface PaywallOverlayProps {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
  showUpgrade?: boolean;
  upgradeText?: string;
}

export function PaywallOverlay({ 
  title, 
  description = "Upgrade to see detailed insights", 
  className = "",
  children,
  showUpgrade = true,
  upgradeText = "Upgrade to Pro"
}: PaywallOverlayProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Blurred background content */}
      <div className="filter blur-sm pointer-events-none select-none">
        {children}
      </div>
      
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center"
      >
        <Card className="w-full max-w-md mx-4 border-2 border-blue-200 bg-white/95 backdrop-blur-md shadow-xl">
          <CardContent className="p-8 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="space-y-6"
            >
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                <Crown className="w-8 h-8 text-white" />
              </div>
              
              {/* Title */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
              
              {/* Features */}
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-gray-700">Detailed strengths analysis</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-gray-700">Specific improvement areas</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span className="text-gray-700">Actionable recommendations</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <span className="text-gray-700">Unlimited analysis reports</span>
                </div>
              </div>
              
              {/* Upgrade Button */}
              {showUpgrade && (
                <div className="space-y-3 pt-2">
                  <Link href="/pricing">
                    <Button size="lg" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                      <Crown className="mr-2 h-4 w-4" />
                      {upgradeText}
                    </Button>
                  </Link>
                  
                  <p className="text-xs text-gray-500">
                    Starting at $9.99/month • Cancel anytime
                  </p>
                </div>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

interface BlurredListItemProps {
  children: React.ReactNode;
  showUpgrade?: boolean;
}

export function BlurredListItem({ children, showUpgrade = true }: BlurredListItemProps) {
  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="filter blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>
      
      {/* Mini upgrade overlay */}
      {showUpgrade && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-gradient-to-r from-blue-50/80 to-purple-50/80 flex items-center justify-center"
        >
          <Link href="/pricing">
            <Button 
              size="sm" 
              variant="outline" 
              className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 shadow-sm"
            >
              <Lock className="mr-1 h-3 w-3" />
              Unlock
            </Button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}

export default PaywallOverlay;

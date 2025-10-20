"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  BarChart3, 
  Zap, 
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [displayedText, setDisplayedText] = useState("");
  const [displayedSubText, setDisplayedSubText] = useState("");
  const [showButtons, setShowButtons] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subTextIndex, setSubTextIndex] = useState(0);
  const [startSubText, setStartSubText] = useState(false);
  const [startTime] = useState(Date.now());

  const fullText = `Welcome ${user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'}, What would you like to do today?`;
  const subText = "if you have an account sign in";

  // Track page view and onboarding start
  useEffect(() => {
    MixpanelService.trackPageView({
      page_name: 'onboarding',
      user_id: user?.id,
    });
    
    MixpanelService.trackOnboardingStarted({
      user_id: user?.id,
      user_name: user?.user_metadata?.full_name || user?.email?.split('@')[0],
    });
  }, [user?.id, user?.user_metadata?.full_name, user?.email]);

  // Main text typing animation effect
  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + fullText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50); // Adjust typing speed here

      return () => clearTimeout(timeout);
    } else if (!startSubText) {
      // Main text is complete, start sub text after a brief delay
      const timeout = setTimeout(() => {
        setStartSubText(true);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, fullText, startSubText]);

  // Sub text typing animation effect
  useEffect(() => {
    if (startSubText && subTextIndex < subText.length) {
      const timeout = setTimeout(() => {
        setDisplayedSubText(prev => prev + subText[subTextIndex]);
        setSubTextIndex(prev => prev + 1);
      }, 40); // Slightly faster for the smaller text

      return () => clearTimeout(timeout);
    } else if (startSubText && subTextIndex >= subText.length) {
      // Sub text is complete, show buttons after a brief delay
      const timeout = setTimeout(() => {
        setShowButtons(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [startSubText, subTextIndex, subText]);

  const handleButtonClick = (action: string) => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    
    MixpanelService.trackFeatureButtonClick({
      button_name: `onboarding_${action}`,
      feature_name: action.replace('-', '_'),
      user_authenticated: !!user,
      user_id: user?.id,
    });
    
    MixpanelService.trackOnboardingCompleted({
      user_id: user?.id,
      selected_action: action,
      time_spent_seconds: timeSpent,
    });
    
    // Navigate based on action
    if (action === 'create-resume') {
      router.push('/create-resume/intro');
    } else if (action === 'rate-resume') {
      router.push('/rate-resume/intro');
    } else if (action === 'tailor-resume') {
      router.push('/tailor-resume/intro');
    } else {
      // For other buttons, don't navigate yet as requested
      console.log(`${action} button clicked`);
    }
  };

  const handleBackClick = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    
    MixpanelService.track('onboarding_back_clicked', {
      user_id: user?.id,
    });
    
    MixpanelService.trackOnboardingAbandoned({
      user_id: user?.id,
      time_spent_seconds: timeSpent,
      last_action: 'back_button_clicked',
    });
    
    router.push('/');
  };

  const onboardingOptions = [
    {
      id: 'create-resume',
      title: 'Create Resume',
      description: 'Build a professional resume from scratch with AI assistance',
      icon: FileText,
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'from-blue-600 to-blue-700',
      delay: 0.1
    },
    {
      id: 'rate-resume',
      title: 'Rate Resume',
      description: 'Get instant AI-powered analysis and scoring for your existing resume',
      icon: BarChart3,
      gradient: 'from-purple-500 to-purple-600',
      hoverGradient: 'from-purple-600 to-purple-700',
      delay: 0.2
    },
    {
      id: 'tailor-resume',
      title: 'Tailor Resume',
      description: 'Optimize your resume for specific job opportunities',
      icon: Zap,
      gradient: 'from-green-500 to-green-600',
      hoverGradient: 'from-green-600 to-green-700',
      delay: 0.3
    }
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-y-auto">
      <div className="container mx-auto px-4 pt-4 pb-8 sm:px-6 lg:px-8 min-h-full">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
            <Button
            variant="ghost"
            onClick={handleBackClick}
            className="flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </motion.div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Welcome Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-6">
              <Sparkles className="mr-1 h-3 w-3" />
              Let's Get Started
            </Badge>
            
            <div className="relative">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 min-h-[120px] flex items-center justify-center">
                <span className="relative">
                  {displayedText}
                  {currentIndex >= fullText.length && !startSubText && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                      className="inline-block w-1 h-12 bg-white ml-1"
                    />
                  )}
                </span>
              </h1>
              
              {/* Sub text */}
              <AnimatePresence>
                {startSubText && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm md:text-base text-white/70 mb-6"
                  >
                    <span className="relative">
                      {displayedSubText}
                      {subTextIndex < subText.length && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                          className="inline-block w-0.5 h-4 bg-white/70 ml-1"
                        />
                      )}
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <AnimatePresence>
            {showButtons && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="grid gap-6 md:grid-cols-3"
              >
                {onboardingOptions.map((option) => (
                  <motion.div
                    key={option.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.6, 
                      delay: option.delay,
                      ease: "easeOut"
                    }}
                  >
                    <Card className="h-full hover:shadow-xl transition-all duration-300 border border-white/20 bg-white/10 backdrop-blur-md group cursor-pointer">
                      <CardContent className="p-8 text-center h-full flex flex-col">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex flex-col items-center"
                          onClick={() => handleButtonClick(option.id)}
                        >
                          {/* Icon */}
                          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${option.gradient} flex items-center justify-center mb-6 group-hover:shadow-lg transition-all duration-300`}>
                            <option.icon className="h-10 w-10 text-white" />
                          </div>

                          {/* Title */}
                          <h3 className="text-2xl font-bold text-white mb-4">
                            {option.title}
                          </h3>

                          {/* Description */}
                          <p className="text-white/80 mb-8 flex-1">
                            {option.description}
                          </p>

                          {/* Button */}
                          <Button
                            size="lg"
                            className={`w-full bg-gradient-to-r ${option.gradient} hover:bg-gradient-to-r hover:${option.hoverGradient} text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300`}
                          >
                            Get Started
                          </Button>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Decorative Elements */}
          <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-40 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-20 w-20 h-20 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

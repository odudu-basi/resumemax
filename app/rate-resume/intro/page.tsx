"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Target,
  Zap,
  Brain,
  FileSearch,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Lightbulb
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";

export default function RateResumeIntroPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [displayedText, setDisplayedText] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fullText = "Discover your resume's weak points and transform them into strengths with AI-powered analysis.";

  // Track page view
  useEffect(() => {
    MixpanelService.trackPageView({
      page_name: 'rate_resume_intro',
      user_id: user?.id,
    });
  }, [user?.id]);

  // Typing animation effect
  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + fullText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50); // Adjust typing speed here

      return () => clearTimeout(timeout);
    } else {
      // Text is complete, show content after a brief delay
      const timeout = setTimeout(() => {
        setShowContent(true);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, fullText]);

  const handleContinue = () => {
    MixpanelService.track('rate_resume_intro_continue', {
      user_id: user?.id,
    });
    router.push('/rate-resume?from=onboarding');
  };

  const handleBack = () => {
    MixpanelService.track('rate_resume_intro_back', {
      user_id: user?.id,
    });
    router.push('/onboarding');
  };

  const features = [
    {
      icon: Target,
      title: "Pinpoint Weak Spots",
      description: "Our AI identifies specific areas where your resume falls short for target positions",
      color: "from-red-500 to-orange-500"
    },
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Advanced algorithms compare your resume against job requirements and industry standards",
      color: "from-blue-500 to-purple-500"
    },
    {
      icon: Lightbulb,
      title: "Smart Improvements",
      description: "Get actionable suggestions to strengthen weak areas and boost your resume score",
      color: "from-green-500 to-teal-500"
    }
  ];

  const benefits = [
    {
      icon: FileSearch,
      title: "Deep Resume Scan",
      description: "Comprehensive analysis of content, keywords, formatting, and ATS compatibility"
    },
    {
      icon: BarChart3,
      title: "Detailed Scoring",
      description: "Get numerical scores for different sections with clear improvement targets"
    },
    {
      icon: TrendingUp,
      title: "Performance Boost",
      description: "See exactly how changes will improve your resume's effectiveness"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Onboarding
          </Button>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          {/* Header with Typing Animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-6">
              <BarChart3 className="mr-1 h-3 w-3" />
              AI Resume Analysis
            </Badge>
            
            <div className="relative mb-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 min-h-[120px] flex items-center justify-center">
                <span className="relative max-w-4xl">
                  {displayedText}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                    className="inline-block w-1 h-12 bg-purple-600 ml-1"
                  />
                </span>
              </h1>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={showContent ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Upload your resume and job description to get instant, detailed feedback on what's holding you back from landing interviews.
            </motion.p>
          </motion.div>

          {/* Main Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-20"
          >
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              How Our AI Analysis Works
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                    <CardContent className="p-8 text-center">
                      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                        <feature.icon className="h-10 w-10 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* What You'll Get */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-16"
          >
            <Card className="p-12 bg-white/80 backdrop-blur-sm border-0 shadow-2xl">
              <CardHeader className="text-center pb-12">
                <CardTitle className="text-3xl font-bold text-gray-900 mb-4">
                  What You'll Discover
                </CardTitle>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Get comprehensive insights into your resume's performance
                </p>
              </CardHeader>
              
              <CardContent>
                <div className="grid md:grid-cols-3 gap-8">
                  {benefits.map((benefit, index) => (
                    <motion.div
                      key={benefit.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={showContent ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                      transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                      className="flex flex-col items-center text-center"
                    >
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                        <benefit.icon className="h-8 w-8 text-purple-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        {benefit.title}
                      </h4>
                      <p className="text-gray-600 leading-relaxed">
                        {benefit.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Example Results Preview */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Sample Analysis Results
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Weak Points */}
              <Card className="p-6 border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                    <CardTitle className="text-xl text-orange-800">Weak Points Identified</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <p className="text-orange-700">Missing key technical skills for the role</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <p className="text-orange-700">Weak action verbs in experience descriptions</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <p className="text-orange-700">Lack of quantified achievements</p>
                  </div>
                </CardContent>
              </Card>

              {/* Improvements */}
              <Card className="p-6 border-green-200 bg-green-50/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <CardTitle className="text-xl text-green-800">AI Improvements</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <p className="text-green-700">Add "Python, React, AWS" to skills section</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <p className="text-green-700">Replace "Worked on" with "Developed and deployed"</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <p className="text-green-700">Include "Increased efficiency by 40%" metrics</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-center"
          >
            <Card className="p-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <CardContent>
                <h2 className="text-3xl font-bold mb-4">
                  Ready to Analyze Your Resume?
                </h2>
                <p className="text-xl mb-8 text-purple-100">
                  Get detailed insights and AI-powered recommendations to make your resume stand out.
                </p>
                
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleContinue}
                    className="bg-white text-purple-600 hover:bg-gray-100"
                    size="lg"
                  >
                    Start Analysis
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

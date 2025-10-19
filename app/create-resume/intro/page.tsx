"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
  Zap,
  Target
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";

export default function CreateResumeIntroPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [animateGraph, setAnimateGraph] = useState(false);

  // Track page view
  useEffect(() => {
    MixpanelService.trackPageView({
      page_name: 'create_resume_intro',
      user_id: user?.id,
    });

    // Start graph animation after a delay
    const timer = setTimeout(() => {
      setAnimateGraph(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleContinue = () => {
    MixpanelService.track('create_resume_intro_continue', {
      user_id: user?.id,
    });
    router.push('/create-resume/builder');
  };

  const handleBack = () => {
    MixpanelService.track('create_resume_intro_back', {
      user_id: user?.id,
    });
    router.push('/onboarding');
  };

  const atsData = [
    { type: "Standard Resume", percentage: 25, color: "bg-red-500", description: "Basic formatting, no ATS optimization" },
    { type: "Good Resume", percentage: 60, color: "bg-yellow-500", description: "Well-written but not ATS-focused" },
    { type: "ATS-Optimized Resume", percentage: 92, color: "bg-green-500", description: "Built with ATS systems in mind" },
  ];

  const benefits = [
    {
      icon: Target,
      title: "Keyword Optimization",
      description: "Strategic placement of industry-relevant keywords"
    },
    {
      icon: FileText,
      title: "ATS-Friendly Format",
      description: "Clean, scannable structure that ATS systems love"
    },
    {
      icon: Zap,
      title: "Instant Results",
      description: "Higher chance of getting past initial screening"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
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
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <Badge variant="secondary" className="mb-4">
              <TrendingUp className="mr-1 h-3 w-3" />
              ATS Optimization
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Why ATS-Optimized Resumes Matter
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              75% of resumes never reach human eyes due to ATS filtering. 
              Let's build you a resume that gets noticed.
            </p>
          </motion.div>

          {/* ATS Success Rate Graph */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-20"
          >
            <Card className="p-12 bg-white/80 backdrop-blur-sm border-0 shadow-2xl">
              <CardHeader className="text-center pb-12">
                <CardTitle className="text-3xl font-bold text-gray-900 mb-4">
                  ATS Pass-Through Rates
                </CardTitle>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Likelihood of your resume passing initial ATS screening
                </p>
              </CardHeader>
              
              <CardContent className="px-8">
                {/* Chart Container with Grid Background */}
                <div className="relative bg-gradient-to-b from-gray-50 to-white rounded-2xl p-12 mb-12">
                  {/* Chart Area */}
                  <div className="relative">
                    {/* Y-Axis Labels */}
                    <div className="absolute left-0 top-0 h-80 flex flex-col justify-between text-sm text-gray-500 pr-4">
                      {[100, 75, 50, 25, 0].map((value) => (
                        <span key={value} className="transform -translate-y-1/2 text-right">
                          {value}%
                        </span>
                      ))}
                    </div>

                    {/* Grid Lines */}
                    <div className="absolute left-16 right-0 top-0 h-80">
                      {[0, 25, 50, 75, 100].map((line) => (
                        <div
                          key={line}
                          className="absolute w-full border-t border-gray-300 opacity-30"
                          style={{ top: `${100 - line}%` }}
                        />
                      ))}
                    </div>

                    {/* Chart Content */}
                    <div className="ml-16">
                      {/* Vertical Bar Chart */}
                      <div className="flex items-end justify-center gap-16 h-80 relative">
                        {atsData.map((item, index) => (
                          <motion.div
                            key={item.type}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 + index * 0.2 }}
                            className="flex flex-col items-center relative"
                          >
                            {/* Percentage Label Above Bar */}
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, y: 10 }}
                              animate={animateGraph ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
                              transition={{ duration: 0.6, delay: 1.4 + index * 0.2 }}
                              className="absolute -top-16 left-1/2 transform -translate-x-1/2"
                            >
                              <div className={`px-4 py-2 rounded-full ${item.color} shadow-lg`}>
                                <span className="font-bold text-xl text-white">{item.percentage}%</span>
                              </div>
                            </motion.div>

                            {/* Bar Container - All bars same height, aligned to bottom */}
                            <div className="relative w-24 h-80 bg-gray-200/50 rounded-t-xl overflow-hidden shadow-inner border border-gray-200">
                              <motion.div
                                className={`absolute bottom-0 w-full ${item.color} rounded-t-xl flex items-center justify-center shadow-lg`}
                                initial={{ height: 0 }}
                                animate={animateGraph ? { height: `${item.percentage}%` } : { height: 0 }}
                                transition={{ duration: 2, delay: 0.8 + index * 0.3, ease: "easeOut" }}
                              >
                                {/* Icon inside bar */}
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={animateGraph ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                                  transition={{ duration: 0.5, delay: 2 + index * 0.3 }}
                                  className="absolute bottom-4"
                                >
                                  {item.percentage >= 90 ? (
                                    <CheckCircle className="h-8 w-8 text-white drop-shadow-lg" />
                                  ) : item.percentage >= 50 ? (
                                    <div className="h-8 w-8 rounded-full bg-white/90 shadow-lg" />
                                  ) : (
                                    <XCircle className="h-8 w-8 text-white drop-shadow-lg" />
                                  )}
                                </motion.div>
                              </motion.div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Labels Below the 0% Line */}
                      <div className="flex justify-center gap-16 mt-8">
                        {atsData.map((item, index) => (
                          <motion.div
                            key={`label-${item.type}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.6 + index * 0.2 }}
                            className="text-center w-24"
                          >
                            <h4 className="font-bold text-gray-900 text-base mb-2">
                              {item.type}
                            </h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {item.description}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Highlight Box */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 2.5 }}
                  className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-8 border border-green-200/50 shadow-lg"
                >
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="p-3 bg-green-500 rounded-full shadow-lg">
                      <TrendingUp className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-green-800">
                      3.7x Higher Success Rate
                    </h3>
                  </div>
                  <p className="text-green-700 text-center text-lg leading-relaxed">
                    ATS-optimized resumes are <span className="font-semibold">3.7 times more likely</span> to pass initial screening 
                    compared to standard resumes.
                  </p>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Benefits Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
              What Makes Our Resume Builder Different
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <benefit.icon className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        {benefit.title}
                      </h3>
                      <p className="text-gray-600">
                        {benefit.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-center"
          >
            <Card className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <CardContent>
                <h2 className="text-3xl font-bold mb-4">
                  Ready to Build Your ATS-Optimized Resume?
                </h2>
                <p className="text-xl mb-8 text-blue-100">
                  Join thousands of job seekers who've increased their interview rates with our AI-powered builder.
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
                    className="bg-white text-blue-600 hover:bg-gray-100"
                    size="lg"
                  >
                    Start Building My Resume
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

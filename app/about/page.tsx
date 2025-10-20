"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Zap, CheckCircle } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";

export default function AboutPage() {
  const { user } = useAuth();

  // Track page view
  useEffect(() => {
    MixpanelService.trackPageView({
      page_name: 'about',
      user_id: user?.id,
    });
  }, [user?.id]);

  const features = [
    {
      icon: BarChart3,
      title: "AI-Powered Analysis",
      description: "Get detailed insights on your resume's strengths and weaknesses with advanced AI technology.",
      delay: 0.1
    },
    {
      icon: Zap,
      title: "Instant Results",
      description: "Receive comprehensive feedback and scoring within seconds of uploading your resume.",
      delay: 0.2
    },
    {
      icon: CheckCircle,
      title: "Actionable Recommendations",
      description: "Get specific suggestions to improve your resume and increase your chances of landing interviews.",
      delay: 0.3
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Why Choose ResumeMax?
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Our advanced AI technology provides comprehensive analysis to help you create a 
            resume that stands out from the competition.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid gap-8 md:grid-cols-3 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.6, 
                delay: feature.delay,
                ease: "easeOut"
              }}
            >
              <Card className="h-full hover:shadow-xl transition-all duration-300 border border-gray-200 bg-white group">
                <CardContent className="p-8 text-center h-full flex flex-col">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 mx-auto group-hover:bg-blue-200 transition-all duration-300">
                    <feature.icon className="h-8 w-8 text-blue-600" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 leading-relaxed flex-1">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Additional About Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 text-center"
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Built for Job Seekers, By Job Seekers
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              ResumeMax was created to solve the challenges we all face in today's competitive job market. 
              Our AI-powered platform combines cutting-edge technology with proven recruiting insights to 
              give you the edge you need to land your dream job.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Whether you're crafting your first resume, optimizing an existing one, or tailoring it for 
              specific opportunities, ResumeMax provides the tools and insights you need to succeed.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

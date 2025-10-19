"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, Zap, CheckCircle, Star, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import MixpanelService from "@/src/lib/mixpanel";
import MixpanelTest from "@/src/components/MixpanelTest";

const features = [
  {
    icon: BarChart3,
    title: "AI-Powered Analysis",
    description: "Get detailed insights on your resume's strengths and weaknesses with advanced AI technology."
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Receive comprehensive feedback and scoring within seconds of uploading your resume."
  },
  {
    icon: CheckCircle,
    title: "Actionable Recommendations",
    description: "Get specific suggestions to improve your resume and increase your chances of landing interviews."
  }
];

const stats = [
  { label: "Resumes Analyzed", value: "50K+" },
  { label: "Success Rate", value: "94%" },
  { label: "Average Score Improvement", value: "+32%" },
  { label: "Happy Users", value: "10K+" }
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  // Track page view
  useEffect(() => {
    MixpanelService.trackPageView({
      page_name: 'homepage',
      user_id: user?.id,
    });
    
    // Track session start
    MixpanelService.trackSessionStarted({
      user_id: user?.id,
      is_new_user: !user,
    });
  }, [user?.id]);

  const handleFeatureClick = (targetPath: string) => {
    const featureName = targetPath.replace('/', '');
    
    // Track feature button click
    MixpanelService.trackFeatureButtonClick({
      button_name: `${featureName}_button`,
      feature_name: featureName,
      user_authenticated: !!user,
      user_id: user?.id,
    });
    
    // Always redirect to onboarding page first
    router.push('/onboarding');
  };
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge variant="secondary" className="mb-4">
                <Star className="mr-1 h-3 w-3" />
                AI-Powered Resume Analysis
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                Maximize Your Resume's{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Potential
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
                Get instant, AI-powered feedback on your resume. Discover what recruiters are looking for 
                and optimize your resume to land more interviews.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6 flex-wrap">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    size="lg" 
                    className="text-lg px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600"
                    onClick={() => handleFeatureClick('/create-resume')}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    Create Resume
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="text-lg px-8 py-3"
                    onClick={() => handleFeatureClick('/rate-resume')}
                  >
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Rate Resume
                  </Button>
                </motion.div>
                <Button 
                  variant="ghost" 
                  size="lg" 
                  className="text-lg px-8 py-3"
                  onClick={() => handleFeatureClick('/tailor-resume')}
                >
                  Tailor Resume
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl font-bold text-blue-600">{stat.value}</div>
                <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Why Choose ResumeMax?
              </h2>
              <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                Our advanced AI technology provides comprehensive analysis to help you create 
                a resume that stands out from the competition.
              </p>
            </motion.div>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Powerful Resume Tools
              </h2>
              <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                Choose the perfect tool for your needs. Create a new resume from scratch or 
                optimize your existing one for specific job opportunities.
              </p>
            </motion.div>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-200">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-2xl">Create Resume</CardTitle>
                  <CardDescription className="text-base">
                    Build a professional resume from scratch with our AI-powered builder
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center pt-4">
                  <ul className="text-sm text-gray-600 mb-6 space-y-2">
                    <li>• AI-powered content suggestions</li>
                    <li>• Professional templates</li>
                    <li>• ATS-optimized formatting</li>
                    <li>• Real-time preview</li>
                  </ul>
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={() => handleFeatureClick('/create-resume')}
                  >
                    Start Building
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-200">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-purple-600" />
                  </div>
                  <CardTitle className="text-2xl">Rate Resume</CardTitle>
                  <CardDescription className="text-base">
                    Get instant AI-powered analysis and scoring for your resume
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center pt-4">
                  <ul className="text-sm text-gray-600 mb-6 space-y-2">
                    <li>• Comprehensive scoring</li>
                    <li>• Detailed feedback</li>
                    <li>• Strengths & improvements</li>
                    <li>• Percentile ranking</li>
                  </ul>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full border-purple-600 text-purple-600 hover:bg-purple-50"
                    onClick={() => handleFeatureClick('/rate-resume')}
                  >
                    Rate Now
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-green-200">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl">Tailor Resume</CardTitle>
                  <CardDescription className="text-base">
                    Optimize your existing resume for specific job opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center pt-4">
                  <ul className="text-sm text-gray-600 mb-6 space-y-2">
                    <li>• Job-specific optimization</li>
                    <li>• Keyword matching</li>
                    <li>• ATS compatibility check</li>
                    <li>• Performance scoring</li>
                  </ul>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full border-green-600 text-green-600 hover:bg-green-50"
                    onClick={() => handleFeatureClick('/tailor-resume')}
                  >
                    Optimize Now
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mixpanel Test Component (Remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <section className="py-8 bg-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <MixpanelTest />
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to Optimize Your Resume?
            </h2>
            <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">
              Join thousands of job seekers who have improved their resumes with ResumeMax.
              Get started today and land your dream job faster.
            </p>
            <div className="mt-8">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="text-lg px-8 py-3"
                  onClick={() => handleFeatureClick('/rate-resume')}
                >
                  <Users className="mr-2 h-5 w-5" />
                  Start Free Analysis
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

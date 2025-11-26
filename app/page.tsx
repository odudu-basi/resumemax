"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, Zap, CheckCircle, Star, Users, Home as HomeIcon, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MixpanelService from "@/src/lib/mixpanel";
import MixpanelTest from "@/src/components/MixpanelTest";
import Link from "next/link";
import Image from "next/image";

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


export default function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [activeVideoTab, setActiveVideoTab] = useState<'create' | 'tailor'>('create');

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

    // Allow unauthenticated users to access onboarding
    if (targetPath === '/onboarding') {
      router.push(targetPath);
      return;
    }

    // For other features, require authentication
    if (!user) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(targetPath)}`);
      return;
    }

    // Authenticated users go directly to the feature
    router.push(targetPath);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 via-30% via-gray-200 via-60% to-black relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-gray-300/30 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-gray-800/20 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-gray-400/10 to-transparent rounded-full blur-3xl"></div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Glassmorphic Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-4 z-50 flex justify-center px-4 py-4"
      >
        <div className="flex items-center justify-between w-full max-w-6xl px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/30 rounded-full shadow-2xl">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold text-white">ResumeMax</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/#features">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                Features
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                Pricing
              </Button>
            </Link>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 flex items-center gap-2"
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-white hover:bg-white/20 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-gray-100"
                  >
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative z-10 py-20 sm:py-32">
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
              <h1 className="text-4xl font-bold tracking-tight text-black sm:text-6xl">
                Automate Your Job Applications{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
                  with AI
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-700 max-w-2xl mx-auto">
                🤖 AI reads job posts, fills out applications, and uploads your resume. 
                👤 You just review in 30 seconds and hit submit. 
                ✨ It's that simple - no more copy-paste madness!
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    size="lg"
                    className="text-lg px-8 py-3 bg-gradient-to-r from-gray-800 to-black text-white hover:from-gray-700 hover:to-gray-900"
                    onClick={() => handleFeatureClick('/onboarding')}
                  >
                    Get Started
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link href="/smart-jobs">
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-lg px-8 py-3 border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white"
                    >
                      Smart Job Search
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Workflow Section */}
      <section className="relative z-10 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-8 sm:p-12 shadow-2xl">
              <div className="mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                  Let AI Handle Your Job Applications
                </h2>
                <p className="text-xl text-gray-600 font-medium">
                  You Just Review and Submit ✨
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-12 items-center mb-8">
                {/* AI Side */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                        <span className="text-lg font-bold">🤖</span>
                      </div>
                      <h3 className="text-xl font-bold">AI Does All The Work</h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center">
                        <span className="mr-2">✓</span>
                        Reads job requirements
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">✓</span>
                        Fills out entire application
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">✓</span>
                        Uploads your resume
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">✓</span>
                        Answers all questions intelligently
                      </li>
                    </ul>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">AI</span>
                  </div>
                </div>

                {/* You Side */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                        <span className="text-lg font-bold">👤</span>
                      </div>
                      <h3 className="text-xl font-bold">You Just Review & Submit</h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center">
                        <span className="mr-2">👀</span>
                        Quick 30-second review
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">✏️</span>
                        Make any final tweaks
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">🚀</span>
                        Hit submit and you're done!
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">☕</span>
                        Grab coffee while AI works
                      </li>
                    </ul>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">YOU</span>
                  </div>
                </div>
              </div>
              
              {/* Bottom Quote */}
              <div className="text-center p-6 bg-gradient-to-r from-gray-800 to-black rounded-2xl text-white">
                <p className="text-2xl font-bold mb-2">
                  "I went from spending 2 hours on applications to 2 minutes"
                </p>
                <p className="text-gray-300">
                  Stop the copy-paste madness. Let AI handle your job applications while you focus on landing interviews.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Showcase Section */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto"
          >
            <div className="text-center mb-8 sm:mb-12 px-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-3 sm:mb-4">
                See ResumeMax in Action
              </h2>
              <p className="text-base sm:text-lg text-gray-700">
                Watch how our AI-powered tools can transform your resume
              </p>
            </div>

            {/* Glassmorphic Tab Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-8 px-4">
              <button
                onClick={() => setActiveVideoTab('create')}
                className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold transition-all duration-300 min-h-[48px] ${
                  activeVideoTab === 'create'
                    ? 'bg-black/80 text-white backdrop-blur-xl border border-white/30 shadow-2xl sm:scale-105'
                    : 'bg-white/60 text-gray-800 backdrop-blur-sm border border-gray-200 hover:bg-white/80 hover:shadow-lg'
                }`}
              >
                Create Resume
              </button>
              <button
                onClick={() => setActiveVideoTab('tailor')}
                className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold transition-all duration-300 min-h-[48px] ${
                  activeVideoTab === 'tailor'
                    ? 'bg-black/80 text-white backdrop-blur-xl border border-white/30 shadow-2xl sm:scale-105'
                    : 'bg-white/60 text-gray-800 backdrop-blur-sm border border-gray-200 hover:bg-white/80 hover:shadow-lg'
                }`}
              >
                Tailor Resume
              </button>
            </div>

            {/* Video Container with Glassmorphic Effect */}
            <div className="relative rounded-3xl overflow-hidden bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl p-2">
              <div className="relative rounded-2xl overflow-hidden bg-black">
                <video
                  key={activeVideoTab}
                  className="w-full h-auto"
                  controls
                  playsInline
                  preload="metadata"
                  src={activeVideoTab === 'create' ? '/create-resume-demo.mp4' : '/tailor-resume-demo.mov'}
                >
                  <source
                    src={activeVideoTab === 'create' ? '/create-resume-demo.mp4' : '/tailor-resume-demo.mov'}
                    type={activeVideoTab === 'create' ? 'video/mp4' : 'video/quicktime'}
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>

            {/* Video Description */}
            <div className="mt-8 text-center px-4">
              <p className="text-base sm:text-lg text-gray-700">
                {activeVideoTab === 'create'
                  ? 'Watch how easy it is to build a professional resume from scratch with AI-powered suggestions and templates.'
                  : 'See how our AI optimizes your existing resume for specific job opportunities with keyword matching and ATS optimization.'}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl font-bold text-black sm:text-4xl">
                Why Choose ResumeMax?
              </h2>
              <p className="mt-4 text-lg text-gray-700 max-w-2xl mx-auto">
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
                  <Card className="h-full hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm border-gray-200">
                    <CardHeader>
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-gray-800" />
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
      <section id="features" className="relative z-10 py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl font-bold text-black sm:text-4xl">
                Powerful Resume Tools
              </h2>
              <p className="mt-4 text-lg text-gray-700 max-w-2xl mx-auto">
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
              <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-gray-300 bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-800" />
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
              <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-gray-300 bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-800" />
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
                    className="w-full border-gray-800 text-gray-800 hover:bg-gray-50"
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
              <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-gray-300 bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-gray-800" />
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
                    className="w-full border-gray-800 text-gray-800 hover:bg-gray-50"
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
        <section className="relative z-10 py-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <MixpanelTest />
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="relative z-10 py-20 bg-gradient-to-r from-gray-800 to-black">
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
            <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
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
                  className="text-lg px-8 py-3 bg-white text-black hover:bg-gray-100"
                  onClick={() => handleFeatureClick('/onboarding')}
                >
                  <Users className="mr-2 h-5 w-5" />
                  Get Started Free
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Section */}
            <div className="md:col-span-2">
              <h3 className="text-xl font-bold text-white mb-3">ResumeMax.ai</h3>
              <p className="text-gray-400 text-sm max-w-md">
                AI-powered resume optimization and job application automation.
                Land your dream job faster with intelligent matching and automated applications.
              </p>
              <p className="text-gray-500 text-xs mt-4">
                Operated by Odanta LLC
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Product</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => handleFeatureClick('/dashboard')}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleFeatureClick('/pricing')}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleFeatureClick('/onboarding')}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Get Started
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/privacy"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-gray-800/50">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} Odanta LLC. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <a
                  href="mailto:support@resumemax.ai"
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  support@resumemax.ai
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, Zap, CheckCircle, Star, Users, Home as HomeIcon, LogOut, Sparkles, MousePointer, FileEdit, ShieldCheck, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import MixpanelService from "@/src/lib/mixpanel";
import MixpanelTest from "@/src/components/MixpanelTest";
import Link from "next/link";
import Image from "next/image";

const features = [
  {
    icon: MousePointer,
    title: "1-Click Apply",
    description: "Paste any job link and apply in seconds. AI extracts details, fills forms, and uploads your documents automatically."
  },
  {
    icon: FileEdit,
    title: "Tailored Cover Letters",
    description: "AI generates truthful, personalized cover letters based on your actual experience for every application."
  },
  {
    icon: ShieldCheck,
    title: "No Duplicate Applications",
    description: "Never apply to the same job twice. Smart tracking prevents duplicate submissions automatically."
  },
  {
    icon: Brain,
    title: "Resume-Based Answers",
    description: "All application questions are answered intelligently using your resume data and profile information."
  }
];


export default function Home() {
  const { user, signOut } = useAuth();
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
                <Link href="/onboarding">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Onboarding</span>
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
              {/* Product Hunt Badge */}
              <div className="flex flex-col items-center mb-8 gap-3">
                {/* Cursive CTA Text */}
                <p className="text-3xl sm:text-4xl font-pacifico italic text-transparent bg-clip-text bg-gradient-to-r from-gray-600 via-gray-800 to-black">
                  Please give us an upvote on Product Hunt
                </p>

                <div className="inline-flex items-center px-6 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-full shadow-lg hover:bg-white/50 transition-all duration-300">
                  <a
                    href="https://www.producthunt.com/products/resumemax-ai?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-resumemax&#0045;ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <img
                      src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1046566&theme=light&t=1765025491233"
                      alt="ResumeMax.ai - Apply to jobs accurately in seconds not hours with AI | Product Hunt"
                      style={{ width: '250px', height: '54px' }}
                      width="250"
                      height="54"
                    />
                  </a>
                </div>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-black sm:text-6xl">
                Apply to Jobs Accurately{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
                  in Seconds Not Hours
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-700 max-w-2xl mx-auto">
                Paste any job link. AI extracts every detail, tailors your application, and completes forms with precision.
                No more manual data entry. No more copy-paste chaos. Just accurate, instant applications.
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
                  You Just Apply ✨
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-12 items-center mb-8">
                {/* AI Side */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-2xl p-6 text-white shadow-xl border border-gray-600">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mr-3">
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
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center border border-gray-500">
                    <span className="text-xs text-white font-bold">AI</span>
                  </div>
                </div>

                {/* You Side */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-gray-700 via-gray-600 to-gray-800 rounded-2xl p-6 text-white shadow-xl border border-gray-500">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mr-3">
                        <span className="text-lg font-bold">👤</span>
                      </div>
                      <h3 className="text-xl font-bold">You Just Apply</h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center">
                        <span className="mr-2">🔍</span>
                        Find the job
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">📋</span>
                        Paste the link
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">🚀</span>
                        Click apply
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">☕</span>
                        Grab a coffee and let AI handle the rest
                      </li>
                    </ul>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center border border-gray-400">
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
              Start Applying to Jobs Accurately in Seconds Not Hours
            </h2>
            <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
              Join thousands using AI to land their dream jobs faster with intelligent auto-apply.
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

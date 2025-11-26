"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useOnboarding } from "@/src/contexts/OnboardingContext";
import ElevenLabsAgent from "@/src/components/ElevenLabsAgent";

export default function OnboardingStep2() {
  const router = useRouter();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  
  const [formData, setFormData] = useState({
    fullName: '',
    preferredName: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    portfolioUrl: ''
  });

  // Load existing data from context on mount
  useEffect(() => {
    if (onboardingData.basicInfo) {
      setFormData(onboardingData.basicInfo);
    }
  }, [onboardingData.basicInfo]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContinue = () => {
    // Save to context instead of database
    updateOnboardingData('basicInfo', formData);
    console.log('Basic info saved to context:', formData);
    // Navigate to step 3
    router.push('/onboarding/step-3');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 via-30% via-gray-200 via-60% to-black relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-gray-300/30 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-gray-800/20 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-gray-400/10 to-transparent rounded-full blur-3xl"></div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Simple Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-4 z-50 flex justify-center px-4 py-4"
      >
        <div className="flex items-center justify-between w-full max-w-6xl px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/30 rounded-full shadow-2xl">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold text-white">ResumeMax</span>
          </Link>
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              Skip Onboarding
            </Button>
          </Link>
        </div>
      </motion.nav>

      {/* Main Content */}
      <section className="relative z-10 py-12 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* JJ Avatar and Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                  <span className="text-xl font-bold text-white">JJ</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl mb-2">
                  Let's Get to Know You Better
                </h1>
                <p className="text-lg text-gray-600">
                  Tell me a bit about yourself so I can personalize your experience
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Full Legal Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">
                      Full Legal Name *
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full legal name"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* Preferred Name */}
                  <div className="space-y-2">
                    <Label htmlFor="preferredName" className="text-sm font-medium">
                      Preferred Name (if different)
                    </Label>
                    <Input
                      id="preferredName"
                      type="text"
                      placeholder="What would you like to be called?"
                      value={formData.preferredName}
                      onChange={(e) => handleInputChange('preferredName', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Email Address */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* Current Location */}
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium">
                      Current Location (City, State) *
                    </Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="San Francisco, CA"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* LinkedIn Profile URL */}
                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl" className="text-sm font-medium">
                      LinkedIn Profile URL (optional)
                    </Label>
                    <Input
                      id="linkedinUrl"
                      type="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={formData.linkedinUrl}
                      onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Portfolio/Personal Website */}
                  <div className="space-y-2">
                    <Label htmlFor="portfolioUrl" className="text-sm font-medium">
                      Portfolio/Personal Website (optional)
                    </Label>
                    <Input
                      id="portfolioUrl"
                      type="url"
                      placeholder="https://yourportfolio.com"
                      value={formData.portfolioUrl}
                      onChange={(e) => handleInputChange('portfolioUrl', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6">
                    <Button
                      variant="outline"
                      onClick={() => router.back()}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleContinue}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      disabled={!formData.fullName || !formData.email || !formData.phone || !formData.location}
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Progress Indicator */}
              <div className="mt-8 flex justify-center">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ElevenLabs AI Agent */}
      <ElevenLabsAgent />
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useOnboarding } from "@/src/contexts/OnboardingContext";

export default function OnboardingStep3() {
  const router = useRouter();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  
  const [formData, setFormData] = useState({
    workAuthorization: '',
    visaStatus: '',
    sponsorshipRequired: false,
    sponsorshipTimeline: ''
  });

  // Load existing data from context on mount
  useEffect(() => {
    if (onboardingData.workAuth) {
      setFormData(onboardingData.workAuth);
    }
  }, [onboardingData.workAuth]);

  const handleSelectChange = (field: string, value: string) => {
    if (field === 'sponsorshipRequired') {
      setFormData(prev => ({
        ...prev,
        [field]: value === 'true'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleContinue = () => {
    // Save to context instead of database
    updateOnboardingData('workAuth', formData);
    console.log('Work auth saved to context:', formData);
    // Navigate to step 4
    router.push('/onboarding/step-4');
  };

  const isFormValid = () => {
    return formData.workAuthorization && formData.visaStatus;
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
                  Work Authorization & Preferences
                </h1>
                <p className="text-lg text-gray-600">
                  Help me understand your work eligibility and preferences
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Work Authorization */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Are you legally authorized to work in the US? *
                    </Label>
                    <Select value={formData.workAuthorized} onValueChange={(value) => handleSelectChange('workAuthorized', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your work authorization status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Visa Sponsorship */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Will you now or in the future require visa sponsorship? *
                    </Label>
                    <Select value={formData.visaSponsorship} onValueChange={(value) => handleSelectChange('visaSponsorship', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select visa sponsorship requirement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Veteran Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Are you a U.S. Veteran? *
                    </Label>
                    <Select value={formData.veteran} onValueChange={(value) => handleSelectChange('veteran', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select veteran status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Disability Disclosure */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Do you have a disability you'd like to disclose? *
                    </Label>
                    <p className="text-xs text-gray-500">
                      (for accommodations/voluntary disclosure)
                    </p>
                    <Select value={formData.disability} onValueChange={(value) => handleSelectChange('disability', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select disability disclosure preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes, I have a disability</SelectItem>
                        <SelectItem value="no">No, I don't have a disability</SelectItem>
                        <SelectItem value="prefer-not-to-answer">I don't wish to answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Open to Relocation */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Are you open to relocation? *
                    </Label>
                    <Select value={formData.openToRelocation} onValueChange={(value) => handleSelectChange('openToRelocation', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select relocation preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="depends">Depends on the opportunity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Work Arrangement */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Preferred work arrangement *
                    </Label>
                    <Select value={formData.workArrangement} onValueChange={(value) => handleSelectChange('workArrangement', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select preferred work arrangement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="on-site">On-site</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Travel Willingness */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Willing to travel for work? *
                    </Label>
                    <Select value={formData.travelWillingness} onValueChange={(value) => handleSelectChange('travelWillingness', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select travel willingness" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="occasionally">Occasionally</SelectItem>
                        <SelectItem value="frequently">Frequently</SelectItem>
                      </SelectContent>
                    </Select>
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
                      disabled={!isFormValid()}
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
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}

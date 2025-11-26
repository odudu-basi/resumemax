"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useOnboarding } from "@/src/contexts/OnboardingContext";

const applicationVolumes = [
  { value: "5", label: "5 applications per week", description: "Conservative approach - quality focused" },
  { value: "10", label: "10 applications per week", description: "Balanced approach - recommended for most users" },
  { value: "20", label: "20 applications per week", description: "Aggressive approach - maximum exposure" },
  { value: "30", label: "30+ applications per week", description: "Ultra-aggressive - for urgent job searches" }
];

const commonBlacklistCompanies = [
  "Meta", "Google", "Amazon", "Microsoft", "Apple", "Tesla", "Netflix", "Uber", 
  "Airbnb", "Spotify", "Twitter", "LinkedIn", "Salesforce", "Oracle", "IBM"
];

export default function OnboardingStep7() {
  const router = useRouter();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  
  const [formData, setFormData] = useState({
    applicationsPerWeek: '',
    blacklistedCompanies: [] as string[]
  });

  const [newCompany, setNewCompany] = useState('');

  // Load existing data from context on mount
  useEffect(() => {
    if (onboardingData.applicationPrefs) {
      setFormData(onboardingData.applicationPrefs);
    }
  }, [onboardingData.applicationPrefs]);

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addBlacklistedCompany = (company: string) => {
    if (company.trim() && !formData.blacklistedCompanies.includes(company.trim())) {
      setFormData(prev => ({
        ...prev,
        blacklistedCompanies: [...prev.blacklistedCompanies, company.trim()]
      }));
    }
  };

  const removeBlacklistedCompany = (index: number) => {
    setFormData(prev => ({
      ...prev,
      blacklistedCompanies: prev.blacklistedCompanies.filter((_, i) => i !== index)
    }));
  };

  const handleAddCompany = () => {
    if (newCompany.trim()) {
      addBlacklistedCompany(newCompany);
      setNewCompany('');
    }
  };

  const handleContinue = () => {
    // Save to context instead of database
    updateOnboardingData('applicationPrefs', formData);
    console.log('Application preferences saved to context:', formData);
    console.log('Complete onboarding data:', onboardingData);
    // Complete onboarding and redirect to signup, then paywall
    router.push('/auth/signup?returnTo=/paywall');
  };

  const isFormValid = () => {
    return formData.applicationsPerWeek !== '';
  };

  const selectedVolume = applicationVolumes.find(vol => vol.value === formData.applicationsPerWeek);

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
                  Application Preferences
                </h1>
                <p className="text-lg text-gray-600">
                  Let's customize how I'll help you apply to jobs
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Your Application Strategy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Application Volume */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">
                      How many applications per week do you want us to submit? *
                    </Label>
                    <Select value={formData.applicationsPerWeek} onValueChange={(value) => handleSelectChange('applicationsPerWeek', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose your application volume" />
                      </SelectTrigger>
                      <SelectContent>
                        {applicationVolumes.map((volume) => (
                          <SelectItem key={volume.value} value={volume.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{volume.label}</span>
                              <span className="text-xs text-gray-500">{volume.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Volume Description */}
                    {selectedVolume && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-blue-900 mb-1">
                              {selectedVolume.label}
                            </h4>
                            <p className="text-sm text-blue-700">
                              {selectedVolume.description}
                            </p>
                            {selectedVolume.value === "30" && (
                              <p className="text-xs text-blue-600 mt-2 font-medium">
                                ⚡ This is our most aggressive option - great for urgent job searches!
                              </p>
                            )}
                            {selectedVolume.value === "10" && (
                              <p className="text-xs text-blue-600 mt-2 font-medium">
                                ⭐ Recommended for most users - good balance of quantity and quality
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Company Blacklist */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">
                      Companies you DON'T want us to apply to (optional)
                    </Label>
                    <p className="text-xs text-gray-500">
                      Add companies to your blacklist to avoid unwanted applications
                    </p>
                    
                    {/* Add Company Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter company name (e.g., Google, Amazon)"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCompany()}
                        className="flex-1"
                      />
                      <Button onClick={handleAddCompany} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Quick Add Common Companies */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Quick add common companies:</p>
                      <div className="flex flex-wrap gap-2">
                        {commonBlacklistCompanies.slice(0, 8).map((company) => (
                          <Badge
                            key={company}
                            variant="outline"
                            className="cursor-pointer hover:bg-red-50 hover:border-red-200 text-xs"
                            onClick={() => {
                              if (!formData.blacklistedCompanies.includes(company)) {
                                addBlacklistedCompany(company);
                              }
                            }}
                          >
                            + {company}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Current Blacklist */}
                    {formData.blacklistedCompanies.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Blacklisted companies ({formData.blacklistedCompanies.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {formData.blacklistedCompanies.map((company, index) => (
                            <Badge key={index} variant="destructive" className="flex items-center gap-1">
                              {company}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => removeBlacklistedCompany(index)}
                              />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {formData.blacklistedCompanies.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No companies blacklisted - we'll apply to all relevant opportunities
                      </div>
                    )}
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
                      className="flex-1 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                      disabled={!isFormValid()}
                    >
                      Complete Onboarding
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Progress Indicator */}
              <div className="mt-8 flex justify-center">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
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

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useOnboarding } from "@/src/contexts/OnboardingContext";

const commonSkills = [
  "JavaScript", "Python", "Java", "React", "Node.js", "SQL", "HTML/CSS", "Git",
  "AWS", "Docker", "Kubernetes", "MongoDB", "PostgreSQL", "Excel", "PowerPoint",
  "Photoshop", "Figma", "Salesforce", "HubSpot", "Google Analytics", "Tableau",
  "Power BI", "AutoCAD", "SolidWorks", "MATLAB", "R", "Machine Learning", "AI"
];

const commonCertifications = [
  "PMP (Project Management Professional)", "Six Sigma Green Belt", "Six Sigma Black Belt",
  "AWS Certified Solutions Architect", "Google Cloud Professional", "Microsoft Azure Fundamentals",
  "Certified ScrumMaster (CSM)", "CISSP", "CompTIA Security+", "CPA (Certified Public Accountant)",
  "CFA (Chartered Financial Analyst)", "SHRM-CP", "Google Analytics Certified", "HubSpot Certified",
  "Salesforce Administrator", "Cisco CCNA", "Oracle Certified Professional", "Other"
];

const languages = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian",
  "Chinese (Mandarin)", "Japanese", "Korean", "Arabic", "Hindi", "Dutch", "Swedish", "Other"
];

const proficiencyLevels = [
  "Native/Bilingual", "Fluent", "Conversational", "Basic"
];

export default function OnboardingStep6() {
  const router = useRouter();
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const [formData, setFormData] = useState({
    technicalSkills: [] as string[],
    softwareTools: [] as string[],
    certifications: [] as string[],
    languageSkills: [] as { language: string; proficiency: string }[],
    keyStrengths: [] as string[]
  });

  // Load existing data from context on mount
  useEffect(() => {
    if (onboardingData.skills) {
      setFormData(onboardingData.skills);
    }
  }, [onboardingData.skills]);

  const [inputValues, setInputValues] = useState({
    newSkill: '',
    newTool: '',
    newCertification: '',
    newLanguage: '',
    newLanguageProficiency: '',
    newStrength: ''
  });

  const addItem = (field: keyof typeof formData, value: string | { language: string; proficiency: string }) => {
    if (field === 'languageSkills' && typeof value === 'object') {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value]
      }));
    } else if (typeof value === 'string' && value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...(prev[field] as string[]), value.trim()]
      }));
    }
  };

  const removeItem = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleAddSkill = () => {
    if (inputValues.newSkill.trim()) {
      addItem('technicalSkills', inputValues.newSkill);
      setInputValues(prev => ({ ...prev, newSkill: '' }));
    }
  };

  const handleAddTool = () => {
    if (inputValues.newTool.trim()) {
      addItem('softwareTools', inputValues.newTool);
      setInputValues(prev => ({ ...prev, newTool: '' }));
    }
  };

  const handleAddCertification = () => {
    if (inputValues.newCertification.trim()) {
      addItem('certifications', inputValues.newCertification);
      setInputValues(prev => ({ ...prev, newCertification: '' }));
    }
  };

  const handleAddLanguage = () => {
    if (inputValues.newLanguage.trim() && inputValues.newLanguageProficiency) {
      addItem('languageSkills', {
        language: inputValues.newLanguage,
        proficiency: inputValues.newLanguageProficiency
      });
      setInputValues(prev => ({ 
        ...prev, 
        newLanguage: '', 
        newLanguageProficiency: '' 
      }));
    }
  };

  const handleAddStrength = () => {
    if (inputValues.newStrength.trim() && formData.keyStrengths.length < 5) {
      addItem('keyStrengths', inputValues.newStrength);
      setInputValues(prev => ({ ...prev, newStrength: '' }));
    }
  };

  const handleContinue = () => {
    // Save to context
    updateOnboardingData('skills', formData);
    console.log('Skills & Certifications data saved to context:', formData);
    console.log('Complete onboarding data:', onboardingData);
    // Complete onboarding and redirect to signup, then paywall
    router.push('/auth/signup?returnTo=/paywall');
  };

  const isFormValid = () => {
    return formData.keyStrengths.length > 0;
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
        <div className="flex items-center justify-center w-full max-w-6xl px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/30 rounded-full shadow-2xl">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold text-white">ResumeMax</span>
          </Link>
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              Sign In
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
                  Skills & Certifications
                </h1>
                <p className="text-lg text-gray-600">
                  Let me know about your technical skills and expertise
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Your Expertise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Certifications */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Certifications (optional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add certification or select from common ones below"
                        value={inputValues.newCertification}
                        onChange={(e) => setInputValues(prev => ({ ...prev, newCertification: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCertification()}
                        className="flex-1"
                      />
                      <Button onClick={handleAddCertification} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {commonCertifications.slice(0, 6).map((cert) => (
                        <Badge
                          key={cert}
                          variant="outline"
                          className="cursor-pointer hover:bg-green-50 text-xs"
                          onClick={() => {
                            if (!formData.certifications.includes(cert)) {
                              addItem('certifications', cert);
                            }
                          }}
                        >
                          + {cert}
                        </Badge>
                      ))}
                    </div>
                    {formData.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.certifications.map((cert, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {cert}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem('certifications', index);
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Languages */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Languages spoken (optional)
                    </Label>
                    <div className="flex gap-2">
                      <Select 
                        value={inputValues.newLanguage} 
                        onValueChange={(value) => setInputValues(prev => ({ ...prev, newLanguage: value }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select 
                        value={inputValues.newLanguageProficiency} 
                        onValueChange={(value) => setInputValues(prev => ({ ...prev, newLanguageProficiency: value }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Proficiency" />
                        </SelectTrigger>
                        <SelectContent>
                          {proficiencyLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAddLanguage} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.languageSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.languageSkills.map((lang, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {lang.language} ({lang.proficiency})
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem('languageSkills', index);
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Key Strengths */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Key strengths/areas of expertise (3-5 keywords)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a key strength (e.g., Leadership, Problem Solving)"
                        value={inputValues.newStrength}
                        onChange={(e) => setInputValues(prev => ({ ...prev, newStrength: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddStrength()}
                        className="flex-1"
                        disabled={formData.keyStrengths.length >= 5}
                      />
                      <Button 
                        onClick={handleAddStrength} 
                        size="sm"
                        disabled={formData.keyStrengths.length >= 5}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formData.keyStrengths.length}/5 strengths added
                    </p>
                    {formData.keyStrengths.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.keyStrengths.map((strength, index) => (
                          <Badge key={index} variant="default" className="flex items-center gap-1">
                            {strength}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem('keyStrengths', index);
                              }}
                            />
                          </Badge>
                        ))}
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

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const educationLevels = [
  "High School Diploma/GED",
  "Some College",
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctoral Degree (PhD)",
  "Professional Degree (JD, MD, etc.)",
  "Trade/Vocational Certificate",
  "Other"
];

const fieldsOfStudy = [
  "Computer Science", "Engineering", "Business Administration", "Marketing", "Finance",
  "Accounting", "Psychology", "Biology", "Chemistry", "Physics", "Mathematics",
  "English", "Communications", "Art & Design", "Education", "Nursing", "Medicine",
  "Law", "Economics", "Political Science", "History", "Sociology", "Philosophy",
  "Information Technology", "Data Science", "Cybersecurity", "Other"
];

export default function OnboardingStep5() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    employmentStatus: '',
    educationLevel: '',
    fieldOfStudy: ''
  });

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContinue = () => {
    // Here you can save the form data or pass it to the next step
    console.log('Experience & Education data:', formData);
    // Navigate to step 6
    router.push('/onboarding/step-6');
  };

  const isFormValid = () => {
    return formData.employmentStatus && 
           formData.educationLevel && 
           formData.fieldOfStudy;
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
        <div className="flex items-center justify-start w-full max-w-6xl px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/30 rounded-full shadow-2xl">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold text-white">ResumeMax</span>
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
                  Experience & Education
                </h1>
                <p className="text-lg text-gray-600">
                  Tell me about your background and upload your resume
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Your Background</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current Employment Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Current employment status *
                    </Label>
                    <Select value={formData.employmentStatus} onValueChange={(value) => handleSelectChange('employmentStatus', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your current employment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed">Employed</SelectItem>
                        <SelectItem value="unemployed">Unemployed</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Highest Level of Education */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Highest level of education completed *
                    </Label>
                    <Select value={formData.educationLevel} onValueChange={(value) => handleSelectChange('educationLevel', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your highest education level" />
                      </SelectTrigger>
                      <SelectContent>
                        {educationLevels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Field of Study */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Field of study/Major *
                    </Label>
                    <Select value={formData.fieldOfStudy} onValueChange={(value) => handleSelectChange('fieldOfStudy', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your field of study" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldsOfStudy.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Info Message */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-xs text-white font-bold">ℹ</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">
                          AI Profile Generation
                        </h4>
                        <p className="text-sm text-blue-700">
                          After completing onboarding, our AI will analyze all your information and create a comprehensive profile to help with job applications.
                        </p>
                      </div>
                    </div>
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

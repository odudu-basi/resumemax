"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const jobTitles = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Data Scientist", "Product Manager", "UX Designer", "UI Designer", "DevOps Engineer",
  "Marketing Manager", "Sales Representative", "Business Analyst", "Project Manager",
  "Accountant", "Financial Analyst", "HR Manager", "Operations Manager", "Customer Success Manager"
];

const industries = [
  "Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Education",
  "Real Estate", "Media & Entertainment", "Automotive", "Energy", "Consulting",
  "Non-profit", "Government", "Aerospace", "Biotechnology", "Telecommunications"
];

const locations = [
  "New York, NY", "San Francisco, CA", "Los Angeles, CA", "Chicago, IL", "Austin, TX",
  "Seattle, WA", "Boston, MA", "Denver, CO", "Atlanta, GA", "Miami, FL", "Dallas, TX",
  "Washington, DC", "Philadelphia, PA", "Phoenix, AZ", "San Diego, CA", "Portland, OR",
  "Nashville, TN", "Charlotte, NC", "Minneapolis, MN", "Detroit, MI", "Remote Only"
];

export default function OnboardingStep4() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    jobTitles: [] as string[],
    industries: [] as string[],
    locations: [] as string[],
    minSalary: '',
    jobType: '',
    startTime: ''
  });

  const handleMultiSelect = (field: 'jobTitles' | 'industries' | 'locations', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value) 
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const removeItem = (field: 'jobTitles' | 'industries' | 'locations', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(item => item !== value)
    }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContinue = () => {
    // Here you can save the form data or pass it to the next step
    console.log('Job Search Criteria data:', formData);
    // Navigate to step 5
    router.push('/onboarding/step-5');
  };

  const isFormValid = () => {
    return formData.jobTitles.length > 0 && 
           formData.industries.length > 0 && 
           formData.locations.length > 0 && 
           formData.minSalary && 
           formData.jobType && 
           formData.startTime;
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
                  Job Search Criteria
                </h1>
                <p className="text-lg text-gray-600">
                  Let me know what kind of opportunities you're looking for
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Your Job Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Desired Job Titles */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Desired job titles *
                    </Label>
                    <Select onValueChange={(value) => handleMultiSelect('jobTitles', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select job titles you're interested in" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTitles.map((title) => (
                          <SelectItem key={title} value={title} disabled={formData.jobTitles.includes(title)}>
                            {title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.jobTitles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.jobTitles.map((title) => (
                          <Badge key={title} variant="secondary" className="flex items-center gap-1">
                            {title}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeItem('jobTitles', title)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Target Industries */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Target industries *
                    </Label>
                    <Select onValueChange={(value) => handleMultiSelect('industries', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select industries you're interested in" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry} disabled={formData.industries.includes(industry)}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.industries.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.industries.map((industry) => (
                          <Badge key={industry} variant="secondary" className="flex items-center gap-1">
                            {industry}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeItem('industries', industry)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preferred Locations */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Preferred locations *
                    </Label>
                    <Select onValueChange={(value) => handleMultiSelect('locations', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select preferred locations or Remote Only" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location} disabled={formData.locations.includes(location)}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.locations.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.locations.map((location) => (
                          <Badge key={location} variant="secondary" className="flex items-center gap-1">
                            {location}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeItem('locations', location)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Minimum Desired Salary */}
                  <div className="space-y-2">
                    <Label htmlFor="minSalary" className="text-sm font-medium">
                      Minimum desired salary *
                    </Label>
                    <Input
                      id="minSalary"
                      type="number"
                      placeholder="e.g., 75000"
                      value={formData.minSalary}
                      onChange={(e) => handleSelectChange('minSalary', e.target.value)}
                      className="w-full"
                      min="0"
                      step="1000"
                    />
                  </div>

                  {/* Job Type Preference */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Job type preference *
                    </Label>
                    <Select value={formData.jobType} onValueChange={(value) => handleSelectChange('jobType', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select job type preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Start Time */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      How soon are you looking to start? *
                    </Label>
                    <Select value={formData.startTime} onValueChange={(value) => handleSelectChange('startTime', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">Immediately</SelectItem>
                        <SelectItem value="2-weeks">2 weeks</SelectItem>
                        <SelectItem value="1-month">1 month</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
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

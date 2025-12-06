"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useOnboarding, PersonalInfo, Experience, Education, Project, ResumeData } from "@/src/contexts/OnboardingContext";
import {
  Loader2,
  ArrowRight,
  User,
  Briefcase,
  GraduationCap,
  FolderOpen,
  Code,
  FileText,
  Plus,
  Trash2,
  CheckCircle
} from "lucide-react";

export default function OnboardingStep2b() {
  const router = useRouter();
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [activeTab, setActiveTab] = useState("personal");

  const [resumeData, setResumeData] = useState<ResumeData>({
    personalInfo: {
      name: "",
      email: "",
      phone: "",
      state: ""
    },
    experiences: [],
    education: [],
    projects: [],
    summary: "",
    skills: []
  });

  // Load existing resume data from context or parse resume on mount
  useEffect(() => {
    if (onboardingData.resumeData) {
      setResumeData(onboardingData.resumeData);
    } else if (onboardingData.resumeFile) {
      parseResume();
    } else {
      // No resume file, redirect back to step 2a
      router.push('/onboarding/step-2a');
    }
  }, []);

  const parseResume = async () => {
    if (!onboardingData.resumeFile) return;

    setIsParsing(true);
    setParseError("");

    try {
      const formData = new FormData();
      formData.append('file', onboardingData.resumeFile);

      const response = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to parse resume');
      }

      const result = await response.json();

      // Transform the parsed data to match our ResumeData interface
      const transformedData: ResumeData = {
        personalInfo: result.data.personalInfo,
        experiences: result.data.experiences.map((exp: any, index: number) => ({
          ...exp,
          id: `exp-${index}-${Date.now()}`
        })),
        education: result.data.education.map((edu: any, index: number) => ({
          ...edu,
          id: `edu-${index}-${Date.now()}`
        })),
        projects: result.data.projects.map((proj: any, index: number) => ({
          ...proj,
          id: `proj-${index}-${Date.now()}`
        })),
        summary: result.data.summary,
        skills: result.data.skills,
      };

      setResumeData(transformedData);
      updateOnboardingData('resumeData', transformedData);

    } catch (error) {
      console.error('Resume parsing error:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse resume');
    } finally {
      setIsParsing(false);
    }
  };

  // Personal Info handlers
  const updatePersonalInfo = (field: keyof PersonalInfo, value: string) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value
      }
    }));
  };

  // Experience handlers
  const addExperience = () => {
    const newExperience: Experience = {
      id: Date.now().toString(),
      company: "",
      position: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      description: "",
    };
    setResumeData(prev => ({
      ...prev,
      experiences: [...prev.experiences, newExperience]
    }));
  };

  const updateExperience = (id: string, field: keyof Experience, value: string | boolean) => {
    setResumeData(prev => ({
      ...prev,
      experiences: prev.experiences.map(exp =>
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const removeExperience = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      experiences: prev.experiences.filter(exp => exp.id !== id)
    }));
  };

  // Education handlers
  const addEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      school: "",
      degree: "",
      startDate: "",
      endDate: "",
      current: false,
    };
    setResumeData(prev => ({
      ...prev,
      education: [...prev.education, newEducation]
    }));
  };

  const updateEducation = (id: string, field: keyof Education, value: string | boolean) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.map(edu =>
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const removeEducation = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id)
    }));
  };

  // Project handlers
  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: "",
      description: "",
    };
    setResumeData(prev => ({
      ...prev,
      projects: [...prev.projects, newProject]
    }));
  };

  const updateProject = (id: string, field: keyof Project, value: string) => {
    setResumeData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === id ? { ...proj, [field]: value } : proj
      )
    }));
  };

  const removeProject = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      projects: prev.projects.filter(proj => proj.id !== id)
    }));
  };

  // Skills handlers
  const updateSkills = (skillsText: string) => {
    const skillsArray = skillsText.split(',').map(s => s.trim()).filter(s => s);
    setResumeData(prev => ({
      ...prev,
      skills: skillsArray
    }));
  };

  const handleContinue = () => {
    // Save resume data to context
    updateOnboardingData('resumeData', resumeData);
    // Navigate to step 3
    router.push('/onboarding/step-3');
  };

  // Show loading state while parsing
  if (isParsing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 via-30% via-gray-200 via-60% to-black relative overflow-hidden flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Parsing Your Resume
            </h3>
            <p className="text-gray-600">
              Our AI is extracting information from your resume...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if parsing failed
  if (parseError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 via-30% via-gray-200 via-60% to-black relative overflow-hidden flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <div className="text-red-500 mb-4">✕</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Parsing Failed
            </h3>
            <p className="text-gray-600 mb-6">{parseError}</p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/onboarding/step-2a')}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={parseResume}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="mx-auto max-w-4xl">
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
                  Review Your Resume Information
                </h1>
                <p className="text-lg text-gray-600">
                  Please review and edit the information extracted from your resume
                </p>
              </div>

              {/* Form Card */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Resume Data Extracted
                  </CardTitle>
                  <CardDescription>
                    Review and edit the extracted resume data. You can add, modify, or remove sections as needed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-6 mb-6">
                      <TabsTrigger value="personal" className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Personal</span>
                      </TabsTrigger>
                      <TabsTrigger value="summary" className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Summary</span>
                      </TabsTrigger>
                      <TabsTrigger value="experience" className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        <span className="hidden sm:inline">Experience</span>
                      </TabsTrigger>
                      <TabsTrigger value="education" className="flex items-center gap-1">
                        <GraduationCap className="h-4 w-4" />
                        <span className="hidden sm:inline">Education</span>
                      </TabsTrigger>
                      <TabsTrigger value="projects" className="flex items-center gap-1">
                        <FolderOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">Projects</span>
                      </TabsTrigger>
                      <TabsTrigger value="skills" className="flex items-center gap-1">
                        <Code className="h-4 w-4" />
                        <span className="hidden sm:inline">Skills</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Personal Information Tab */}
                    <TabsContent value="personal" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Full Name *
                          </label>
                          <Input
                            placeholder="John Doe"
                            value={resumeData.personalInfo.name}
                            onChange={(e) => updatePersonalInfo('name', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address *
                          </label>
                          <Input
                            type="email"
                            placeholder="john.doe@email.com"
                            value={resumeData.personalInfo.email}
                            onChange={(e) => updatePersonalInfo('email', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number *
                          </label>
                          <Input
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={resumeData.personalInfo.phone}
                            onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            State/Location *
                          </label>
                          <Input
                            placeholder="California, USA"
                            value={resumeData.personalInfo.state}
                            onChange={(e) => updatePersonalInfo('state', e.target.value)}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Summary Tab */}
                    <TabsContent value="summary" className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Professional Summary
                        </label>
                        <Textarea
                          placeholder="I am an experienced professional with expertise in..."
                          rows={6}
                          value={resumeData.summary}
                          onChange={(e) => setResumeData(prev => ({ ...prev, summary: e.target.value }))}
                        />
                      </div>
                    </TabsContent>

                    {/* Experience Tab */}
                    <TabsContent value="experience" className="space-y-4">
                      {resumeData.experiences.map((exp, index) => (
                        <Card key={exp.id} className="p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-medium">Experience {index + 1}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeExperience(exp.id);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                              <Input
                                placeholder="Company Name"
                                value={exp.company}
                                onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                              <Input
                                placeholder="Job Title"
                                value={exp.position}
                                onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                              <Input
                                placeholder="City, State"
                                value={exp.location}
                                onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                              <Input
                                placeholder="MM/YYYY"
                                value={exp.startDate}
                                onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                              <Input
                                placeholder="MM/YYYY or Present"
                                value={exp.endDate}
                                onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                                disabled={exp.current}
                              />
                            </div>
                            <div className="flex items-center pt-8">
                              <input
                                type="checkbox"
                                id={`current-${exp.id}`}
                                checked={exp.current}
                                onChange={(e) => updateExperience(exp.id, 'current', e.target.checked)}
                                className="mr-2"
                              />
                              <label htmlFor={`current-${exp.id}`} className="text-sm text-gray-700">
                                I currently work here
                              </label>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                              <Textarea
                                placeholder="Describe your responsibilities and achievements..."
                                rows={4}
                                value={exp.description}
                                onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                      <Button
                        variant="outline"
                        onClick={addExperience}
                        className="w-full flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Experience
                      </Button>
                    </TabsContent>

                    {/* Education Tab */}
                    <TabsContent value="education" className="space-y-4">
                      {resumeData.education.map((edu, index) => (
                        <Card key={edu.id} className="p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-medium">Education {index + 1}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEducation(edu.id);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">School</label>
                              <Input
                                placeholder="University Name"
                                value={edu.school}
                                onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Degree</label>
                              <Input
                                placeholder="Bachelor's in Computer Science"
                                value={edu.degree}
                                onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                              <Input
                                placeholder="MM/YYYY"
                                value={edu.startDate}
                                onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                              <Input
                                placeholder="MM/YYYY or Present"
                                value={edu.endDate}
                                onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                                disabled={edu.current}
                              />
                            </div>
                            <div className="flex items-center pt-8">
                              <input
                                type="checkbox"
                                id={`current-edu-${edu.id}`}
                                checked={edu.current}
                                onChange={(e) => updateEducation(edu.id, 'current', e.target.checked)}
                                className="mr-2"
                              />
                              <label htmlFor={`current-edu-${edu.id}`} className="text-sm text-gray-700">
                                I currently study here
                              </label>
                            </div>
                          </div>
                        </Card>
                      ))}
                      <Button
                        variant="outline"
                        onClick={addEducation}
                        className="w-full flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Education
                      </Button>
                    </TabsContent>

                    {/* Projects Tab */}
                    <TabsContent value="projects" className="space-y-4">
                      {resumeData.projects.map((proj, index) => (
                        <Card key={proj.id} className="p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-medium">Project {index + 1}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeProject(proj.id);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                              <Input
                                placeholder="Project Title"
                                value={proj.name}
                                onChange={(e) => updateProject(proj.id, 'name', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                              <Textarea
                                placeholder="Describe the project..."
                                rows={3}
                                value={proj.description}
                                onChange={(e) => updateProject(proj.id, 'description', e.target.value)}
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                      <Button
                        variant="outline"
                        onClick={addProject}
                        className="w-full flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Project
                      </Button>
                    </TabsContent>

                    {/* Skills Tab */}
                    <TabsContent value="skills" className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Skills (comma-separated)
                        </label>
                        <Textarea
                          placeholder="JavaScript, React, Node.js, Python, etc."
                          rows={6}
                          value={resumeData.skills.join(', ')}
                          onChange={(e) => updateSkills(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Enter your skills separated by commas
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6 mt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/onboarding/step-2a')}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleContinue}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 flex items-center gap-2 justify-center"
                      disabled={!resumeData.personalInfo.name || !resumeData.personalInfo.email}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
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
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  Target, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Lightbulb,
  Star
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";

export default function RateResumePage() {
  const { session, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromOnboarding = searchParams.get('from') === 'onboarding';
  
  // Track page view
  React.useEffect(() => {
    MixpanelService.trackPageView({
      page_name: 'rate_resume',
      user_id: user?.id,
      from_onboarding: isFromOnboarding,
    });
  }, [user?.id, isFromOnboarding]);

  // Handle back to onboarding
  const handleBackToOnboarding = () => {
    MixpanelService.track('rate_resume_back_to_onboarding', {
      user_id: user?.id,
      current_step: step,
    });
    router.push('/onboarding');
  };

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  
  // Resume parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState("");

  // Save states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Track resume upload
      MixpanelService.trackResumeUploaded({
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        user_id: user?.id,
      });
    }
  };

  // Analyze resume function
  const analyzeResume = async () => {
    if (!file) return;
    
    const analysisStartTime = Date.now();
    setIsAnalyzing(true);
    setAnalysisError("");
    
    // Track analysis step completion
    MixpanelService.trackAnalysisStepCompleted({
      step_name: 'analysis_started',
      step_number: 1,
      user_id: user?.id,
    });
    
    try {
      // First extract text from the resume file
      const formData = new FormData();
      formData.append('file', file);
      
      const extractResponse = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });
      
      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.error || 'Failed to extract text from resume');
      }
      
      const extractResult = await extractResponse.json();
      
      // Use the extracted text for analysis
      const resumeText = extractResult.text;
      
      // Now analyze the resume
      const analysisResponse = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobRole: jobTitle,
          jobDescription: jobDescription,
          resumeText: resumeText,
        }),
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.error || 'Failed to analyze resume');
      }
      
      const result = await analysisResponse.json();
      console.log('=== ANALYSIS RESPONSE ===');
      console.log('Full result:', result);
      console.log('Analysis data:', result.analysis);
      console.log('========================');
      
      const analysisEndTime = Date.now();
      const analysisDuration = analysisEndTime - analysisStartTime;
      
      // Track successful analysis
      MixpanelService.trackResumeAnalyzed({
        analysis_score: result.analysis?.scores?.overall || 0,
        job_title: jobTitle,
        analysis_duration_ms: analysisDuration,
        user_id: user?.id,
      });
      
      // Track analysis step completion
      MixpanelService.trackAnalysisStepCompleted({
        step_name: 'analysis_completed',
        step_number: 2,
        user_id: user?.id,
      });
      
      setAnalysisResults(result.analysis);
      setStep(3); // Move to analysis results step
      
    } catch (error) {
      console.error('Resume analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze resume');
      
      // Track analysis error
      MixpanelService.trackError({
        error_type: 'analysis_failed',
        error_message: error instanceof Error ? error.message : 'Failed to analyze resume',
        page_name: 'rate_resume',
        user_id: user?.id,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save analysis function
  const saveAnalysis = async () => {
    if (!analysisResults || !file) return;
    
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    
    try {
      // First, we need to get the resume text again for saving
      const formData = new FormData();
      formData.append('file', file);
      
      const extractResponse = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });
      
      if (!extractResponse.ok) {
        throw new Error('Failed to extract resume text');
      }
      
      const extractResult = await extractResponse.json();
      
      // Save the analysis to the database
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if user is authenticated
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const saveResponse = await fetch('/api/save-analysis', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jobTitle: jobTitle,
          jobDescription: jobDescription || null,
          resumeText: extractResult.text,
          analysisResults: analysisResults,
          fileName: file.name,
        }),
      });
      
      const saveResult = await saveResponse.json();
      
      if (!saveResponse.ok) {
        throw new Error(saveResult.error || 'Failed to save analysis');
      }
      
      // Handle different response types
      if (saveResult.requiresAuth) {
        setSaveError("Please sign up or log in to save your analysis results.");
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000); // Hide success message after 3 seconds
        
        // Track successful analysis save
        MixpanelService.trackAnalysisSaved({
          analysis_score: analysisResults?.scores?.overall || 0,
          job_title: jobTitle,
          user_id: user?.id,
        });
      }
      
    } catch (error) {
      console.error('Save analysis error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save analysis');
      
      // Track save error
      MixpanelService.trackError({
        error_type: 'save_analysis_failed',
        error_message: error instanceof Error ? error.message : 'Failed to save analysis',
        page_name: 'rate_resume',
        user_id: user?.id,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { number: 1, title: "Upload Resume", description: "Upload your current resume" },
    { number: 2, title: "Job Details", description: "Provide target job information" },
    { number: 3, title: "Analysis Results", description: "Get your resume rating and feedback" }
  ];

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Back to Onboarding Button - Only show if coming from onboarding */}
        {isFromOnboarding && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Button
              variant="ghost"
              onClick={handleBackToOnboarding}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Onboarding
            </Button>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            <BarChart3 className="mr-1 h-3 w-3" />
            Resume Rating
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Rate Your Resume
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get instant AI-powered analysis and scoring for your resume. Discover how well it matches your target job and what you can improve.
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex justify-between items-center mb-8">
            {steps.map((stepItem, index) => (
              <div key={stepItem.number} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step >= stepItem.number 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {step > stepItem.number ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    stepItem.number
                  )}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${
                    step >= stepItem.number ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {stepItem.title}
                  </p>
                  <p className="text-xs text-gray-500">{stepItem.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-4 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
          <Progress value={(step / steps.length) * 100} className="h-2" />
        </motion.div>

        {/* Step 1: Upload Resume */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Your Resume
                </CardTitle>
                <CardDescription>
                  Upload your current resume in PDF or Word format for analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label htmlFor="resume-upload" className="cursor-pointer">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      {file ? file.name : "Choose a file or drag it here"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports PDF, DOC, and DOCX files up to 10MB
                    </p>
                  </label>
                </div>
                
                {file && (
                  <div className="mt-6 flex justify-end">
                    <Button 
                      onClick={() => {
                        setStep(2);
                        MixpanelService.trackAnalysisStepCompleted({
                          step_name: 'file_uploaded',
                          step_number: 1,
                          user_id: user?.id,
                        });
                      }} 
                      className="flex items-center gap-2"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Job Details */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Target Job Information
                </CardTitle>
                <CardDescription>
                  Provide details about the job you're targeting for personalized analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <Input
                    placeholder="e.g., Senior Software Engineer, Marketing Manager"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description (Optional)
                  </label>
                  <Textarea
                    placeholder="Paste the job description here for more accurate analysis..."
                    rows={8}
                    value={jobDescription}
                    onChange={(e) => {
                      setJobDescription(e.target.value);
                      if (e.target.value.length > 50) { // Track when substantial job description is added
                        MixpanelService.trackJobDescriptionAdded({
                          job_title: jobTitle,
                          description_length: e.target.value.length,
                          user_id: user?.id,
                        });
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Including the job description helps us provide more accurate scoring and feedback.
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button 
                    onClick={analyzeResume}
                    disabled={!jobTitle.trim() || isAnalyzing}
                    className="flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing Resume...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Analyze Resume
                      </>
                    )}
                  </Button>
                </div>

                {analysisError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{analysisError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Analysis Results */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {isAnalyzing ? (
              <Card className="mb-8">
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Analyzing Your Resume
                  </h3>
                  <p className="text-gray-600">
                    Our AI is evaluating your resume against the "{jobTitle}" role...
                  </p>
                </CardContent>
              </Card>
            ) : analysisResults ? (
              <div className="space-y-6">
                {/* Analysis Header */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                      <CheckCircle className="h-5 w-5" />
                      Resume Analysis Complete
                    </CardTitle>
                    <CardDescription>
                      Analysis for: <strong>{jobTitle}</strong>
                    </CardDescription>
                  </CardHeader>
                </Card>

                {/* Scoring Dashboard */}
                <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                  <CardContent className="p-8">
                    {/* Profile Section */}
                    <div className="flex items-center justify-center mb-8">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-2xl font-bold">
                        {analysisResults.scores.overall}
                      </div>
                    </div>

                    {/* Scores Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Overall Score */}
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Overall</h3>
                        <div className="text-4xl font-bold mb-2">{analysisResults.scores.overall}</div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              analysisResults.scores.overall >= 90 ? 'bg-green-500' :
                              analysisResults.scores.overall >= 75 ? 'bg-yellow-500' :
                              analysisResults.scores.overall >= 60 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${analysisResults.scores.overall}%` }}
                          />
                        </div>
                      </div>

                      {/* Potential Score */}
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Potential</h3>
                        <div className="text-4xl font-bold mb-2">{analysisResults.scores.potential}</div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${analysisResults.scores.potential}%` }}
                          />
                        </div>
                      </div>

                      {/* ATS Score */}
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">ATS Readiness</h3>
                        <div className="text-4xl font-bold mb-2">{analysisResults.scores.ats}</div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              analysisResults.scores.ats >= 90 ? 'bg-green-500' :
                              analysisResults.scores.ats >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${analysisResults.scores.ats}%` }}
                          />
                        </div>
                      </div>

                      {/* Alignment Score */}
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Job Alignment</h3>
                        <div className="text-4xl font-bold mb-2">{analysisResults.scores.alignment}</div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              analysisResults.scores.alignment >= 90 ? 'bg-green-500' :
                              analysisResults.scores.alignment >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${analysisResults.scores.alignment}%` }}
                          />
                        </div>
                      </div>

                      {/* Impact Score */}
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Impact</h3>
                        <div className="text-4xl font-bold mb-2">{analysisResults.scores.impact}</div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              analysisResults.scores.impact >= 90 ? 'bg-green-500' :
                              analysisResults.scores.impact >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${analysisResults.scores.impact}%` }}
                          />
                        </div>
                      </div>

                      {/* Polish Score */}
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Polish</h3>
                        <div className="text-4xl font-bold mb-2">{analysisResults.scores.polish}</div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              analysisResults.scores.polish >= 90 ? 'bg-green-500' :
                              analysisResults.scores.polish >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${analysisResults.scores.polish}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Percentile and Label */}
                    <div className="mt-8 text-center">
                      <div className="text-sm text-gray-300 mb-1">
                        {analysisResults.estimatedPercentile}th Percentile
                      </div>
                      <div className={`text-lg font-semibold ${
                        analysisResults.label === 'Excellent' ? 'text-green-400' :
                        analysisResults.label === 'Strong' ? 'text-blue-400' :
                        analysisResults.label === 'Above Average' ? 'text-yellow-400' :
                        analysisResults.label === 'Average' ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {analysisResults.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysisResults.strengths.map((strength: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Areas for Improvement */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-orange-600 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Areas for Improvement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysisResults.improvements.map((improvement: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Actionable Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysisResults.recommendations.map((recommendation: string, index: number) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm text-gray-700">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Save/Error Messages */}
                {saveError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{saveError}</p>
                  </div>
                )}
                
                {saveSuccess && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-600">✅ Analysis saved successfully!</p>
                  </div>
                )}
                
                {!session && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-600">
                      💡 <strong>Sign up to save your results!</strong> Create an account to save your analysis and access it later.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => { setStep(1); setAnalysisResults(null); }}>
                    Analyze Another Resume
                  </Button>
                  <Button 
                    onClick={saveAnalysis}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        {session ? 'Save Analysis' : 'Try to Save (Sign up required)'}
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/tailor-resume'}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Improve Your Resume
                  </Button>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </div>
    </div>
  );
}

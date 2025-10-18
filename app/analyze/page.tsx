"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Briefcase, FileSearch } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type UploadStatus = "idle" | "uploading" | "processing" | "completed" | "error";

interface FormData {
  file: File | null;
  targetJobRole: string;
  jobDescription: string;
}

export default function AnalyzePage() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    file: null,
    targetJobRole: "",
    jobDescription: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setErrors({ ...errors, file: 'Please upload a PDF, DOC, or DOCX file.' });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrors({ ...errors, file: 'File size must be less than 10MB.' });
      return;
    }

    setFormData({ ...formData, file });
    setErrors({ ...errors, file: '' });
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.file) {
      newErrors.file = 'Please upload your resume.';
    }

    if (!formData.targetJobRole.trim()) {
      newErrors.targetJobRole = 'Please enter your target job role.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnalyze = async () => {
    if (!validateForm()) return;

    setUploadStatus("uploading");
    setProgress(0);

    try {
      // Create FormData for API request
      const apiFormData = new FormData();
      apiFormData.append('resume', formData.file!);
      apiFormData.append('targetJobRole', formData.targetJobRole);
      apiFormData.append('jobDescription', formData.jobDescription);

      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 50) {
            clearInterval(uploadInterval);
            setUploadStatus("processing");
            return 50;
          }
          return prev + 10;
        });
      }, 200);

      // Make API request
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: apiFormData,
      });

      clearInterval(uploadInterval);

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Simulate processing progress
      const processingInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(processingInterval);
            setUploadStatus("completed");
            
            // Redirect to results page with analysis ID
            setTimeout(() => {
              router.push(`/results?id=${result.analysisId}`);
            }, 1500);
            
            return 100;
          }
          return prev + 10;
        });
      }, 300);

    } catch (error) {
      setUploadStatus("error");
      setErrors({ submit: error instanceof Error ? error.message : 'Analysis failed. Please try again.' });
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case "uploading":
        return <Loader2 className="h-6 w-6 animate-spin text-blue-600" />;
      case "processing":
        return <Loader2 className="h-6 w-6 animate-spin text-blue-600" />;
      case "completed":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "error":
        return <AlertCircle className="h-6 w-6 text-red-600" />;
      default:
        return <Upload className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case "uploading":
        return "Uploading your resume...";
      case "processing":
        return "Analyzing your resume with AI...";
      case "completed":
        return "Analysis complete! Redirecting to results...";
      case "error":
        return errors.submit || "Something went wrong. Please try again.";
      default:
        return formData.file ? `Selected: ${formData.file.name}` : "Upload your resume to get started";
    }
  };

  const isFormDisabled = uploadStatus === "uploading" || uploadStatus === "processing";

  return (
    <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Analyze Your Resume
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Upload your resume and get instant AI-powered feedback to improve your chances of landing interviews.
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* File Upload Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resume Upload
                </CardTitle>
                <CardDescription>
                  Supported formats: PDF, DOC, DOCX (Max size: 10MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="resume-upload"
                      className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        formData.file
                          ? "border-green-300 bg-green-50"
                          : errors.file
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                      } ${isFormDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <motion.div
                          animate={{ scale: uploadStatus !== "idle" ? 1.1 : 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {getStatusIcon()}
                        </motion.div>
                        <p className="mb-2 text-sm text-gray-500 mt-4">
                          <span className="font-semibold">{getStatusText()}</span>
                        </p>
                        {!formData.file && uploadStatus === "idle" && (
                          <p className="text-xs text-gray-500">
                            Click to upload or drag and drop
                          </p>
                        )}
                      </div>
                      <Input
                        id="resume-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                        disabled={isFormDisabled}
                      />
                    </label>
                  </div>
                  {errors.file && (
                    <p className="text-sm text-red-600">{errors.file}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Job Information Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Job Information
                </CardTitle>
                <CardDescription>
                  Help us tailor the analysis to your target role
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="target-job-role" className="block text-sm font-medium text-gray-700 mb-2">
                    Target Job Role *
                  </label>
                  <Input
                    id="target-job-role"
                    type="text"
                    placeholder="e.g., Senior Software Engineer, Marketing Manager, Data Scientist"
                    value={formData.targetJobRole}
                    onChange={(e) => handleInputChange('targetJobRole', e.target.value)}
                    disabled={isFormDisabled}
                    className={errors.targetJobRole ? "border-red-300" : ""}
                  />
                  {errors.targetJobRole && (
                    <p className="text-sm text-red-600 mt-1">{errors.targetJobRole}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description (Optional)
                  </label>
                  <Textarea
                    id="job-description"
                    placeholder="Paste the job description here to get more targeted feedback and keyword suggestions..."
                    value={formData.jobDescription}
                    onChange={(e) => handleInputChange('jobDescription', e.target.value)}
                    disabled={isFormDisabled}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Including the job description will help us provide more specific recommendations
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Analysis Progress */}
          <AnimatePresence>
            {(uploadStatus === "uploading" || uploadStatus === "processing") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Analysis Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="w-full" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analyze Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex justify-center"
          >
            <Button
              onClick={handleAnalyze}
              disabled={isFormDisabled}
              size="lg"
              className="px-12 py-3 text-lg"
            >
              {uploadStatus === "uploading" || uploadStatus === "processing" ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {uploadStatus === "uploading" ? "Uploading..." : "Analyzing..."}
                </>
              ) : (
                <>
                  <FileSearch className="mr-2 h-5 w-5" />
                  Analyze Resume
                </>
              )}
            </Button>
          </motion.div>

          {errors.submit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-red-600">{errors.submit}</p>
            </motion.div>
          )}
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid gap-6 md:grid-cols-3"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comprehensive Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get detailed feedback on content, formatting, keywords, and overall structure.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ATS Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Ensure your resume passes through Applicant Tracking Systems successfully.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actionable Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive specific recommendations to improve your resume's impact and effectiveness.
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
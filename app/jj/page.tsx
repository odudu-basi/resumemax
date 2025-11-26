"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Search,
  FileText,
  Briefcase,
  MapPin,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    dates: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    dates: string;
  }[];
  certifications: string[];
}

interface JobListing {
  title: string;
  company: string;
  url: string;
  description: string;
  location?: string;
  salary?: string;
  matchScore?: number;
  matchReasons?: string[];
  source: string;
  postedDate?: string;
}

export default function JobSearchAutomation() {
  const { user } = useAuth();
  const router = useRouter();

  // Resume upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Job search state
  const [jobKeywords, setJobKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("mid");
  const [isSearching, setIsSearching] = useState(false);
  const [jobResults, setJobResults] = useState<JobListing[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter and sort state
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("matchScore");
  const [availableSources, setAvailableSources] = useState<string[]>([]);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type)) {
      setParseError("Please upload a PDF or DOCX file");
      return;
    }

    setUploadedFile(file);
    setParseError(null);
    setIsParsingResume(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/jj/parse-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }

      const data = await response.json();
      setParsedResume(data.data);
    } catch (error) {
      console.error('Error parsing resume:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse resume');
      setParsedResume(null);
    } finally {
      setIsParsingResume(false);
    }
  }, []);

  // Handle job search with enhanced matching
  const handleJobSearch = async () => {
    if (!jobKeywords.trim()) {
      setSearchError("Please enter job keywords");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setJobResults([]);

    try {
      const response = await fetch('/api/jj/search-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: jobKeywords,
          location: location,
          seniorityLevel: seniorityLevel,
          skills: parsedResume?.skills || [],
          // Send full resume data for enhanced matching
          resumeData: parsedResume || undefined,
          filters: {
            minMatchScore: filterMinScore,
            sources: filterSource !== 'all' ? [filterSource] : undefined,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search jobs');
      }

      const data = await response.json();
      setJobResults(data.jobs);
      setAvailableSources(data.sources || []);

      console.log(`Found ${data.totalFound} REAL jobs from actual company pages`);
    } catch (error) {
      console.error('Error searching jobs:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search for jobs');
    } finally {
      setIsSearching(false);
    }
  };

  // Get filtered and sorted jobs
  const getFilteredAndSortedJobs = () => {
    let filtered = [...jobResults];

    // Apply source filter
    if (filterSource !== 'all') {
      filtered = filtered.filter(job => job.source === filterSource);
    }

    // Apply minimum match score filter
    if (filterMinScore > 0) {
      filtered = filtered.filter(job => (job.matchScore || 0) >= filterMinScore);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'matchScore':
          return (b.matchScore || 0) - (a.matchScore || 0);
        case 'company':
          return a.company.localeCompare(b.company);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'date':
          // Most recent first
          if (!a.postedDate) return 1;
          if (!b.postedDate) return -1;
          return b.postedDate.localeCompare(a.postedDate);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const displayedJobs = getFilteredAndSortedJobs();

  // Drag and drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      // Create a synthetic event to reuse handleFileUpload
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(syntheticEvent);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4">
              <Briefcase className="mr-1 h-3 w-3" />
              Job Search Automation
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-4">
              Find Your Perfect Job
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload your resume and let AI find the best job opportunities for you
            </p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Resume Upload Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Your Resume
                </CardTitle>
                <CardDescription>
                  Upload your resume in PDF or DOCX format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center justify-center gap-4">
                    {isParsingResume ? (
                      <>
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                        <p className="text-sm text-gray-600">Parsing your resume...</p>
                      </>
                    ) : parsedResume ? (
                      <>
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-sm font-medium text-gray-900">Resume Uploaded Successfully</p>
                        <p className="text-xs text-gray-600">{uploadedFile?.name}</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-12 w-12 text-gray-400" />
                        <div>
                          <label htmlFor="resume-upload" className="cursor-pointer">
                            <span className="text-blue-600 hover:text-blue-700 font-medium">
                              Click to upload
                            </span>
                            <span className="text-gray-600"> or drag and drop</span>
                          </label>
                          <input
                            id="resume-upload"
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileUpload}
                          />
                        </div>
                        <p className="text-xs text-gray-500">PDF or DOCX (Max 10MB)</p>
                      </>
                    )}
                  </div>
                </div>

                {parseError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{parseError}</p>
                  </div>
                )}

                {parsedResume && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-900 mb-2">Extracted Information</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Name:</span> {parsedResume.name}</p>
                        <p><span className="font-medium">Email:</span> {parsedResume.email}</p>
                        <p><span className="font-medium">Skills:</span> {parsedResume.skills.join(', ')}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setParsedResume(null);
                        setUploadedFile(null);
                      }}
                    >
                      Upload Different Resume
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Job Search Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Job Search Criteria
                </CardTitle>
                <CardDescription>
                  Define what you're looking for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keywords">Job Keywords / Title</Label>
                  <Input
                    id="keywords"
                    placeholder="e.g., Software Engineer, Product Manager"
                    value={jobKeywords}
                    onChange={(e) => setJobKeywords(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="e.g., San Francisco, Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seniority">Seniority Level</Label>
                  <Select value={seniorityLevel} onValueChange={setSeniorityLevel}>
                    <SelectTrigger id="seniority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level</SelectItem>
                      <SelectItem value="mid">Mid Level</SelectItem>
                      <SelectItem value="senior">Senior Level</SelectItem>
                      <SelectItem value="lead">Lead / Principal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleJobSearch}
                  disabled={isSearching || !jobKeywords.trim()}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search Jobs
                    </>
                  )}
                </Button>

                {searchError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{searchError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filter and Sort Controls */}
        {jobResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filter & Sort Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Source Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="source-filter">Filter by Source</Label>
                    <Select value={filterSource} onValueChange={setFilterSource}>
                      <SelectTrigger id="source-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        {availableSources.map(source => (
                          <SelectItem key={source} value={source}>{source}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Match Score Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="score-filter">Min Match Score: {filterMinScore}%</Label>
                    <input
                      id="score-filter"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={filterMinScore}
                      onChange={(e) => setFilterMinScore(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Sort By */}
                  <div className="space-y-2">
                    <Label htmlFor="sort-by">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger id="sort-by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matchScore">Match Score</SelectItem>
                        <SelectItem value="date">Posted Date</SelectItem>
                        <SelectItem value="company">Company Name</SelectItem>
                        <SelectItem value="title">Job Title</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Job Results Section */}
        {displayedJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Showing {displayedJobs.length} of {jobResults.length} Job Opportunities
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayedJobs.map((job, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{job.title}</CardTitle>
                        <CardDescription className="flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-4 w-4" />
                            {job.company}
                          </span>
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {job.location}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {job.matchScore && (
                          <Badge variant="secondary" className="ml-2">
                            {job.matchScore}% Match
                          </Badge>
                        )}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {job.source}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {job.salary && (
                      <p className="text-sm font-medium text-green-600 mb-2">
                        {job.salary}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {job.description}
                    </p>
                    {job.matchReasons && job.matchReasons.length > 0 && (
                      <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Why this matches:</p>
                        <ul className="text-xs text-blue-700 space-y-1">
                          {job.matchReasons.slice(0, 2).map((reason, i) => (
                            <li key={i}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {job.postedDate && (
                      <p className="text-xs text-gray-500 mb-3">Posted: {job.postedDate}</p>
                    )}
                    <Button
                      className="w-full"
                      variant="outline"
                      asChild
                    >
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2"
                      >
                        Open Application
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* No results after filtering */}
        {jobResults.length > 0 && displayedJobs.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs match your filters</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your filters to see more results
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setFilterSource('all');
                setFilterMinScore(0);
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && jobResults.length === 0 && jobKeywords && (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results yet</h3>
            <p className="text-gray-600">
              Enter your job criteria and click search to find opportunities
            </p>
          </div>
        )}

        {/* Back to Home */}
        <div className="text-center mt-12">
          <Link href="/">
            <Button variant="ghost">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

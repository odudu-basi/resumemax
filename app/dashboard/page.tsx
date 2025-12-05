"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  User, 
  Search, 
  FileText, 
  Send, 
  Menu, 
  X,
  LogOut,
  Home,
  ChevronDown,
  ChevronUp,
  Filter,
  MapPin,
  DollarSign,
  Building2,
  Briefcase,
  Globe,
  Loader2,
  CheckCircle2,
  Zap,
  AlertCircle,
  Crown,
  Star,
  Check,
  ArrowRight,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { EnhancedJobListing } from "@/src/types/user-profile";
import { JobCard } from "@/components/JobCard";
import { createSupabaseClient } from "@/src/lib/supabase";
import { useAutoApplySessions } from "@/src/hooks/useAutoApplySessions";
import { useSubmittedApplications } from "@/src/hooks/useSubmittedApplications";
import { GmailConnectionBanner } from "@/src/components/GmailConnectionBanner";
import { ApplicationDetailModal } from "@/src/components/ApplicationDetailModal";

const sidebarItems = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    description: 'Quick apply to jobs'
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    description: 'Manage your profile and preferences'
  },
  {
    id: 'resume',
    label: 'Resume',
    icon: FileText,
    description: 'Upload and manage your resume'
  },
  // {
  //   id: 'browse-jobs',
  //   label: 'Browse Jobs',
  //   icon: Search,
  //   description: 'Search and discover Greenhouse job opportunities'
  // },
  // {
  //   id: 'review-applications',
  //   label: 'Review Applications',
  //   icon: FileText,
  //   description: 'Review applications before submission'
  // },
  {
    id: 'submitted-applications',
    label: 'Submitted Applications',
    icon: Send,
    description: 'Track your submitted applications'
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: DollarSign,
    description: 'View and manage your subscription'
  }
];


// Browse Jobs Section Component
// Home Section Component
// Home Job Card Component - No Apply button, only shows Applying status and Watch Live
function HomeJobCard({
  job,
  userId,
  cloudApplyLoading = false,
  cloudNotification = null,
}: {
  job: any;
  userId: string | null;
  cloudApplyLoading?: boolean;
  cloudNotification?: any;
}) {
  return (
    <Card className="hover:shadow-lg transition-all relative">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
              {job.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 text-sm">
              <Building2 className="h-3 w-3" />
              {job.company}
            </CardDescription>
          </div>
          {job.datePosted && (
            <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.datePosted}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Location and Salary */}
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{job.location}</span>
          </div>
          {job.salary?.display && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>{job.salary.display}</span>
            </div>
          )}
          {job.jobType && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span>{job.jobType}</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        {job.status === 'scraping' && (
          <Badge variant="outline" className="w-full justify-center py-2">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Extracting job details...
          </Badge>
        )}

        {job.status === 'error' && (
          <Badge variant="destructive" className="w-full justify-center py-2">
            <AlertCircle className="h-4 w-4 mr-2" />
            {job.error || 'Application failed'}
          </Badge>
        )}

        {/* Cloud Notification - Shows Watch Live button */}
        {cloudNotification && (
          <div className={`p-3 rounded-md ${
            cloudNotification.type === 'success'
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm ${
              cloudNotification.type === 'success' ? 'text-blue-800' : 'text-red-800'
            }`}>
              {cloudNotification.description || cloudNotification.message}
            </p>
            {cloudNotification.liveUrl && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => window.open(cloudNotification.liveUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Watch Live
              </Button>
            )}
          </div>
        )}

        {/* Applying Button (disabled, just shows status) */}
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            disabled={true}
          >
            {cloudApplyLoading || job.status === 'applying' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : job.status === 'scraping' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Applying...
              </>
            )}
          </Button>
        </div>

        {/* View Job Link */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(job.applicationUrl, '_blank')}
        >
          <Globe className="h-4 w-4 mr-2" />
          View Original Job
        </Button>
      </CardContent>
    </Card>
  );
}
// Home Section Component
function HomeSection() {
  const { user } = useAuth();
  const [jobLink, setJobLink] = useState("");
  const [homeJobs, setHomeJobs] = useState<any[]>([]);
  const [cloudApplyJobLoading, setCloudApplyJobLoading] = useState<Record<string, boolean>>({});
  const [cloudNotifications, setCloudNotifications] = useState<Record<string, any>>({});

  // Gmail account setup states
  const [showGmailSetup, setShowGmailSetup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workEmail, setWorkEmail] = useState<string | null>(null);
  const [isCreatingEmail, setIsCreatingEmail] = useState(false);
  const [gmailPassword, setGmailPassword] = useState<string | null>(null);

  // Load work email on mount
  useEffect(() => {
    const loadWorkEmail = async () => {
      if (!user?.id) return;

      const supabase = await createSupabaseClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('work_email, first_name, last_name')
        .eq('user_id', user.id)
        .single();

      if (data?.work_email) {
        setWorkEmail(data.work_email);
      }
      if (data?.first_name) setFirstName(data.first_name);
      if (data?.last_name) setLastName(data.last_name);
    };

    loadWorkEmail();
  }, [user?.id]);

  const handleCreateGmailAccount = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter your first and last name');
      return;
    }

    setIsCreatingEmail(true);
    try {
      const response = await fetch('/api/create-gmail-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setWorkEmail(result.email);
        setShowGmailSetup(false);

        if (result.alreadyExists) {
          toast.success(`Your work email is: ${result.email}`);
        } else {
          setGmailPassword(result.password);
          toast.success(`Gmail account created! Email: ${result.email}`);
        }
      } else {
        toast.error(result.error || 'Failed to create Gmail account');
      }
    } catch (error: any) {
      console.error('Error creating Gmail account:', error);
      toast.error('Failed to create Gmail account');
    } finally {
      setIsCreatingEmail(false);
    }
  };

  const handleApply = async () => {
    if (!jobLink.trim()) {
      toast.error('Please enter a job link');
      return;
    }

    const jobId = `home_${Date.now()}`;
    const currentJobUrl = jobLink.trim();

    // Clear input immediately
    setJobLink("");

    // Create initial job card with loading state
    const newJob = {
      id: jobId,
      title: "Scraping job details...",
      company: "Loading...",
      location: "Loading...",
      applicationUrl: currentJobUrl,
      status: 'scraping',
      datePosted: null,
    };

    setHomeJobs(prev => [newJob, ...prev]);

    try {
      // Step 1: Scrape job details
      console.log('🔍 Scraping job details from:', currentJobUrl);
      const scrapeResponse = await fetch(`${process.env.NEXT_PUBLIC_STAGEHAND_API_URL}/scrape-job-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobUrl: currentJobUrl }),
      });

      if (!scrapeResponse.ok) {
        throw new Error('Failed to scrape job details');
      }

      const scrapedData = await scrapeResponse.json();
      console.log('✅ Job details scraped:', scrapedData);

      // Update job card with scraped details
      setHomeJobs(prev => prev.map(job =>
        job.id === jobId ? {
          ...job,
          title: scrapedData.jobTitle || 'Job Title Not Found',
          company: scrapedData.companyName || 'Company Not Found',
          location: scrapedData.location || 'Location Not Found',
          salary: scrapedData.salaryRange ? { min: 0, max: 0, display: scrapedData.salaryRange } : undefined,
          datePosted: scrapedData.datePosted || null,
          description: scrapedData.jobDescription,
          jobType: scrapedData.jobType,
          requirements: scrapedData.requirements,
          benefits: scrapedData.benefits,
          status: 'applying',
        } : job
      ));

      // Step 2: Automatically trigger cloud apply
      console.log('🚀 Auto-triggering cloud apply for:', currentJobUrl);
      setCloudApplyJobLoading(prev => ({ ...prev, [jobId]: true }));

      const applyResponse = await fetch('/api/cloud-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl: currentJobUrl,
          userId: user?.id,
        }),
      });

      const applyResult = await applyResponse.json();

      if (applyResult.success) {
        console.log('✅ Application started:', applyResult);

        // Set notification with session info
        setCloudNotifications(prev => ({
          ...prev,
          [jobId]: {
            type: 'success',
            message: `Application in progress for ${scrapedData.companyName || 'this job'}`,
            liveUrl: applyResult.sessionUrl,
            description: `Smart application to ${scrapedData.companyName || 'company'} is in progress... Click "Watch Live" to view!`,
          }
        }));

        // Update job status
        setHomeJobs(prev => prev.map(job =>
          job.id === jobId ? { ...job, status: 'applying', sessionUrl: applyResult.sessionUrl, sessionId: applyResult.sessionId } : job
        ));

        toast.success(`Application started for ${scrapedData.companyName || 'job'}! Click "Watch Live" to monitor.`);
      } else {
        throw new Error(applyResult.error || 'Failed to start application');
      }

    } catch (error: any) {
      console.error('❌ Error in apply flow:', error);
      toast.error(`Failed: ${error.message}`);

      // Update job card to show error
      setHomeJobs(prev => prev.map(job =>
        job.id === jobId ? { ...job, status: 'error', error: error.message } : job
      ));

      setCloudNotifications(prev => ({
        ...prev,
        [jobId]: {
          type: 'error',
          message: error.message,
        }
      }));
    } finally {
      setCloudApplyJobLoading(prev => ({ ...prev, [jobId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Gmail Setup Banner/Card */}
      {!workEmail ? (
        <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/30 backdrop-blur-xl border-blue-700/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Setup Your Work Inbox
            </CardTitle>
            <CardDescription className="text-blue-100">
              Get a professional @nuclei-mail.com email address for job applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showGmailSetup ? (
              <div className="flex items-center justify-between">
                <p className="text-white">Create your professional email to streamline job applications</p>
                <Button
                  onClick={() => setShowGmailSetup(true)}
                  className="bg-white text-blue-900 hover:bg-blue-50"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Setup Inbox
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">First Name</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="bg-gray-800/50 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Last Name</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="bg-gray-800/50 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <p className="text-sm text-blue-100">
                  Your email will be: {firstName && lastName ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nuclei-mail.com` : 'firstname.lastname@nuclei-mail.com'}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateGmailAccount}
                    disabled={isCreatingEmail || !firstName.trim() || !lastName.trim()}
                    className="bg-white text-blue-900 hover:bg-blue-50"
                  >
                    {isCreatingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Create Email
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowGmailSetup(false)}
                    variant="outline"
                    className="border-white text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-green-900/50 to-emerald-900/30 backdrop-blur-xl border-green-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
                <div>
                  <p className="text-white font-semibold">Work Email Active</p>
                  <p className="text-green-100 text-sm">{workEmail}</p>
                </div>
              </div>
              {gmailPassword && (
                <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-3 max-w-md">
                  <p className="text-yellow-100 text-xs font-semibold mb-1">Temporary Password:</p>
                  <p className="text-white font-mono text-sm">{gmailPassword}</p>
                  <p className="text-yellow-200 text-xs mt-1">Save this password! You'll need to change it on first login.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Section */}
      <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border-gray-700/50 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Home className="h-6 w-6" />
            Quick Apply
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center max-w-3xl mx-auto py-8">
            <div className="flex-1 w-full">
              <Input
                type="url"
                placeholder="Paste job link here..."
                value={jobLink}
                onChange={(e) => setJobLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && jobLink.trim()) {
                    handleApply();
                  }
                }}
                className="h-12 text-lg bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleApply}
              disabled={!jobLink.trim()}
              className="h-12 px-8 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <Send className="h-5 w-5 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Cards Section */}
      {homeJobs.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Applications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homeJobs.map((job) => (
              <HomeJobCard
                key={job.id}
                job={job}
                userId={user?.id || null}
                cloudApplyLoading={cloudApplyJobLoading[job.id]}
                cloudNotification={cloudNotifications[job.id]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BrowseJobsSection({
  isSearching,
  setIsSearching,
  jobResults,
  setJobResults,
  autoApplyJobLoading,
  setAutoApplyJobLoading,
  cloudApplyJobLoading,
  setCloudApplyJobLoading,
  notifications,
  setNotifications,
  cloudNotifications,
  setCloudNotifications
}: {
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  jobResults: EnhancedJobListing[];
  setJobResults: (results: EnhancedJobListing[]) => void;
  autoApplyJobLoading: Record<string, boolean>;
  setAutoApplyJobLoading: (loading: React.SetStateAction<Record<string, boolean>>) => void;
  cloudApplyJobLoading: Record<string, boolean>;
  setCloudApplyJobLoading: (loading: React.SetStateAction<Record<string, boolean>>) => void;
  notifications: Record<string, any>;
  setNotifications: (notifications: React.SetStateAction<Record<string, any>>) => void;
  cloudNotifications: Record<string, any>;
  setCloudNotifications: (notifications: React.SetStateAction<Record<string, any>>) => void;
}) {
  const { user } = useAuth();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);

  // Filter states
  const [role, setRole] = useState("");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [city, setCity] = useState("");
  const [flexibility, setFlexibility] = useState("");
  const [experience, setExperience] = useState("");
  const [sponsorship, setSponsorship] = useState("");

  // Auto-apply toggle state - ALWAYS ON
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [autoApplyToggleLoading, setAutoApplyToggleLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Common options for dropdowns
  const commonRoles = [
    // Software & Data
    "Software Engineer",
    "Senior Software Engineer",
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "Platform Engineer",
    "Mobile Engineer (iOS)",
    "Mobile Engineer (Android)",
    "QA Engineer",
    "QA Automation Engineer",
    "Test Engineer",
    "Data Engineer",
    "Data Scientist",
    "Machine Learning Engineer",
    "Analytics Engineer",
    "Business Intelligence Analyst",
    "Security Engineer",
    "DevOps Engineer",
    "Site Reliability Engineer",
    "Cloud Engineer",
    "Solutions Architect",
    
    // Hardware & Core Engineering
    "Embedded Software Engineer",
    "Firmware Engineer",
    "Hardware Engineer",
    "Electrical Engineer",
    "Mechanical Engineer",
    "Industrial Engineer",
    "Manufacturing Engineer",
    "Systems Engineer",
    "Aerospace Engineer",
    "Civil Engineer",
    "Chemical Engineer",
    "Biomedical Engineer",

    // Product, Program & Project
    "Product Manager",
    "Technical Product Manager",
    "Product Owner",
    "Program Manager",
    "Project Manager",
    "Scrum Master",

    // Design & UX
    "Product Designer",
    "UX Designer",
    "UI Designer",
    "UX Researcher",
    "Visual Designer",

    // Marketing & Growth
    "Marketing Manager",
    "Growth Marketer",
    "Performance Marketer",
    "Content Marketer",
    "Product Marketing Manager",
    "SEO Specialist",
    "Social Media Manager",

    // Sales, CS & RevOps
    "Account Executive",
    "Sales Development Representative",
    "Business Development Representative",
    "Customer Success Manager",
    "Solutions Consultant",

    // Operations & Supply Chain
    "Operations Manager",
    "Supply Chain Manager",
    "Logistics Manager",

    // IT & Support
    "IT Support Specialist",
    "Network Engineer",
    "Technical Support Engineer",
    "Technical Writer",

    // HR & People
    "Recruiter",
    "Talent Acquisition Specialist",
    "HR Generalist",

    // Analytics & Business
    "Business Analyst",
    "Financial Analyst",
    "Strategy Analyst"
  ];

  const commonCities = [
    "Remote",
    "New York, NY",
    "San Francisco, CA",
    "Los Angeles, CA",
    "Chicago, IL",
    "Boston, MA",
    "Seattle, WA",
    "Austin, TX",
    "Denver, CO",
    "Atlanta, GA"
  ];

  // Load saved filters from database
  const loadSavedFilters = async () => {
    if (!user) return;
    
    try {
      const { createSupabaseClient } = await import('@/src/lib/supabase');
      const supabase = createSupabaseClient();
      
      const { data, error } = await (supabase as any)
        .from('job_search_filters')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading filters:', error);
        return;
      }

      if (data) {
        setRole(data.role || "");
        setPayMin(data.pay_min?.toString() || "");
        setPayMax(data.pay_max?.toString() || "");
        setCity(data.city || "");
        setFlexibility(data.flexibility || "");
        setExperience(data.experience || "");
        setSponsorship(data.sponsorship || "");
        console.log('✅ Loaded saved filters:', data);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    } finally {
      setFiltersLoaded(true);
    }
  };

  // Save filters to database
  const handleSaveFilters = async () => {
    if (!user) return;

    setSavingFilters(true);
    try {
      const { createSupabaseClient } = await import('@/src/lib/supabase');
      const supabase = createSupabaseClient();

      const filterData = {
        user_id: user.id,
        role: role || null,
        pay_min: payMin ? parseInt(payMin) : null,
        pay_max: payMax ? parseInt(payMax) : null,
        city: city || null,
        flexibility: flexibility || null,
        experience: experience || null,
        sponsorship: sponsorship || null,
      };

      const { error } = await (supabase as any)
        .from('job_search_filters')
        .upsert(filterData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving filters:', error);
        alert('Failed to save filters. Please try again.');
        return;
      }

      console.log('✅ Filters saved successfully:', filterData);
      alert('Filters saved successfully!');
      setFiltersExpanded(false);
      // Immediately query central jobs with the saved filters
      await handleBrowseJobs();
    } catch (error) {
      console.error('Error saving filters:', error);
      alert('Failed to save filters. Please try again.');
    } finally {
      setSavingFilters(false);
    }
  };

  // Load auto-apply preference from database
  const loadAutoApplyPreference = async () => {
    if (!user) return;

    try {
      const { createSupabaseClient } = await import('@/src/lib/supabase');
      const supabase = createSupabaseClient();

      const { data, error } = await (supabase as any)
        .from('auto_apply_preferences')
        .select('auto_apply_enabled')
        .eq('user_id', user.id)
        .single();

      if (error && (error as any).code && (error as any).code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading auto-apply preference:', error);
        return;
      }

      if (data) {
        setAutoApplyEnabled(!!data.auto_apply_enabled);
        console.log('✅ Auto-apply preference loaded:', data.auto_apply_enabled);
      } else {
        // No row found or empty error; default to false without logging an error
        setAutoApplyEnabled(false);
      }
    } catch (error) {
      console.error('Error loading auto-apply preference:', error);
    }
  };

  // Save auto-apply preference to database
  const handleAutoApplyToggle = async (enabled: boolean) => {
    if (!user) return;

    setAutoApplyToggleLoading(true);
    setAutoApplyEnabled(enabled);

    try {
      const { createSupabaseClient } = await import('@/src/lib/supabase');
      const supabase = createSupabaseClient();

      const { error } = await (supabase as any)
        .from('auto_apply_preferences')
        .upsert({
          user_id: user.id,
          auto_apply_enabled: enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving auto-apply preference:', error);
        alert('Failed to save auto-apply preference. Please try again.');
        // Revert the toggle state on error
        setAutoApplyEnabled(!enabled);
        return;
      }

      console.log('✅ Auto-apply preference saved:', enabled);
    } catch (error) {
      console.error('Error saving auto-apply preference:', error);
      alert('Failed to save auto-apply preference. Please try again.');
      // Revert the toggle state on error
      setAutoApplyEnabled(!enabled);
    } finally {
      setAutoApplyToggleLoading(false);
    }
  };

  // Load filters and auto-apply preference on component mount
  useEffect(() => {
    if (user && !filtersLoaded) {
      loadSavedFilters();
      loadAutoApplyPreference();
      setFiltersLoaded(true);
    }
  }, [user, filtersLoaded]);

  const handleSyncJobs = async () => {
    setIsSyncing(true);
    try {
      await Promise.allSettled([
        fetch('/api/jobs/ingest?source=greenhouse&limit=300'),
        fetch('/api/jobs/ingest?source=lever&limit=300'),
        fetch('/api/jobs/ingest?source=workable&limit=300'),
      ]);
      alert('Job sync complete. New jobs saved to the database.');
    } catch (e) {
      console.error('Sync error:', e);
      alert('Job sync finished with some errors. Please check logs.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBrowseJobs = async () => {
    setIsSearching(true);
    
    try {
      // Build central DB query params from filters
      const params = new URLSearchParams();
      if (role && role.trim()) params.set('q', role.trim());
      if (city && city.trim()) params.set('location', city.trim());
      if (flexibility) {
        const f = flexibility.toLowerCase();
        if (f.includes('remote')) params.set('remote_type', 'remote');
        else if (f.includes('hybrid')) params.set('remote_type', 'hybrid');
        else if (f.includes('onsite') || f.includes('on-site')) params.set('remote_type', 'onsite');
      }
      params.set('page', '1');
      params.set('limit', '25');

      const res = await fetch(`/api/jobs/query?${params.toString()}`, { method: 'GET' });
      if (!res.ok) throw new Error(`Query failed: ${res.status}`);
      const data = await res.json();
      const mapped = (data.jobs || []).map((row: any) => ({
        id: row.id || `${row.source}_${row.application_url}`,
        title: row.title,
        company: row.company,
        applicationUrl: row.application_url, // critical for auto-apply
        description: row.description_text || '',
        qualifications: [],
        location: row.location || '',
        remoteType: row.remote_type || 'onsite',
        postedDate: row.posted_at || row.last_seen_at || null,
        source: row.source,
        atsId: row.source_job_id || null,
        requirements: [],
        responsibilities: [],
        companyInfo: {},
        visaSponsorship: false,
        matchCriteria: {
          overallScore: 0,
          breakdown: {
            skillsMatch: 0,
            experienceMatch: 0,
            salaryMatch: 0,
            locationMatch: 0,
            visaMatch: 0,
            roleMatch: 0,
            cultureFit: 0,
          },
          matchReasons: [],
          concerns: [],
          recommendation: 'possible-fit',
        }
      }));
      setJobResults(mapped);
    } catch (error) {
      console.error('Job search error:', error);
      setJobResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle auto-apply
  const handleAutoApply = async (job: EnhancedJobListing) => {
    console.log('🔥 handleAutoApply CALLED!', { jobTitle: job.title, company: job.company, userId: user?.id });

    if (!user) {
      console.error('❌ No user found, aborting auto-apply');
      alert('Please log in to use auto-apply');
      return;
    }

    console.log('🎯 Auto Apply clicked for:', job.title, 'at', job.company);

    // Set loading state
    setAutoApplyJobLoading(prev => ({ ...prev, [job.id]: true }));

    try {
      // Fetch complete user profile from database including demographics
      console.log('📚 Fetching complete user profile from database...');
      const supabase = createSupabaseClient();

       // Fetch all user profile data including resume
       const [userProfileData, workAuthData, parsedResumeData, userResumeData] = await Promise.all([
         (supabase as any).from('user_profiles').select('*').eq('user_id', user.id).single(),
         (supabase as any).from('work_authorization').select('*').eq('user_id', user.id).single(),
         (supabase as any).from('parsed_resumes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
         (supabase as any).from('resumes').select('file_name, file_type, file_size, file_content, file_url').eq('user_id', user.id).single()
       ]);

      const profileData = userProfileData.data;
      const workAuth = workAuthData.data;
      const parsedResume = parsedResumeData.data;
      const userResume = userResumeData.data;

      console.log('✅ User profile fetched:', {
        hasProfile: !!profileData,
        hasWorkAuth: !!workAuth,
        hasParsedResume: !!parsedResume,
        hasUserResume: !!userResume
      });

      // Build complete userProfile with demographics and work authorization
      const applicationData = {
        url: job.applicationUrl,
        userId: user.id,
        userProfile: {
          firstName: profileData?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'User',
          lastName: profileData?.full_name?.split(' ').slice(1).join(' ') || '',
          email: profileData?.email || user.email || '',
          phone: profileData?.phone || '',
          location: {
            address: '',
            city: profileData?.location?.split(',')[0]?.trim() || '',
            state: profileData?.location?.split(',')[1]?.trim() || '',
            zipCode: '',
            country: 'United States'
          },
          linkedinUrl: profileData?.linkedin_url || '',
          portfolioUrl: profileData?.portfolio_url || '',

          // Demographics from database (from work_authorization table)
          demographics: {
            gender: workAuth?.gender || null,
            ethnicity: workAuth?.ethnicity || null,
            race: workAuth?.race || null,
            veteranStatus: workAuth?.veteran_status || null,
            disabilityStatus: workAuth?.disability_status || null
          },

          // Work Authorization from database
          workAuthorization: {
            authorizedToWork: workAuth?.work_authorized ?? true,
            requiresSponsorship: workAuth?.visa_sponsorship_required ?? false,
            visaStatus: workAuth?.work_authorized ? 'authorized' : 'requires-sponsorship',
            availableStartDate: 'Immediately'
          },

          // Parsed resume data
          parsedResume: parsedResume?.resume_data || null,

          // Application data (from GPT essay if exists)
          applicationData: {
            chatgptEssay: profileData?.gpt_essay || null,
            coverLetter: profileData?.gpt_essay || null,
            careerHighlight: parsedResume?.resume_data?.summary || null
          },

          resume: await (async () => {
            // Strategy 1: Try to get from database (file_content column)
            if (userResume && userResume.file_content) {
              console.log('✅ Resume from database (file_content)');
              return {
                fileName: userResume.file_name || 'resume.pdf',
                fileBase64: Buffer.from(userResume.file_content).toString('base64'),
                mimeType: userResume.file_type || 'application/pdf'
              };
            }

            // Strategy 2: Try to download from Supabase Storage (file_url)
            if (userResume && userResume.file_url) {
              console.log('📥 Downloading resume from Supabase Storage...');
              try {
                const response = await fetch(userResume.file_url);
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  console.log('✅ Resume downloaded from storage');
                  return {
                    fileName: userResume.file_name || 'resume.pdf',
                    fileBase64: buffer.toString('base64'),
                    mimeType: userResume.file_type || 'application/pdf'
                  };
                }
              } catch (storageError) {
                console.error('❌ Failed to download resume from storage:', storageError);
              }
            }

            // Strategy 3: Try the download API endpoint as fallback
            if (userResume && user.id) {
              console.log('📥 Trying download API endpoint...');
              try {
                const response = await fetch(`/api/download-resume?userId=${user.id}`);
                if (response.ok) {
                  const blob = await response.blob();
                  const arrayBuffer = await blob.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  console.log('✅ Resume fetched from API');
                  return {
                    fileName: userResume.file_name || 'resume.pdf',
                    fileBase64: buffer.toString('base64'),
                    mimeType: userResume.file_type || 'application/pdf'
                  };
                }
              } catch (apiError) {
                console.error('❌ Failed to fetch resume from API:', apiError);
              }
            }

            // Fallback: No resume available
            console.warn('⚠️  No resume available - user needs to upload one');
            return {
              fileName: 'resume.pdf',
              fileBase64: '', // Empty - will cause skip
              mimeType: 'application/pdf'
            };
          })()
        },
        options: {
          submitForm: true,
          recordVideo: true,
          autoApply: autoApplyEnabled // Pass the toggle state
        }
      };

      // NEW: Call browser-apply API with browser-use
      console.log('🤖 Calling browser-use AI agent...');

      const browserApplyData = {
        jobUrl: job.applicationUrl,
        userId: user.id,
        sessionId: `${user.id}_${job.id}_${Date.now()}`,

        // User profile
        fullName: profileData?.full_name || `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim() || '',
        email: profileData?.email || user.email || '',
        phone: profileData?.phone || '',
        location: profileData?.location || '',

        // Optional URLs (convert null to undefined for API)
        linkedinUrl: profileData?.linkedin_url || undefined,
        portfolioUrl: profileData?.portfolio_url || undefined,
        resumeUrl: userResume?.file_url || undefined,

        // Work experience from parsed resume
        workExperience: parsedResume?.resume_data?.work_experience?.map((exp: any) => ({
          title: exp.title || exp.position || '',
          company: exp.company || '',
          duration: exp.duration || `${exp.start_date || ''} - ${exp.end_date || 'Present'}`,
          description: exp.description || exp.responsibilities?.join('. ') || ''
        })) || [],

        // Education from parsed resume
        education: parsedResume?.resume_data?.education?.map((edu: any) => ({
          degree: edu.degree || '',
          field: edu.field || edu.major || '',
          school: edu.school || edu.institution || '',
          year: edu.graduation_year || edu.end_date || ''
        })) || [],

        // Cover letter
        coverLetter: profileData?.gpt_essay || parsedResume?.resume_data?.summary,

        // Demographics (for EEO forms - convert null to undefined)
        gender: workAuth?.gender || undefined,
        ethnicity: workAuth?.ethnicity || undefined,
        veteranStatus: workAuth?.veteran_status || undefined,
        disabilityStatus: workAuth?.disability_status || undefined,

        // Configuration
        headless: false, // Set to false to watch the browser work!
        timeout: 300
      };

      const response = await fetch('/api/browser-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(browserApplyData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Browser-use application started:', result);

        // Show initial success toast
        toast.success('🤖 AI Agent Started', {
          description: `Smart application to ${job.company} is in progress...`,
          duration: 5000,
        });

        // Store session ID and start polling for status
        const sessionId = result.sessionId;

        // Track last action index to only log new actions
        let lastActionIndex = 0;

        // Poll for application status
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/browser-apply?sessionId=${sessionId}`);
            const statusResult = await statusResponse.json();

            console.log('📊 Application status:', statusResult.status);

            // Log new AI actions to console in real-time
            if (statusResult.actionLog && Array.isArray(statusResult.actionLog)) {
              const newActions = statusResult.actionLog.slice(lastActionIndex);
              newActions.forEach((actionItem: any) => {
                console.log(`🤖 [AI Agent] ${actionItem.action}`);
              });
              lastActionIndex = statusResult.actionLog.length;
            }

            // Log current progress
            if (statusResult.progress) {
              console.log(`📋 [Progress] ${statusResult.progress}`);
            }

            if (statusResult.status === 'completed') {
              clearInterval(pollInterval);

              console.log(`✅ Application to ${job.company} completed successfully!`);

              toast.success('✅ Application Submitted!', {
                description: `Successfully submitted to ${job.company}`,
                duration: 7000,
              });

              setNotifications(prev => ({
                ...prev,
                [job.id]: {
                  type: 'success',
                  message: `Application submitted successfully! ${statusResult.result?.fields_filled || 0} fields filled.`,
                  timestamp: new Date()
                }
              }));

              setAutoApplyJobLoading(prev => ({ ...prev, [job.id]: false }));

            } else if (statusResult.status === 'failed') {
              clearInterval(pollInterval);

              console.log(`❌ Application to ${job.company} failed:`, statusResult.error);

              toast.error('❌ Application Failed', {
                description: statusResult.error || 'Failed to submit application',
                duration: 7000,
              });

              setNotifications(prev => ({
                ...prev,
                [job.id]: {
                  type: 'error',
                  message: statusResult.error || 'Application failed',
                  timestamp: new Date()
                }
              }));

              setAutoApplyJobLoading(prev => ({ ...prev, [job.id]: false }));
            }
          } catch (pollError) {
            console.error('Error polling status:', pollError);
            clearInterval(pollInterval);
            setAutoApplyJobLoading(prev => ({ ...prev, [job.id]: false }));
          }
        }, 2000); // Poll every 2 seconds for faster updates

        // Set a timeout to stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setAutoApplyJobLoading(prev => ({ ...prev, [job.id]: false }));
        }, 300000);

      } else {
        console.error('❌ Browser-apply failed:', result);

        toast.error('Application Failed', {
          description: result.error || 'Failed to start application',
          duration: 5000,
        });

        setNotifications(prev => ({
          ...prev,
          [job.id]: {
            type: 'error',
            message: result.error || 'Application failed',
            timestamp: new Date()
          }
        }));
      }
    } catch (error: any) {
      console.error('❌ Auto-apply error:', error);

      // Show error toast
      toast.error('Auto-Apply Error', {
        description: error.message || 'An unexpected error occurred',
        duration: 5000,
      });

      setNotifications(prev => ({
        ...prev,
        [job.id]: {
          type: 'error',
          message: 'An error occurred during auto-apply',
          timestamp: new Date()
        }
      }));
    } finally {
      setAutoApplyJobLoading(prev => ({ ...prev, [job.id]: false }));
    }
  };

  // Handle cloud apply (using Browser-Use Cloud API)
  const handleCloudApply = async (job: EnhancedJobListing) => {
    console.log('☁️ handleCloudApply CALLED!', { jobTitle: job.title, company: job.company, userId: user?.id });

    if (!user) {
      console.error('❌ No user found, aborting cloud apply');
      alert('Please log in to use cloud apply');
      return;
    }

    console.log('🎯 Cloud Apply clicked for:', job.title, 'at', job.company);

    // Set loading state
    setCloudApplyJobLoading(prev => ({ ...prev, [job.id]: true }));

    try {
      // Call the cloud-apply API
      const response = await fetch('/api/cloud-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl: job.applicationUrl,
          userId: user.id
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Browser-use cloud application started:', result);

        // Show initial success toast with live URL
        toast.success('☁️ Cloud AI Agent Started', {
          description: `Smart application to ${job.company} is in progress... Click "Watch Live" to view!`,
          duration: 5000,
        });

        // Log the live URL
        if (result.sessionUrl) {
          console.log('🔴 Live URL:', result.sessionUrl);
        }

        // Set notification with live URL - this makes the Watch Live button appear
        setCloudNotifications(prev => ({
          ...prev,
          [job.id]: {
            type: 'success',
            message: `Application in progress... Task ID: ${result.taskId}`,
            timestamp: new Date(),
            liveUrl: result.sessionUrl
          }
        }));

        // Show final success toast after a delay
        setTimeout(() => {
          toast.success('✅ Application Submitted!', {
            description: `Successfully submitted to ${job.company} via Browser-Use Cloud`,
            duration: 7000,
          });
        }, 2000);

      } else {
        console.error('❌ Cloud apply failed:', result);

        toast.error('Application Failed', {
          description: result.error || 'Failed to start cloud application',
          duration: 5000,
        });

        setCloudNotifications(prev => ({
          ...prev,
          [job.id]: {
            type: 'error',
            message: result.error || 'Application failed',
            timestamp: new Date()
          }
        }));
      }
    } catch (error: any) {
      console.error('❌ Cloud apply error:', error);

      toast.error('Cloud Apply Error', {
        description: error.message || 'An unexpected error occurred',
        duration: 5000,
      });

      setCloudNotifications(prev => ({
        ...prev,
        [job.id]: {
          type: 'error',
          message: 'An error occurred during cloud apply',
          timestamp: new Date()
        }
      }));
    } finally {
      // Always stop loading spinner
      setCloudApplyJobLoading(prev => ({ ...prev, [job.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <CardTitle className="text-lg">Job Filters</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center gap-2"
            >
              {filtersExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Expand Filters
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        
        <AnimatePresence>
          {filtersExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Role */}
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {commonRoles.map((roleOption) => (
                          <SelectItem key={roleOption} value={roleOption}>
                            {roleOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pay Range */}
                  <div className="space-y-2">
                    <Label>Pay Range (USD/year)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min"
                        type="number"
                        value={payMin}
                        onChange={(e) => setPayMin(e.target.value)}
                      />
                      <Input
                        placeholder="Max"
                        type="number"
                        value={payMax}
                        onChange={(e) => setPayMax(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger id="city">
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        {commonCities.map((cityOption) => (
                          <SelectItem key={cityOption} value={cityOption}>
                            {cityOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Flexibility */}
                  <div className="space-y-2">
                    <Label htmlFor="flexibility">Work Flexibility</Label>
                    <Select value={flexibility} onValueChange={setFlexibility}>
                      <SelectTrigger id="flexibility">
                        <SelectValue placeholder="Select flexibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remote-only">Remote Only</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="onsite">On-site</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Experience */}
                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience Level</Label>
                    <Select value={experience} onValueChange={setExperience}>
                      <SelectTrigger id="experience">
                        <SelectValue placeholder="Select experience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry Level</SelectItem>
                        <SelectItem value="junior">Junior</SelectItem>
                        <SelectItem value="mid">Mid Level</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="principal">Principal</SelectItem>
                        <SelectItem value="lead">Lead / Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sponsorship */}
                  <div className="space-y-2">
                    <Label htmlFor="sponsorship">Visa Sponsorship</Label>
                    <Select value={sponsorship} onValueChange={setSponsorship}>
                      <SelectTrigger id="sponsorship">
                        <SelectValue placeholder="Select sponsorship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-required">Not Required</SelectItem>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="preferred">Preferred</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveFilters} 
                    disabled={savingFilters}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {savingFilters ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Filters'
                    )}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Browse Jobs / Sync Buttons */}
      <div className="flex justify-center gap-3">
        <Button
          onClick={handleBrowseJobs}
          disabled={isSearching}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-3"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Searching Jobs...
            </>
          ) : (
            <>
              <Search className="mr-2 h-5 w-5" />
              Browse Jobs
            </>
          )}
        </Button>
        <Button
          onClick={handleSyncJobs}
          disabled={isSyncing}
          size="lg"
          className="bg-gray-700 hover:bg-gray-800 px-8 py-3"
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Syncing...
            </>
          ) : (
            <>Sync Jobs Now</>
          )}
        </Button>
      </div>

      {/* Auto-Apply Settings - HIDDEN (Always ON) */}

      {/* Job Results */}
      {isSearching && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <h3 className="text-xl font-semibold">Finding Greenhouse Jobs for You</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Analyzing your filters...
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching Greenhouse companies...
                </p>
                <p className="text-gray-400">
                  Calculating match scores...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSearching && jobResults.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              Found {jobResults.length} Greenhouse Jobs!
            </h2>
            <p className="text-gray-600">
              Based on your filter criteria
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
          {jobResults.map((job) => {
            const notification = notifications[job.id];
            const cloudNotification = cloudNotifications[job.id];
            const isApplying = autoApplyJobLoading[job.id];
            const isCloudApplying = cloudApplyJobLoading[job.id];

              return (
                <JobCard
                  key={job.id}
                  job={job}
                  userId={user?.id || null}
                  onAutoApply={handleAutoApply as any}
                  onCloudApply={handleCloudApply as any}
                  autoApplyLoading={isApplying}
                  cloudApplyLoading={isCloudApplying}
                  notification={notification}
                  cloudNotification={cloudNotification}
                  showAutoApply={true}
                  autoApplyEnabled={autoApplyEnabled}
                />
              );
            })}
          </div>
        </div>
      )}

      {!isSearching && jobResults.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <Search className="h-12 w-12 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Find Your Next Job?
                </h3>
                <p className="text-gray-600">
                  Set your filters and click "Browse Jobs" to discover Greenhouse opportunities tailored to your preferences.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Review Applications Section Component
function ReviewApplicationsSection() {
  const { user } = useAuth();
  const { sessions, loading, error } = useAutoApplySessions(user?.id || null);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Error loading applications: {error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Applications to Review
          </h2>
          <p className="text-gray-600 mb-6">
            Applications that are ready for review will appear here.
          </p>
          <p className="text-sm text-gray-500">
            Use the "Auto Apply" feature on job listings to automatically fill out applications.
          </p>
        </div>
      </div>
    );
  }

  // Group sessions by job
  const jobsWithSessions = sessions.map(session => ({
    id: session.job_url,
    title: session.job_title || session.job_url.split('/').pop() || 'Application',
    company: session.company_name || 'Company',
    location: 'Location',
    applicationUrl: session.job_url,
    matchCriteria: {
      overallScore: session.success_rate || 0,
      matchReasons: [`${session.fields_filled} fields filled`, `${session.success_rate}% success rate`],
      concerns: session.fields_skipped > 0 ? [`${session.fields_skipped} fields skipped`] : [],
    },
    session
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Applications</h2>
          <p className="text-gray-600 mt-1">
            {sessions.length} application{sessions.length !== 1 ? 's' : ''} ready for review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!user?.id) return;
              
              try {
                const response = await fetch('/api/update-session-job-info', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id })
                });
                
                const result = await response.json();
                if (result.success) {
                  alert(`Updated ${result.updated} sessions with job info`);
                  // Refresh the page to show updated data
                  window.location.reload();
                } else {
                  alert('Failed to update job info');
                }
              } catch (error) {
                console.error('Error updating job info:', error);
                alert('Error updating job info');
              }
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Update Job Info
          </Button>
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Ready to Submit
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobsWithSessions.map((job: any) => (
          <div key={job.id} className="relative">
            <div
              onClick={async () => {
                // Fetch full session data with media URLs
                if (job.session?.id) {
                  try {
                    const response = await fetch(`/api/session/${job.session.id}`);
                    const data = await response.json();
                    if (data.session) {
                      setSelectedSession(data.session);
                      setIsModalOpen(true);
                    }
                  } catch (error) {
                    console.error('Error fetching session:', error);
                  }
                }
              }}
              className="cursor-pointer"
            >
              <JobCard
                job={job}
                userId={user?.id || null}
                showAutoApply={true}
                className="border-2 border-green-200 bg-green-50/30"
              />
            </div>
            {/* Mark as Submitted Button */}
            <div className="absolute bottom-3 right-3" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  if (!user?.id || !job.session?.id) return;
                  
                  const confirmed = confirm(
                    'Mark this application as submitted?\n\n' +
                    'This will move it to the "Submitted Applications" section.\n\n' +
                    'Note: If you submitted the form in the browser, it should be detected automatically.'
                  );
                  
                  if (!confirmed) return;
                  
                  try {
                    const response = await fetch('/api/update-session-status', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sessionId: job.session.id,
                        status: 'submitted',
                        userId: user.id
                      })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                      alert('✅ Application marked as submitted! Moving to Submitted Applications section...');
                      // Refresh the page to move the application to submitted section
                      window.location.reload();
                    } else {
                      alert('Failed to mark as submitted: ' + result.error);
                    }
                  } catch (error) {
                    console.error('Error marking as submitted:', error);
                    alert('Error marking as submitted');
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark as Submitted
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ApplicationDetailModal
        session={selectedSession}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

// Submitted Applications Section Component
function SubmittedApplicationsSection() {
  const { user } = useAuth();
  const { applications, loading, error } = useSubmittedApplications(user?.id || null);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Error loading submitted applications: {error}</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Send className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Submitted Applications
          </h2>
          <p className="text-gray-600 mb-6">
            Applications you've submitted will appear here for tracking.
          </p>
          <p className="text-sm text-gray-500">
            Complete applications in the "Review Applications" section to see them here.
          </p>
        </div>
      </div>
    );
  }

  // Group applications by job
  const jobsWithApplications = applications.map(application => ({
    id: application.job_url,
    title: application.job_title || application.job_url.split('/').pop() || 'Application',
    company: application.company_name || 'Company',
    location: 'Location',
    applicationUrl: application.job_url,
    matchCriteria: {
      overallScore: application.success_rate || 0,
      matchReasons: [`${application.fields_filled} fields filled`, `${application.success_rate}% success rate`],
      concerns: application.fields_skipped > 0 ? [`${application.fields_skipped} fields skipped`] : [],
    },
    session: application,
    submittedAt: application.closed_at,
    status: application.status
  }));

  // Get status badge info
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return { color: 'bg-green-600', icon: CheckCircle2, text: 'Auto-Submitted' };
      case 'manual_submission':
        return { color: 'bg-blue-600', icon: User, text: 'Manual Submission' };
      case 'timeout':
        return { color: 'bg-yellow-600', icon: Clock, text: 'Timed Out' };
      case 'error':
        return { color: 'bg-red-600', icon: AlertCircle, text: 'Error' };
      default:
        return { color: 'bg-gray-600', icon: FileText, text: 'Completed' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Submitted Applications</h2>
          <p className="text-gray-600 mt-1">
            {applications.length} application{applications.length !== 1 ? 's' : ''} submitted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-blue-600">
            <Send className="h-4 w-4 mr-1" />
            Application History
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobsWithApplications.map((job: any) => {
          const statusBadge = getStatusBadge(job.status);
          const StatusIcon = statusBadge.icon;

          return (
            <div key={job.id} className="relative">
              <div
                onClick={async () => {
                  // Fetch full session data with media URLs
                  if (job.session?.id) {
                    try {
                      const response = await fetch(`/api/session/${job.session.id}`);
                      const data = await response.json();
                      if (data.session) {
                        setSelectedSession(data.session);
                        setIsModalOpen(true);
                      }
                    } catch (error) {
                      console.error('Error fetching session:', error);
                    }
                  }
                }}
                className="cursor-pointer"
              >
                <JobCard
                  job={job}
                  userId={user?.id || null}
                  showAutoApply={false}
                  className="border-2 border-blue-200 bg-blue-50/30 opacity-90"
                />
              </div>
              {/* Status overlay */}
              <div className="absolute top-3 right-3">
                <Badge variant="default" className={statusBadge.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusBadge.text}
                </Badge>
              </div>
              {/* Submitted date */}
              {job.submittedAt && (
                <div className="absolute bottom-3 left-3">
                  <div className="bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-gray-600">
                    Submitted: {new Date(job.submittedAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ApplicationDetailModal
        session={selectedSession}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

// Pricing Section Component
function PricingSection() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const pricingPlans = {
    weekly: [
      {
        id: 'basic-weekly',
        name: 'Basic',
        price: 6,
        period: 'week',
        jobs: 10,
        priceId: 'price_1SOBvoGfV3OgrONkrH31ZPzs',
        icon: Zap,
        popular: false,
        features: [
          '10 auto-apply uses per week',
          'AI-powered form filling',
          'Resume optimization',
          'Basic support',
          'Application tracking'
        ]
      },
      {
        id: 'student-weekly',
        name: 'Student',
        price: 10,
        period: 'week',
        jobs: 20,
        priceId: 'price_1SOBxFGfV3OgrONkjWcGYa7k',
        icon: Star,
        popular: true,
        features: [
          '20 auto-apply uses per week',
          'AI-powered form filling',
          'Resume optimization',
          'Priority support',
          'Application tracking',
          'Interview preparation tips'
        ]
      }
    ],
    monthly: [
      {
        id: 'basic-monthly',
        name: 'Basic',
        price: 20,
        period: 'month',
        jobs: 30,
        priceId: 'price_1SOBwYGfV3OgrONkSrpIhdBH',
        icon: Zap,
        popular: false,
        features: [
          '30 auto-apply uses per month',
          'AI-powered form filling',
          'Resume optimization',
          'Basic support',
          'Application tracking'
        ]
      },
      {
        id: 'student-monthly',
        name: 'Student',
        price: 35,
        period: 'month',
        jobs: 80,
        priceId: 'price_1SOBxuGfV3OgrONkamx6GPzC',
        icon: Star,
        popular: true,
        features: [
          '80 auto-apply uses per month',
          'AI-powered form filling',
          'Resume optimization',
          'Priority support',
          'Application tracking',
          'Interview preparation tips',
          'Career coaching resources'
        ]
      },
      {
        id: 'desperate-monthly',
        name: 'Desperate',
        price: 100,
        period: 'month',
        jobs: 200,
        priceId: 'price_1SOByyGfV3OgrONk3Yvj3Sdh',
        icon: Crown,
        popular: false,
        features: [
          '200 auto-apply uses per month',
          'AI-powered form filling',
          'Resume optimization',
          'Premium support',
          'Application tracking',
          'Interview preparation tips',
          'Career coaching resources',
          'Personal job search consultant',
          'Custom application strategies'
        ]
      }
    ]
  };

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) {
      router.push('/auth/login?returnTo=/dashboard');
      return;
    }

    setLoading(priceId);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          planName,
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/dashboard?subscription=cancelled`,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received');
        setLoading(null);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <Badge variant="secondary" className="mb-4">
          <Crown className="mr-1 h-3 w-3" />
          Subscription Plans
        </Badge>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Choose Your Plan
        </h2>
        <p className="text-gray-600">
          Each plan gives you a certain number of auto-apply uses per period.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'weekly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Weekly Plans
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly Plans
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {pricingPlans[activeTab].map((plan) => {
          const Icon = plan.icon;
          const isLoading = loading === plan.priceId;
          
          return (
            <Card
              key={plan.id}
              className={`relative hover:shadow-xl transition-all duration-300 ${
                plan.popular
                  ? 'ring-2 ring-blue-500 shadow-lg scale-105'
                  : plan.name === 'Desperate'
                  ? 'ring-2 ring-red-500 bg-red-50/30 hover:shadow-lg'
                  : 'hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className={`p-3 rounded-full ${
                    plan.popular 
                      ? 'bg-blue-100 text-blue-600' 
                      : plan.name === 'Desperate'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {plan.name}
                </CardTitle>
                
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
                
                <p className="text-sm text-gray-600 mt-2">
                  {plan.jobs} auto-apply uses per {plan.period}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={isLoading}
                  className={`w-full ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : plan.name === 'Desperate'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Subscribe Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Current Usage Info */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              How Auto-Apply Works
            </h3>
            <p className="text-gray-600 mb-4">
              Each time you click the "Auto Apply" button on a job, it uses one of your plan's applications. 
              Choose a plan that matches your job search intensity.
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Instant access</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Profile Editor Component (collapsible onboarding sections)
function ProfileEditor({ resumeFileName = '' }: { resumeFileName?: string }) {
  const { user } = useAuth();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [updatingJJ, setUpdatingJJ] = useState(false);

  // Collapsible states
  const [open, setOpen] = useState<Record<string, boolean>>({
    step2: true,
    step3: false,
    step4: false,
    step5Edu: false,
    step5Exp: false,
    step6: false,
    step7: false,
    demographics: false,
  });

  // Step 2: Basic Info
  const [basicInfo, setBasicInfo] = useState({
    full_name: "",
    preferred_name: "",
    email: "",
    phone: "",
    location: "",
    linkedin_url: "",
    portfolio_url: "",
    gpt_essay: "",
  });

  // Step 3: Work Authorization & Preferences
  const [workAuth, setWorkAuth] = useState({
    work_authorized: "",
    visa_sponsorship_required: "",
    veteran_status: "",
    disability_status: "",
    open_to_relocation: "",
    work_arrangement: "",
    travel_willingness: "",
  });

  // Step 4: Job Search Criteria
  const [jobCriteria, setJobCriteria] = useState({
    desired_job_titles: [] as string[],
    target_industries: [] as string[],
    preferred_locations: [] as string[],
    min_salary: "",
    job_type: "",
    start_availability: "",
  });

  // Step 5: Experience & Education
  const [experienceEd, setExperienceEd] = useState({
    employment_status: "",
    education_level: "",
    field_of_study: "",
  });

  // Step 6: Skills & Certifications + Languages
  const [skills, setSkills] = useState({
    technical_skills: [] as string[],
    software_tools: [] as string[],
    certifications: [] as string[],
    key_strengths: [] as string[],
  });
  const [languages, setLanguages] = useState<Array<{ language: string; proficiency_level: string }>>([]);
  const [newLanguage, setNewLanguage] = useState({ language: "", proficiency_level: "" });

  // Step 7: Application Preferences
  const [appPrefs, setAppPrefs] = useState({
    applications_per_week: "",
    blacklisted_companies: [] as string[],
  });

  // Demographics
  const [demographics, setDemographics] = useState({
    race: "",
    gender: "",
    age_range: "",
    education_level: "",
    employment_status: "",
    veteran_status: "",
    disability_status: "",
  });

  // Common option sets
  const jobTypes = ["full-time", "part-time", "contract", "internship"];
  const startAvailabilities = ["immediately", "2-weeks", "1-month", "flexible"];
  const workArrangements = ["remote", "hybrid", "on-site", "flexible"];
  const travelOptions = ["no", "occasionally", "frequently"];

  const toggle = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const showMessage = (type: 'success' | 'error', message: string) => {
    setSaveMessage({ type, message });
    setTimeout(() => setSaveMessage(null), 3000); // Clear after 3 seconds
  };

  // Update JJ (regenerate factual profile)
  async function updateJJ() {
    if (!user) return;
    setUpdatingJJ(true);
    
    try {
      const response = await fetch('/api/update-essay-from-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error for missing resume
        if (result.error === 'No resume found for user') {
          showMessage('error', 'Please upload your resume first before generating your factual profile. Go to the Resume tab to upload your resume.');
        } else {
          throw new Error(result.error || 'Failed to update profile');
        }
        return;
      }

      showMessage('success', 'Factual profile updated successfully with your latest information!');
      // Reload data to show the updated essay
      await loadData();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showMessage('error', 'Failed to update profile. Please try again.');
    } finally {
      setUpdatingJJ(false);
    }
  }

  // Fetch all onboarding data
  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_complete_user_profile', { target_user_id: user.id } as any);
      if (error) throw error;

      const bi = (data as any)?.basic_info || {};
      setBasicInfo({
        full_name: bi.full_name || "",
        preferred_name: bi.preferred_name || "",
        email: bi.email || user.email || "",
        phone: bi.phone || "",
        location: bi.location || "",
        linkedin_url: bi.linkedin_url || "",
        portfolio_url: bi.portfolio_url || "",
        gpt_essay: bi.gpt_essay || "",
      });

      const wa = (data as any)?.work_auth || {};
      setWorkAuth({
        work_authorized: wa.work_authorized === true ? 'yes' : wa.work_authorized === false ? 'no' : '',
        visa_sponsorship_required: wa.visa_sponsorship_required === true ? 'yes' : wa.visa_sponsorship_required === false ? 'no' : '',
        veteran_status: wa.veteran_status || '',
        disability_status: wa.disability_status || '',
        open_to_relocation: wa.open_to_relocation || '',
        work_arrangement: wa.work_arrangement || '',
        travel_willingness: wa.travel_willingness || '',
      });

      const jc = (data as any)?.job_criteria || {};
      setJobCriteria({
        desired_job_titles: jc.desired_job_titles || [],
        target_industries: jc.target_industries || [],
        preferred_locations: jc.preferred_locations || [],
        min_salary: jc.min_salary?.toString?.() || "",
        job_type: jc.job_type || '',
        start_availability: jc.start_availability || '',
      });

      const ee = (data as any)?.experience || {};
      setExperienceEd({
        employment_status: ee.employment_status || '',
        education_level: ee.education_level || '',
        field_of_study: ee.field_of_study || '',
      });

      const sc = (data as any)?.skills || {};
      setSkills({
        technical_skills: sc.technical_skills || [],
        software_tools: sc.software_tools || [],
        certifications: sc.certifications || [],
        key_strengths: sc.key_strengths || [],
      });
      setLanguages(Array.isArray((data as any)?.languages) ? (data as any).languages.map((l: any) => ({ language: l.language, proficiency_level: l.proficiency_level })) : []);

      const ap = (data as any)?.app_prefs || {};
      setAppPrefs({
        applications_per_week: ap.applications_per_week?.toString?.() || '',
        blacklisted_companies: ap.blacklisted_companies || [],
      });

      // Load demographics data separately
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.access_token) {
          const response = await fetch('/api/demographics', {
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
            },
          });
          if (response.ok) {
            const demographicsData = await response.json();
            if (demographicsData.demographics) {
              setDemographics({
                race: demographicsData.demographics.race || '',
                gender: demographicsData.demographics.gender || '',
                age_range: demographicsData.demographics.age_range || '',
                education_level: demographicsData.demographics.education_level || '',
                employment_status: demographicsData.demographics.employment_status || '',
                veteran_status: demographicsData.demographics.veteran_status || '',
                disability_status: demographicsData.demographics.disability_status || '',
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load demographics:', error);
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  }

  // Save handlers per section
  async function saveStep2() {
    if (!user) return;
    setSavingSection('step2');
    try {
      console.log('Attempting to save basic info for user:', user.id);
      
        const profileData = {
          user_id: user.id,
          full_name: basicInfo.full_name || null,
          preferred_name: basicInfo.preferred_name || null,
          email: basicInfo.email || null,
          phone: basicInfo.phone || null,
          location: basicInfo.location || null,
          linkedin_url: basicInfo.linkedin_url || null,
          portfolio_url: basicInfo.portfolio_url || null,
          gpt_essay: basicInfo.gpt_essay || null,
        };

      // Use profileData directly since we removed the id column
      
      console.log('Data to save:', profileData);

      // First, let's test the connection and table access
      console.log('Testing table access...');
      const testQuery = await supabase.from('user_profiles').select('user_id').limit(1);
      console.log('Table access test result:', testQuery);

      // Try a simpler approach: check if profile exists, then insert or update
      let result;
      
      // First, check if a profile already exists for this user
      console.log('Checking if profile exists...');
      const existingProfile = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      console.log('Existing profile check:', existingProfile);
      
      if (existingProfile.data) {
        // Profile exists, do an update
        console.log('Profile exists, updating...');
        const updateData = {
          full_name: basicInfo.full_name || null,
          preferred_name: basicInfo.preferred_name || null,
          email: basicInfo.email || null,
          phone: basicInfo.phone || null,
          location: basicInfo.location || null,
          linkedin_url: basicInfo.linkedin_url || null,
          portfolio_url: basicInfo.portfolio_url || null,
        };
        result = await (supabase as any)
          .from('user_profiles')
          .update(updateData)
          .eq('user_id', user.id);
        console.log('Update result:', result);
      } else {
        // Profile doesn't exist, do an insert
        console.log('Profile does not exist, inserting...');
        result = await (supabase as any).from('user_profiles').upsert(profileData, {
          onConflict: 'user_id'
        });
        console.log('Insert result:', result);
      }
      
      if (result.error) {
        console.error('All save attempts failed. Final error object:', result.error);
        console.error('Final error stringified:', JSON.stringify(result.error, null, 2));
        console.error('Final error properties:', {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code
        });
        throw result.error;
      }
      
      showMessage('success', 'Basic information saved successfully!');
    } catch (e: any) {
      console.error('Save step 2 failed - Raw error:', e);
      console.error('Save step 2 failed - Stringified error:', JSON.stringify(e, null, 2));
      console.error('Save step 2 failed - Error properties:', {
        error: e,
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        stack: e?.stack,
        name: e?.name,
        toString: e?.toString?.()
      });
      
      // Try to get a meaningful error message
      let errorMessage = 'Unknown error';
      if (e?.message) {
        errorMessage = e.message;
      } else if (e?.toString && typeof e.toString === 'function') {
        errorMessage = e.toString();
      } else if (typeof e === 'string') {
        errorMessage = e;
      }
      
      showMessage('error', `Failed to save basic information: ${errorMessage}. Please try again.`);
    } finally {
      setSavingSection(null);
    }
  }

  async function saveStep3() {
    if (!user) return;
    setSavingSection('step3');
    try {
      const { error } = await supabase.from('work_authorization').upsert({
        user_id: user.id,
        work_authorized: workAuth.work_authorized === 'yes',
        visa_sponsorship_required: workAuth.visa_sponsorship_required === 'yes',
        veteran_status: workAuth.veteran_status || null,
        disability_status: workAuth.disability_status || null,
        open_to_relocation: workAuth.open_to_relocation || null,
        work_arrangement: workAuth.work_arrangement || null,
        travel_willingness: workAuth.travel_willingness || null,
      } as any);
      
      if (error) throw error;
      showMessage('success', 'Work authorization saved successfully!');
    } catch (e) {
      console.error('Save step 3 failed:', e);
      showMessage('error', 'Failed to save work authorization. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveStep4() {
    if (!user) return;
    setSavingSection('step4');
    try {
      const { error } = await supabase.from('job_search_criteria').upsert({
        user_id: user.id,
        desired_job_titles: jobCriteria.desired_job_titles,
        target_industries: jobCriteria.target_industries,
        preferred_locations: jobCriteria.preferred_locations,
        min_salary: jobCriteria.min_salary ? parseInt(jobCriteria.min_salary) : null,
        job_type: jobCriteria.job_type || null,
        start_availability: jobCriteria.start_availability || null,
      } as any);
      
      if (error) throw error;
      showMessage('success', 'Job search criteria saved successfully!');
    } catch (e) {
      console.error('Save step 4 failed:', e);
      showMessage('error', 'Failed to save job search criteria. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveStep5() {
    if (!user) return;
    setSavingSection('step5');
    try {
      const { error } = await supabase.from('experience_education').upsert({
        user_id: user.id,
        employment_status: experienceEd.employment_status || null,
        education_level: experienceEd.education_level || null,
        field_of_study: experienceEd.field_of_study || null,
      } as any);
      
      if (error) throw error;
      showMessage('success', 'Experience & education saved successfully!');
    } catch (e) {
      console.error('Save step 5 failed:', e);
      showMessage('error', 'Failed to save experience & education. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  // Multi-entry Education & Experience
  const [educationEntries, setEducationEntries] = useState<Array<{ school: string; startYear: string; endYear: string; major: string; degree: string }>>([
    { school: '', startYear: '', endYear: '', major: '', degree: '' }
  ]);
  const [experienceEntries, setExperienceEntries] = useState<Array<{ company: string; role: string; startDate: string; endDate: string; reason: string; current: boolean; description: string }>>([
    { company: '', role: '', startDate: '', endDate: '', reason: '', current: false, description: '' }
  ]);

  async function saveEducation() {
    if (!user) return;
    setSavingSection('step5Edu');
    try {
      // Best-effort: save detailed entries to a dedicated table if present
      try {
        // Clear existing and insert fresh set
        await supabase.from('education_entries').delete().eq('user_id', user.id);
        const rows = educationEntries
          .filter(e => e.school || e.degree)
          .map(e => ({ user_id: user.id, school: e.school || null, start_year: e.startYear || null, end_year: e.endYear || null, major: e.major || null, degree: e.degree || null }));
        if (rows.length > 0) {
          const { error: insertErr } = await supabase.from('education_entries').insert(rows as any);
          if (insertErr) throw insertErr;
        }
      } catch (e) {
        console.warn('Education entries table not available or insert failed, falling back to summary fields.');
      }
      // Always persist summary to experience_education
      const { error } = await supabase.from('experience_education').upsert({
        user_id: user.id,
        education_level: experienceEd.education_level || null,
        field_of_study: experienceEd.field_of_study || null,
      } as any);
      if (error) throw error;
      showMessage('success', 'Education saved successfully!');
    } catch (e) {
      console.error('Save education failed:', e);
      showMessage('error', 'Failed to save education. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveExperience() {
    if (!user) return;
    setSavingSection('step5Exp');
    try {
      try {
        await supabase.from('experience_entries').delete().eq('user_id', user.id);
        const rows = experienceEntries
          .filter(x => x.company || x.role)
          .map(x => ({ user_id: user.id, company: x.company || null, role: x.role || null, start_date: x.startDate || null, end_date: x.current ? null : (x.endDate || null), is_current: x.current, reason_for_leaving: x.reason || null, description: x.description || null }));
        if (rows.length > 0) {
          const { error: insertErr } = await supabase.from('experience_entries').insert(rows as any);
          if (insertErr) throw insertErr;
        }
      } catch (e) {
        console.warn('Experience entries table not available or insert failed, falling back to summary fields.');
      }
      const { error } = await supabase.from('experience_education').upsert({
        user_id: user.id,
        employment_status: experienceEd.employment_status || null,
      } as any);
      if (error) throw error;
      showMessage('success', 'Experience saved successfully!');
    } catch (e) {
      console.error('Save experience failed:', e);
      showMessage('error', 'Failed to save experience. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveStep6() {
    if (!user) return;
    setSavingSection('step6');
    try {
      const { error: skillsError } = await supabase.from('skills_certifications').upsert({
        user_id: user.id,
        technical_skills: skills.technical_skills,
        software_tools: skills.software_tools,
        certifications: skills.certifications,
        key_strengths: skills.key_strengths,
      } as any);

      if (skillsError) throw skillsError;

      // Replace languages set
      const { error: deleteError } = await supabase.from('language_skills').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;
      
      if (languages.length > 0) {
        const { error: insertError } = await supabase.from('language_skills').insert(
          languages.map(l => ({ user_id: user.id, language: l.language, proficiency_level: l.proficiency_level })) as any
        );
        if (insertError) throw insertError;
      }
      
      showMessage('success', 'Skills & certifications saved successfully!');
    } catch (e) {
      console.error('Save step 6 failed:', e);
      showMessage('error', 'Failed to save skills & certifications. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveStep7() {
    if (!user) return;
    setSavingSection('step7');
    try {
      const { error } = await supabase.from('application_preferences').upsert({
        user_id: user.id,
        applications_per_week: appPrefs.applications_per_week ? parseInt(appPrefs.applications_per_week) : null,
        blacklisted_companies: appPrefs.blacklisted_companies,
      } as any);
      
      if (error) throw error;
      showMessage('success', 'Application preferences saved successfully!');
    } catch (e) {
      console.error('Save step 7 failed:', e);
      showMessage('error', 'Failed to save application preferences. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveDemographics() {
    if (!user) return;
    setSavingSection('demographics');
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await fetch('/api/demographics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          race: demographics.race || null,
          gender: demographics.gender || null,
          age_range: demographics.age_range || null,
          education_level: demographics.education_level || null,
          employment_status: demographics.employment_status || null,
          veteran_status: demographics.veteran_status || null,
          disability_status: demographics.disability_status || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save demographics');
      }

      showMessage('success', 'Demographics saved successfully!');
    } catch (e) {
      console.error('Save demographics failed:', e);
      showMessage('error', 'Failed to save demographics. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  // Check if user has resume in database (fallback check)
  const [hasResumeInDB, setHasResumeInDB] = useState(false);
  
  useEffect(() => {
    const checkResume = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('resumes')
          .select('file_name')
          .eq('user_id', user.id)
          .single();
        setHasResumeInDB(!!(data as any)?.file_name);
      } catch (error) {
        setHasResumeInDB(false);
      }
    };
    
    checkResume();
  }, [user?.id, supabase]);

  // Load on mount
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{saveMessage.message}</span>
          </div>
        </div>
      )}

      {/* Step 2: Basic Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step2')} className="flex items-center gap-2">
              {open.step2 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step2 ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step2 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Legal Name</Label>
                    <Input value={basicInfo.full_name} onChange={e => setBasicInfo(v => ({ ...v, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Name</Label>
                    <Input value={basicInfo.preferred_name} onChange={e => setBasicInfo(v => ({ ...v, preferred_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={basicInfo.email} onChange={e => setBasicInfo(v => ({ ...v, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={basicInfo.phone} onChange={e => setBasicInfo(v => ({ ...v, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={basicInfo.location} onChange={e => setBasicInfo(v => ({ ...v, location: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn URL</Label>
                    <Input value={basicInfo.linkedin_url} onChange={e => setBasicInfo(v => ({ ...v, linkedin_url: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Portfolio URL</Label>
                    <Input value={basicInfo.portfolio_url} onChange={e => setBasicInfo(v => ({ ...v, portfolio_url: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveStep2} disabled={savingSection === 'step2'}>
                    {savingSection === 'step2' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Step 3: Work Authorization & Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Work Authorization & Preferences</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step3')} className="flex items-center gap-2">
              {open.step3 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step3 ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step3 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Legally authorized to work in the US?</Label>
                    <Select value={workAuth.work_authorized} onValueChange={v => setWorkAuth(s => ({ ...s, work_authorized: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Require visa sponsorship now or future?</Label>
                    <Select value={workAuth.visa_sponsorship_required} onValueChange={v => setWorkAuth(s => ({ ...s, visa_sponsorship_required: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Veteran status</Label>
                    <Select value={workAuth.veteran_status} onValueChange={v => setWorkAuth(s => ({ ...s, veteran_status: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Disability disclosure</Label>
                    <Select value={workAuth.disability_status} onValueChange={v => setWorkAuth(s => ({ ...s, disability_status: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="prefer-not-to-answer">Prefer not to answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Open to relocation</Label>
                    <Select value={workAuth.open_to_relocation} onValueChange={v => setWorkAuth(s => ({ ...s, open_to_relocation: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="depends">Depends</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred work arrangement</Label>
                    <Select value={workAuth.work_arrangement} onValueChange={v => setWorkAuth(s => ({ ...s, work_arrangement: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {workArrangements.map(w => (<SelectItem key={w} value={w}>{w}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Willingness to travel</Label>
                    <Select value={workAuth.travel_willingness} onValueChange={v => setWorkAuth(s => ({ ...s, travel_willingness: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {travelOptions.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveStep3} disabled={savingSection === 'step3'}>
                    {savingSection === 'step3' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Step 4: Job Search Criteria */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Job Search Criteria</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step4')} className="flex items-center gap-2">
              {open.step4 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step4 ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step4 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Desired job titles</Label>
                  <Input placeholder="Comma-separated (e.g., Software Engineer, Frontend Developer)" value={jobCriteria.desired_job_titles.join(', ')} onChange={e => setJobCriteria(s => ({ ...s, desired_job_titles: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Target industries</Label>
                  <Input placeholder="Comma-separated" value={jobCriteria.target_industries.join(', ')} onChange={e => setJobCriteria(s => ({ ...s, target_industries: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Preferred locations</Label>
                  <Input placeholder="Comma-separated or 'Remote'" value={jobCriteria.preferred_locations.join(', ')} onChange={e => setJobCriteria(s => ({ ...s, preferred_locations: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum desired salary (USD/year)</Label>
                    <Input type="number" value={jobCriteria.min_salary} onChange={e => setJobCriteria(s => ({ ...s, min_salary: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Job type</Label>
                    <Select value={jobCriteria.job_type} onValueChange={v => setJobCriteria(s => ({ ...s, job_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {jobTypes.map(j => (<SelectItem key={j} value={j}>{j}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start availability</Label>
                    <Select value={jobCriteria.start_availability} onValueChange={v => setJobCriteria(s => ({ ...s, start_availability: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {startAvailabilities.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveStep4} disabled={savingSection === 'step4'}>
                    {savingSection === 'step4' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Step 5: Education */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Education</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step5Edu')} className="flex items-center gap-2">
              {open.step5Edu ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step5Edu ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step5Edu && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Highest education level</Label>
                    <Input value={experienceEd.education_level} onChange={e => setExperienceEd(s => ({ ...s, education_level: e.target.value }))} placeholder="e.g., Bachelor's Degree" />
                  </div>
                  <div className="space-y-2">
                    <Label>Field of study</Label>
                    <Input value={experienceEd.field_of_study} onChange={e => setExperienceEd(s => ({ ...s, field_of_study: e.target.value }))} placeholder="e.g., Civil Engineering" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Education entries</h4>
                    <Button size="sm" variant="outline" onClick={() => setEducationEntries(arr => [...arr, { school: '', startYear: '', endYear: '', major: '', degree: '' }])}>Add Education</Button>
                  </div>
                  {educationEntries.map((ed, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 border rounded-lg">
                      <div className="space-y-1">
                        <Label>School</Label>
                        <Input value={ed.school} onChange={e => setEducationEntries(a => a.map((x,i)=> i===idx? { ...x, school: e.target.value }: x))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Year started</Label>
                        <Input value={ed.startYear} onChange={e => setEducationEntries(a => a.map((x,i)=> i===idx? { ...x, startYear: e.target.value }: x))} placeholder="YYYY" />
                      </div>
                      <div className="space-y-1">
                        <Label>Year graduated</Label>
                        <Input value={ed.endYear} onChange={e => setEducationEntries(a => a.map((x,i)=> i===idx? { ...x, endYear: e.target.value }: x))} placeholder="YYYY" />
                      </div>
                      <div className="space-y-1">
                        <Label>Major studied</Label>
                        <Input value={ed.major} onChange={e => setEducationEntries(a => a.map((x,i)=> i===idx? { ...x, major: e.target.value }: x))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Degree</Label>
                        <Select value={ed.degree} onValueChange={v => setEducationEntries(a => a.map((x,i)=> i===idx? { ...x, degree: v }: x))}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="associate">Associate</SelectItem>
                            <SelectItem value="bachelor">Bachelor's</SelectItem>
                            <SelectItem value="master">Master's</SelectItem>
                            <SelectItem value="phd">PhD</SelectItem>
                            <SelectItem value="diploma">Diploma/Certificate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-5 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEducationEntries(a => a.filter((_,i)=> i!==idx))}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveEducation} disabled={savingSection === 'step5Edu'}>
                    {savingSection === 'step5Edu' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Education'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Step 5.1: Experience */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Experience</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step5Exp')} className="flex items-center gap-2">
              {open.step5Exp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step5Exp ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step5Exp && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Experience entries</h4>
                    <Button size="sm" variant="outline" onClick={() => setExperienceEntries(arr => [...arr, { company: '', role: '', startDate: '', endDate: '', reason: '', current: false, description: '' }])}>Add Experience</Button>
                  </div>
                  {experienceEntries.map((ex, idx) => (
                    <div key={idx} className="space-y-3 p-3 border rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Company</Label>
                          <Input value={ex.company} onChange={e => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, company: e.target.value }: x))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Role</Label>
                          <Input value={ex.role} onChange={e => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, role: e.target.value }: x))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Start date</Label>
                          <Input type="date" value={ex.startDate} onChange={e => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, startDate: e.target.value }: x))} />
                        </div>
                        <div className="space-y-1">
                          <Label>End date</Label>
                          <Input type="date" value={ex.endDate} onChange={e => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, endDate: e.target.value }: x))} disabled={ex.current} />
                        </div>
                        <div className="space-y-1">
                          <Label>Still working here?</Label>
                          <div className="flex items-center gap-2">
                            <Switch checked={ex.current} onCheckedChange={v => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, current: v }: x))} />
                            <span className="text-sm text-gray-600">Mark current role</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Reason for leaving</Label>
                          <Input value={ex.reason} onChange={e => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, reason: e.target.value }: x))} disabled={ex.current} />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <Label>Description of responsibilities/impact</Label>
                          <Textarea value={ex.description} onChange={e => setExperienceEntries(a => a.map((x,i)=> i===idx? { ...x, description: e.target.value }: x))} rows={4} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setExperienceEntries(a => a.filter((_,i)=> i!==idx))}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveExperience} disabled={savingSection === 'step5Exp'}>
                    {savingSection === 'step5Exp' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Experience'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Step 6: Skills & Certifications + Languages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Skills, Certifications & Languages</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step6')} className="flex items-center gap-2">
              {open.step6 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step6 ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step6 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Technical skills (comma-separated)</Label>
                    <Input value={skills.technical_skills.join(', ')} onChange={e => setSkills(s => ({ ...s, technical_skills: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Software/tools (comma-separated)</Label>
                    <Input value={skills.software_tools.join(', ')} onChange={e => setSkills(s => ({ ...s, software_tools: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Certifications (comma-separated)</Label>
                    <Input value={skills.certifications.join(', ')} onChange={e => setSkills(s => ({ ...s, certifications: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Key strengths (comma-separated)</Label>
                    <Input value={skills.key_strengths.join(', ')} onChange={e => setSkills(s => ({ ...s, key_strengths: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Languages</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input placeholder="Language" value={newLanguage.language} onChange={e => setNewLanguage(s => ({ ...s, language: e.target.value }))} />
                    <Select value={newLanguage.proficiency_level} onValueChange={v => setNewLanguage(s => ({ ...s, proficiency_level: v }))}>
                      <SelectTrigger><SelectValue placeholder="Proficiency" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="native">Native/Bilingual</SelectItem>
                        <SelectItem value="fluent">Fluent</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => {
                      if (newLanguage.language && newLanguage.proficiency_level) {
                        setLanguages(arr => [...arr, newLanguage]);
                        setNewLanguage({ language: '', proficiency_level: '' });
                      }
                    }}>Add</Button>
                  </div>
                  {languages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {languages.map((l, idx) => (
                        <Badge key={`${l.language}-${idx}`} variant="secondary" className="flex items-center gap-2">
                          {l.language} ({l.proficiency_level})
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setLanguages(arr => arr.filter((_, i) => i !== idx))} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveStep6} disabled={savingSection === 'step6'}>
                    {savingSection === 'step6' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Step 7: Application Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Application Preferences</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('step7')} className="flex items-center gap-2">
              {open.step7 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.step7 ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {open.step7 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Applications per week</Label>
                    <Select value={appPrefs.applications_per_week} onValueChange={v => setAppPrefs(s => ({ ...s, applications_per_week: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Blacklisted companies (comma-separated)</Label>
                    <Input value={appPrefs.blacklisted_companies.join(', ')} onChange={e => setAppPrefs(s => ({ ...s, blacklisted_companies: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveStep7} disabled={savingSection === 'step7'}>
                    {savingSection === 'step7' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Demographics Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Demographics (Optional)</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => toggle('demographics')} className="flex items-center gap-2">
              {open.demographics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open.demographics ? 'Collapse' : 'Expand'}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            This information helps us provide better job matching and insights. All fields are optional.
          </p>
        </CardHeader>
        <AnimatePresence>
          {open.demographics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Race/Ethnicity */}
                  <div>
                    <Label>Race/Ethnicity</Label>
                    <Select value={demographics.race} onValueChange={value => setDemographics(s => ({ ...s, race: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select race/ethnicity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="american_indian_alaska_native">American Indian or Alaska Native</SelectItem>
                        <SelectItem value="asian">Asian</SelectItem>
                        <SelectItem value="black_african_american">Black or African American</SelectItem>
                        <SelectItem value="hispanic_latino">Hispanic or Latino</SelectItem>
                        <SelectItem value="native_hawaiian_pacific_islander">Native Hawaiian or Pacific Islander</SelectItem>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="two_or_more_races">Two or More Races</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <div>
                    <Label>Gender Identity</Label>
                    <Select value={demographics.gender} onValueChange={value => setDemographics(s => ({ ...s, gender: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender identity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non_binary">Non-binary</SelectItem>
                        <SelectItem value="transgender">Transgender</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Age Range */}
                  <div>
                    <Label>Age Range</Label>
                    <Select value={demographics.age_range} onValueChange={value => setDemographics(s => ({ ...s, age_range: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select age range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under_18">Under 18</SelectItem>
                        <SelectItem value="18_24">18-24</SelectItem>
                        <SelectItem value="25_34">25-34</SelectItem>
                        <SelectItem value="35_44">35-44</SelectItem>
                        <SelectItem value="45_54">45-54</SelectItem>
                        <SelectItem value="55_64">55-64</SelectItem>
                        <SelectItem value="65_plus">65+</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Education Level */}
                  <div>
                    <Label>Education Level</Label>
                    <Select value={demographics.education_level} onValueChange={value => setDemographics(s => ({ ...s, education_level: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select education level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high_school">High School</SelectItem>
                        <SelectItem value="some_college">Some College</SelectItem>
                        <SelectItem value="associate_degree">Associate Degree</SelectItem>
                        <SelectItem value="bachelor_degree">Bachelor's Degree</SelectItem>
                        <SelectItem value="master_degree">Master's Degree</SelectItem>
                        <SelectItem value="doctoral_degree">Doctoral Degree</SelectItem>
                        <SelectItem value="professional_degree">Professional Degree</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Employment Status */}
                  <div>
                    <Label>Employment Status</Label>
                    <Select value={demographics.employment_status} onValueChange={value => setDemographics(s => ({ ...s, employment_status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed_full_time">Employed Full-time</SelectItem>
                        <SelectItem value="employed_part_time">Employed Part-time</SelectItem>
                        <SelectItem value="self_employed">Self-employed</SelectItem>
                        <SelectItem value="unemployed_seeking">Unemployed (Seeking)</SelectItem>
                        <SelectItem value="unemployed_not_seeking">Unemployed (Not Seeking)</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Veteran Status */}
                  <div>
                    <Label>Veteran Status</Label>
                    <Select value={demographics.veteran_status} onValueChange={value => setDemographics(s => ({ ...s, veteran_status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select veteran status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veteran">Veteran</SelectItem>
                        <SelectItem value="not_veteran">Not a Veteran</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Disability Status */}
                  <div>
                    <Label>Disability Status</Label>
                    <Select value={demographics.disability_status} onValueChange={value => setDemographics(s => ({ ...s, disability_status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select disability status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes, I have a disability</SelectItem>
                        <SelectItem value="no">No, I do not have a disability</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      This information is kept private and secure. It helps us provide better job recommendations.
                    </p>
                    <Button onClick={saveDemographics} disabled={savingSection === 'demographics'}>
                      {savingSection === 'demographics' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Demographics'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Update JJ Button */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">JJ AI Profile</h3>
              <p className="text-sm text-gray-600">
                Your comprehensive factual profile showing work experience, education, skills, projects, and preferences from your resume and profile data.
              </p>
            </div>
            
            {/* Display Structured Profile */}
            {basicInfo.gpt_essay ? (
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Your Professional Profile:</h4>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {/* Render structured profile with proper formatting */}
                  {basicInfo.gpt_essay.split('\n').map((line, index) => {
                    // Handle section headers (## SECTION)
                    if (line.startsWith('## ')) {
                      return (
                        <h5 key={index} className="font-semibold text-gray-900 mt-6 mb-3 text-base border-b border-gray-200 pb-1">
                          {line.replace('## ', '')}
                        </h5>
                      );
                    }
                    // Handle bullet points
                    if (line.startsWith('- ')) {
                      return (
                        <div key={index} className="ml-4 mb-2 flex items-start">
                          <span className="text-blue-600 mr-2 mt-1">•</span>
                          <span>{line.replace('- ', '')}</span>
                        </div>
                      );
                    }
                    // Handle regular paragraphs
                    if (line.trim()) {
                      return (
                        <p key={index} className="mb-3">
                          {line}
                        </p>
                      );
                    }
                    // Handle empty lines
                    return <div key={index} className="mb-2"></div>;
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                {!resumeFileName && !hasResumeInDB ? (
                  <div className="space-y-3">
                    <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Resume Required</p>
                      <p className="text-sm text-gray-600">
                        Please upload your resume first to generate your comprehensive factual profile. 
                        Go to the <strong>Resume</strong> tab to upload your resume file.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No professional profile generated yet. Click the button below to create your comprehensive factual profile.
                  </p>
                )}
              </div>
            )}
            
            <div className="text-center">
              <Button 
                onClick={updateJJ} 
                disabled={updatingJJ || (!resumeFileName && !hasResumeInDB)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingJJ ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Profile...
                  </>
                ) : !resumeFileName && !hasResumeInDB ? (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Resume First
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    {basicInfo.gpt_essay ? 'Update Profile' : 'Generate Factual Profile'}
                  </>
                )}
              </Button>
              {!resumeFileName && !hasResumeInDB && (
                <p className="text-xs text-gray-500 mt-2">
                  A resume is required to generate your factual profile
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  // Persistent job search state (survives tab switches)
  const [isSearching, setIsSearching] = useState(false);
  const [jobResults, setJobResults] = useState<EnhancedJobListing[]>([]);
  const [autoApplyJobLoading, setAutoApplyJobLoading] = useState<Record<string, boolean>>({});
  const [cloudApplyJobLoading, setCloudApplyJobLoading] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<Record<string, any>>({});
  const [cloudNotifications, setCloudNotifications] = useState<Record<string, any>>({});
  const [searchProgress, setSearchProgress] = useState<string>('');

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFileUrl, setResumeFileUrl] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeSaving, setResumeSaving] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeMessage, setResumeMessage] = useState('');

  // Resume functions
  const loadResume = useCallback(async () => {
    if (!user?.id) {
      console.log('❌ loadResume: No user ID');
      return;
    }

    console.log('🔍 Loading resume for user:', user.id);
    setResumeLoading(true);

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await (supabase as any)
        .from('resumes')
        .select('file_name, file_size, file_type')
        .eq('user_id', user.id)
        .single();

      console.log('📥 Resume query result:', {
        hasData: !!data,
        fileName: data?.file_name,
        error: error?.code,
        errorMessage: error?.message
      });

      if (error) {
        if (error.code === 'PGRST116') {
          // No resume found - not an error, just no data
          console.log('ℹ️  No resume uploaded yet (code PGRST116)');
          setResumeFileName('');
          setResumeFileUrl('');
          setResumeMessage('');
        } else {
          // Real error
          console.error('❌ Error loading resume:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          setResumeMessage(`Failed to load resume: ${error.message || 'Database error'}`);
        }
      } else if (data) {
        console.log('✅ Resume found:', data.file_name);
        setResumeFileName(data.file_name || '');
        // No file URL needed for database storage
        setResumeFileUrl('');
        setResumeMessage('');
      } else {
        console.log('⚠️  Query succeeded but no data returned');
        setResumeFileName('');
        setResumeFileUrl('');
      }
    } catch (error: any) {
      console.error('❌ Exception loading resume:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setResumeMessage(`Failed to load resume: ${error.message || 'Unknown error'}`);
    } finally {
      setResumeLoading(false);
    }
  }, [user?.id]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setResumeMessage('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setResumeMessage('File size must be less than 5MB');
      return;
    }

    setResumeFile(file);
    setResumeMessage('');
  };

  const uploadResume = async () => {
    if (!user?.id || !resumeFile) {
      console.log('❌ uploadResume: Missing user ID or file');
      return;
    }

    console.log('📤 Uploading resume:', resumeFile.name, `(${resumeFile.size} bytes)`);
    setResumeUploading(true);
    setResumeMessage('');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', resumeFile);
      formData.append('userId', user.id);

      console.log('🌐 Sending upload request to /api/upload-resume...');

      // Upload file to API endpoint
      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      });

      console.log('📥 Upload response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Upload failed:', errorData);
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Upload successful:', result);

      // File is already saved to database by the API
      setResumeFileName(resumeFile.name);
      setResumeFileUrl(''); // No URL needed for database storage
      setResumeFile(null);

      // Show success message (no parsing, no reload)
      setResumeMessage(result.message || '✅ Resume uploaded successfully!');
      console.log('✅ Resume upload completed');

      // Clear message after 5 seconds
      setTimeout(() => setResumeMessage(''), 5000);
      
      // Reset file input
      const fileInput = document.getElementById('resume-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error('Error uploading resume:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      setResumeMessage(`Failed to upload resume: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setResumeUploading(false);
    }
  };

  const downloadResume = async () => {
    if (!user?.id || !resumeFileName) return;
    
    try {
      const response = await fetch(`/api/download-resume?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to download resume');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resumeFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setResumeMessage('Resume downloaded successfully!');
      setTimeout(() => setResumeMessage(''), 3000);
    } catch (error) {
      console.error('Error downloading resume:', error);
      setResumeMessage('Failed to download resume. Please try again.');
    }
  };

  const deleteResume = async () => {
    if (!user?.id) return;
    
    setResumeSaving(true);
    setResumeMessage('');
    
    try {
      const supabase = createSupabaseClient();
      const { error } = await (supabase as any)
        .from('resumes')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting resume:', error);
        setResumeMessage('Failed to delete resume. Please try again.');
      } else {
        setResumeFileName('');
        setResumeFileUrl('');
        setResumeFile(null);
        setResumeMessage('Resume deleted successfully!');
        setTimeout(() => setResumeMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
      setResumeMessage('Failed to delete resume. Please try again.');
    } finally {
      setResumeSaving(false);
    }
  };

  // Load resume when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      loadResume(); // Load resume data regardless of active tab
    }
  }, [user?.id, loadResume]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?returnTo=/dashboard');
    }
  }, [loading, user, router]);

  // Don't render anything if not authenticated
  if (!loading && !user) {
    return null;
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Loading Dashboard...
          </h2>
          <p className="text-gray-600">
            Please wait while we set up your workspace.
          </p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // Resume Section Component
  const ResumeSection = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Resume
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload your resume file (PDF, DOC, DOCX). This will be used for job applications and matching.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {resumeLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading resume...</span>
            </div>
          ) : (
            <>
              {/* Current Resume Display */}
              {resumeFileName && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">{resumeFileName}</p>
                        <p className="text-sm text-gray-600">Current resume file</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {resumeFileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(resumeFileUrl, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deleteResume}
                        disabled={resumeSaving}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resume-file">
                    {resumeFileName ? 'Replace Resume File' : 'Upload Resume File'}
                  </Label>
                  <div className="flex items-center gap-4">
                    <input
                      id="resume-file"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Supported formats: PDF, DOC, DOCX (Max size: 5MB)
                  </p>
                </div>

                {resumeFile && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <span className="text-sm font-medium">{resumeFile.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        onClick={uploadResume}
                        disabled={resumeUploading}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {resumeUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {resumeMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  resumeMessage.includes('successfully') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {resumeMessage}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Upload Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Choose your resume file (PDF, DOC, or DOCX format)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>File size should be less than 5MB</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Click "Upload" to save your resume to your account</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Your resume will be used for job applications and matching</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* AI Resume Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Resume Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Get personalized feedback and practice interview questions based on your resume with our AI assistant.
            </p>
            <Button
              onClick={() => setActiveTab('context')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Analyze Resume & Start Conversation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    const activeItem = sidebarItems.find(item => item.id === activeTab);
    
    
    // Render Home section
    if (activeTab === 'home') {
      return <HomeSection />;
    }

    if (activeTab === 'browse-jobs') {
      return (
        <BrowseJobsSection
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          jobResults={jobResults}
          setJobResults={setJobResults}
          autoApplyJobLoading={autoApplyJobLoading}
          setAutoApplyJobLoading={setAutoApplyJobLoading}
          cloudApplyJobLoading={cloudApplyJobLoading}
          setCloudApplyJobLoading={setCloudApplyJobLoading}
          notifications={notifications}
          setNotifications={setNotifications}
          cloudNotifications={cloudNotifications}
          setCloudNotifications={setCloudNotifications}
        />
      );
    }

    // Render Review Applications section
    if (activeTab === 'review-applications') {
      return <ReviewApplicationsSection />;
    }

    // Render Submitted Applications section
    if (activeTab === 'submitted-applications') {
      return <SubmittedApplicationsSection />;
    }

    // Render Resume section
    if (activeTab === 'resume') {
      return <ResumeSection />;
    }


    // Render Pricing section
    if (activeTab === 'pricing') {
      return <PricingSection />;
    }
    // Render Profile section
    if (activeTab === 'profile') {
      return <ProfileEditor resumeFileName={resumeFileName} />;
    }
    
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            {activeItem && <activeItem.icon className="h-10 w-10 text-gray-400" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {activeItem?.label}
          </h2>
          <p className="text-gray-600 mb-6">
            {activeItem?.description}
          </p>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              This section is coming soon! We're working hard to bring you amazing features.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className="hidden lg:block w-80 bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900">ResumeMax</span>
            </Link>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Welcome back!
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-900'} flex items-center gap-2`}>
                      {item.label}
                      {item.id === 'browse-jobs' && isSearching && (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                          <span className="text-xs text-blue-600 font-normal">Searching...</span>
                        </div>
                      )}
                      {item.id === 'browse-jobs' && !isSearching && jobResults.length > 0 && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                          {jobResults.length} jobs
                        </Badge>
                      )}
                    </div>
                    <p className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'} truncate`}>
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                <Home className="h-4 w-4 mr-3" />
                Back to Home
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : -320
        }}
        className="fixed lg:hidden inset-y-0 left-0 z-50 w-80 bg-white shadow-xl"
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900">ResumeMax</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Welcome back!
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-900'} flex items-center gap-2`}>
                      {item.label}
                      {item.id === 'browse-jobs' && isSearching && (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                          <span className="text-xs text-blue-600 font-normal">Searching...</span>
                        </div>
                      )}
                      {item.id === 'browse-jobs' && !isSearching && jobResults.length > 0 && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                          {jobResults.length} jobs
                        </Badge>
                      )}
                    </div>
                    <p className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'} truncate`}>
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                <Home className="h-4 w-4 mr-3" />
                Back to Home
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {sidebarItems.find(item => item.id === activeTab)?.label}
                </h1>
                <p className="text-sm text-gray-600">
                  {sidebarItems.find(item => item.id === activeTab)?.description}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-8">
          {/* Gmail Connection Banner */}
          {user?.id && <GmailConnectionBanner userId={user.id} />}

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </main>

        {/* Stats Cards (shown on profile tab) */}
        {activeTab === 'profile' && (
          <div className="px-4 pb-8 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Applications Submitted</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">0</div>
                  <p className="text-xs text-gray-500">This week</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Profile Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">100%</div>
                  <p className="text-xs text-gray-500">Onboarding complete</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Jobs Matched</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <p className="text-xs text-gray-500">Waiting for jobs</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

          </div>
  );
}
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Upload, 
  FileText, 
  Target, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  Download,
  Loader2,
  ArrowRight,
  ArrowLeft,
  User,
  Briefcase,
  GraduationCap,
  FolderOpen,
  Code,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Undo2,
  Check,
  X,
  Lightbulb,
  Wand2,
  GripVertical,
  Eye
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Tab Component
function SortableTab({ id, children, isActive, onClick }: { 
  id: string; 
  children: React.ReactNode; 
  isActive: boolean; 
  onClick: () => void; 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only handle click if we're not in the middle of a drag operation
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative px-4 py-2 rounded-lg transition-all duration-200 select-none group ${
        isActive 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
      } ${isDragging ? 'z-50 shadow-lg scale-105 rotate-2' : ''}`}
      onClick={handleClick}
    >
      {/* Drag handle - only visible on hover */}
      <div
        {...listeners}
        className={`absolute left-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab ${
          isDragging ? 'cursor-grabbing opacity-70' : ''
        } ${isActive ? 'text-blue-200' : 'text-gray-400'}`}
      >
        <GripVertical className="h-3 w-3" />
      </div>
      
      {/* Tab content */}
      <div className="pl-2">
        {children}
      </div>
    </div>
  );
}

// Types for resume data
interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  state: string;
}

interface Experience {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ResumeData {
  personalInfo: PersonalInfo;
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  summary: string;
  skills: string[];
}

function TailorResumeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useAuth();
  const isFromOnboarding = searchParams.get('from') === 'onboarding';

  // Handle back to onboarding
  const handleBackToOnboarding = () => {
    router.push('/onboarding');
  };

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  
  // Resume parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [resumeData, setResumeData] = useState<ResumeData>({
    personalInfo: {
      name: "",
      email: "",
      phone: "",
      state: "",
    },
    experiences: [],
    education: [],
    projects: [],
    summary: "",
    skills: [],
  });

  // Resume editor states
  const [activeTab, setActiveTab] = useState("personal");
  const [tabOrder, setTabOrder] = useState([
    "personal",
    "summary", 
    "experience",
    "education",
    "projects",
    "skills"
  ]);

  // AI optimization states
  const [isOptimizing, setIsOptimizing] = useState<{[key: string]: boolean}>({});
  const [optimizationError, setOptimizationError] = useState<string>("");
  const [originalText, setOriginalText] = useState<{[key: string]: string}>({});
  const [recentlyOptimized, setRecentlyOptimized] = useState<{[key: string]: boolean}>({});
  const [showUndo, setShowUndo] = useState<{[key: string]: boolean}>({});

  // AI tailoring states
  const [isTailoring, setIsTailoring] = useState<{[key: string]: boolean}>({});
  const [aiSuggestions, setAiSuggestions] = useState<{[key: string]: string}>({});
  const [showSuggestions, setShowSuggestions] = useState<{[key: string]: boolean}>({});
  const [tailoringError, setTailoringError] = useState<string>("");

  // Skills management
  const [newSkill, setNewSkill] = useState("");

  // Preview and PDF states
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState("");

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for tab reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };


  const parseResume = async () => {
    if (!file) return;
    
    setIsParsing(true);
    setParseError("");
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
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
      setStep(3);
      
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
      projects: prev.projects.map(project => 
        project.id === id ? { ...project, [field]: value } : project
      )
    }));
  };

  const removeProject = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      projects: prev.projects.filter(project => project.id !== id)
    }));
  };

  // Skills handlers
  const addSkill = () => {
    if (newSkill.trim() && !resumeData.skills.includes(newSkill.trim())) {
      setResumeData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setResumeData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  // AI Tailoring function
  const tailorWithAI = async (type: 'experience' | 'summary' | 'project' | 'skills', id?: string, currentContent?: string) => {
    const tailoringKey = id ? `${type}-${id}` : type;
    setIsTailoring(prev => ({ ...prev, [tailoringKey]: true }));
    setTailoringError("");

    try {
      const response = await fetch('/api/tailor-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          content: currentContent,
          jobTitle,
          jobDescription,
          context: {
            personalInfo: resumeData.personalInfo,
            allExperiences: resumeData.experiences,
            allProjects: resumeData.projects,
            skills: resumeData.skills,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to tailor content');
      }

      const data = await response.json();
      
      // Store the AI suggestion
      setAiSuggestions(prev => ({ ...prev, [tailoringKey]: data.tailoredContent }));
      setShowSuggestions(prev => ({ ...prev, [tailoringKey]: true }));

    } catch (error) {
      setTailoringError('Failed to tailor content. Please try again.');
      console.error('AI tailoring error:', error);
    } finally {
      setIsTailoring(prev => ({ ...prev, [tailoringKey]: false }));
    }
  };

  // Accept AI suggestion
  const acceptSuggestion = (type: 'experience' | 'summary' | 'project' | 'skills', id?: string) => {
    const tailoringKey = id ? `${type}-${id}` : type;
    const suggestion = aiSuggestions[tailoringKey];
    
    if (suggestion) {
      if (type === 'experience' && id) {
        updateExperience(id, 'description', suggestion);
      } else if (type === 'summary') {
        setResumeData(prev => ({ ...prev, summary: suggestion }));
      } else if (type === 'project' && id) {
        updateProject(id, 'description', suggestion);
      } else if (type === 'skills') {
        // For skills, parse the suggestion as comma-separated values
        const newSkills = suggestion.split(',').map(skill => skill.trim()).filter(skill => skill);
        setResumeData(prev => ({ ...prev, skills: newSkills }));
      }

      // Hide suggestion after accepting
      setShowSuggestions(prev => ({ ...prev, [tailoringKey]: false }));
      setAiSuggestions(prev => {
        const newState = { ...prev };
        delete newState[tailoringKey];
        return newState;
      });
      
      // Show green highlight for accepted suggestions
      setRecentlyOptimized(prev => ({ ...prev, [tailoringKey]: true }));
      setTimeout(() => {
        setRecentlyOptimized(prev => ({ ...prev, [tailoringKey]: false }));
      }, 2000);
    }
  };

  // Deny AI suggestion
  const denySuggestion = (type: 'experience' | 'summary' | 'project' | 'skills', id?: string) => {
    const tailoringKey = id ? `${type}-${id}` : type;
    setShowSuggestions(prev => ({ ...prev, [tailoringKey]: false }));
    setAiSuggestions(prev => {
      const newState = { ...prev };
      delete newState[tailoringKey];
      return newState;
    });
  };

  // Generate and download PDF
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    setPdfError("");

    try {
      // Validate required data
      const hasBasicInfo = resumeData.personalInfo.name.trim() && resumeData.personalInfo.email.trim();
      const hasContent = resumeData.experiences.length > 0 || resumeData.education.length > 0 || resumeData.skills.length > 0;

      if (!hasBasicInfo) {
        setPdfError('Please fill in at least your name and email to generate a PDF.');
        return;
      }

      if (!hasContent) {
        setPdfError('Please add some experience, education, or skills to generate a meaningful resume PDF.');
        return;
      }

      // Check authentication
      if (!session?.access_token) {
        setPdfError('Please log in to download PDFs.');
        return;
      }

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          personalInfo: resumeData.personalInfo,
          experiences: resumeData.experiences,
          education: resumeData.education,
          projects: resumeData.projects,
          skills: resumeData.skills,
          summary: resumeData.summary,
          sectionOrder: tabOrder.filter(tab => tab !== 'personal'), // Exclude personal info from section order
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle subscription-related errors
        if (errorData.requiresUpgrade) {
          const returnTo = `${window.location.pathname}`;
          router.push(`/pricing?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resumeData.personalInfo.name.replace(/\s+/g, '_')}_Tailored_Resume.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.');
      console.error('PDF generation error:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Handle Tailor with AI button click
  const handleTailorWithAI = async () => {
    if (!file) return;
    
    setIsParsing(true);
    
    try {
      await parseResume();
      setStep(4); // Navigate to edit step after parsing is complete
    } catch (error) {
      console.error('Failed to parse resume for tailoring:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse resume');
    } finally {
      setIsParsing(false);
    }
  };

  // Handle Skip Analysis - go directly to tailoring
  const handleSkipAnalysis = async () => {
    if (!file) return;
    
    setIsParsing(true);
    
    try {
      await parseResume();
      setStep(4); // Navigate directly to edit step, skipping analysis
    } catch (error) {
      console.error('Failed to parse resume for tailoring:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse resume');
    } finally {
      setIsParsing(false);
    }
  };

  // Analyze resume function
  const analyzeResume = async () => {
    if (!file) return;
    
    setIsAnalyzing(true);
    setAnalysisError("");
    
    try {
      // First parse the resume to get both text and structured data
      const formData = new FormData();
      formData.append('file', file);
      
      const parseResponse = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      });
      
      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Failed to parse resume');
      }
      
      const parseResult = await parseResponse.json();
      
      // Transform the parsed data to match our ResumeData interface
      const transformedData: ResumeData = {
        personalInfo: parseResult.data.personalInfo,
        experiences: parseResult.data.experiences.map((exp: any, index: number) => ({
          ...exp,
          id: `exp-${index}-${Date.now()}`
        })),
        education: parseResult.data.education.map((edu: any, index: number) => ({
          ...edu,
          id: `edu-${index}-${Date.now()}`
        })),
        projects: parseResult.data.projects.map((proj: any, index: number) => ({
          ...proj,
          id: `proj-${index}-${Date.now()}`
        })),
        summary: parseResult.data.summary,
        skills: parseResult.data.skills,
      };
      
      // Store the parsed resume data for the edit step
      setResumeData(transformedData);
      
      // Use the raw text for analysis
      const resumeText = parseResult.rawText;
      
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
      setAnalysisResults(result.analysis);
      setStep(3); // Move to analysis step
      
    } catch (error) {
      console.error('Resume analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze resume');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Simulate analysis process
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      setStep(4);
    }, 3000);
  };

  const steps = [
    { number: 1, title: "Upload Resume", description: "Upload your current resume" },
    { number: 2, title: "Job Details", description: "Provide target job information" },
    { number: 3, title: "Analysis", description: "AI-powered resume analysis and scoring" },
    { number: 4, title: "Edit Resume", description: "Review and edit with AI recommendations" }
  ];

  // Resume Preview Component
  const ResumePreview = () => {
    const sectionsToRender = tabOrder.filter(tab => tab !== 'personal');
    
    const renderBulletPoints = (text: string) => {
      if (!text.trim()) return null;
      
      const lines = text.split('\n').filter(line => line.trim());
      return (
        <ul className="list-disc list-inside space-y-1 text-sm">
          {lines.map((line, index) => (
            <li key={index} className="text-gray-700">
              {line.replace(/^[-•*]\s*/, '').trim()}
            </li>
          ))}
        </ul>
      );
    };

    const sectionComponents = {
      summary: () => resumeData.summary.trim() && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">
            PROFESSIONAL SUMMARY
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            {resumeData.summary}
          </p>
        </div>
      ),

      experience: () => resumeData.experiences.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">
            PROFESSIONAL EXPERIENCE
          </h3>
          <div className="space-y-4">
            {resumeData.experiences.map((exp) => (
              <div key={exp.id}>
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-base text-gray-900">{exp.position}</h4>
                  <span className="text-sm text-gray-600">
                    {exp.company} | {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                <p className="text-sm text-gray-600 italic mb-2">{exp.location}</p>
                {renderBulletPoints(exp.description)}
              </div>
            ))}
          </div>
        </div>
      ),

      education: () => resumeData.education.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">
            EDUCATION
          </h3>
          <div className="space-y-3">
            {resumeData.education.map((edu) => (
              <div key={edu.id}>
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-base text-gray-900">{edu.degree}</h4>
                  <span className="text-sm text-gray-600">
                    {edu.startDate} - {edu.current ? 'Present' : edu.endDate}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{edu.school}</p>
              </div>
            ))}
          </div>
        </div>
      ),

      projects: () => resumeData.projects.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">
            PROJECTS
          </h3>
          <div className="space-y-4">
            {resumeData.projects.map((project) => (
              <div key={project.id}>
                <h4 className="font-bold text-base text-gray-900 mb-2">{project.name}</h4>
                {renderBulletPoints(project.description)}
              </div>
            ))}
          </div>
        </div>
      ),

      skills: () => resumeData.skills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">
            SKILLS
          </h3>
          <p className="text-sm text-gray-700">
            {resumeData.skills.join(' • ')}
          </p>
        </div>
      )
    };

    return (
      <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="text-center mb-6 border-b border-gray-400 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {resumeData.personalInfo.name || 'Your Name'}
          </h1>
          <p className="text-sm text-gray-700">
            {[
              resumeData.personalInfo.email,
              resumeData.personalInfo.phone,
              resumeData.personalInfo.state
            ].filter(Boolean).join(' | ')}
          </p>
        </div>

        {/* Dynamic Sections */}
        {sectionsToRender.map(sectionId => {
          const component = sectionComponents[sectionId as keyof typeof sectionComponents];
          return component ? <div key={sectionId}>{component()}</div> : null;
        })}
      </div>
    );
  };

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
            <Target className="mr-1 h-3 w-3" />
            Resume Optimization
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tailor Your Resume
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Optimize your existing resume for specific job opportunities with AI-powered analysis and recommendations.
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
                    <Button onClick={() => setStep(2)} className="flex items-center gap-2">
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
                  Provide details about the job you're targeting for personalized optimization.
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
                    placeholder="Paste the job description here for more accurate optimization..."
                    rows={8}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Including the job description helps us optimize your resume for specific requirements and keywords.
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <div className="flex gap-3">
                  <Button 
                      variant="outline"
                      onClick={handleSkipAnalysis}
                      disabled={!jobTitle.trim() || isParsing || isAnalyzing}
                    className="flex items-center gap-2"
                  >
                      {isParsing ? (
                        <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4" />
                          Skip Analysis
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={analyzeResume}
                      disabled={!jobTitle.trim() || isAnalyzing || isParsing}
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
                  
                {/* Navigation */}
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                      <Button 
                        onClick={handleTailorWithAI}
                        disabled={isParsing}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isParsing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Preparing Resume...
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-4 w-4" />
                            Tailor with AI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
            ) : null}
          </motion.div>
        )}

        {/* Step 4: Resume Editor */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
              <Card className="mb-8">
                  <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Edit Your Resume
                    </CardTitle>
                    <CardDescription>
                  Review and edit the extracted resume data. Make any necessary corrections before analysis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="mb-6">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
                        <div className="flex gap-2 p-2 bg-gray-50 rounded-lg overflow-x-auto">
                          {tabOrder.map((tabId) => {
                            const tabConfig = {
                              personal: { icon: User, label: "Personal" },
                              experience: { icon: Briefcase, label: "Experience" },
                              education: { icon: GraduationCap, label: "Education" },
                              projects: { icon: FolderOpen, label: "Projects" },
                              summary: { icon: FileText, label: "Summary" },
                              skills: { icon: Code, label: "Skills" },
                            }[tabId];

                            if (!tabConfig) return null;

                            const Icon = tabConfig.icon;

                            return (
                              <SortableTab
                                key={tabId}
                                id={tabId}
                                isActive={activeTab === tabId}
                                onClick={() => setActiveTab(tabId)}
                              >
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                  <Icon className="h-4 w-4" />
                                  <span className="hidden sm:inline">{tabConfig.label}</span>
                                </div>
                              </SortableTab>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      💡 Click tabs to switch sections • Hover and drag the grip icon to reorder sections
                    </p>
                  </div>

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
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Professional Summary
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => tailorWithAI('summary', undefined, resumeData.summary)}
                          disabled={!resumeData.summary.trim() || !jobTitle.trim() || isTailoring['summary']}
                          className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                        >
                          {isTailoring['summary'] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3" />
                          )}
                          AI Tailor
                        </Button>
                      </div>

                      <div className="relative">
                        {/* Original Content with red highlight when suggestion is shown */}
                        <motion.div
                          animate={{
                            backgroundColor: showSuggestions['summary'] 
                              ? 'rgb(254, 226, 226)' // light red
                              : recentlyOptimized['summary']
                              ? 'rgb(220, 252, 231)' // light green
                              : 'transparent'
                          }}
                          transition={{ duration: 0.3 }}
                          className="rounded-md"
                        >
                    <Textarea
                            placeholder="I am an experienced professional with expertise in..."
                            rows={6}
                            value={resumeData.summary}
                            onChange={(e) => {
                              setResumeData(prev => ({ ...prev, summary: e.target.value }));
                              // Hide suggestions when user manually edits
                              if (showSuggestions['summary']) {
                                setShowSuggestions(prev => ({ ...prev, 'summary': false }));
                              }
                            }}
                            className={`transition-all duration-300 ${
                              showSuggestions['summary'] 
                                ? 'border-red-300' 
                                : recentlyOptimized['summary']
                                ? 'border-green-300'
                                : ''
                            }`}
                          />
                        </motion.div>

                        {/* AI Suggestion - Cursor Style */}
                        {showSuggestions['summary'] && aiSuggestions['summary'] && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.3 }}
                            className="mt-4 border border-green-300 rounded-md bg-green-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Wand2 className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-800">AI Tailored Summary</span>
                  </div>
                                <div className="text-sm text-green-700 whitespace-pre-wrap bg-white p-3 rounded border border-green-200">
                                  {aiSuggestions['summary']}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => acceptSuggestion('summary')}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                  title="Accept suggestion"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => denySuggestion('summary')}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                  title="Reject suggestion"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Loading indicator for tailoring */}
                        {isTailoring['summary'] && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md"
                          >
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                              <span className="text-sm text-blue-700">AI is tailoring your summary for "{jobTitle}"...</span>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-1">
                        Keep it concise (2-4 sentences) and focus on your most relevant achievements
                      </p>
                    </div>
                  </TabsContent>

                  {/* Experience Tab */}
                  <TabsContent value="experience" className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold">Work Experience</h3>
                        <p className="text-sm text-gray-600">Review and edit your professional experience</p>
                      </div>
                      <Button onClick={addExperience} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add Experience
                    </Button>
                    </div>

                    {resumeData.experiences.length === 0 ? (
                      <div className="text-center py-8">
                        <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No work experience found. Click "Add Experience" to add one.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {resumeData.experiences.map((experience, index) => (
                          <Card key={experience.id}>
                            <CardHeader>
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-lg">Experience #{index + 1}</CardTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeExperience(experience.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Company Name *
                                  </label>
                                  <Input
                                    placeholder="Tech Corp"
                                    value={experience.company}
                                    onChange={(e) => updateExperience(experience.id, 'company', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Position *
                                  </label>
                                  <Input
                                    placeholder="Software Engineer"
                                    value={experience.position}
                                    onChange={(e) => updateExperience(experience.id, 'position', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Location
                                  </label>
                                  <Input
                                    placeholder="San Francisco, CA"
                                    value={experience.location}
                                    onChange={(e) => updateExperience(experience.id, 'location', e.target.value)}
                                  />
                                </div>
                    <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Start Date *
                                    </label>
                                    <Input
                                      type="month"
                                      value={experience.startDate}
                                      onChange={(e) => updateExperience(experience.id, 'startDate', e.target.value)}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      End Date
                                    </label>
                                    <Input
                                      type="month"
                                      value={experience.endDate}
                                      onChange={(e) => updateExperience(experience.id, 'endDate', e.target.value)}
                                      disabled={experience.current}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`current-${experience.id}`}
                                  checked={experience.current}
                                  onChange={(e) => updateExperience(experience.id, 'current', e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <label htmlFor={`current-${experience.id}`} className="text-sm text-gray-700">
                                  I currently work here
                                </label>
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <label className="block text-sm font-medium text-gray-700">
                                    Description of Tasks Completed *
                                  </label>
                      <Button 
                        variant="outline"
                                    size="sm"
                                    onClick={() => tailorWithAI('experience', experience.id, experience.description)}
                                    disabled={!experience.description.trim() || !jobTitle.trim() || isTailoring[`experience-${experience.id}`]}
                                    className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                                  >
                                    {isTailoring[`experience-${experience.id}`] ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Wand2 className="h-3 w-3" />
                                    )}
                                    AI Tailor
                                  </Button>
                                </div>

                                <div className="relative">
                                  {/* Original Content with red highlight when suggestion is shown */}
                                  <motion.div
                                    animate={{
                                      backgroundColor: showSuggestions[`experience-${experience.id}`] 
                                        ? 'rgb(254, 226, 226)' // light red
                                        : recentlyOptimized[`experience-${experience.id}`]
                                        ? 'rgb(220, 252, 231)' // light green
                                        : 'transparent'
                                    }}
                                    transition={{ duration: 0.3 }}
                                    className="rounded-md"
                                  >
                                    <Textarea
                                      placeholder="• Led development of microservices architecture&#10;• Improved application performance by 40%&#10;• Mentored 3 junior developers"
                                      rows={4}
                                      value={experience.description}
                                      onChange={(e) => {
                                        updateExperience(experience.id, 'description', e.target.value);
                                        // Hide suggestions when user manually edits
                                        if (showSuggestions[`experience-${experience.id}`]) {
                                          setShowSuggestions(prev => ({ ...prev, [`experience-${experience.id}`]: false }));
                                        }
                                      }}
                                      className={`transition-all duration-300 ${
                                        showSuggestions[`experience-${experience.id}`] 
                                          ? 'border-red-300' 
                                          : recentlyOptimized[`experience-${experience.id}`]
                                          ? 'border-green-300'
                                          : ''
                                      }`}
                                    />
                                  </motion.div>

                                  {/* AI Suggestion - Cursor Style */}
                                  {showSuggestions[`experience-${experience.id}`] && aiSuggestions[`experience-${experience.id}`] && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 10 }}
                                      transition={{ duration: 0.3 }}
                                      className="mt-4 border border-green-300 rounded-md bg-green-50 p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Wand2 className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-800">AI Tailored Experience</span>
                                          </div>
                                          <div className="text-sm text-green-700 whitespace-pre-wrap bg-white p-3 rounded border border-green-200">
                                            {aiSuggestions[`experience-${experience.id}`]}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => acceptSuggestion('experience', experience.id)}
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                            title="Accept suggestion"
                                          >
                                            <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => denySuggestion('experience', experience.id)}
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                            title="Reject suggestion"
                                          >
                                            <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
          </motion.div>
        )}

                                  {/* Loading indicator for tailoring */}
                                  {isTailoring[`experience-${experience.id}`] && (
          <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md"
                                    >
                          <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                        <span className="text-sm text-blue-700">AI is tailoring this experience for "{jobTitle}"...</span>
                          </div>
                                    </motion.div>
                                  )}
                        </div>
                        
                                <p className="text-xs text-gray-500 mt-1">
                                  Use bullet points to describe your achievements and responsibilities
                                </p>
                              </div>
                </CardContent>
              </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Education Tab */}
                  <TabsContent value="education" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                        <h3 className="text-lg font-semibold">Education</h3>
                        <p className="text-sm text-gray-600">Review and edit your educational background</p>
                      </div>
                      <Button onClick={addEducation} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add Education
                      </Button>
                    </div>

                    {resumeData.education.length === 0 ? (
                      <div className="text-center py-8">
                        <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No education found. Click "Add Education" to add one.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {resumeData.education.map((edu, index) => (
                          <Card key={edu.id}>
                  <CardHeader>
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-lg">Education #{index + 1}</CardTitle>
                      <Button 
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeEducation(edu.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                  </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    School/University *
                                  </label>
                                  <Input
                                    placeholder="University of Technology"
                                    value={edu.school}
                                    onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Degree *
                                  </label>
                                  <Input
                                    placeholder="Bachelor of Science in Computer Science"
                                    value={edu.degree}
                                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date
                                  </label>
                                  <Input
                                    type="month"
                                    value={edu.startDate}
                                    onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date
                                  </label>
                                  <Input
                                    type="month"
                                    value={edu.endDate}
                                    onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                                    disabled={edu.current}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`current-edu-${edu.id}`}
                                  checked={edu.current}
                                  onChange={(e) => updateEducation(edu.id, 'current', e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <label htmlFor={`current-edu-${edu.id}`} className="text-sm text-gray-700">
                                  Currently studying here
                                </label>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Projects Tab */}
                  <TabsContent value="projects" className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold">Projects</h3>
                        <p className="text-sm text-gray-600">Review and edit your notable projects</p>
                      </div>
                      <Button onClick={addProject} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add Project
                      </Button>
                    </div>

                    {resumeData.projects.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No projects found. Click "Add Project" to add one.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {resumeData.projects.map((project, index) => (
                          <Card key={project.id}>
                            <CardHeader>
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-lg">Project #{index + 1}</CardTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeProject(project.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                        <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Project Name *
                                </label>
                                <Input
                                  placeholder="E-commerce Platform"
                                  value={project.name}
                                  onChange={(e) => updateProject(project.id, 'name', e.target.value)}
                    />
                  </div>
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <label className="block text-sm font-medium text-gray-700">
                                    Project Description *
                                  </label>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => tailorWithAI('project', project.id, project.description)}
                                    disabled={!project.description.trim() || !jobTitle.trim() || isTailoring[`project-${project.id}`]}
                                    className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                                  >
                                    {isTailoring[`project-${project.id}`] ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Wand2 className="h-3 w-3" />
                                    )}
                                    AI Tailor
                                  </Button>
                                </div>

                                <div className="relative">
                                  {/* Original Content with red highlight when suggestion is shown */}
                                  <motion.div
                                    animate={{
                                      backgroundColor: showSuggestions[`project-${project.id}`] 
                                        ? 'rgb(254, 226, 226)' // light red
                                        : recentlyOptimized[`project-${project.id}`]
                                        ? 'rgb(220, 252, 231)' // light green
                                        : 'transparent'
                                    }}
                                    transition={{ duration: 0.3 }}
                                    className="rounded-md"
                                  >
                                    <Textarea
                                      placeholder="Built a full-stack e-commerce platform using React and Node.js..."
                                      rows={4}
                                      value={project.description}
                                      onChange={(e) => {
                                        updateProject(project.id, 'description', e.target.value);
                                        // Hide suggestions when user manually edits
                                        if (showSuggestions[`project-${project.id}`]) {
                                          setShowSuggestions(prev => ({ ...prev, [`project-${project.id}`]: false }));
                                        }
                                      }}
                                      className={`transition-all duration-300 ${
                                        showSuggestions[`project-${project.id}`] 
                                          ? 'border-red-300' 
                                          : recentlyOptimized[`project-${project.id}`]
                                          ? 'border-green-300'
                                          : ''
                                      }`}
                                    />
                                  </motion.div>

                                  {/* AI Suggestion - Cursor Style */}
                                  {showSuggestions[`project-${project.id}`] && aiSuggestions[`project-${project.id}`] && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 10 }}
                                      transition={{ duration: 0.3 }}
                                      className="mt-4 border border-green-300 rounded-md bg-green-50 p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Wand2 className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-800">AI Tailored Project</span>
                                          </div>
                                          <div className="text-sm text-green-700 whitespace-pre-wrap bg-white p-3 rounded border border-green-200">
                                            {aiSuggestions[`project-${project.id}`]}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => acceptSuggestion('project', project.id)}
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                            title="Accept suggestion"
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => denySuggestion('project', project.id)}
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                            title="Reject suggestion"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}

                                  {/* Loading indicator for tailoring */}
                                  {isTailoring[`project-${project.id}`] && (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md"
                                    >
                          <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                        <span className="text-sm text-blue-700">AI is tailoring this project for "{jobTitle}"...</span>
                          </div>
                                    </motion.div>
                                  )}
                        </div>
                        
                                <p className="text-xs text-gray-500 mt-1">
                                  Describe the project, technologies used, and key achievements
                                </p>
                      </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Skills Tab */}
                  <TabsContent value="skills" className="space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                        <h3 className="text-lg font-semibold">Skills</h3>
                        <p className="text-sm text-gray-600">Review and edit your technical and professional skills</p>
                          </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => tailorWithAI('skills', undefined, resumeData.skills.join(', '))}
                        disabled={resumeData.skills.length === 0 || !jobTitle.trim() || isTailoring['skills']}
                        className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                      >
                        {isTailoring['skills'] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        AI Tailor Skills
                      </Button>
                        </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter a skill (e.g., JavaScript, Project Management)"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1"
                      />
                      <Button onClick={addSkill} disabled={!newSkill.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      </div>

                    {/* AI Suggestion for Skills */}
                    {showSuggestions['skills'] && aiSuggestions['skills'] && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.3 }}
                        className="border border-green-300 rounded-md bg-green-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Wand2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">AI Tailored Skills</span>
                      </div>
                            <div className="text-sm text-green-700 bg-white p-3 rounded border border-green-200">
                              <div className="flex flex-wrap gap-2">
                                {aiSuggestions['skills'].split(',').map((skill, index) => (
                                  <Badge key={index} variant="outline" className="border-green-300 text-green-700">
                                    {skill.trim()}
                                  </Badge>
                                ))}
                    </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => acceptSuggestion('skills')}
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                              title="Accept suggestion"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => denySuggestion('skills')}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              title="Reject suggestion"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Loading indicator for skills tailoring */}
                    {isTailoring['skills'] && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 bg-blue-50 border border-blue-200 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                          <span className="text-sm text-blue-700">AI is tailoring your skills for "{jobTitle}"...</span>
                        </div>
                      </motion.div>
                    )}

                    {resumeData.skills.length > 0 ? (
                      <motion.div
                        animate={{
                          backgroundColor: showSuggestions['skills'] 
                            ? 'rgb(254, 226, 226)' // light red
                            : recentlyOptimized['skills']
                            ? 'rgb(220, 252, 231)' // light green
                            : 'transparent'
                        }}
                        transition={{ duration: 0.3 }}
                        className="rounded-md p-3"
                      >
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Your Skills:</h4>
                        <div className="flex flex-wrap gap-2">
                          {resumeData.skills.map((skill, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="flex items-center gap-1 px-3 py-1"
                            >
                              {skill}
                              <button
                                onClick={() => removeSkill(skill)}
                                className="ml-1 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <div className="text-center py-8">
                        <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No skills found. Start typing to add your first skill.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <Separator className="my-6" />

                {/* Tailoring Error Display */}
                {tailoringError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-md"
                  >
                    <p className="text-sm text-red-600">{tailoringError}</p>
                  </motion.div>
                )}

                {/* PDF Error Display */}
                {pdfError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-md"
                  >
                    <p className="text-sm text-red-600">{pdfError}</p>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  
                  <div className="flex gap-3">
                    {/* Preview Button */}
                    <Dialog open={showPreview} onOpenChange={setShowPreview}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Preview Resume
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Tailored Resume Preview</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          <ResumePreview />
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Download PDF Button */}
                    <Button 
                      variant="outline"
                      onClick={generatePDF}
                      disabled={isGeneratingPDF}
                      className="flex items-center gap-2"
                    >
                      {isGeneratingPDF ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
                      </Button>

                  </div>
                    </div>
                  </CardContent>
                </Card>
          </motion.div>
        )}

      </div>
    </div>
  );
}

function TailorResumeLoading() {
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Target className="mr-1 h-3 w-3" />
            Tailor Resume
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tailor Your Resume
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Loading...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TailorResumePage() {
  return (
    <Suspense fallback={<TailorResumeLoading />}>
      <TailorResumeContent />
    </Suspense>
  );
}

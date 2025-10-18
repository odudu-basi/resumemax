"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  User, 
  Briefcase, 
  GraduationCap, 
  FileText, 
  Code, 
  Plus, 
  Trash2, 
  Download,
  Eye,
  FolderOpen,
  Sparkles,
  Loader2,
  Undo2,
  Check,
  X,
  Lightbulb,
  Wand2,
  ChevronLeft,
  ChevronRight
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${isDragging ? 'z-50' : ''}`}
      onClick={onClick}
    >
      {children}
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

export default function CreateResumePage() {
  const [activeTab, setActiveTab] = useState("personal");
  
  // Tab order state for drag and drop
  const [tabOrder, setTabOrder] = useState([
    "personal",
    "summary", 
    "experience",
    "education",
    "projects",
    "skills"
  ]);
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

  // AI optimization states
  const [isOptimizing, setIsOptimizing] = useState<{[key: string]: boolean}>({});
  const [optimizationError, setOptimizationError] = useState<string>("");
  const [originalText, setOriginalText] = useState<{[key: string]: string}>({});
  const [recentlyOptimized, setRecentlyOptimized] = useState<{[key: string]: boolean}>({});
  const [showUndo, setShowUndo] = useState<{[key: string]: boolean}>({});

  // AI recommendations states
  const [recommendations, setRecommendations] = useState<{[key: string]: string[]}>({});
  const [showRecommendations, setShowRecommendations] = useState<{[key: string]: boolean}>({});
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState<{[key: string]: boolean}>({});
  const [recommendationError, setRecommendationError] = useState<string>("");

  // Generate summary states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [generateSummaryError, setGenerateSummaryError] = useState<string>("");

  // Skill recommendations states
  const [recommendedSkills, setRecommendedSkills] = useState<string[]>([]);
  const [showRecommendedSkills, setShowRecommendedSkills] = useState<boolean>(false);
  const [isGeneratingSkillRecommendations, setIsGeneratingSkillRecommendations] = useState<boolean>(false);
  const [skillRecommendationError, setSkillRecommendationError] = useState<string>("");

  // PDF generation states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string>("");

  // Preview states
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
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
    setResumeData(prev => {
      const newData = {
        ...prev,
        experiences: prev.experiences.map(exp => 
          exp.id === id ? { ...exp, [field]: value } : exp
        )
      };

      // Check if we should generate recommendations after updating
      if (field === 'company' || field === 'position') {
        const updatedExp = newData.experiences.find(exp => exp.id === id);
        if (updatedExp) {
          // Use setTimeout to ensure state is updated first
          setTimeout(() => {
            checkAndGenerateRecommendations('experience', id, updatedExp.position, updatedExp.company, updatedExp.description);
          }, 100);
        }
      }

      return newData;
    });
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
    setResumeData(prev => {
      const newData = {
        ...prev,
        projects: prev.projects.map(project => 
          project.id === id ? { ...project, [field]: value } : project
        )
      };

      // Check if we should generate recommendations after updating
      if (field === 'name') {
        const updatedProject = newData.projects.find(proj => proj.id === id);
        if (updatedProject) {
          // Use setTimeout to ensure state is updated first
          setTimeout(() => {
            // For projects, we use the project name as both position and company context
            checkAndGenerateRecommendations('project', id, updatedProject.name, 'Project', updatedProject.description);
          }, 100);
        }
      }

      return newData;
    });
  };

  const removeProject = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      projects: prev.projects.filter(project => project.id !== id)
    }));
  };

  // AI Optimization function
  const optimizeWithAI = async (type: 'experience' | 'summary' | 'project', id?: string, currentText?: string) => {
    const optimizationKey = id ? `${type}-${id}` : type;
    setIsOptimizing(prev => ({ ...prev, [optimizationKey]: true }));
    setOptimizationError("");

    // Store original text for undo functionality
    if (currentText) {
      setOriginalText(prev => ({ ...prev, [optimizationKey]: currentText }));
    }

    try {
      const response = await fetch('/api/optimize-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          text: currentText,
          context: {
            personalInfo: resumeData.personalInfo,
            allExperiences: resumeData.experiences,
            allProjects: resumeData.projects,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize text');
      }

      const data = await response.json();
      
      // Update the appropriate field with optimized text
      if (type === 'experience' && id) {
        updateExperience(id, 'description', data.optimizedText);
      } else if (type === 'summary') {
        setResumeData(prev => ({ ...prev, summary: data.optimizedText }));
      } else if (type === 'project' && id) {
        updateProject(id, 'description', data.optimizedText);
      }

      // Trigger highlight animation and show undo button
      setRecentlyOptimized(prev => ({ ...prev, [optimizationKey]: true }));
      setShowUndo(prev => ({ ...prev, [optimizationKey]: true }));

      // Remove highlight after animation
      setTimeout(() => {
        setRecentlyOptimized(prev => ({ ...prev, [optimizationKey]: false }));
      }, 2000);

    } catch (error) {
      setOptimizationError('Failed to optimize text. Please try again.');
      console.error('AI optimization error:', error);
    } finally {
      setIsOptimizing(prev => ({ ...prev, [optimizationKey]: false }));
    }
  };

  // Undo AI optimization
  const undoOptimization = (type: 'experience' | 'summary' | 'project', id?: string) => {
    const optimizationKey = id ? `${type}-${id}` : type;
    const original = originalText[optimizationKey];
    
    if (original) {
      // Restore original text
      if (type === 'experience' && id) {
        updateExperience(id, 'description', original);
      } else if (type === 'summary') {
        setResumeData(prev => ({ ...prev, summary: original }));
      } else if (type === 'project' && id) {
        updateProject(id, 'description', original);
      }

      // Hide undo button and clear original text
      setShowUndo(prev => ({ ...prev, [optimizationKey]: false }));
      setOriginalText(prev => {
        const newState = { ...prev };
        delete newState[optimizationKey];
        return newState;
      });
    }
  };

  // AI Recommendations function
  const generateRecommendations = async (type: 'experience' | 'project', id: string, position: string, company: string) => {
    const recommendationKey = `${type}-${id}`;
    setIsGeneratingRecommendations(prev => ({ ...prev, [recommendationKey]: true }));
    setRecommendationError("");

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position,
          company,
          type,
          context: {
            industry: 'Technology', // Could be inferred from company or user input
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendations');
      }

      const data = await response.json();
      
      // Store recommendations and show them
      setRecommendations(prev => ({ ...prev, [recommendationKey]: data.recommendations }));
      setShowRecommendations(prev => ({ ...prev, [recommendationKey]: true }));

    } catch (error) {
      setRecommendationError('Failed to generate recommendations. Please try again.');
      console.error('AI recommendations error:', error);
    } finally {
      setIsGeneratingRecommendations(prev => ({ ...prev, [recommendationKey]: false }));
    }
  };

  // Accept recommendations
  const acceptRecommendations = (type: 'experience' | 'project', id: string) => {
    const recommendationKey = `${type}-${id}`;
    const recs = recommendations[recommendationKey];
    
    if (recs && recs.length > 0) {
      const bulletPoints = recs.map(rec => `• ${rec}`).join('\n');
      
      if (type === 'experience') {
        updateExperience(id, 'description', bulletPoints);
      } else if (type === 'project') {
        updateProject(id, 'description', bulletPoints);
      }

      // Hide recommendations after accepting
      setShowRecommendations(prev => ({ ...prev, [recommendationKey]: false }));
      
      // Show green highlight for accepted recommendations
      setRecentlyOptimized(prev => ({ ...prev, [recommendationKey]: true }));
      setTimeout(() => {
        setRecentlyOptimized(prev => ({ ...prev, [recommendationKey]: false }));
      }, 2000);
    }
  };

  // Deny recommendations
  const denyRecommendations = (type: 'experience' | 'project', id: string) => {
    const recommendationKey = `${type}-${id}`;
    setShowRecommendations(prev => ({ ...prev, [recommendationKey]: false }));
    setRecommendations(prev => {
      const newState = { ...prev };
      delete newState[recommendationKey];
      return newState;
    });
  };

  // Auto-trigger recommendations when position and company are filled
  const checkAndGenerateRecommendations = (type: 'experience' | 'project', id: string, position: string, company: string, description: string) => {
    const recommendationKey = `${type}-${id}`;
    
    // Only generate if both position and company are filled, description is empty, and not already showing recommendations
    if (position.trim() && company.trim() && !description.trim() && !showRecommendations[recommendationKey] && !isGeneratingRecommendations[recommendationKey]) {
      // Small delay to avoid too many API calls
      setTimeout(() => {
        generateRecommendations(type, id, position, company);
      }, 500);
    }
  };

  // Generate Professional Summary function
  const generateProfessionalSummary = async () => {
    setIsGeneratingSummary(true);
    setGenerateSummaryError("");

    try {
      // Check if user has enough data
      const hasExperience = resumeData.experiences.length > 0;
      const hasEducation = resumeData.education.length > 0;
      const hasSkills = resumeData.skills.length > 0;
      const hasProjects = resumeData.projects.length > 0;

      if (!hasExperience && !hasEducation && !hasSkills && !hasProjects) {
        setGenerateSummaryError('Please add some experience, education, skills, or projects first to generate a professional summary.');
        return;
      }

      // Store original summary for undo functionality
      if (resumeData.summary.trim()) {
        setOriginalText(prev => ({ ...prev, 'summary': resumeData.summary }));
      }

      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalInfo: resumeData.personalInfo,
          experiences: resumeData.experiences,
          education: resumeData.education,
          projects: resumeData.projects,
          skills: resumeData.skills,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate professional summary');
      }

      const data = await response.json();
      
      // Update the summary with generated content
      setResumeData(prev => ({ ...prev, summary: data.summary }));

      // Show green highlight for generated summary
      setRecentlyOptimized(prev => ({ ...prev, 'summary': true }));
      setShowUndo(prev => ({ ...prev, 'summary': true }));

      // Remove highlight after animation
      setTimeout(() => {
        setRecentlyOptimized(prev => ({ ...prev, 'summary': false }));
      }, 2000);

    } catch (error) {
      setGenerateSummaryError(error instanceof Error ? error.message : 'Failed to generate professional summary. Please try again.');
      console.error('Generate summary error:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Skills handlers
  const [newSkill, setNewSkill] = useState("");

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

  // Generate Skill Recommendations function
  const generateSkillRecommendations = async () => {
    setIsGeneratingSkillRecommendations(true);
    setSkillRecommendationError("");

    try {
      // Check if user has enough data
      const hasExperience = resumeData.experiences.length > 0;
      const hasEducation = resumeData.education.length > 0;
      const hasProjects = resumeData.projects.length > 0;

      if (!hasExperience && !hasEducation && !hasProjects) {
        setSkillRecommendationError('Please add some experience, education, or projects first to get skill recommendations.');
        return;
      }

      const response = await fetch('/api/recommend-skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          experiences: resumeData.experiences,
          education: resumeData.education,
          projects: resumeData.projects,
          existingSkills: resumeData.skills,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate skill recommendations');
      }

      const data = await response.json();
      
      // Store recommendations and show them
      setRecommendedSkills(data.skills);
      setShowRecommendedSkills(true);

    } catch (error) {
      setSkillRecommendationError(error instanceof Error ? error.message : 'Failed to generate skill recommendations. Please try again.');
      console.error('Generate skill recommendations error:', error);
    } finally {
      setIsGeneratingSkillRecommendations(false);
    }
  };

  // Accept recommended skill
  const acceptRecommendedSkill = (skill: string) => {
    // Add skill to the user's skills
    if (!resumeData.skills.includes(skill)) {
      setResumeData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    }
    
    // Remove from recommended skills
    setRecommendedSkills(prev => prev.filter(s => s !== skill));
    
    // Hide recommendations if no more skills left
    if (recommendedSkills.length <= 1) {
      setShowRecommendedSkills(false);
    }
  };

  // Deny recommended skill
  const denyRecommendedSkill = (skill: string) => {
    // Remove from recommended skills
    setRecommendedSkills(prev => prev.filter(s => s !== skill));
    
    // Hide recommendations if no more skills left
    if (recommendedSkills.length <= 1) {
      setShowRecommendedSkills(false);
    }
  };

  // Clear all skill recommendations
  const clearSkillRecommendations = () => {
    setRecommendedSkills([]);
    setShowRecommendedSkills(false);
    setSkillRecommendationError("");
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

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resumeData.personalInfo.name.replace(/\s+/g, '_')}_Resume.pdf`;
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Create Your Resume
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Build a professional resume step by step with our easy-to-use builder
          </p>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview Resume
          </Button>
          <Button className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>

        {/* Resume Builder Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mb-8">
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
                💡 Drag tabs to reorder sections - this will change the order in your PDF
              </p>
            </div>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Enter your basic contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={resumeData.personalInfo.name}
                        onChange={(e) => updatePersonalInfo('name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john.doe@email.com"
                        value={resumeData.personalInfo.email}
                        onChange={(e) => updatePersonalInfo('email', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={resumeData.personalInfo.phone}
                        onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                        State/Location *
                      </label>
                      <Input
                        id="state"
                        type="text"
                        placeholder="California, USA"
                        value={resumeData.personalInfo.state}
                        onChange={(e) => updatePersonalInfo('state', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Experience Tab */}
            <TabsContent value="experience" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Work Experience</h3>
                  <p className="text-sm text-gray-600">Add your professional experience</p>
                </div>
                <Button onClick={addExperience} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Experience
                </Button>
              </div>

              {resumeData.experiences.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Briefcase className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-center">
                      No work experience added yet. Click "Add Experience" to get started.
                    </p>
                  </CardContent>
                </Card>
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
                            <div className="flex items-center gap-2">
                              {showUndo[`experience-${experience.id}`] && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => undoOptimization('experience', experience.id)}
                                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                                  >
                                    <Undo2 className="h-3 w-3" />
                                    Undo
                                  </Button>
                                </motion.div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => optimizeWithAI('experience', experience.id, experience.description)}
                                disabled={!experience.description.trim() || isOptimizing[`experience-${experience.id}`]}
                                className="flex items-center gap-1 text-xs"
                              >
                                {isOptimizing[`experience-${experience.id}`] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                AI Optimize
                              </Button>
                            </div>
                          </div>
                          <motion.div
                            animate={{
                              backgroundColor: recentlyOptimized[`experience-${experience.id}`] 
                                ? 'rgb(220, 252, 231)' // light green
                                : 'transparent'
                            }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="rounded-md relative"
                          >
                            {/* AI Recommendations - Cursor Style */}
                            {showRecommendations[`experience-${experience.id}`] && recommendations[`experience-${experience.id}`] && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="absolute top-2 left-2 right-2 z-10 bg-green-50 border border-green-200 rounded-md p-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Lightbulb className="h-4 w-4 text-green-600" />
                                      <span className="text-sm font-medium text-green-800">AI Suggestions</span>
                                    </div>
                                    <div className="text-sm text-green-700 space-y-1">
                                      {recommendations[`experience-${experience.id}`].map((rec, index) => (
                                        <div key={index} className="flex items-start gap-1">
                                          <span className="text-green-600 mt-0.5">•</span>
                                          <span>{rec}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => acceptRecommendations('experience', experience.id)}
                                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => denyRecommendations('experience', experience.id)}
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {/* Loading indicator for recommendations */}
                            {isGeneratingRecommendations[`experience-${experience.id}`] && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute top-2 left-2 right-2 z-10 bg-blue-50 border border-blue-200 rounded-md p-3 shadow-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                  <span className="text-sm text-blue-700">Generating AI suggestions...</span>
                                </div>
                              </motion.div>
                            )}

                            <Textarea
                              placeholder="• Led development of microservices architecture serving 1M+ users&#10;• Improved application performance by 40% through code optimization&#10;• Mentored 3 junior developers and conducted code reviews"
                              rows={4}
                              value={experience.description}
                              onChange={(e) => {
                                updateExperience(experience.id, 'description', e.target.value);
                                // Hide undo button when user manually edits
                                if (showUndo[`experience-${experience.id}`]) {
                                  setShowUndo(prev => ({ ...prev, [`experience-${experience.id}`]: false }));
                                }
                                // Hide recommendations when user starts typing
                                if (showRecommendations[`experience-${experience.id}`]) {
                                  setShowRecommendations(prev => ({ ...prev, [`experience-${experience.id}`]: false }));
                                }
                              }}
                              className={`transition-all duration-500 ${
                                recentlyOptimized[`experience-${experience.id}`] 
                                  ? 'border-green-300 shadow-sm' 
                                  : ''
                              } ${
                                showRecommendations[`experience-${experience.id}`] || isGeneratingRecommendations[`experience-${experience.id}`]
                                  ? 'pt-20' // Add padding when recommendations are shown
                                  : ''
                              }`}
                            />
                          </motion.div>
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
                  <p className="text-sm text-gray-600">Add your educational background</p>
                </div>
                <Button onClick={addEducation} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Education
                </Button>
              </div>

              {resumeData.education.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <GraduationCap className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-center">
                      No education added yet. Click "Add Education" to get started.
                    </p>
                  </CardContent>
                </Card>
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
                              Start Date *
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
                  <p className="text-sm text-gray-600">Add your notable projects and achievements</p>
                </div>
                <Button onClick={addProject} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              </div>

              {resumeData.projects.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FolderOpen className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-center">
                      No projects added yet. Click "Add Project" to get started.
                    </p>
                  </CardContent>
                </Card>
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
                            <div className="flex items-center gap-2">
                              {showUndo[`project-${project.id}`] && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => undoOptimization('project', project.id)}
                                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                                  >
                                    <Undo2 className="h-3 w-3" />
                                    Undo
                                  </Button>
                                </motion.div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => optimizeWithAI('project', project.id, project.description)}
                                disabled={!project.description.trim() || isOptimizing[`project-${project.id}`]}
                                className="flex items-center gap-1 text-xs"
                              >
                                {isOptimizing[`project-${project.id}`] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                AI Optimize
                              </Button>
                            </div>
                          </div>
                          <motion.div
                            animate={{
                              backgroundColor: recentlyOptimized[`project-${project.id}`] 
                                ? 'rgb(220, 252, 231)' // light green
                                : 'transparent'
                            }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="rounded-md relative"
                          >
                            {/* AI Recommendations - Cursor Style */}
                            {showRecommendations[`project-${project.id}`] && recommendations[`project-${project.id}`] && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="absolute top-2 left-2 right-2 z-10 bg-green-50 border border-green-200 rounded-md p-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Lightbulb className="h-4 w-4 text-green-600" />
                                      <span className="text-sm font-medium text-green-800">AI Suggestions</span>
                                    </div>
                                    <div className="text-sm text-green-700 space-y-1">
                                      {recommendations[`project-${project.id}`].map((rec, index) => (
                                        <div key={index} className="flex items-start gap-1">
                                          <span className="text-green-600 mt-0.5">•</span>
                                          <span>{rec}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => acceptRecommendations('project', project.id)}
                                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => denyRecommendations('project', project.id)}
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {/* Loading indicator for recommendations */}
                            {isGeneratingRecommendations[`project-${project.id}`] && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute top-2 left-2 right-2 z-10 bg-blue-50 border border-blue-200 rounded-md p-3 shadow-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                  <span className="text-sm text-blue-700">Generating AI suggestions...</span>
                                </div>
                              </motion.div>
                            )}

                            <Textarea
                              placeholder="Built a full-stack e-commerce platform using React and Node.js. Implemented secure payment processing, inventory management, and user authentication. Deployed on AWS with 99.9% uptime."
                              rows={4}
                              value={project.description}
                              onChange={(e) => {
                                updateProject(project.id, 'description', e.target.value);
                                // Hide undo button when user manually edits
                                if (showUndo[`project-${project.id}`]) {
                                  setShowUndo(prev => ({ ...prev, [`project-${project.id}`]: false }));
                                }
                                // Hide recommendations when user starts typing
                                if (showRecommendations[`project-${project.id}`]) {
                                  setShowRecommendations(prev => ({ ...prev, [`project-${project.id}`]: false }));
                                }
                              }}
                              className={`transition-all duration-500 ${
                                recentlyOptimized[`project-${project.id}`] 
                                  ? 'border-green-300 shadow-sm' 
                                  : ''
                              } ${
                                showRecommendations[`project-${project.id}`] || isGeneratingRecommendations[`project-${project.id}`]
                                  ? 'pt-20' // Add padding when recommendations are shown
                                  : ''
                              }`}
                            />
                          </motion.div>
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

            {/* Professional Summary Tab */}
            <TabsContent value="summary" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Professional Summary
                      </CardTitle>
                      <CardDescription>
                        Write a compelling summary that highlights your key qualifications and career objectives
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {showUndo['summary'] && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => undoOptimization('summary')}
                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                          >
                            <Undo2 className="h-3 w-3" />
                            Undo
                          </Button>
                        </motion.div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateProfessionalSummary}
                        disabled={isGeneratingSummary}
                        className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                      >
                        {isGeneratingSummary ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        Generate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => optimizeWithAI('summary', undefined, resumeData.summary)}
                        disabled={!resumeData.summary.trim() || isOptimizing['summary']}
                        className="flex items-center gap-1 text-xs"
                      >
                        {isOptimizing['summary'] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        AI Optimize
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.div
                    animate={{
                      backgroundColor: recentlyOptimized['summary'] 
                        ? 'rgb(220, 252, 231)' // light green
                        : 'transparent'
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="rounded-md"
                  >
                    <Textarea
                      placeholder="I am an experienced software engineer with 5+ years of experience in full-stack development. I have a proven track record of delivering scalable web applications and leading cross-functional teams. I am passionate about creating innovative solutions that drive business growth and improve user experience."
                      rows={6}
                      value={resumeData.summary}
                      onChange={(e) => {
                        setResumeData(prev => ({ ...prev, summary: e.target.value }));
                        // Hide undo button when user manually edits
                        if (showUndo['summary']) {
                          setShowUndo(prev => ({ ...prev, summary: false }));
                        }
                        // Clear generate summary error when user starts typing
                        if (generateSummaryError) {
                          setGenerateSummaryError("");
                        }
                      }}
                      className={`resize-none transition-all duration-500 ${
                        recentlyOptimized['summary'] 
                          ? 'border-green-300 shadow-sm' 
                          : ''
                      }`}
                    />
                  </motion.div>
                  <p className="text-xs text-gray-500 mt-2">
                    Keep it concise (2-4 sentences) and focus on your most relevant achievements and skills
                  </p>
                  {generateSummaryError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md"
                    >
                      <p className="text-sm text-red-600">{generateSummaryError}</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Skills
                      </CardTitle>
                      <CardDescription>
                        Add your technical and professional skills
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateSkillRecommendations}
                      disabled={isGeneratingSkillRecommendations}
                      className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                    >
                      {isGeneratingSkillRecommendations ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Lightbulb className="h-3 w-3" />
                      )}
                      Recommend
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter a skill (e.g., JavaScript, Project Management)"
                      value={newSkill}
                      onChange={(e) => {
                        setNewSkill(e.target.value);
                        // Clear error when user starts typing
                        if (skillRecommendationError) {
                          setSkillRecommendationError("");
                        }
                      }}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <Button onClick={addSkill} disabled={!newSkill.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Error display */}
                  {skillRecommendationError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-md"
                    >
                      <p className="text-sm text-red-600">{skillRecommendationError}</p>
                    </motion.div>
                  )}

                  {/* Skill Recommendations */}
                  {showRecommendedSkills && recommendedSkills.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-purple-600" />
                          AI Recommended Skills
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSkillRecommendations}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recommendedSkills.map((skill, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-md px-3 py-2"
                          >
                            <span className="text-sm text-green-800 font-medium">{skill}</span>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => acceptRecommendedSkill(skill)}
                                className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => denyRecommendedSkill(skill)}
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  
                  {resumeData.skills.length > 0 ? (
                    <div>
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
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">
                        No skills added yet. Start typing to add your first skill.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Error Display */}
        {optimizationError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
            <p className="text-red-600 text-sm">{optimizationError}</p>
          </div>
        )}

        {/* PDF Error Display */}
        {pdfError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md"
          >
            <p className="text-sm text-red-600">{pdfError}</p>
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => {
              const currentIndex = tabOrder.indexOf(activeTab);
              if (currentIndex > 0) {
                setActiveTab(tabOrder[currentIndex - 1]);
              }
            }}
            disabled={tabOrder.indexOf(activeTab) === 0}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex gap-4">
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Resume Preview</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <ResumePreview />
                </div>
              </DialogContent>
            </Dialog>
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
          
          <Button
            onClick={() => {
              const currentIndex = tabOrder.indexOf(activeTab);
              if (currentIndex < tabOrder.length - 1) {
                setActiveTab(tabOrder[currentIndex + 1]);
              }
            }}
            disabled={tabOrder.indexOf(activeTab) === tabOrder.length - 1}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

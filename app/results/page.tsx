"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  Share2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  Eye,
  Target,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";

const mockResults = {
  overallScore: 78,
  sections: [
    { name: "Content Quality", score: 85, status: "good" },
    { name: "Formatting", score: 72, status: "warning" },
    { name: "Keywords", score: 68, status: "warning" },
    { name: "ATS Compatibility", score: 90, status: "good" },
    { name: "Length & Structure", score: 75, status: "good" }
  ],
  strengths: [
    "Strong professional experience section with quantified achievements",
    "Good use of action verbs and industry-specific terminology",
    "Clear contact information and professional summary",
    "Relevant skills section aligned with job requirements"
  ],
  improvements: [
    "Add more industry-specific keywords to improve ATS compatibility",
    "Improve formatting consistency across sections",
    "Include more quantified results in experience descriptions",
    "Consider adding a projects or certifications section"
  ],
  keywordAnalysis: {
    found: 12,
    missing: 8,
    suggestions: ["Python", "Machine Learning", "Data Analysis", "SQL", "AWS"]
  }
};

const mockResume = `
JOHN DOE
Software Engineer
john.doe@email.com | (555) 123-4567 | LinkedIn: linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years of experience in full-stack development. 
Proven track record of delivering scalable web applications and leading cross-functional teams.

EXPERIENCE
Senior Software Engineer | Tech Corp | 2021 - Present
• Led development of microservices architecture serving 1M+ users
• Improved application performance by 40% through code optimization
• Mentored 3 junior developers and conducted code reviews

Software Engineer | StartupXYZ | 2019 - 2021
• Built responsive web applications using React and Node.js
• Collaborated with design team to implement user-friendly interfaces
• Reduced bug reports by 30% through comprehensive testing

EDUCATION
Bachelor of Science in Computer Science
University of Technology | 2015 - 2019

SKILLS
• Programming: JavaScript, Python, Java, TypeScript
• Frameworks: React, Node.js, Express, Django
• Databases: PostgreSQL, MongoDB, Redis
• Tools: Git, Docker, AWS, Jenkins
`;

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "detailed">("overview");

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (status: string) => {
    switch (status) {
      case "good": return "default";
      case "warning": return "secondary";
      case "error": return "destructive";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "good": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "error": return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Resume Analysis Results</h1>
            <p className="mt-2 text-gray-600">Comprehensive AI-powered analysis of your resume</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Pane - Analysis Results */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-6"
        >
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Overall Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${getScoreColor(mockResults.overallScore)}`}>
                  {mockResults.overallScore}
                </div>
                <div className="flex-1">
                  <Progress value={mockResults.overallScore} className="h-3" />
                  <p className="text-sm text-gray-600 mt-2">
                    Your resume scores better than 68% of resumes in our database
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Section Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockResults.sections.map((section, index) => (
                <motion.div
                  key={section.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(section.status)}
                    <span className="font-medium">{section.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${getScoreColor(section.score)}`}>
                      {section.score}
                    </span>
                    <Badge variant={getScoreBadgeVariant(section.status)}>
                      {section.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* Strengths */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mockResults.strengths.map((strength, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-start gap-2"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Improvements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <Zap className="h-5 w-5" />
                Recommended Improvements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mockResults.improvements.map((improvement, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-start gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{improvement}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Keyword Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Keyword Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {mockResults.keywordAnalysis.found}
                  </div>
                  <div className="text-sm text-gray-600">Keywords Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {mockResults.keywordAnalysis.missing}
                  </div>
                  <div className="text-sm text-gray-600">Keywords Missing</div>
                </div>
              </div>
              <Separator className="my-4" />
              <div>
                <h4 className="font-medium mb-2">Suggested Keywords:</h4>
                <div className="flex flex-wrap gap-2">
                  {mockResults.keywordAnalysis.suggestions.map((keyword, index) => (
                    <Badge key={index} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Pane - Resume Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="lg:sticky lg:top-8"
        >
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resume Preview
              </CardTitle>
              <CardDescription>
                Your uploaded resume with highlighted areas for improvement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white border rounded-lg p-6 max-h-[800px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {mockResume}
                </pre>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download Original
                </Button>
                <Button size="sm" className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Improved Version
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

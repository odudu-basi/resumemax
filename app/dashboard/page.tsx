'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  FileText, 
  BarChart3, 
  Zap, 
  Plus, 
  Calendar,
  TrendingUp,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/src/contexts/AuthContext';
import { createSupabaseClient, Resume, ResumeAnalysis } from '@/src/lib/supabase';
import MixpanelService from '@/src/lib/mixpanel';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [analyses, setAnalyses] = useState<ResumeAnalysis[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const supabase = createSupabaseClient();

  // Track dashboard visit
  useEffect(() => {
    if (user) {
      MixpanelService.trackDashboardVisited({
        user_id: user.id,
        resumes_count: resumes.length,
        analyses_count: analyses.length,
      });
    }
  }, [user, resumes.length, analyses.length]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, loading, router]);

  const loadUserData = async () => {
    if (!user?.id) return;
    
    try {
      // Load user's resumes
      const { data: resumesData } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Load user's analyses
      const { data: analysesData } = await supabase
        .from('resume_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setResumes(resumesData || []);
      setAnalyses(analysesData || []);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading || loadingData) {
    return (
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {user?.user_metadata?.full_name || 'User'}!
              </h1>
              <p className="text-gray-600">
                Manage your resumes and track your analysis history
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Dashboard
            </Badge>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Resumes</p>
                  <p className="text-2xl font-bold text-gray-900">{resumes.length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Analyses Run</p>
                  <p className="text-2xl font-bold text-gray-900">{analyses.length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analyses.length > 0 
                      ? Math.round(analyses.reduce((acc, analysis) => 
                          acc + (analysis.analysis_results?.scores?.overall || 0), 0) / analyses.length)
                      : 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Get started with analyzing or creating your resume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/rate-resume">
                  <Button className="w-full h-16 flex flex-col items-center justify-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Rate Resume
                  </Button>
                </Link>
                <Link href="/tailor-resume">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2">
                    <Zap className="h-5 w-5" />
                    Tailor Resume
                  </Button>
                </Link>
                <Link href="/create-resume">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create Resume
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Analyses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Recent Analyses</CardTitle>
              <CardDescription>
                Your latest resume analysis results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyses.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No analyses yet</p>
                  <Link href="/rate-resume">
                    <Button>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Analyze Your First Resume
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {analyses.slice(0, 5).map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {analysis.job_title || 'Resume Analysis'}
                        </h4>
                        <p className="text-sm text-gray-600">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {formatDate(analysis.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Overall Score</p>
                          <p className={`text-lg font-bold ${getScoreColor(analysis.analysis_results?.scores?.overall || 0)}`}>
                            {analysis.analysis_results?.scores?.overall || 0}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Saved Resumes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Saved Resumes</CardTitle>
              <CardDescription>
                Manage your uploaded and created resumes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resumes.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No resumes saved yet</p>
                  <Link href="/create-resume">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Resume
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resumes.map((resume) => (
                    <Card key={resume.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 truncate">
                            {resume.title}
                          </h4>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {formatDate(resume.created_at)}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

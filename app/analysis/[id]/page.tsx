"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Download, 
  Share2, 
  CheckCircle, 
  AlertTriangle, 
  Target,
  Zap,
  ArrowLeft,
  Loader2,
  Calendar
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { PaywallOverlay, BlurredListItem } from "@/src/components/PaywallOverlay";
import SessionReplayDebug from "@/src/components/SessionReplayDebug";
import Link from "next/link";

interface AnalysisData {
  id: string;
  job_title: string;
  job_description: string;
  resume_text: string;
  analysis_results: {
    scores: {
      overall: number;
      potential: number;
      ats: number;
      alignment: number;
      impact: number;
      polish: number;
    };
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    estimatedPercentile: number;
    label: string;
  };
  created_at: string;
}

interface SubscriptionStatus {
  planName: 'free' | 'basic' | 'unlimited';
  isActive: boolean;
  limits: {
    resumeAnalyses: number;
  };
}

function AnalysisResultsContent() {
  const { user } = useAuth();
  const params = useParams();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  const analysisId = params?.id as string;

  const loadAnalysis = useCallback(async () => {
    if (!user?.id || !analysisId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/analysis/${analysisId}?userId=${user.id}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Failed to load analysis');
      }
    } catch (err) {
      console.error('Error loading analysis:', err);
      setError('Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, [user?.id, analysisId]);

  const loadSubscriptionStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingSubscription(true);
      console.log('Loading subscription status for user:', user.id);
      
      const response = await fetch(`/api/subscription/status?userId=${user.id}`);
      const data = await response.json();

      console.log('Subscription API response:', { 
        ok: response.ok, 
        status: response.status, 
        data 
      });

      if (response.ok) {
        const subscriptionData = {
          planName: data.subscription.planName,
          isActive: data.subscription.isActive,
          limits: data.subscription.limits,
        };
        console.log('Setting subscription status:', subscriptionData);
        setSubscriptionStatus(subscriptionData);
      } else {
        console.warn('Subscription API failed, defaulting to free plan:', data);
        // Default to free plan if failed to load
        setSubscriptionStatus({
          planName: 'free',
          isActive: false,
          limits: { resumeAnalyses: 3 },
        });
      }
    } catch (err) {
      console.error('Error loading subscription status:', err);
      // Default to free plan on error
      setSubscriptionStatus({
        planName: 'free',
        isActive: false,
        limits: { resumeAnalyses: 3 },
      });
    } finally {
      setLoadingSubscription(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !analysisId) {
      setLoading(false);
      setLoadingSubscription(false);
      return;
    }

    // Load both analysis and subscription status in parallel
    Promise.all([loadAnalysis(), loadSubscriptionStatus()]);
  }, [user?.id, analysisId, loadAnalysis, loadSubscriptionStatus]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Determine if user should see paywall (free users see paywall for detailed feedback)
  const shouldShowPaywall = () => {
    // Don't show paywall while loading
    if (loadingSubscription) return false;
    
    // If subscription status failed to load, default to free (show paywall)
    if (!subscriptionStatus) {
      console.warn('Subscription status not loaded, defaulting to paywall');
      return true;
    }

    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Subscription Status:', {
        planName: subscriptionStatus.planName,
        isActive: subscriptionStatus.isActive,
        limits: subscriptionStatus.limits,
      });
    }

    // Show paywall for free users only
    const showPaywall = subscriptionStatus.planName === 'free';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Should show paywall:', showPaywall);
    }
    
    return showPaywall;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading analysis results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Analysis Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The analysis you requested could not be found.'}</p>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const results = analysis.analysis_results;

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Debug Panel - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">🐛 Debug Panel (Dev Mode)</h3>
          <div className="text-xs text-yellow-700 space-y-1">
            <div><strong>Loading Subscription:</strong> {loadingSubscription ? 'Yes' : 'No'}</div>
            <div><strong>Subscription Status:</strong> {subscriptionStatus ? 'Loaded' : 'Not Loaded'}</div>
            {subscriptionStatus && (
              <>
                <div><strong>Plan Name:</strong> {subscriptionStatus.planName}</div>
                <div><strong>Is Active:</strong> {subscriptionStatus.isActive ? 'Yes' : 'No'}</div>
                <div><strong>Should Show Paywall:</strong> {shouldShowPaywall() ? 'Yes' : 'No'}</div>
              </>
            )}
            <div><strong>User ID:</strong> {user?.id || 'Not logged in'}</div>
          </div>
        </div>
      )}

      {/* Session Replay Debug - Development Only */}
      <SessionReplayDebug />
      
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-between"
        >
          <div>
            <Link href="/dashboard" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Resume Analysis Results</h1>
            <p className="mt-2 text-gray-600">Analysis for: <strong>{analysis.job_title}</strong></p>
            <p className="text-sm text-gray-500">
              <Calendar className="inline h-3 w-3 mr-1" />
              {formatDate(analysis.created_at)}
            </p>
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

      <div className="space-y-6">
        {/* Scoring Dashboard */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <CardContent className="p-8">
            {/* Profile Section */}
            <div className="flex items-center justify-center mb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-2xl font-bold">
                {results.scores.overall}
              </div>
            </div>

            {/* Scores Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Overall Score */}
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Overall</h3>
                <div className="text-4xl font-bold mb-2">{results.scores.overall}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      results.scores.overall >= 90 ? 'bg-green-500' :
                      results.scores.overall >= 75 ? 'bg-yellow-500' :
                      results.scores.overall >= 60 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${results.scores.overall}%` }}
                  />
                </div>
              </div>

              {/* Potential Score */}
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Potential</h3>
                <div className="text-4xl font-bold mb-2">{results.scores.potential}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${results.scores.potential}%` }}
                  />
                </div>
              </div>

              {/* ATS Score */}
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">ATS Readiness</h3>
                <div className="text-4xl font-bold mb-2">{results.scores.ats}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      results.scores.ats >= 90 ? 'bg-green-500' :
                      results.scores.ats >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${results.scores.ats}%` }}
                  />
                </div>
              </div>

              {/* Alignment Score */}
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Job Alignment</h3>
                <div className="text-4xl font-bold mb-2">{results.scores.alignment}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      results.scores.alignment >= 90 ? 'bg-green-500' :
                      results.scores.alignment >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${results.scores.alignment}%` }}
                  />
                </div>
              </div>

              {/* Impact Score */}
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Impact</h3>
                <div className="text-4xl font-bold mb-2">{results.scores.impact}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      results.scores.impact >= 90 ? 'bg-green-500' :
                      results.scores.impact >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${results.scores.impact}%` }}
                  />
                </div>
              </div>

              {/* Polish Score */}
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Polish</h3>
                <div className="text-4xl font-bold mb-2">{results.scores.polish}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      results.scores.polish >= 90 ? 'bg-green-500' :
                      results.scores.polish >= 75 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${results.scores.polish}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Percentile and Label */}
            <div className="mt-8 text-center">
              <div className="text-sm text-gray-300 mb-1">
                {results.estimatedPercentile}th Percentile
              </div>
              <div className={`text-lg font-semibold ${
                results.label === 'Excellent' ? 'text-green-400' :
                results.label === 'Strong' ? 'text-blue-400' :
                results.label === 'Above Average' ? 'text-yellow-400' :
                results.label === 'Average' ? 'text-orange-400' : 'text-red-400'
              }`}>
                {results.label}
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
              {shouldShowPaywall() ? (
                <div className="space-y-2">
                  {results.strengths.map((strength: string, index: number) => (
                    <BlurredListItem key={index}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{strength}</span>
                      </div>
                    </BlurredListItem>
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.strengths.map((strength: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Areas for Improvement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shouldShowPaywall() ? (
                <div className="space-y-2">
                  {results.improvements.map((improvement: string, index: number) => (
                    <BlurredListItem key={index}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{improvement}</span>
                      </div>
                    </BlurredListItem>
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.improvements.map((improvement: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{improvement}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Actionable Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shouldShowPaywall() ? (
              <PaywallOverlay
                title="Unlock Detailed Recommendations"
                description="Get specific, actionable advice to improve your resume and land more interviews"
                upgradeText="Upgrade for Full Analysis"
              >
                <div className="space-y-4">
                  {results.recommendations.map((recommendation: string, index: number) => (
                    <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <p className="text-sm text-gray-700">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </PaywallOverlay>
            ) : (
              <div className="space-y-4">
                {results.recommendations.map((recommendation: string, index: number) => (
                  <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm text-gray-700">{recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-center gap-4">
              <Link href="/rate-resume">
                <Button variant="outline">
                  <Target className="mr-2 h-4 w-4" />
                  Analyze Another Resume
                </Button>
              </Link>
              <Link href="/tailor-resume">
                <Button>
                  <Zap className="mr-2 h-4 w-4" />
                  Improve This Resume
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalysisResultsLoading() {
  return (
    <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analysis results...</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisResultsPage() {
  return (
    <Suspense fallback={<AnalysisResultsLoading />}>
      <AnalysisResultsContent />
    </Suspense>
  );
}

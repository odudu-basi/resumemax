/**
 * Custom hook to manage submitted applications
 * Fetches closed/submitted sessions from Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '../lib/supabase';
import type { AutoApplySession } from '../lib/supabase';

export interface SubmittedApplication extends AutoApplySession {
  // Additional computed properties if needed
}

export function useSubmittedApplications(userId: string | null) {
  const [applications, setApplications] = useState<SubmittedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch submitted applications
  const fetchApplications = useCallback(async () => {
    if (!userId) {
      setApplications([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching submitted applications for user:', userId);
      
      let supabase;
      try {
        supabase = createSupabaseClient();
      } catch (clientError: any) {
        console.error('❌ Failed to create Supabase client:', clientError);
        throw new Error(`Supabase client error: ${clientError.message || 'Configuration missing'}`);
      }
      
      if (!supabase) {
        throw new Error('Failed to create Supabase client - client is null');
      }
      
      const { data, error: fetchError } = await supabase
        .from('auto_apply_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['submitted', 'timeout', 'error', 'manual_submission'])
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false }) as { data: AutoApplySession[] | null; error: any };

      if (fetchError) {
        throw fetchError;
      }

      const submittedApps: SubmittedApplication[] = (data || []).map(session => ({
        ...session
      }));

      setApplications(submittedApps);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching submitted applications:', err);
      
      // Handle different types of errors
      let errorMessage = 'Unknown error occurred';
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error?.message) {
        errorMessage = err.error.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.details) {
        errorMessage = err.details;
      } else {
        errorMessage = 'Failed to fetch submitted applications';
        console.error('Full error object:', JSON.stringify(err, null, 2));
      }
      
      setError(errorMessage);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Refresh applications periodically (less frequent than active sessions)
  useEffect(() => {
    fetchApplications();

    // Refresh every 30 seconds (less frequent since these are completed)
    const interval = setInterval(fetchApplications, 30000);

    return () => clearInterval(interval);
  }, [fetchApplications]);

  return {
    applications,
    loading,
    error,
    refresh: fetchApplications
  };
}

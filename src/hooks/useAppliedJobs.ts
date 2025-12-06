/**
 * Custom hook to manage applied jobs
 * Fetches from applied_jobs table in Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '../lib/supabase';

export interface AppliedJob {
  id: string;
  user_id: string;
  job_url: string;
  job_title: string;
  company_name: string;
  location?: string;
  job_type?: string;
  salary_range?: string;
  date_posted?: string;
  job_description?: string;
  requirements?: string;
  benefits?: string;
  session_id?: string;
  session_url?: string;
  session_video_url?: string;
  filled_fields?: Record<string, string>;
  cover_letter_generated?: boolean;
  application_status: string;
  applied_at: string;
  extracted_at?: string;
}

export function useAppliedJobs(userId: string | null) {
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch applied jobs
  const fetchAppliedJobs = useCallback(async () => {
    if (!userId) {
      setAppliedJobs([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching applied jobs for user:', userId);

      const supabase = createSupabaseClient();

      const { data, error: fetchError } = await supabase
        .from('applied_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('applied_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setAppliedJobs(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching applied jobs:', err);
      setError(err.message || 'Failed to fetch applied jobs');
      setAppliedJobs([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Refresh applied jobs periodically
  useEffect(() => {
    fetchAppliedJobs();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAppliedJobs, 30000);

    return () => clearInterval(interval);
  }, [fetchAppliedJobs]);

  return {
    appliedJobs,
    loading,
    error,
    refresh: fetchAppliedJobs
  };
}

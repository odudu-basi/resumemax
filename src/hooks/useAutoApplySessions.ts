/**
 * Custom hook to manage auto-apply sessions
 * Fetches active sessions from Supabase and provides real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '../lib/supabase';
import type { AutoApplySession } from '../lib/supabase';

export interface ActiveSession extends AutoApplySession {
  timeRemaining: number; // milliseconds
  formattedTime: string; // "14m 32s"
  expired: boolean;
}

export function useAutoApplySessions(userId: string | null) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active sessions
  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey
      });
      setError('Supabase configuration missing. Please check environment variables.');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching sessions for user:', userId);
      
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
        .in('status', ['awaiting_review', 'completed'])
        .is('closed_at', null)
        .order('created_at', { ascending: false }) as { data: AutoApplySession[] | null; error: any };

      console.log('📊 Supabase query result:', { 
        dataCount: data?.length || 0, 
        hasError: !!fetchError,
        errorCode: fetchError?.code,
        errorMessage: fetchError?.message 
      });

      if (fetchError) {
        console.error('❌ Supabase fetch error:', fetchError);
        
        // Handle specific error cases
        if (fetchError.code === 'PGRST116') {
          throw new Error('Table "auto_apply_sessions" not found. Please check database setup.');
        } else if (fetchError.code === '42501') {
          throw new Error('Permission denied. Please check database permissions.');
        } else if (fetchError.message?.includes('JWT')) {
          throw new Error('Authentication error. Please sign in again.');
        } else {
          throw new Error(`Database error: ${fetchError.message || 'Unknown database error'}`);
        }
      }

      // Calculate time remaining for each session
      const now = new Date().getTime();
      const activeSessions: ActiveSession[] = (data || []).map(session => {
        const expiresAt = new Date(session.expires_at || 0).getTime();
        const timeRemaining = Math.max(0, expiresAt - now);
        const expired = timeRemaining === 0;

        const minutes = Math.floor((timeRemaining / 1000 / 60) % 60);
        const seconds = Math.floor((timeRemaining / 1000) % 60);
        const formattedTime = expired ? 'Expired' : `${minutes}m ${seconds}s`;

        return {
          ...session,
          timeRemaining,
          formattedTime,
          expired
        };
      });

      setSessions(activeSessions);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      
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
        errorMessage = 'Failed to fetch sessions';
        console.error('Full error object:', JSON.stringify(err, null, 2));
      }
      
      setError(errorMessage);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Refresh sessions periodically
  useEffect(() => {
    fetchSessions();

    // Refresh every 5 seconds
    const interval = setInterval(fetchSessions, 5000);

    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Update time remaining every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prevSessions =>
        prevSessions.map(session => {
          const now = new Date().getTime();
          const expiresAt = new Date(session.expires_at || 0).getTime();
          const timeRemaining = Math.max(0, expiresAt - now);
          const expired = timeRemaining === 0;

          const minutes = Math.floor((timeRemaining / 1000 / 60) % 60);
          const seconds = Math.floor((timeRemaining / 1000) % 60);
          const formattedTime = expired ? 'Expired' : `${minutes}m ${seconds}s`;

          return {
            ...session,
            timeRemaining,
            formattedTime,
            expired
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    sessions,
    loading,
    error,
    refresh: fetchSessions
  };
}

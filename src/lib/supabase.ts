import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { getConfig, getClientConfig } from './env';

// Get configuration
const isServer = typeof window === 'undefined';
let config: any;
try {
  config = isServer ? getConfig() : getClientConfig();
} catch (error) {
  console.warn('Supabase configuration not available:', error);
  // Provide default values for development
  config = {
    supabase: {
      url: 'https://placeholder.supabase.co',
      anonKey: 'placeholder-key',
      serviceRoleKey: 'placeholder-service-key',
    }
  } as any;
}

// Types for our database schema
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          file_url: string | null;
          content: any; // JSONB
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          file_url?: string | null;
          content?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          file_url?: string | null;
          content?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      resume_analyses: {
        Row: {
          id: string;
          resume_id: string;
          user_id: string;
          job_title: string | null;
          job_description: string | null;
          analysis_results: any; // JSONB
          created_at: string;
        };
        Insert: {
          id?: string;
          resume_id: string;
          user_id: string;
          job_title?: string | null;
          job_description?: string | null;
          analysis_results?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          resume_id?: string;
          user_id?: string;
          job_title?: string | null;
          job_description?: string | null;
          analysis_results?: any;
          created_at?: string;
        };
      };
      // user_subscriptions removed
    };
  };
}

// Create Supabase client for server-side operations (never expose to client)
export const supabase = isServer
  ? createClient<Database>(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : (null as any);

// Create Supabase client for client-side operations
export function createSupabaseClient() {
  if (!config?.supabase?.url || !config?.supabase?.anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createBrowserClient<Database>(
    config.supabase.url,
    config.supabase.anonKey
  );
}

// Export types
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Resume = Database['public']['Tables']['resumes']['Row'];
export type ResumeAnalysis = Database['public']['Tables']['resume_analyses']['Row'];
// UserSubscription type removed

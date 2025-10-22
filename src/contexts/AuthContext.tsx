'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/src/lib/supabase';
import { useRouter } from 'next/navigation';
import MixpanelService from '@/src/lib/mixpanel';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Handle missing Supabase configuration gracefully
  let supabase: ReturnType<typeof createSupabaseClient>;
  try {
    supabase = createSupabaseClient();
  } catch (error) {
    console.warn('Supabase not configured, authentication disabled');
    // Return a mock client for development
    supabase = null as any;
  }

  useEffect(() => {
    // Skip if Supabase is not configured
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.warn('Failed to get session:', error);
      }
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle auth events and track them
        if (event === 'SIGNED_IN' && session?.user) {
          MixpanelService.trackUserSignIn({
            user_id: session.user.id,
            login_method: session.user.app_metadata?.provider === 'google' ? 'google' : 'email',
          });
          
          // Set user properties for Mixpanel
          MixpanelService.setUser(session.user.id, {
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name,
            signup_date: session.user.created_at,
          });
        }
        
        if (event === 'SIGNED_OUT') {
          MixpanelService.trackUserSignOut({
            user_id: session?.user?.id,
          });
          router.push('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const createUserProfile = async (user: User) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any);

      if (error) {
        console.error('Error creating user profile:', error);
        throw error; // Re-throw to surface the error
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error; // Re-throw to surface the error
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!supabase) {
      return { error: { message: 'Authentication not configured' } as AuthError };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : undefined,
          data: {
            full_name: fullName,
          },
        },
      });
      
      // Track successful signup
      if (!error && data.user) {
        MixpanelService.trackUserSignUp({
          user_id: data.user.id,
          email: email,
          full_name: fullName,
          signup_method: 'email',
        });
      }
      
      return { error };
    } catch (err: any) {
      return { error: { message: err?.message || 'Sign up failed' } as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Authentication not configured' } as AuthError };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      return { error: { message: 'Authentication not configured' } as AuthError };
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect to dashboard after OAuth callback
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent('/dashboard')}` : undefined,
        },
      });

      // Note: Google OAuth tracking will be handled in the auth state change listener
      return { error };
    } catch (err: any) {
      return { error: { message: err?.message || 'Google sign-in failed' } as AuthError };
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    if (!supabase) {
      return { error: { message: 'Authentication not configured' } as AuthError };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

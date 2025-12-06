import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    // Initialize PostHog only on client side
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // Only create profiles for logged-in users
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog loaded');
        }
      },
      // Enable session recording
      capture_pageview: true,
      capture_pageleave: true,

      // Session recording settings
      session_recording: {
        maskAllInputs: false, // Set to true to mask all input fields
        maskInputOptions: {
          password: true, // Always mask password fields
        },
      },

      // Autocapture settings
      autocapture: {
        dom_event_allowlist: ['click', 'submit', 'change'], // Only capture these events
        url_allowlist: [], // Empty = all URLs allowed
      },
    });
  }

  return posthog;
};

// Helper to track events
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    posthog.capture(eventName, properties);
  }
};

// Helper to identify user
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    posthog.identify(userId, properties);
  }
};

// Helper to reset on logout
export const resetPostHog = () => {
  if (typeof window !== 'undefined') {
    posthog.reset();
  }
};

// Helper to track errors
export const trackError = (error: Error, context?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    posthog.capture('$exception', {
      $exception_message: error.message,
      $exception_type: error.name,
      $exception_stack: error.stack,
      ...context,
    });
  }
};

export default posthog;

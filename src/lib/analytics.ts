/**
 * Analytics helper - Unified tracking for PostHog and Mixpanel
 * Use these helpers to track events across both platforms
 */

import posthog from 'posthog-js';
import MixpanelService from './mixpanel';

/**
 * Track a custom event
 * @param eventName - Name of the event (e.g., 'job_application_submitted')
 * @param properties - Event properties (e.g., { job_id, company, status })
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Track to PostHog
  if (typeof window !== 'undefined') {
    posthog.capture(eventName, properties);
  }

  // Track to Mixpanel
  MixpanelService.track(eventName, properties);
};

/**
 * Track an error
 * @param error - Error object
 * @param context - Additional context about the error
 */
export const trackError = (error: Error, context?: Record<string, any>) => {
  // Track to PostHog (with exception format)
  if (typeof window !== 'undefined') {
    posthog.capture('$exception', {
      $exception_message: error.message,
      $exception_type: error.name,
      $exception_stack: error.stack,
      ...context,
    });
  }

  // Track to Mixpanel
  MixpanelService.track('error_occurred', {
    error_message: error.message,
    error_name: error.name,
    error_stack: error.stack,
    ...context,
  });
};

/**
 * Identify a user (call on login)
 * @param userId - User ID
 * @param properties - User properties
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  // Identify in PostHog
  if (typeof window !== 'undefined') {
    posthog.identify(userId, properties);
  }

  // Identify in Mixpanel
  MixpanelService.setUser(userId, properties);
};

/**
 * Reset analytics on logout
 */
export const resetAnalytics = () => {
  if (typeof window !== 'undefined') {
    posthog.reset();
  }
  // Mixpanel reset is handled in AuthContext
};

// Example usage:
/*

// Track job application
trackEvent('job_application_started', {
  job_url: 'https://...',
  job_id: '123',
  company: 'Tesla'
});

// Track error
try {
  await applyToJob();
} catch (error) {
  trackError(error, {
    job_url: 'https://...',
    step: 'form_filling'
  });
}

// Track subscription
trackEvent('subscription_upgraded', {
  from_plan: 'Free',
  to_plan: 'Pro',
  price: 20
});

*/

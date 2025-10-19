import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
const MIXPANEL_TOKEN = 'aacb76a61ef50cb06055ea77d040a790';

if (typeof window !== 'undefined') {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage',
  });
}

// Event names constants
export const MIXPANEL_EVENTS = {
  // Core Resume Events
  RESUME_UPLOADED: 'resume_uploaded',
  RESUME_CREATED: 'resume_created',
  RESUME_ANALYZED: 'resume_analyzed',
  RESUME_DOWNLOADED: 'resume_downloaded',
  ANALYSIS_SAVED: 'analysis_saved',
  
  // User Journey Events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  PAGE_VIEWED: 'page_viewed',
  FEATURE_BUTTON_CLICKED: 'feature_button_clicked',
  
  // Engagement Events
  RESUME_TAILORED: 'resume_tailored',
  JOB_DESCRIPTION_ADDED: 'job_description_added',
  ANALYSIS_STEP_COMPLETED: 'analysis_step_completed',
  DASHBOARD_VISITED: 'dashboard_visited',
  
  // Business Intelligence Events
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  FEATURE_EXPLORED: 'feature_explored',
  ERROR_OCCURRED: 'error_occurred',
  SESSION_STARTED: 'session_started',
  
  // Onboarding Events
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
} as const;

// User properties
export const setUserProperties = (userId: string, properties: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.identify(userId);
  mixpanel.people.set({
    $email: properties.email,
    $name: properties.full_name,
    signup_date: properties.signup_date,
    plan_type: properties.plan_type || 'free',
    ...properties,
  });
};

// Track events
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  
  const eventProperties = {
    timestamp: new Date().toISOString(),
    page_url: window.location.href,
    page_title: document.title,
    user_agent: navigator.userAgent,
    ...properties,
  };
  
  mixpanel.track(eventName, eventProperties);
};

// Specific tracking functions for common events
export const MixpanelService = {
  // Resume Events
  trackResumeUploaded: (properties: {
    file_type: string;
    file_size: number;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.RESUME_UPLOADED, properties);
  },

  trackResumeCreated: (properties: {
    template_used?: string;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.RESUME_CREATED, properties);
  },

  trackResumeAnalyzed: (properties: {
    analysis_score: number;
    job_title?: string;
    analysis_duration_ms: number;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.RESUME_ANALYZED, properties);
  },

  trackResumeDownloaded: (properties: {
    format: string;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.RESUME_DOWNLOADED, properties);
  },

  trackAnalysisSaved: (properties: {
    analysis_score: number;
    job_title?: string;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.ANALYSIS_SAVED, properties);
  },

  // User Events
  trackUserSignUp: (properties: {
    user_id: string;
    email: string;
    full_name?: string;
    signup_method: 'email' | 'google';
  }) => {
    setUserProperties(properties.user_id, {
      email: properties.email,
      full_name: properties.full_name,
      signup_date: new Date().toISOString(),
      signup_method: properties.signup_method,
    });
    trackEvent(MIXPANEL_EVENTS.USER_SIGNED_UP, properties);
  },

  trackUserSignIn: (properties: {
    user_id: string;
    login_method: 'email' | 'google';
  }) => {
    trackEvent(MIXPANEL_EVENTS.USER_SIGNED_IN, properties);
  },

  trackUserSignOut: (properties: {
    user_id?: string;
    session_duration_ms?: number;
  }) => {
    trackEvent(MIXPANEL_EVENTS.USER_SIGNED_OUT, properties);
  },

  // Navigation Events
  trackPageView: (properties: {
    page_name: string;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.PAGE_VIEWED, properties);
  },

  trackFeatureButtonClick: (properties: {
    button_name: string;
    feature_name: string;
    user_authenticated: boolean;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.FEATURE_BUTTON_CLICKED, properties);
  },

  // Engagement Events
  trackJobDescriptionAdded: (properties: {
    job_title?: string;
    description_length: number;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.JOB_DESCRIPTION_ADDED, properties);
  },

  trackAnalysisStepCompleted: (properties: {
    step_name: string;
    step_number: number;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.ANALYSIS_STEP_COMPLETED, properties);
  },

  trackDashboardVisited: (properties: {
    user_id: string;
    resumes_count?: number;
    analyses_count?: number;
  }) => {
    trackEvent(MIXPANEL_EVENTS.DASHBOARD_VISITED, properties);
  },

  // Business Events
  trackPricingPageViewed: (properties: {
    user_id?: string;
    referrer_page?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.PRICING_PAGE_VIEWED, properties);
  },

  trackError: (properties: {
    error_type: string;
    error_message: string;
    page_name: string;
    user_id?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.ERROR_OCCURRED, properties);
  },

  trackSessionStarted: (properties: {
    user_id?: string;
    is_new_user: boolean;
  }) => {
    trackEvent(MIXPANEL_EVENTS.SESSION_STARTED, properties);
  },

  // Onboarding Events
  trackOnboardingStarted: (properties: {
    user_id?: string;
    user_name?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.ONBOARDING_STARTED, properties);
  },

  trackOnboardingCompleted: (properties: {
    user_id?: string;
    selected_action: string;
    time_spent_seconds: number;
  }) => {
    trackEvent(MIXPANEL_EVENTS.ONBOARDING_COMPLETED, properties);
  },

  trackOnboardingAbandoned: (properties: {
    user_id?: string;
    time_spent_seconds: number;
    last_action?: string;
  }) => {
    trackEvent(MIXPANEL_EVENTS.ONBOARDING_ABANDONED, properties);
  },

  // Generic event tracker
  track: trackEvent,
  setUser: setUserProperties,
};

export default MixpanelService;

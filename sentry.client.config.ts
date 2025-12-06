import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d498a69d8d34f6ddf2be0c6087df9672@o4510409764700160.ingest.us.sentry.io/4510487426367488",

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Capture 100% of the errors
  sampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable Session Replay to capture user sessions
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
  replaysSessionSampleRate: 0.1, // Capture 10% of all sessions

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content for privacy
      maskAllText: false,
      blockAllMedia: false,
      maskAllInputs: true, // Mask input fields for security
    }),
  ],

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },

  // Set environment
  environment: process.env.NODE_ENV || 'production',
});

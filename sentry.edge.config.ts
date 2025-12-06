import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d498a69d8d34f6ddf2be0c6087df9672@o4510409764700160.ingest.us.sentry.io/4510487426367488",

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  tracesSampleRate: 1.0,

  // Capture 100% of the errors
  sampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Set environment
  environment: process.env.NODE_ENV || 'production',
});

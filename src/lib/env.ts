import { z } from "zod";

/**
 * Environment variables schema with validation
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Next.js
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  OPENAI_MAX_TOKENS: z.coerce.number().default(4000),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Supabase URL is required").optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required").optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase service role key is required").optional(),
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // Database (if using one)
  DATABASE_URL: z.string().url().optional(),
  
  // Redis (for caching)
  REDIS_URL: z.string().url().optional(),
  
  // File Upload Configuration
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  ALLOWED_FILE_TYPES: z.string().default("pdf,doc,docx"),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  
  // Analytics
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  
  // Email Configuration (for notifications)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // Feature Flags
  ENABLE_ANALYTICS: z.coerce.boolean().default(true),
  ENABLE_STRIPE: z.coerce.boolean().default(false),
  ENABLE_CACHING: z.coerce.boolean().default(true),
  ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),
  
  // API Configuration
  API_VERSION: z.string().default("v1"),
  API_TIMEOUT: z.coerce.number().default(30000), // 30 seconds
  
  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  
  // Development
  SKIP_ENV_VALIDATION: z.coerce.boolean().default(false),
});

/**
 * Client-side environment variables schema
 * These are safe to expose to the browser
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  // Skip validation in certain cases (useful for build processes)
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    return process.env as any;
  }

  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .filter((err) => err.code === "invalid_type" && (err as any).received === "undefined")
        .map((err) => err.path.join("."));
      
      const invalidVars = error.issues
        .filter((err) => err.code !== "invalid_type" || (err as any).received !== "undefined")
        .map((err) => `${err.path.join(".")}: ${err.message}`);

      let errorMessage = "❌ Invalid environment variables:\n";
      
      if (missingVars.length > 0) {
        errorMessage += `\nMissing variables:\n${missingVars.map(v => `  - ${v}`).join("\n")}`;
      }
      
      if (invalidVars.length > 0) {
        errorMessage += `\nInvalid variables:\n${invalidVars.map(v => `  - ${v}`).join("\n")}`;
      }

      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    console.error('Environment validation error:', error);
    throw error;
  }
}

/**
 * Validate client-side environment variables
 */
function validateClientEnv() {
  const clientEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    return clientEnvSchema.parse(clientEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `❌ Invalid client environment variables: ${error.issues
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
}

/**
 * Get environment-specific configuration
 */
export function getConfig() {
  // Only validate on server side
  const env = typeof window === 'undefined' ? validateEnv() : ({} as any);
  
  return {
    // App
    app: {
      name: "ResumeMax",
      url: env.NEXT_PUBLIC_APP_URL,
      env: env.NODE_ENV,
    },
    
    // OpenAI
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      maxTokens: env.OPENAI_MAX_TOKENS,
      temperature: env.OPENAI_TEMPERATURE,
    },
    
    // Supabase
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    
    // Stripe
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      enabled: env.ENABLE_STRIPE,
    },
    
    // Database
    database: {
      url: env.DATABASE_URL,
    },
    
    // Redis
    redis: {
      url: env.REDIS_URL,
    },
    
    // File Upload
    upload: {
      maxFileSize: env.MAX_FILE_SIZE,
      allowedTypes: env.ALLOWED_FILE_TYPES.split(","),
    },
    
    // Rate Limiting
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      windowMs: env.RATE_LIMIT_WINDOW,
      enabled: env.ENABLE_RATE_LIMITING,
    },
    
    // Email
    email: {
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
      },
      from: env.FROM_EMAIL,
    },
    
    // Security
    security: {
      jwtSecret: env.JWT_SECRET,
      encryptionKey: env.ENCRYPTION_KEY,
    },
    
    // Features
    features: {
      analytics: env.ENABLE_ANALYTICS,
      stripe: env.ENABLE_STRIPE,
      caching: env.ENABLE_CACHING,
      rateLimiting: env.ENABLE_RATE_LIMITING,
    },
    
    // API
    api: {
      version: env.API_VERSION,
      timeout: env.API_TIMEOUT,
    },
    
    // Logging
    logging: {
      level: env.LOG_LEVEL,
    },
  };
}

/**
 * Get client-side configuration
 */
export function getClientConfig() {
  // Only validate on client side
  const env = typeof window !== 'undefined' ? validateClientEnv() : ({} as any);
  
  return {
    app: {
      url: env.NEXT_PUBLIC_APP_URL,
      env: env.NODE_ENV,
    },
    stripe: {
      publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    },
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if we're in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Get a required environment variable
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get an optional environment variable with default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Validate environment on module load
 * Only validate server env on server, client env on client
 */
const env = typeof window === 'undefined' ? validateEnv() : ({} as any);
const clientEnv = typeof window !== 'undefined' ? validateClientEnv() : ({} as any);

// Export validated environment variables
export { env, clientEnv };

// Export types
export type Env = z.infer<typeof envSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

// Default export
export default {
  env,
  clientEnv,
  getConfig,
  getClientConfig,
  isDevelopment,
  isProduction,
  isTest,
  getRequiredEnv,
  getOptionalEnv,
};

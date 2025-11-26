/**
 * Core types for Greenhouse auto-apply system
 */

export interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  resume: {
    path: string;
    text: string;
  };
  location: {
    city: string;
    state: string;
    country: string;
  };
  linkedin?: string;
  portfolio?: string;
  github?: string;
  yearsOfExperience?: string;
  education: {
    degree: string;
    school: string;
    major: string;
  };
  workAuthorization: string;
  requiresSponsorship: boolean;
  customAnswers: Record<string, string>;
}

export interface GreenhouseJob {
  id: string;
  company: string;
  title: string;
  url: string;
  location: string;
}

export interface FieldError {
  fieldName: string;
  fieldLabel: string;
  reason: 'missing_value' | 'field_not_found' | 'validation_failed' | 'required_but_empty';
  attemptedValue?: string;
  suggestions?: string[];
}

export interface ApplicationResult {
  jobId: string;
  jobUrl: string;
  status: 'success' | 'failed' | 'duplicate' | 'captcha_required' | 'manual_required';
  method: 'api' | 'browser' | 'none';
  message: string;
  timestamp: string;
  errors?: string[];
  fieldErrors?: FieldError[];
  missingFields?: string[];
  filledFields?: string[];
  confirmationId?: string;
  screenshotPath?: string;
}

export interface ApplicationRecord {
  email: string;
  jobId: string;
  jobUrl: string;
  appliedAt: string;
  status: string;
}

export interface GreenhouseFormField {
  type: string;
  name: string;
  label: string;
  required: boolean;
  value?: string;
}

export interface Config {
  headless: boolean;
  timeout: number;
  maxRetries: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

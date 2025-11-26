"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the onboarding data structure
export interface OnboardingData {
  // Step 2: Basic Information
  basicInfo?: {
    fullName: string;
    preferredName: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    portfolioUrl: string;
  };

  // Step 3: Work Authorization
  workAuth?: {
    workAuthorization: string;
    visaStatus: string;
    sponsorshipRequired: boolean;
    sponsorshipTimeline: string;
  };

  // Step 4: Job Search Criteria
  jobCriteria?: {
    desiredRoles: string[];
    preferredLocations: string[];
    salaryExpectation: string;
    jobType: string;
    workArrangement: string;
    startDate: string;
  };

  // Step 5: Experience & Education
  experience?: {
    yearsOfExperience: string;
    currentRole: string;
    currentCompany: string;
    educationLevel: string;
    fieldOfStudy: string;
    institution: string;
    graduationYear: string;
  };

  // Step 6: Skills & Certifications
  skills?: {
    technicalSkills: string[];
    softSkills: string[];
    certifications: string[];
    languages: Array<{
      language: string;
      proficiency: string;
    }>;
  };

  // Step 7: Application Preferences
  applicationPrefs?: {
    applicationsPerWeek: string;
    blacklistedCompanies: string[];
  };
}

interface OnboardingContextType {
  onboardingData: OnboardingData;
  updateOnboardingData: (step: keyof OnboardingData, data: any) => void;
  clearOnboardingData: () => void;
  isComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});

  const updateOnboardingData = (step: keyof OnboardingData, data: any) => {
    setOnboardingData(prev => ({
      ...prev,
      [step]: data
    }));
  };

  const clearOnboardingData = () => {
    setOnboardingData({});
  };

  const isComplete = !!(
    onboardingData.basicInfo &&
    onboardingData.workAuth &&
    onboardingData.jobCriteria &&
    onboardingData.experience &&
    onboardingData.skills &&
    onboardingData.applicationPrefs
  );

  return (
    <OnboardingContext.Provider value={{
      onboardingData,
      updateOnboardingData,
      clearOnboardingData,
      isComplete
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

// Helper function to save onboarding data to database after signup
export const saveOnboardingDataToDatabase = async (userId: string, onboardingData: OnboardingData) => {
  try {
    const { createSupabaseClient } = await import('@/src/lib/supabase');
    const supabase = createSupabaseClient();

    // Save basic info to user_profiles
    if (onboardingData.basicInfo) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          full_name: onboardingData.basicInfo.fullName,
          preferred_name: onboardingData.basicInfo.preferredName,
          email: onboardingData.basicInfo.email,
          phone: onboardingData.basicInfo.phone,
          location: onboardingData.basicInfo.location,
          linkedin_url: onboardingData.basicInfo.linkedinUrl,
          portfolio_url: onboardingData.basicInfo.portfolioUrl,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Error saving basic info:', profileError);
        throw profileError;
      }
    }

    // Save work authorization
    if (onboardingData.workAuth) {
      const { error: workAuthError } = await supabase
        .from('work_authorization')
        .upsert({
          user_id: userId,
          work_authorization: onboardingData.workAuth.workAuthorization,
          visa_status: onboardingData.workAuth.visaStatus,
          sponsorship_required: onboardingData.workAuth.sponsorshipRequired,
          sponsorship_timeline: onboardingData.workAuth.sponsorshipTimeline,
        }, {
          onConflict: 'user_id'
        });

      if (workAuthError) {
        console.error('Error saving work auth:', workAuthError);
        throw workAuthError;
      }
    }

    // Save job search criteria
    if (onboardingData.jobCriteria) {
      const { error: jobCriteriaError } = await supabase
        .from('job_search_criteria')
        .upsert({
          user_id: userId,
          desired_roles: onboardingData.jobCriteria.desiredRoles,
          preferred_locations: onboardingData.jobCriteria.preferredLocations,
          salary_expectation: onboardingData.jobCriteria.salaryExpectation,
          job_type: onboardingData.jobCriteria.jobType,
          work_arrangement: onboardingData.jobCriteria.workArrangement,
          start_date: onboardingData.jobCriteria.startDate,
        }, {
          onConflict: 'user_id'
        });

      if (jobCriteriaError) {
        console.error('Error saving job criteria:', jobCriteriaError);
        throw jobCriteriaError;
      }
    }

    // Save experience & education
    if (onboardingData.experience) {
      const { error: experienceError } = await supabase
        .from('experience_education')
        .upsert({
          user_id: userId,
          years_of_experience: onboardingData.experience.yearsOfExperience,
          current_role: onboardingData.experience.currentRole,
          current_company: onboardingData.experience.currentCompany,
          education_level: onboardingData.experience.educationLevel,
          field_of_study: onboardingData.experience.fieldOfStudy,
          institution: onboardingData.experience.institution,
          graduation_year: onboardingData.experience.graduationYear,
        }, {
          onConflict: 'user_id'
        });

      if (experienceError) {
        console.error('Error saving experience:', experienceError);
        throw experienceError;
      }
    }

    // Save skills & certifications
    if (onboardingData.skills) {
      const { error: skillsError } = await supabase
        .from('skills_certifications')
        .upsert({
          user_id: userId,
          technical_skills: onboardingData.skills.technicalSkills,
          soft_skills: onboardingData.skills.softSkills,
          certifications: onboardingData.skills.certifications,
        }, {
          onConflict: 'user_id'
        });

      if (skillsError) {
        console.error('Error saving skills:', skillsError);
        throw skillsError;
      }

      // Save language skills
      if (onboardingData.skills.languages && onboardingData.skills.languages.length > 0) {
        const { error: languageError } = await supabase
          .from('language_skills')
          .upsert({
            user_id: userId,
            languages: onboardingData.skills.languages,
          }, {
            onConflict: 'user_id'
          });

        if (languageError) {
          console.error('Error saving languages:', languageError);
          throw languageError;
        }
      }
    }

    // Save application preferences
    if (onboardingData.applicationPrefs) {
      const { error: appPrefsError } = await supabase
        .from('application_preferences')
        .upsert({
          user_id: userId,
          applications_per_week: parseInt(onboardingData.applicationPrefs.applicationsPerWeek),
          blacklisted_companies: onboardingData.applicationPrefs.blacklistedCompanies,
        }, {
          onConflict: 'user_id'
        });

      if (appPrefsError) {
        console.error('Error saving application preferences:', appPrefsError);
        throw appPrefsError;
      }
    }

    console.log('✅ All onboarding data saved successfully to database');
    return { success: true };

  } catch (error) {
    console.error('❌ Error saving onboarding data to database:', error);
    return { success: false, error };
  }
};

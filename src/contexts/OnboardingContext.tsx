"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Resume data types
export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  state: string;
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  summary: string;
  skills: string[];
}

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

  // Step 2a: Resume Upload
  resumeFile?: File | null;

  // Step 2b: Resume Data (parsed)
  resumeData?: ResumeData;

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
    onboardingData.resumeData &&
    onboardingData.workAuth &&
    onboardingData.jobCriteria &&
    onboardingData.experience &&
    onboardingData.skills
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

// Helper function to convert date formats to MM/DD/YYYY
function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  // If already in MM/DD/YYYY format, return as is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // If in MM/YYYY format, add /01 for first day of month
  if (/^\d{2}\/\d{4}$/.test(dateStr)) {
    return `${dateStr.substring(0, 2)}/01/${dateStr.substring(3)}`;
  }

  // If in other format, try to parse and convert
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = '01'; // Always use 1st of the month
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  } catch (e) {
    console.warn('Could not parse date:', dateStr);
  }

  return dateStr; // Return as-is if we can't parse it
}

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

    // Save resume data (education entries)
    if (onboardingData.resumeData?.education && onboardingData.resumeData.education.length > 0) {
      // Delete existing education entries first
      await supabase
        .from('education_entries')
        .delete()
        .eq('user_id', userId);

      // Insert new education entries
      const educationEntries = onboardingData.resumeData.education.map(edu => ({
        user_id: userId,
        school: edu.school,
        degree: edu.degree, // Full degree text
        start_date: formatDate(edu.startDate),
        end_date: edu.current ? '' : formatDate(edu.endDate),
        current: edu.current || false,
      }));

      const { error: eduError } = await supabase
        .from('education_entries')
        .insert(educationEntries);

      if (eduError) {
        console.error('Error saving education entries:', eduError);
        // Don't throw, just log - this is not critical
      }
    }

    // Save resume data (experience entries)
    if (onboardingData.resumeData?.experiences && onboardingData.resumeData.experiences.length > 0) {
      // Delete existing experience entries first
      await supabase
        .from('experience_entries')
        .delete()
        .eq('user_id', userId);

      // Insert new experience entries
      const experienceEntries = onboardingData.resumeData.experiences.map(exp => ({
        user_id: userId,
        company: exp.company,
        position: exp.position, // Job title
        location: exp.location || '', // Location
        start_date: formatDate(exp.startDate),
        end_date: exp.current ? '' : formatDate(exp.endDate),
        current: exp.current || false,
        description: exp.description,
      }));

      const { error: expError } = await supabase
        .from('experience_entries')
        .insert(experienceEntries);

      if (expError) {
        console.error('Error saving experience entries:', expError);
        // Don't throw, just log - this is not critical
      }
    }

    // Save resume data (summary, skills, projects) to user_resume_data table
    if (onboardingData.resumeData) {
      const { error: resumeDataError } = await supabase
        .from('user_resume_data')
        .upsert({
          user_id: userId,
          professional_summary: onboardingData.resumeData.summary || '',
          skills: onboardingData.resumeData.skills || [],
          projects: onboardingData.resumeData.projects || [],
        }, {
          onConflict: 'user_id'
        });

      if (resumeDataError) {
        console.error('Error saving resume data:', resumeDataError);
        // Don't throw, just log - this is not critical
      }
    }

    // Save demographics (work authorization data)
    if (onboardingData.workAuth || onboardingData.experience) {
      const { error: demoError } = await supabase
        .from('user_demographics')
        .upsert({
          user_id: userId,
          employment_status: onboardingData.experience?.employmentStatus === 'employed' ? 'employed_full_time' :
                             onboardingData.experience?.employmentStatus === 'unemployed' ? 'unemployed_seeking' :
                             onboardingData.experience?.employmentStatus === 'student' ? 'student' : 'prefer_not_to_say',
          education_level: onboardingData.experience?.educationLevel?.toLowerCase().includes('bachelor') ? 'bachelor_degree' :
                          onboardingData.experience?.educationLevel?.toLowerCase().includes('master') ? 'master_degree' :
                          onboardingData.experience?.educationLevel?.toLowerCase().includes('phd') ||
                          onboardingData.experience?.educationLevel?.toLowerCase().includes('doctoral') ? 'doctoral_degree' :
                          onboardingData.experience?.educationLevel?.toLowerCase().includes('associate') ? 'associate_degree' :
                          onboardingData.experience?.educationLevel?.toLowerCase().includes('high school') ? 'high_school' : 'prefer_not_to_say',
          veteran_status: onboardingData.workAuth?.veteran === 'yes' ? 'veteran' :
                         onboardingData.workAuth?.veteran === 'no' ? 'not_veteran' : 'prefer_not_to_say',
          disability_status: onboardingData.workAuth?.disability?.includes('yes') ? 'yes' :
                            onboardingData.workAuth?.disability?.includes('no') ? 'no' : 'prefer_not_to_say',
        }, {
          onConflict: 'user_id'
        });

      if (demoError) {
        console.error('Error saving demographics:', demoError);
        // Don't throw, just log - this is not critical
      }
    }

    console.log('✅ All onboarding data saved successfully to database');
    return { success: true };

  } catch (error) {
    console.error('❌ Error saving onboarding data to database:', error);
    return { success: false, error };
  }
};

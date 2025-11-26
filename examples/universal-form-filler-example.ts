/**
 * Universal Form Filler - Usage Examples
 *
 * This file shows various ways to use the Universal Form Filler API
 */

// Example 1: Basic job application
async function basicJobApplication() {
  const response = await fetch('/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://company.greenhouse.io/jobs/12345',
      userProfile: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@email.com',
        phone: '+1-555-123-4567',
        resume: {
          fileName: 'Jane_Smith_Resume.pdf',
          fileBase64: 'JVBERi0xLjQK...', // Your base64 encoded PDF
          mimeType: 'application/pdf'
        }
      }
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log(`✅ Application submitted!`);
    console.log(`Fields filled: ${result.fieldsFilled}/${result.fieldsAttempted}`);
    console.log(`Video: ${result.videoPath}`);
  } else {
    console.log(`❌ Application failed: ${result.message}`);
    console.log(`Errors:`, result.errors);
  }
}

// Example 2: Complete profile with all fields
async function completeJobApplication() {
  const response = await fetch('/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://careers.company.com/apply/software-engineer',
      userProfile: {
        // Required
        firstName: 'Alex',
        lastName: 'Johnson',
        email: 'alex.johnson@email.com',
        phone: '+1-555-987-6543',

        // Location
        location: {
          address: '456 Tech Boulevard, Apt 12B',
          city: 'Austin',
          state: 'Texas',
          zipCode: '78701',
          country: 'United States'
        },

        // Resume & Documents
        resume: {
          fileName: 'Alex_Johnson_Resume.pdf',
          fileBase64: '...', // base64 PDF
          mimeType: 'application/pdf'
        },
        coverLetter: 'Dear Hiring Manager,\n\nI am excited to apply for the Software Engineer position...',

        // Professional Links
        linkedinUrl: 'https://linkedin.com/in/alexjohnson',
        portfolioUrl: 'https://alexjohnson.dev',
        websiteUrl: 'https://github.com/alexjohnson',

        // Demographics (optional, but helps with EEO forms)
        demographics: {
          gender: 'Non-binary',
          pronouns: 'They/Them',
          race: 'Two or More Races',
          ethnicity: 'Not Hispanic or Latino',
          veteranStatus: 'Not a Veteran',
          disabilityStatus: 'No Disability'
        },

        // Work Authorization
        workAuthorization: {
          visaStatus: 'Green Card Holder',
          requiresSponsorship: false,
          authorizedToWork: true,
          availableStartDate: '2025-03-01'
        },

        // Education
        education: {
          degree: 'Master of Science',
          school: 'MIT',
          major: 'Computer Science',
          graduationYear: '2022',
          gpa: '3.9'
        },

        // Experience
        experience: {
          yearsOfExperience: '4',
          currentCompany: 'Tech Innovations Inc.',
          currentTitle: 'Senior Full Stack Developer'
        },

        // Application-specific
        applicationData: {
          careerHighlight: 'Built a microservices platform that reduced deployment time by 70% and served 10M+ users.',
          salaryExpectation: '$140,000 - $170,000',
          noticePeriod: '2 weeks',
          referralSource: 'LinkedIn Job Board',
          whyJoin: 'I am passionate about your mission to democratize AI and have been following your product launches closely.'
        }
      },

      options: {
        submitForm: true,
        handleMultiStep: true,
        maxSteps: 10,
        recordVideo: true
      }
    })
  });

  return await response.json();
}

// Example 3: Multi-step form with custom fields
async function customFieldsApplication() {
  const response = await fetch('/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://apply.startup.com/positions/engineer',
      userProfile: {
        firstName: 'Sam',
        lastName: 'Williams',
        email: 'sam@example.com',
        phone: '+1-555-111-2222',

        // Standard fields...
        resume: {
          fileName: 'resume.pdf',
          fileBase64: '...',
          mimeType: 'application/pdf'
        },

        // Custom fields for unique form questions
        customFields: {
          'favorite-programming-language': 'TypeScript',
          'preferred-work-environment': 'Hybrid',
          'team-size-preference': '5-10 people',
          'most-proud-project': 'Built an open-source GraphQL framework',
          'side-projects': 'Contributing to React and maintaining my blog',
          'conference-speaker': 'Yes',
          'open-source-contributions': 'Yes, 500+ commits to various projects'
        }
      },

      options: {
        submitForm: false, // Don't submit, just fill - useful for testing
        handleMultiStep: true,
        recordVideo: true
      }
    })
  });

  return await response.json();
}

// Example 4: Batch application to multiple companies
async function batchApplications() {
  const companies = [
    { name: 'Google', url: 'https://careers.google.com/jobs/apply/123456' },
    { name: 'Meta', url: 'https://www.metacareers.com/jobs/123456789' },
    { name: 'Apple', url: 'https://jobs.apple.com/en-us/details/123456789' },
  ];

  const baseProfile = {
    firstName: 'Chris',
    lastName: 'Davis',
    email: 'chris.davis@email.com',
    phone: '+1-555-222-3333',
    // ... rest of profile
  };

  const results = await Promise.all(
    companies.map(async (company) => {
      try {
        const response = await fetch('/api/universal-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: company.url,
            userProfile: {
              ...baseProfile,
              // Customize cover letter per company
              coverLetter: `Dear ${company.name} Hiring Team,\n\nI am excited to apply...`
            }
          })
        });

        const result = await response.json();
        return {
          company: company.name,
          success: result.success,
          fieldsFilled: result.fieldsFilled,
          errors: result.errors
        };
      } catch (error) {
        return {
          company: company.name,
          success: false,
          error: error.message
        };
      }
    })
  );

  // Summary
  const successful = results.filter(r => r.success).length;
  console.log(`✅ ${successful}/${companies.length} applications submitted`);

  results.forEach(result => {
    console.log(`${result.company}: ${result.success ? '✅' : '❌'}`);
  });

  return results;
}

// Example 5: Error handling and retry
async function robustApplication() {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch('/api/universal-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://company.com/apply',
          userProfile: {
            firstName: 'Taylor',
            lastName: 'Anderson',
            email: 'taylor@example.com',
            phone: '+1-555-444-5555',
            // ... rest of profile
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Success!');
        return result;
      }

      // Check if errors are recoverable
      const hasRecoverableErrors = result.errors.some(err =>
        err.includes('timeout') ||
        err.includes('network') ||
        err.includes('connection')
      );

      if (!hasRecoverableErrors) {
        console.log('❌ Non-recoverable error, stopping retries');
        return result;
      }

      attempt++;
      console.log(`⚠️ Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt)); // Exponential backoff

    } catch (error) {
      attempt++;
      console.error(`Error on attempt ${attempt}:`, error);
      if (attempt >= maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
    }
  }

  throw new Error('Max retries exceeded');
}

// Example 6: Read resume from file system
import fs from 'fs';
import path from 'path';

async function applicationWithFileResume() {
  // Read resume file
  const resumePath = path.join(process.cwd(), 'documents', 'my-resume.pdf');
  const resumeBuffer = await fs.promises.readFile(resumePath);
  const resumeBase64 = resumeBuffer.toString('base64');

  const response = await fetch('/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://company.com/apply',
      userProfile: {
        firstName: 'Jordan',
        lastName: 'Lee',
        email: 'jordan.lee@email.com',
        phone: '+1-555-666-7777',
        resume: {
          fileName: 'Jordan_Lee_Resume.pdf',
          fileBase64: resumeBase64,
          mimeType: 'application/pdf'
        }
      }
    })
  });

  return await response.json();
}

// Example 7: Track progress with detailed logging
async function trackedApplication() {
  console.log('🚀 Starting application process...');

  const response = await fetch('/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://company.com/careers/apply',
      userProfile: {
        firstName: 'Morgan',
        lastName: 'Brown',
        email: 'morgan@example.com',
        phone: '+1-555-888-9999',
        // ... rest of profile
      }
    })
  });

  const result = await response.json();

  console.log('\n📊 Application Results:');
  console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Fields: ${result.fieldsFilled}/${result.fieldsAttempted} (${result.successRate}%)`);
  console.log(`Steps completed: ${result.currentStep}`);

  if (result.videoPath) {
    console.log(`📹 Video: ${result.videoPath}`);
  }

  console.log('\n📝 Field Details:');
  result.fieldResults.forEach((field, index) => {
    const status = field.success ? '✅' : '❌';
    const value = field.success ? `: ${field.value}` : ` - ${field.reason}`;
    console.log(`  ${index + 1}. ${status} ${field.fieldLabel}${value}`);
  });

  if (result.errors.length > 0) {
    console.log('\n⚠️ Errors:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  return result;
}

// Example 8: Test mode (fill but don't submit)
async function testFormFilling() {
  const response = await fetch('/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://company.com/apply',
      userProfile: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1-555-000-0000',
      },
      options: {
        submitForm: false,        // Don't submit - just fill
        handleMultiStep: false,   // Only fill first page
        recordVideo: true         // Record for review
      }
    })
  });

  const result = await response.json();
  console.log('Test Results:', result);
  console.log(`Watch video to verify: ${result.videoPath}`);

  return result;
}

// Export all examples
export {
  basicJobApplication,
  completeJobApplication,
  customFieldsApplication,
  batchApplications,
  robustApplication,
  applicationWithFileResume,
  trackedApplication,
  testFormFilling
};

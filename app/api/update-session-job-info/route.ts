import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Extract job title and company name from a job URL
 */
async function extractJobInfoFromUrl(url: string) {
  console.log(`🔍 Extracting job info from: ${url}`);
  
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const jobInfo = await page.evaluate(() => {
      // Same extraction logic as in intelligent-apply
      const titleSelectors = [
        'h1[data-testid*="job-title"]',
        'h1[class*="job-title"]',
        'h1[class*="jobTitle"]',
        'h1[class*="title"]',
        '[data-testid*="job-title"]',
        '[class*="job-title"]',
        '[class*="jobTitle"]',
        '.job-title',
        '.jobTitle',
        'h1',
        'h2[class*="title"]',
        '[role="heading"][aria-level="1"]',
        '.position-title',
        '.role-title'
      ];

      const companySelectors = [
        '[data-testid*="company"]',
        '[class*="company"]',
        '[class*="employer"]',
        '.company-name',
        '.employer-name',
        'a[href*="company"]',
        'a[href*="employer"]',
        '[class*="organization"]',
        '.org-name',
        'h2[class*="company"]',
        'span[class*="company"]'
      ];

      let jobTitle = '';
      let companyName = '';

      // Try to find job title
      for (const selector of titleSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            const text = element.textContent.trim();
            if (text.length > 5 && text.length < 100 && 
                !text.toLowerCase().includes('search') &&
                !text.toLowerCase().includes('filter') &&
                !text.toLowerCase().includes('menu')) {
              jobTitle = text;
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Try to find company name
      for (const selector of companySelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element && element.textContent?.trim()) {
              const text = element.textContent.trim();
              if (text.length > 2 && text.length < 50 && 
                  !text.toLowerCase().includes('search') &&
                  !text.toLowerCase().includes('filter') &&
                  !text.toLowerCase().includes('apply') &&
                  !text.toLowerCase().includes('save') &&
                  !text.toLowerCase().includes('share') &&
                  text !== jobTitle) {
                companyName = text;
                break;
              }
            }
          }
          if (companyName) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      // Fallback: try to extract from page title or URL
      if (!jobTitle || !companyName) {
        const pageTitle = document.title;
        const url = window.location.href;
        
        if (pageTitle) {
          const titleParts = pageTitle.split(' at ');
          if (titleParts.length === 2) {
            if (!jobTitle) jobTitle = titleParts[0].trim();
            if (!companyName) companyName = titleParts[1].split(' |')[0].split(' -')[0].trim();
          }
          
          const dashParts = pageTitle.split(' - ');
          if (dashParts.length >= 2 && !jobTitle) {
            jobTitle = dashParts[0].trim();
          }
        }
        
        if (!companyName && url) {
          const hostname = new URL(url).hostname;
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            const potentialCompany = parts[parts.length - 2];
            if (potentialCompany && potentialCompany !== 'jobs' && potentialCompany !== 'careers' && 
                potentialCompany !== 'www' && potentialCompany.length > 2) {
              companyName = potentialCompany.charAt(0).toUpperCase() + potentialCompany.slice(1);
            }
          }
        }
      }

      return { jobTitle, companyName };
    });

    console.log(`📋 Extracted: "${jobInfo.jobTitle}" at "${jobInfo.companyName}"`);
    return jobInfo;

  } catch (error: any) {
    console.error(`❌ Error extracting from ${url}:`, error.message);
    return { jobTitle: '', companyName: '' };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId } = await request.json();

    if (!sessionId && !userId) {
      return NextResponse.json(
        { error: 'Either sessionId or userId is required' },
        { status: 400 }
      );
    }

    // Get sessions to update
    let query = supabase.from('auto_apply_sessions').select('*');
    
    if (sessionId) {
      query = query.eq('id', sessionId);
    } else if (userId) {
      query = query.eq('user_id', userId).is('job_title', null);
    }

    const { data: sessions, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions found to update',
        updated: 0
      });
    }

    console.log(`🔄 Updating job info for ${sessions.length} sessions...`);

    let updated = 0;
    const results = [];

    for (const session of sessions) {
      try {
        const jobInfo = await extractJobInfoFromUrl(session.job_url);
        
        if (jobInfo.jobTitle || jobInfo.companyName) {
          const { error: updateError } = await supabase
            .from('auto_apply_sessions')
            .update({
              job_title: jobInfo.jobTitle || null,
              company_name: jobInfo.companyName || null
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`❌ Failed to update session ${session.id}:`, updateError);
            results.push({
              sessionId: session.id,
              url: session.job_url,
              success: false,
              error: updateError.message
            });
          } else {
            updated++;
            results.push({
              sessionId: session.id,
              url: session.job_url,
              success: true,
              jobTitle: jobInfo.jobTitle,
              companyName: jobInfo.companyName
            });
            console.log(`✅ Updated session ${session.id}: "${jobInfo.jobTitle}" at "${jobInfo.companyName}"`);
          }
        } else {
          results.push({
            sessionId: session.id,
            url: session.job_url,
            success: false,
            error: 'Could not extract job info from URL'
          });
        }

        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`❌ Error processing session ${session.id}:`, error);
        results.push({
          sessionId: session.id,
          url: session.job_url,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} out of ${sessions.length} sessions`,
      updated,
      total: sessions.length,
      results
    });

  } catch (error: any) {
    console.error('❌ Update job info error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Update Session Job Info API',
    description: 'Retroactively extract job titles and company names for existing sessions',
    usage: {
      method: 'POST',
      body: {
        sessionId: 'string (optional) - Update specific session',
        userId: 'string (optional) - Update all sessions for user that are missing job info'
      }
    }
  });
}

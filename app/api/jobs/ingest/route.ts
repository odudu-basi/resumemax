import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';
import { searchGreenhouseJobs } from '@/src/lib/job-sources/greenhouse-api';
import { searchLeverJobs } from '@/src/lib/job-sources/lever-api';
import { searchWorkableJobs } from '@/src/lib/job-sources/workable-api';

type Source = 'greenhouse' | 'lever' | 'workable' | 'all';

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function toIsoOrNull(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = (searchParams.get('source') as Source) || 'all';
    const limit = Number(searchParams.get('limit') || 500);

    const jobs: any[] = [];

    // Use empty keywords to fetch all postings from each source implementation
    if (source === 'greenhouse' || source === 'all') {
      const gh = await searchGreenhouseJobs([], undefined, limit);
      jobs.push(...gh);
    }
    if (source === 'lever' || source === 'all') {
      const lv = await searchLeverJobs([], undefined, limit);
      jobs.push(...lv);
    }
    if (source === 'workable' || source === 'all') {
      const wk = await searchWorkableJobs([], undefined, limit);
      jobs.push(...wk);
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase server client unavailable' }, { status: 500 });
    }

    // Map to DB rows
    const rows = jobs.map(j => {
      const companyName = j.company || '';
      const applicationUrl = j.applicationUrl || j.url || '';
      return {
        application_url: applicationUrl,
        source: (j.source || '').toString(),
        source_job_id: j.atsId || null,
        title: j.title || '',
        company: companyName,
        company_slug: companyName ? slugify(companyName) : null,
        location: j.location || null,
        remote_type: j.remoteType || null,
        description_html: null, // current scrapers mostly provide text
        description_text: j.description || null,
        posted_at: toIsoOrNull(j.postedDate),
        salary_json: j.salary ? j.salary : null,
        raw: j,
        is_active: true,
        // last_seen_at auto via trigger on update
      };
    }).filter(r => r.application_url && r.title && r.company && r.source);

    // Batch upsert in chunks to avoid payload size issues
    const chunkSize = 300;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error, count } = await (supabase as any)
        .from('jobs')
        .upsert(chunk, { onConflict: 'application_url', ignoreDuplicates: false, count: 'estimated' });
      if (error) {
        console.error('Upsert error:', error.message);
        // continue but record failure
      } else {
        upserted += count || chunk.length;
      }
    }

    return NextResponse.json({
      ok: true,
      received: jobs.length,
      upserted,
      source
    });
  } catch (error: any) {
    console.error('Ingestion failed:', error?.message || error);
    return NextResponse.json({ error: 'Ingestion failed', details: error?.message }, { status: 500 });
  }
}



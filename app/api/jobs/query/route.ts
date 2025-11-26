import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const source = searchParams.get('source') || '';
    const company = searchParams.get('company') || '';
    const location = searchParams.get('location') || '';
    const remoteType = searchParams.get('remote_type') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase server client unavailable' }, { status: 500 });
    }

    let query = (supabase as any).from('jobs').select('*', { count: 'exact' });

    if (source) query = query.eq('source', source);
    if (company) query = query.ilike('company', `%${company}%`);
    if (location) query = query.ilike('location', `%${location}%`);
    if (remoteType) query = query.eq('remote_type', remoteType);

    if (q) {
      // Simple text search across a few columns
      // For better relevance, consider a PostgreSQL function that uses to_tsvector
      query = query.or([
        `title.ilike.%${q}%`,
        `company.ilike.%${q}%`,
        `description_text.ilike.%${q}%`
      ].join(','));
    }

    query = query.order('posted_at', { ascending: false, nullsFirst: false })
                 .order('last_seen_at', { ascending: false })
                 .range(from, to);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      total: count || 0,
      page,
      pageSize,
      jobs: data || []
    });
  } catch (error: any) {
    console.error('Query failed:', error?.message || error);
    return NextResponse.json({ error: 'Query failed', details: error?.message }, { status: 500 });
  }
}



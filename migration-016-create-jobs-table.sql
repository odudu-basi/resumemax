-- Central jobs warehouse for ATS ingest (Greenhouse, Lever, Workable)
-- Run with your existing migration flow

BEGIN;

-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Uniqueness keys
  application_url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('Greenhouse','Lever','Workable')),
  source_job_id TEXT,

  -- Core fields
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_slug TEXT,
  location TEXT,
  remote_type TEXT CHECK (remote_type IN ('remote','hybrid','onsite')),

  -- Description
  description_html TEXT,
  description_text TEXT,

  -- Dates
  posted_at TIMESTAMPTZ NULL,

  -- Compensation
  salary_json JSONB,

  -- Raw payload for debugging/enrichment
  raw JSONB,

  -- Housekeeping
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Uniqueness: prefer URL; also protect on (source, source_job_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_application_url ON public.jobs (application_url);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_source_job ON public.jobs (source, source_job_id) WHERE source_job_id IS NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_jobs_company ON public.jobs (company);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON public.jobs (source);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON public.jobs (posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jobs_last_seen_at ON public.jobs (last_seen_at DESC);

-- Full text search index (title + company + description_text)
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON public.jobs USING GIN (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(company,'') || ' ' || coalesce(description_text,''))
);

-- Trigger to auto-update last_seen_at on updates
CREATE OR REPLACE FUNCTION public.set_last_seen_now()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_set_last_seen ON public.jobs;
CREATE TRIGGER trg_jobs_set_last_seen
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_last_seen_now();

-- Optional: mapping table to persist discovered Workable account slugs
CREATE TABLE IF NOT EXISTS public.workable_slug_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,              -- e.g., company brand we probed
  account_slug TEXT NOT NULL,            -- workable account slug we resolved
  source_url TEXT,                       -- where we found it (redirect, careers page, etc.)
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_slug),
  UNIQUE (account_slug)
);

CREATE OR REPLACE FUNCTION public.set_last_seen_now_workable()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workable_slug_map_set_last_seen ON public.workable_slug_map;
CREATE TRIGGER trg_workable_slug_map_set_last_seen
BEFORE UPDATE ON public.workable_slug_map
FOR EACH ROW
EXECUTE FUNCTION public.set_last_seen_now_workable();

COMMIT;



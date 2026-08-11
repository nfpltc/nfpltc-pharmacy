-- supabase/vaccine_submissions.sql
--
-- Vaccine Administration Consent Form storage.
--
-- The table already exists in production but was never committed as a
-- migration, so this file is written to be safe to run against either an
-- empty project or the live database: the CREATE is IF NOT EXISTS and every
-- new column is added with ADD COLUMN IF NOT EXISTS.
--
-- Run this in the Supabase SQL editor (or `supabase db execute`) before
-- deploying the updated consent form — the API writes the new columns.

-- ---------------------------------------------------------------------------
-- 1. Base table (no-op if it already exists)
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

create table if not exists public.vaccine_submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Section A
  first_name    text,
  last_name     text,
  dob           date,
  phone         text,
  email         text,
  address       text,
  city          text,
  state         text,
  zip           text,

  -- Vaccine selection + screening
  vaccine_type        text,
  screening_responses jsonb,

  -- Section D
  consent_name  text,
  consent_date  date,

  -- Workflow
  status            text not null default 'pending',
  administered_date date,
  administered_by   text,
  lot_number        text,
  notes             text
);

-- ---------------------------------------------------------------------------
-- 2. Columns added for the new (2026) consent form
-- ---------------------------------------------------------------------------

-- Section A — demographics that the previous form did not capture
alter table public.vaccine_submissions add column if not exists age            text;
alter table public.vaccine_submissions add column if not exists gender         text;
alter table public.vaccine_submissions add column if not exists race           text;
alter table public.vaccine_submissions add column if not exists ethnicity      text;
alter table public.vaccine_submissions add column if not exists physician_name  text;
alter table public.vaccine_submissions add column if not exists physician_phone text;
alter table public.vaccine_submissions add column if not exists physician_fax   text;

-- Vaccines requested. `vaccine_type` is kept as a human-readable comma list so
-- the existing admin table/search keeps working; the array is the queryable one.
alter table public.vaccine_submissions add column if not exists vaccines_requested text[];
alter table public.vaccine_submissions add column if not exists other_vaccine_text text;

-- Section C question 18 — "check all that apply"
alter table public.vaccine_submissions add column if not exists q18_conditions text[];

-- Section D — insurance
alter table public.vaccine_submissions add column if not exists insurance_types     text[];
alter table public.vaccine_submissions add column if not exists insurance_plan_name text;
alter table public.vaccine_submissions add column if not exists member_id           text;
alter table public.vaccine_submissions add column if not exists rx_bin              text;
alter table public.vaccine_submissions add column if not exists rx_pcn              text;
alter table public.vaccine_submissions add column if not exists group_no            text;
alter table public.vaccine_submissions add column if not exists medicare_card_no    text;
alter table public.vaccine_submissions add column if not exists medicare_id         text;
alter table public.vaccine_submissions add column if not exists authorize_billing   boolean default false;

-- SSN: only the last four digits are ever persisted. The full value stays in
-- the emailed PDF and is never written to the database or the JSON blob.
-- See the SSN note in app/api/forms/vaccine-consent/route.ts.
alter table public.vaccine_submissions add column if not exists ssn_last4 text;

-- Section D — consent
alter table public.vaccine_submissions add column if not exists consent_agree boolean default false;

-- Clinic-use administration table (page 2 of the printed form)
alter table public.vaccine_submissions add column if not exists vaccine_rows   jsonb;
alter table public.vaccine_submissions add column if not exists immunizer_name text;

-- Stable id shown on the PDF and used by the patient download link
alter table public.vaccine_submissions add column if not exists record_id text;

-- Screening answers that should be reviewed by a pharmacist before dosing
alter table public.vaccine_submissions add column if not exists review_flags text[];

-- ---------------------------------------------------------------------------
-- 3. Fix the misspelled `full_form_date` column
--
-- The API has been writing the entire form payload into a column named
-- `full_form_date` (it holds data, not a date). Add the correctly-spelled
-- column, backfill it, and leave the old one in place so nothing that still
-- reads it breaks. Drop it manually once you've confirmed the backfill.
-- ---------------------------------------------------------------------------
alter table public.vaccine_submissions add column if not exists full_form_data jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'vaccine_submissions'
      and column_name  = 'full_form_date'
  ) then
    execute 'update public.vaccine_submissions
               set full_form_data = full_form_date
             where full_form_data is null
               and full_form_date is not null';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
create index if not exists vaccine_submissions_created_at_idx
  on public.vaccine_submissions (created_at desc);

create index if not exists vaccine_submissions_status_idx
  on public.vaccine_submissions (status);

create index if not exists vaccine_submissions_record_id_idx
  on public.vaccine_submissions (record_id);

create index if not exists vaccine_submissions_name_idx
  on public.vaccine_submissions (lower(last_name), lower(first_name));

-- ---------------------------------------------------------------------------
-- 5. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists vaccine_submissions_set_updated_at on public.vaccine_submissions;
create trigger vaccine_submissions_set_updated_at
  before update on public.vaccine_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--
-- This table holds PHI. Every legitimate reader/writer goes through a Next.js
-- route using the service-role key, which bypasses RLS. Enabling RLS with no
-- policies therefore changes nothing for the app while denying every request
-- made with the public anon key.
-- ---------------------------------------------------------------------------
alter table public.vaccine_submissions enable row level security;

revoke all on public.vaccine_submissions from anon, authenticated;

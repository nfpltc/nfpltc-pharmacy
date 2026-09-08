-- supabase/team_members.sql
--
-- Backs the admin "Team Members" page (app/admin/(protected)/team) and the
-- public "Our Team" section + per-person bio pages (/team/[slug]).
--
-- Written the same defensive way as vaccine_submissions.sql: CREATE IF NOT
-- EXISTS + ADD COLUMN IF NOT EXISTS, so it's safe to run against a fresh
-- project or one that already has an older version of this table.
--
-- Run this in the Supabase SQL editor before using the Team admin page —
-- the API reads/writes every column below.

create extension if not exists "pgcrypto";

create table if not exists public.team_members (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  name           text not null,
  credentials    text,              -- e.g. "Pharm.D, RPh"
  role           text not null,     -- e.g. "Pharmacy Manager"
  slug           text not null,     -- URL: /team/<slug>
  photo_url      text,

  short_bio      text,              -- one sentence, shown on the About page card
  long_bio       text,              -- full bio, paragraphs separated by blank lines
  expertise      text[] not null default '{}',  -- areas of expertise, one per line in the admin form
  tagline        text,              -- short caps phrase shown on the bio page

  display_order  integer not null default 0,
  visible        boolean not null default true,
  -- Independent from `visible`: a member can appear in the About page
  -- carousel (name/photo/short bio) without having a public /team/<slug>
  -- page — e.g. someone who's listed for transparency but hasn't written
  -- a bio yet, or doesn't want one linkable. Defaults true so existing
  -- rows keep working exactly as before this column existed.
  show_bio_page  boolean not null default true
);

alter table public.team_members add column if not exists credentials    text;
alter table public.team_members add column if not exists photo_url      text;
alter table public.team_members add column if not exists short_bio      text;
alter table public.team_members add column if not exists long_bio       text;
alter table public.team_members add column if not exists expertise      text[] not null default '{}';
alter table public.team_members add column if not exists tagline        text;
alter table public.team_members add column if not exists display_order  integer not null default 0;
alter table public.team_members add column if not exists visible        boolean not null default true;
alter table public.team_members add column if not exists show_bio_page  boolean not null default true;

create unique index if not exists team_members_slug_idx on public.team_members (slug);
create index if not exists team_members_order_idx on public.team_members (display_order) where visible = true;

-- Row Level Security: the public site and the admin API both go through the
-- service-role key (see lib/supabaseAdmin.ts), which bypasses RLS entirely,
-- so this is a safety net against the anon key ever being pointed at this
-- table directly, not the primary access control.
alter table public.team_members enable row level security;

drop policy if exists "Public can read visible team members" on public.team_members;
create policy "Public can read visible team members"
  on public.team_members for select
  using (visible = true);

-- ---------------------------------------------------------------------------
-- Storage: team photos are uploaded to the existing public "images" bucket
-- (the same one blog featured-images use — see app/api/admin/blog/route.ts)
-- under a "team/" prefix. No new bucket needed.
-- ---------------------------------------------------------------------------

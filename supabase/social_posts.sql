-- Social posts — history/log for the Admin → Social page.
-- Mirrors WealthClaude's video_activity_log but tailored to the pharmacy.
-- Run this in the Supabase SQL editor before using /admin/social.

create table if not exists public.social_posts (
  id           uuid primary key default gen_random_uuid(),
  caption      text not null,
  image_url    text,
  platforms    text[] not null default '{}',      -- e.g. {facebook,instagram,linkedin}
  status       text  not null default 'draft',     -- draft | posted | failed
  provider     text,                               -- make | draft | ...
  error        text,                               -- failure reason, if any
  created_at   timestamptz not null default now(),
  posted_at    timestamptz
);

create index if not exists social_posts_created_at_idx
  on public.social_posts (created_at desc);

-- Service-role writes only (the admin API uses the service key, which bypasses RLS).
-- Enable RLS so the anon/public key can never read or write this table.
alter table public.social_posts enable row level security;

-- Local queue for the Social Media Editor. A Vercel cron fires pending items
-- at their due_at via Buffer shareNow. Run this in the Supabase SQL editor.

create table if not exists public.social_queue (
  id           uuid default gen_random_uuid() primary key,
  text         text not null,
  platform     text not null,          -- linkedin | x | instagram
  channel_id   text not null,          -- Buffer channel id
  channel_name text,
  image_url    text,
  due_at       timestamptz not null,
  status       text not null default 'pending',   -- pending | sent | failed
  error        text,
  created_at   timestamptz default now(),
  sent_at      timestamptz
);

create index if not exists idx_social_queue_pending
  on public.social_queue (due_at) where status = 'pending';

-- Service-role only (the admin/cron routes use the service key; RLS blocks anon).
alter table public.social_queue enable row level security;

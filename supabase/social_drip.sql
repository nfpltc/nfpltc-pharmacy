-- Auto-drip: daily auto-posting from the saved image library.
-- Run this in the Supabase SQL editor to enable auto-posting.

-- Track which images have been used for auto-posting.
ALTER TABLE public.social_images
ADD COLUMN IF NOT EXISTS drip_used_at timestamptz;

-- Track the source of queued posts so we know which were auto-drip.
ALTER TABLE public.social_queue
ADD COLUMN IF NOT EXISTS source text default 'manual';

-- Simple config for auto-drip.
CREATE TABLE IF NOT EXISTS public.social_drip_config (
  id         text primary key default 'default',
  enabled    boolean default true,
  tone       text default 'Warm & friendly',
  updated_at timestamptz default now()
);

INSERT INTO public.social_drip_config (id, enabled, tone)
VALUES ('default', true, 'Warm & friendly')
ON CONFLICT (id) DO NOTHING;

-- Service-role only.
ALTER TABLE public.social_drip_config ENABLE ROW LEVEL SECURITY;

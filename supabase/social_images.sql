-- Saved image library for the Social Media Editor.
-- Holds uploaded images (and AI/Unsplash images the admin chose to keep),
-- all re-hosted in the public Supabase Storage bucket "social-images" so the
-- URLs are permanent and Buffer can fetch them at publish time.
create table if not exists public.social_images (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,          -- public storage URL
  path       text,                   -- storage object path (for deletion)
  filename   text,
  source     text default 'upload',  -- 'upload' | 'ai' | 'unsplash'
  created_at timestamptz default now()
);

create index if not exists social_images_created_idx
  on public.social_images (created_at desc);

-- The "social-images" storage bucket is created automatically (public) by the
-- upload route on first use, so no manual bucket setup is needed.

-- Instagram post type (post | story | reel) for scheduled/queued social posts.
-- Immediate "Post now" doesn't need this; it only matters for the queue.
alter table public.social_queue
  add column if not exists instagram_type text default 'post';

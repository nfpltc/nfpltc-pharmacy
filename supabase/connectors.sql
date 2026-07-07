-- Stores the Buffer access token used by the Social Media Editor.
-- Get the token from buffer.com/developers → Create App → Access Token (OIDC).

create table if not exists public.connectors (
  id           text primary key,        -- e.g. 'buffer'
  bearer_token text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.connectors enable row level security;

-- Insert / update your Buffer token (run once, with your real token):
-- insert into public.connectors (id, bearer_token)
-- values ('buffer', 'YOUR_BUFFER_ACCESS_TOKEN')
-- on conflict (id) do update set bearer_token = excluded.bearer_token, updated_at = now();

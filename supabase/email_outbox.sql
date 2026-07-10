-- Drafts + scheduled (and recurring) custom emails for the admin Email page.
-- Sent emails still land in email_log; this table holds the not-yet-sent ones.
create table if not exists public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_email   text not null,
  to_name    text,
  subject    text,
  message    text,
  status     text default 'draft',    -- draft | scheduled | sent | failed | canceled
  send_at    timestamptz,             -- when to send (scheduled rows)
  repeat     text default 'none',     -- none | daily | weekly | monthly
  resend_id  text,
  error      text,
  sent_at    timestamptz,
  sent_by    text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists email_outbox_due_idx on public.email_outbox (status, send_at);

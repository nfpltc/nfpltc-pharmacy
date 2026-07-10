-- Central log of outbound emails sent via Resend, for the admin "Email" page.
-- Statement + overdue reminders keep their own statement_email_log; the Email
-- page merges both. New custom emails and form confirmations write here.
create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  to_email   text,
  subject    text,
  category   text,        -- 'custom' | 'form' | 'blog' | 'other' | ...
  status     text,        -- 'sent' | 'failed'
  resend_id  text,
  error      text,
  meta       jsonb,
  sent_by    text,        -- admin email for manually-composed sends
  created_at timestamptz default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);

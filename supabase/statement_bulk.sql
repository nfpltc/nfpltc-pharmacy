-- Bulk statements: upload one monthly PDF, index per-customer page ranges,
-- extract each customer's pages on demand. Plugs into the existing
-- customer_statements table + customer-statements storage bucket.
-- Run this in the Supabase SQL editor.

-- One row per uploaded monthly bulk PDF.
create table if not exists public.statement_batches (
  id             uuid primary key default gen_random_uuid(),
  month_ym       text not null,        -- '2026-03'
  month_label    text,                 -- 'March 2026'
  bulk_path      text not null,        -- path in the customer-statements bucket
  password       text,                 -- password to open the bulk PDF (e.g. 9291)
  total_pages    int,
  customer_count int,
  created_at     timestamptz default now()
);
alter table public.statement_batches enable row level security;

-- Add bulk pointers to customer_statements (nullable — existing rows unaffected).
-- A "bulk" statement row has bulk_batch_id + start_page/end_page and NO file_path;
-- its PDF is extracted on demand from the batch's bulk PDF.
alter table public.customer_statements
  add column if not exists bulk_batch_id uuid references public.statement_batches(id) on delete cascade,
  add column if not exists start_page int,
  add column if not exists end_page int;

create index if not exists customer_statements_batch_idx
  on public.customer_statements (bulk_batch_id);

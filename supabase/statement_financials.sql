-- Financial + aging fields per customer-per-month, captured from the bulk PDF's
-- summary row (Over 30/60/90/120, Previous, Payments, Charges, Balance) plus the
-- facility code. Powers the money/finance dashboard and overdue reports.
-- Run in the Supabase SQL editor. Nullable so existing rows / manual uploads are
-- unaffected; only bulk-indexed months populate them.

alter table public.customer_statements
  add column if not exists facility          text,
  add column if not exists previous_balance  numeric,
  add column if not exists charges           numeric,   -- this month's sales for this customer
  add column if not exists payments          numeric,   -- collected this month
  add column if not exists balance           numeric,   -- amount still owed
  add column if not exists over_30           numeric,
  add column if not exists over_60           numeric,
  add column if not exists over_90           numeric,
  add column if not exists over_120          numeric;

-- Speeds up "overdue this month" queries.
create index if not exists customer_statements_overdue_idx
  on public.customer_statements (billing_period)
  where over_30 > 0 or over_60 > 0 or over_90 > 0 or over_120 > 0;

-- ── Optional expenses (income vs. expenses -> profit) ────────────────────────
-- Admin can add expenses per month (payroll, rent, product cost, etc.). If none
-- are entered, the dashboard just shows income vs. pending.
create table if not exists public.pharmacy_expenses (
  id          uuid primary key default gen_random_uuid(),
  month_ym    text not null,          -- '2026-06'
  category    text not null,          -- Payroll | Rent | Inventory | Utilities | Other
  label       text,
  amount      numeric not null,
  created_at  timestamptz default now()
);
create index if not exists pharmacy_expenses_month_idx on public.pharmacy_expenses (month_ym);
alter table public.pharmacy_expenses enable row level security;

-- Customer Portal: self-service accounts for pharmacy customers.
-- Run this in the Supabase SQL editor.

-- 1. Portal user accounts (customers who sign up for online access)
CREATE TABLE IF NOT EXISTS public.portal_users (
  id             uuid primary key default gen_random_uuid(),
  account_number text not null,
  email          text not null,
  password_hash  text not null,
  phone          text,
  status         text not null default 'active',  -- active | suspended
  created_at     timestamptz default now(),
  last_login_at  timestamptz,

  UNIQUE (account_number),
  UNIQUE (email)
);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

-- 2. Access requests (when customer email doesn't match records)
CREATE TABLE IF NOT EXISTS public.portal_access_requests (
  id             uuid primary key default gen_random_uuid(),
  account_number text not null,
  email          text not null,
  phone          text,
  first_name     text,
  last_name      text,
  status         text not null default 'pending',  -- pending | approved | rejected
  admin_notes    text,
  created_at     timestamptz default now(),
  reviewed_at    timestamptz,
  reviewed_by    text
);

ALTER TABLE public.portal_access_requests ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_users_account ON public.portal_users (account_number);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON public.portal_users (email);
CREATE INDEX IF NOT EXISTS idx_portal_access_requests_status ON public.portal_access_requests (status);

-- ============================================================
-- MR DIY Job Tracker — Supabase Schema
-- Run this entire file in Supabase > SQL Editor > New Query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── APP USERS ────────────────────────────────────────────────
create table if not exists public.app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  username    text not null unique,
  role        text not null check (role in ('master','team','client')) default 'team',
  created_at  timestamptz default now()
);

-- ── JOBS ─────────────────────────────────────────────────────
create table if not exists public.jobs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  code        text not null,
  state       text not null default '',
  addr        text not null default '',
  pic         text not null default '',
  phone       text not null default '',
  services    jsonb not null default '{}',
  timeline    boolean not null default false,
  tl_stages   jsonb not null default '{}',
  created_by  uuid references public.app_users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── SHARE TOKENS ─────────────────────────────────────────────
-- For generating passwordless client view links
create table if not exists public.share_tokens (
  id          uuid primary key default uuid_generate_v4(),
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  label       text not null default 'Client View',
  created_by  uuid references public.app_users(id),
  expires_at  timestamptz,
  created_at  timestamptz default now()
);

-- ── TELEGRAM CONFIG ──────────────────────────────────────────
create table if not exists public.telegram_config (
  id        int primary key default 1,
  token     text not null default '',
  chat_id   text not null default '',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into public.telegram_config (id, token, chat_id)
values (1, '', '')
on conflict (id) do nothing;

-- ── REMINDER LOG ─────────────────────────────────────────────
create table if not exists public.reminder_log (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid references public.jobs(id) on delete cascade,
  service_key  text not null,
  fired_date   date not null,
  created_at   timestamptz default now(),
  unique(job_id, service_key, fired_date)
);

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.handle_updated_at();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.app_users enable row level security;
alter table public.jobs enable row level security;
alter table public.telegram_config enable row level security;
alter table public.reminder_log enable row level security;
alter table public.share_tokens enable row level security;

-- app_users policies
create policy "Auth users read app_users" on public.app_users
  for select to authenticated using (true);
create policy "Master insert app_users" on public.app_users
  for insert to authenticated
  with check (exists (select 1 from public.app_users where id = auth.uid() and role = 'master'));
create policy "Master or self update app_users" on public.app_users
  for update to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role = 'master') or id = auth.uid());
create policy "Master delete app_users" on public.app_users
  for delete to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role = 'master'));

-- jobs policies
create policy "Auth users read jobs" on public.jobs
  for select to authenticated using (true);
create policy "Anon read jobs via share token" on public.jobs
  for select to anon using (true);
create policy "Master and team insert jobs" on public.jobs
  for insert to authenticated
  with check (exists (select 1 from public.app_users where id = auth.uid() and role in ('master','team')));
create policy "Master and team update jobs" on public.jobs
  for update to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role in ('master','team')));
create policy "Master delete jobs" on public.jobs
  for delete to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role = 'master'));

-- share_tokens policies
create policy "Master and team manage share tokens" on public.share_tokens
  for all to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role in ('master','team')));
create policy "Anon read share tokens" on public.share_tokens
  for select to anon using (true);

-- telegram policies
create policy "Master read telegram" on public.telegram_config
  for select to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role = 'master'));
create policy "Master update telegram" on public.telegram_config
  for update to authenticated
  using (exists (select 1 from public.app_users where id = auth.uid() and role = 'master'));

-- reminder_log policies
create policy "Auth read reminder_log" on public.reminder_log
  for select to authenticated using (true);
create policy "Auth insert reminder_log" on public.reminder_log
  for insert to authenticated with check (true);

-- ── SEED: MASTER USER ────────────────────────────────────────
-- After running this schema:
-- 1. Go to Supabase > Authentication > Users > Add User
--    Email: admin@mrdiy.internal   Password: (choose strong password)
-- 2. Copy the UUID shown for that user
-- 3. Run this in SQL Editor (replace the UUID):
--
-- insert into public.app_users (id, name, username, role)
-- values ('PASTE-UUID-HERE', 'Admin', 'admin', 'master');

-- ============================================================
-- END OF SCHEMA
-- ============================================================

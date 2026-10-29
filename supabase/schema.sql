-- Bhumi Indica feedback — run this once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- digest() lives in pgcrypto (on by default in Supabase; no-op if already enabled)
create extension if not exists pgcrypto with schema extensions;

-- 1. Responses --------------------------------------------------------------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  answers     jsonb not null,
  ip_hash     text,                       -- hashed, never the raw IP; used only for rate limiting
  constraint answers_is_object check (jsonb_typeof(answers) = 'object'),
  constraint answers_size     check (octet_length(answers::text) < 6000)
);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_ip_hash_idx    on public.feedback (ip_hash, created_at);

-- 2. Who counts as an admin (add the client's email here) ----------------------
create table if not exists public.admin_emails (
  email text primary key
);
-- insert into public.admin_emails (email) values ('vivek@example.com');

-- 3. Row Level Security: the public can NOT read or write the table directly --
alter table public.feedback     enable row level security;
alter table public.admin_emails enable row level security;

drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback" on public.feedback
  for select to authenticated
  using (exists (select 1 from public.admin_emails a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins delete feedback" on public.feedback;
create policy "admins delete feedback" on public.feedback
  for delete to authenticated
  using (exists (select 1 from public.admin_emails a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins see own row" on public.admin_emails;
create policy "admins see own row" on public.admin_emails
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- 4. The only way in: a checked submit function -------------------------------
-- Spam protection: honeypot field, minimum fill time, size limits, and
-- max 5 submissions per IP per hour.
create or replace function public.submit_feedback(p_answers jsonb, p_hp text, p_elapsed_ms int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_ip      text;
  v_hash    text;
  v_recent  int;
begin
  -- honeypot: real people never fill this hidden field
  if coalesce(p_hp, '') <> '' then
    return 'ok';                       -- pretend success, store nothing
  end if;

  -- bots submit instantly
  if p_elapsed_ms is null or p_elapsed_ms < 3000 then
    raise exception 'too_fast';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or p_answers = '{}'::jsonb then
    raise exception 'empty';
  end if;

  if octet_length(p_answers::text) >= 6000 then
    raise exception 'too_long';
  end if;

  -- rate limit by hashed IP
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'cf-connecting-ip', 'unknown'), ',', 1);
  v_hash := encode(extensions.digest(v_ip || 'bhumi-salt', 'sha256'), 'hex');

  select count(*) into v_recent from public.feedback
   where ip_hash = v_hash and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.feedback (answers, ip_hash) values (p_answers, v_hash);
  return 'ok';
end;
$$;

revoke all on function public.submit_feedback(jsonb, text, int) from public;
grant execute on function public.submit_feedback(jsonb, text, int) to anon, authenticated;

-- 5. Tiny keep-alive so the free project never pauses (called by GitHub Actions)
create or replace function public.ping()
returns text language sql security definer set search_path = public as $$ select 'pong'::text $$;
grant execute on function public.ping() to anon;

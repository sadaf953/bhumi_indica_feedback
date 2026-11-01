-- Bhumi Indica feedback — run in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run (also upgrades an older version of this schema in place).

-- digest() lives in pgcrypto (on by default in Supabase; no-op if already enabled)
create extension if not exists pgcrypto with schema extensions;

-- 1. Responses ---------------------------------------------------------------
create table if not exists public.responses (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  first_purchase boolean not null,
  current_brand  text,
  ip_hash        text    -- SHA-256 of the IP, never the raw IP; only used for rate limiting
);

-- customer identifier (added at the client's request: name + phone or email)
alter table public.responses add column if not exists customer_name text;
alter table public.responses add column if not exists contact       text;   -- '+91XXXXXXXXXX' or an email
alter table public.responses add column if not exists contact_type  text;   -- 'phone' | 'email'

-- brand list (Ember Cookware renamed from Ember Cooking): drop old rule, rename, re-add
alter table public.responses drop constraint if exists brand_allowed;
update public.responses set current_brand = 'Ember Cookware' where current_brand = 'Ember Cooking';
alter table public.responses add  constraint brand_allowed check (
  current_brand is null or current_brand in
  ('The Indus Valley', 'Ember Cookware', 'Solara', 'Trilonium', 'None of the above')
);
alter table public.responses drop constraint if exists brand_matches_answer;
alter table public.responses add  constraint brand_matches_answer check (
  (first_purchase = true  and current_brand is null) or
  (first_purchase = false and current_brand is not null)
);
alter table public.responses drop constraint if exists name_ok;
alter table public.responses add  constraint name_ok check (
  customer_name is null or char_length(customer_name) between 2 and 80
) not valid;
alter table public.responses drop constraint if exists contact_ok;
alter table public.responses add  constraint contact_ok check (
  contact is null
  or (contact_type = 'phone' and contact ~ '^\+91[6-9][0-9]{9}$')
  or (contact_type = 'email' and contact ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' and char_length(contact) <= 120)
) not valid;

create index if not exists responses_created_at_idx on public.responses (created_at desc);
create index if not exists responses_ip_hash_idx    on public.responses (ip_hash, created_at);
create index if not exists responses_contact_idx    on public.responses (contact);

-- 2. Admins: put Vivek's email here (see bottom of file) ------------------------
create table if not exists public.admin_emails (
  email text primary key
);

-- 3. Row Level Security --------------------------------------------------------
-- The public (anon) gets NO direct access to the table at all — not even insert.
-- Submissions only go through submit_response() below, which runs the checks.
-- Customer names/contacts are only readable by emails in admin_emails.
alter table public.responses    enable row level security;
alter table public.admin_emails enable row level security;

drop policy if exists "admins read responses" on public.responses;
create policy "admins read responses" on public.responses
  for select to authenticated
  using (exists (select 1 from public.admin_emails a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins delete responses" on public.responses;
create policy "admins delete responses" on public.responses
  for delete to authenticated
  using (exists (select 1 from public.admin_emails a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins see own row" on public.admin_emails;
create policy "admins see own row" on public.admin_emails
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- 4. The only way to submit ------------------------------------------------------
-- Checks: honeypot empty, page open ≥ 3s, valid name + phone/email, answer shape,
-- max 5 submissions per IP per hour.
drop function if exists public.submit_response(boolean, text, text, int);

create or replace function public.submit_response(
  p_name           text,
  p_contact        text,
  p_first_purchase boolean,
  p_current_brand  text,
  p_hp             text,
  p_elapsed_ms     int
)
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
  v_name    text := btrim(coalesce(p_name, ''));
  v_contact text := lower(btrim(coalesce(p_contact, '')));
  v_type    text;
begin
  if coalesce(p_hp, '') <> '' then
    return 'ok';                          -- bot filled the hidden field: pretend success, store nothing
  end if;

  if p_elapsed_ms is null or p_elapsed_ms < 3000 then
    raise exception 'too_fast';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'bad_name';
  end if;

  if v_contact ~ '^\+91[6-9][0-9]{9}$' then
    v_type := 'phone';
  elsif v_contact ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' and char_length(v_contact) <= 120 then
    v_type := 'email';
  else
    raise exception 'bad_contact';
  end if;

  if p_first_purchase is null then
    raise exception 'missing_answer';
  end if;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'cf-connecting-ip', 'unknown'), ',', 1);
  v_hash := encode(extensions.digest(trim(v_ip) || ':bhumi', 'sha256'), 'hex');

  select count(*) into v_recent from public.responses
   where ip_hash = v_hash and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.responses (customer_name, contact, contact_type, first_purchase, current_brand, ip_hash)
  values (v_name, v_contact, v_type, p_first_purchase,
          case when p_first_purchase then null else p_current_brand end, v_hash);
  return 'ok';
end;
$$;

revoke all on function public.submit_response(text, text, boolean, text, text, int) from public;
grant execute on function public.submit_response(text, text, boolean, text, text, int) to anon, authenticated;

-- 5. Keep-alive: GitHub Actions calls this every 3 days so the free project never pauses
create or replace function public.ping()
returns text language sql security definer set search_path = public as $$ select 'pong'::text $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon;

-- 6. Add the admin (replace with Vivek's email, then run this line on its own) ---
-- insert into public.admin_emails (email) values ('vivek@example.com') on conflict do nothing;

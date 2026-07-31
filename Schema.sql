-- ============================================================
-- Suraksha Shadow — Supabase schema
-- Paste this into Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Profiles (one row per authenticated user, linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  consent_ambient_audio boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Trusted contacts
create table if not exists trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz not null default now()
);

-- 3. Emergency events — share_token is what Guardian links are built from.
--    'manual' is included as a fallback trigger (e.g. a panic button)
--    alongside the voice/motion triggers from the FRD.
create table if not exists emergency_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('voice', 'motion', 'manual')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  start_time timestamptz not null default now(),
  end_time timestamptz
);

create unique index if not exists emergency_events_share_token_idx on emergency_events(share_token);

-- 4. Timeline entries (feeds the Guardian view's timeline — FR-9)
create table if not exists timeline_entries (
  id uuid primary key default gen_random_uuid(),
  emergency_event_id uuid not null references emergency_events(id) on delete cascade,
  event_type text not null,
  details text,
  created_at timestamptz not null default now()
);

-- 5. Location pings — location + battery + movement (FR-4, FR-7, FR-8)
create table if not exists location_pings (
  id uuid primary key default gen_random_uuid(),
  emergency_event_id uuid not null references emergency_events(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  battery_pct int,
  movement_status text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security — owner-only by default (TR: Security)
-- ============================================================
alter table profiles enable row level security;
alter table trusted_contacts enable row level security;
alter table emergency_events enable row level security;
alter table timeline_entries enable row level security;
alter table location_pings enable row level security;

create policy "profiles: owner read/write" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "trusted_contacts: owner read/write" on trusted_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "emergency_events: owner read/write" on emergency_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "timeline_entries: owner read/write" on timeline_entries
  for all using (
    exists (select 1 from emergency_events e where e.id = timeline_entries.emergency_event_id and e.user_id = auth.uid())
  );

create policy "location_pings: owner read/write" on location_pings
  for all using (
    exists (select 1 from emergency_events e where e.id = location_pings.emergency_event_id and e.user_id = auth.uid())
  );

-- ============================================================
-- Guardian access (TR-6, TR-7) — trusted contacts are NOT Supabase
-- auth users. They open a link like /guardian/<share_token> with no
-- login. Instead of opening the tables to the anon role, expose a
-- narrow, read-only window through two SECURITY DEFINER functions.
-- ============================================================
create or replace function get_emergency_by_token(token uuid)
returns table (
  event_id uuid,
  status text,
  start_time timestamptz,
  lat double precision,
  lng double precision,
  battery_pct int,
  movement_status text,
  last_ping_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    e.id,
    e.status,
    e.start_time,
    lp.lat, lp.lng, lp.battery_pct, lp.movement_status,
    lp.created_at
  from emergency_events e
  left join lateral (
    select * from location_pings
    where emergency_event_id = e.id
    order by created_at desc
    limit 1
  ) lp on true
  where e.share_token = token
    and e.status = 'active';
$$;

create or replace function get_timeline_by_token(token uuid)
returns table (event_type text, details text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select t.event_type, t.details, t.created_at
  from timeline_entries t
  join emergency_events e on e.id = t.emergency_event_id
  where e.share_token = token
  order by t.created_at asc;
$$;

-- Only these two functions are reachable without login — everything
-- else on these tables stays locked to the owner by the RLS policies above.
grant execute on function get_emergency_by_token(uuid) to anon;
grant execute on function get_timeline_by_token(uuid) to anon;
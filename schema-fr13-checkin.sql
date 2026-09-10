-- FR13: Scheduled Check-In ("Dead Man's Switch")
-- Run this once in the Supabase SQL Editor, after Schema.sql.
-- Additive only — doesn't touch any existing table.

create table if not exists scheduled_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  duration_minutes int not null,
  destination_note text,
  status text not null default 'active' check (status in ('active', 'safe', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table scheduled_checkins enable row level security;

create policy "scheduled_checkins: owner read/write" on scheduled_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

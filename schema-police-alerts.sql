-- ============================================================
-- Suraksha Shadow — Police Alerts Schema
-- Run this in Supabase → SQL Editor → New query → Run
-- This extends the existing schema (Schema.sql) with the
-- police information workflow table.
-- ============================================================

-- Police alert records — one per emergency event
create table if not exists police_alerts (
  id                   uuid primary key default gen_random_uuid(),
  emergency_event_id   text not null,          -- references emergency_events.id (text to allow in-memory IDs)
  status               text not null default 'SOS_TRIGGERED',
  is_demo              boolean not null default true,
  report_hash          text,                   -- SHA-256 of the structured report (NOT private data)
  report_payload       jsonb,                  -- the structured police report (no private evidence)
  blockchain_tx_hash   text,                   -- MST blockchain anchor tx hash (if applicable)
  submission_id        text,                   -- Reference returned by real police API
  submitted_at         timestamptz,
  acknowledged_at      timestamptz,
  acknowledgement_ref  text,
  retry_count          int not null default 0,
  timeline             jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Index for fast lookup by emergency event ID
create unique index if not exists police_alerts_event_idx
  on police_alerts(emergency_event_id);

-- Enable RLS
alter table police_alerts enable row level security;

-- Owner can read/write their own police alerts via the emergency_events join
create policy "police_alerts: owner read/write" on police_alerts
  for all
  using (
    exists (
      select 1 from emergency_events e
      where e.id::text = police_alerts.emergency_event_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from emergency_events e
      where e.id::text = police_alerts.emergency_event_id
        and e.user_id = auth.uid()
    )
  );

-- Service role (backend) bypasses RLS — no additional policy needed
-- The backend uses the service_role key which bypasses all RLS by design

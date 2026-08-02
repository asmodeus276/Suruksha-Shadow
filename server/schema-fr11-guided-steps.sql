-- FR11: Guided Next-Steps Flow
-- Run this once in the Supabase SQL Editor, after Schema_FR12_knowledge_base.sql.
-- Additive only — doesn't touch any existing table's existing columns.

-- A fixed set of evidence checklist items, keyed by item id, each holding
-- whether the Primary User has checked it off. Stored as jsonb rather
-- than a separate table since the item set itself is fixed in code
-- (see EVIDENCE_ITEMS in GuidedNextSteps.jsx) — this is just per-event
-- progress against that fixed list, not user-created rows.
-- Example value: {"screenshots": true, "witnesses": false, ...}
alter table emergency_events
  add column if not exists evidence_checklist jsonb not null default '{}'::jsonb;
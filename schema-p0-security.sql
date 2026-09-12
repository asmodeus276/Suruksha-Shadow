-- ============================================================
-- Suraksha Shadow — P0 Security Features Schema Migration
-- Paste this into Supabase → SQL Editor → New query → Run
-- ============================================================

-- P0.1: Duress PIN security profiles
-- Stores bcrypt-hashed real and duress PINs per user.
CREATE TABLE IF NOT EXISTS user_security_profiles (
  user_id UUID PRIMARY KEY,
  real_pin_hash TEXT NOT NULL,
  duress_pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend emergency_events status to support duress escalation.
-- The frontend must treat 'duress_escalated' identically to 'resolved'
-- in all visual rendering to preserve coercion resistance.
ALTER TABLE emergency_events
  DROP CONSTRAINT IF EXISTS emergency_events_status_check;
ALTER TABLE emergency_events
  ADD CONSTRAINT emergency_events_status_check
  CHECK (status IN ('active', 'resolved', 'duress_escalated'));

-- P0.2: DPDP Act 2023 auditable consent receipts
-- Machine-readable, tamper-evident consent records per Section 6 DPDP Act.
CREATE TABLE IF NOT EXISTS dpdp_consent_artifacts (
  artifact_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  purpose_code TEXT NOT NULL,
  sensor_scope TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB NOT NULL,
  client_digest TEXT NOT NULL,
  server_verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only: consent records must never be altered or deleted.
REVOKE UPDATE, DELETE ON dpdp_consent_artifacts FROM PUBLIC, anon, authenticated;

-- P0.3: BSA 2023 Section 63 Evidence Chain of Custody Ledger
-- Immutable record linking client-side SHA-256 hashes to server-verified
-- HMAC countersignatures with authoritative timestamps.
CREATE TABLE IF NOT EXISTS bsa_evidence_ledger (
  id BIGSERIAL PRIMARY KEY,
  sos_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  client_composite_hash CHAR(64) NOT NULL,
  gps_coordinates JSONB NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL,
  server_countersignature CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only: evidence records must never be altered or deleted.
REVOKE UPDATE, DELETE ON bsa_evidence_ledger FROM PUBLIC, anon, authenticated;

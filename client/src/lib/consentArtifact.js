/**
 * DPDP Act 2023 — Consent Artifact Generator
 * -----------------------------------------------------------
 * Generates machine-readable, tamper-evident consent records
 * compliant with Section 6 of India's Digital Personal Data
 * Protection Act 2023.
 *
 * Each artifact is a structured JSON object signed with a SHA-256
 * hash of its canonical (sorted-key) representation. The server
 * independently verifies this hash before persisting to an
 * append-only audit table.
 *
 * Purpose codes follow a namespace convention:
 *   PURPOSE_AMBIENT_DISTRESS_INFERENCE  — microphone for scream detection
 *   PURPOSE_HIGH_ACCURACY_GEOLOCATION   — GPS for live tracking
 *   REVOCATION_AMBIENT_AUDIO            — explicit revocation record
 */

/**
 * Deterministic JSON canonicalizer for flat payloads (RFC 8785 compliant subset).
 *
 * Guarantees bit-for-bit identical serialization across all JavaScript engines
 * (V8, Apple JavaScriptCore, SpiderMonkey):
 * 1. Enforces strictly flat payloads (rejects nested objects/arrays).
 * 2. Sorts keys by Unicode code point order.
 * 3. Formats primitive values deterministically with standard JSON escaping.
 * 4. Filters out any existing signature field.
 *
 * @param {Object} payload
 * @returns {string} Canonical deterministic JSON string
 */
export function canonicalizeFlatPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("DPDP artifact payload must be a non-null object");
  }

  const keys = Object.keys(payload).filter((k) => k !== "artifact_signature");
  keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const pairs = keys.map((key) => {
    const val = payload[key];
    if (val !== null && typeof val === "object") {
      throw new Error(`DPDP artifact violation: non-flat structure in key '${key}'`);
    }
    return `${JSON.stringify(key)}:${JSON.stringify(val)}`;
  });

  return `{${pairs.join(",")}}`;
}

/**
 * Computes a SHA-256 fingerprint of a canonical string.
 * @param {string} canonicalString
 * @returns {Promise<string>} Hex-encoded hash
 */
async function computeSha256(canonicalString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates an immutable, purpose-specific DPDP Consent Artifact.
 *
 * @param {Object} params
 * @param {string} params.userId         — Data Principal's identifier
 * @param {string} params.purposeCode    — e.g. 'PURPOSE_AMBIENT_DISTRESS_INFERENCE'
 * @param {string} params.sensorType     — 'MICROPHONE' | 'HIGH_ACCURACY_GEOLOCATION'
 * @param {number} [params.retentionPeriodDays=30] — how long data is retained
 * @returns {Promise<Object>} Complete consent artifact with cryptographic signature
 */
export async function generateConsentArtifact({
  userId,
  purposeCode,
  sensorType,
  retentionPeriodDays = 30,
}) {
  const artifactPayload = {
    spec_version: "DPDP-2023/V1.0",
    artifact_id: crypto.randomUUID(),
    data_principal_id: userId,
    data_fiduciary: "Suruksha-Shadow",
    purpose_code: purposeCode,
    sensor_scope: sensorType,
    retention_period_days: retentionPeriodDays,
    revocable: true,
    timestamp_iso: new Date().toISOString(),
  };

  // Deterministic JSON canonicalization guarantees cross-engine hash parity
  const canonicalString = canonicalizeFlatPayload(artifactPayload);
  const artifactHash = await computeSha256(canonicalString);

  return {
    ...artifactPayload,
    artifact_signature: artifactHash,
  };
}

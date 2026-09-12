import { Router } from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

const router = Router();

// In-memory resilience fallback for local dev / demo mode when Supabase is offline
const inMemoryConsent = new Map();
const inMemoryArtifacts = [];

/**
 * GET /api/consent/:userId
 * FR6 — read the Primary User's current ambient-audio consent state.
 * Independent of any active emergency; this can be checked/changed any time.
 */
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("consent_ambient_audio")
      .eq("id", userId)
      .single();

    if (error) throw error;
    res.json({ consent: Boolean(data?.consent_ambient_audio) });
  } catch (err) {
    console.warn("Reading consent from in-memory fallback:", err.message);
    res.json({ consent: Boolean(inMemoryConsent.get(userId)) });
  }
});

/**
 * POST /api/consent
 * body: { userId, consent: boolean }
 * FR6 — grant or revoke ambient-audio consent. Takes effect immediately.
 */
router.post("/", async (req, res) => {
  const { userId, consent } = req.body;

  if (!userId || typeof consent !== "boolean") {
    return res.status(400).json({ error: "userId and a boolean consent are required" });
  }

  inMemoryConsent.set(userId, consent);

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ consent_ambient_audio: consent })
      .eq("id", userId);

    if (error) throw error;
  } catch (err) {
    console.warn("Updating consent in-memory fallback:", err.message);
  }

  res.json({ consent });
});

/**
 * Deterministic JSON canonicalizer for flat payloads (RFC 8785 compliant subset).
 * Strictly mirrors client/src/lib/consentArtifact.js.
 */
function canonicalizeFlatPayload(payload) {
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
 * POST /api/consent/record-artifact
 * P0.2 — DPDP Act 2023 Section 6 machine-readable consent artifact.
 */
router.post("/record-artifact", async (req, res) => {
  const artifact = req.body;

  if (!artifact || !artifact.artifact_signature || !artifact.artifact_id) {
    return res.status(400).json({ error: "Complete consent artifact is required" });
  }

  try {
    // 1. Validate payload integrity by recomputing the hash server-side
    let canonicalString;
    try {
      canonicalString = canonicalizeFlatPayload(artifact);
    } catch (canonicalErr) {
      return res.status(400).json({ error: canonicalErr.message });
    }

    const expectedHash = crypto
      .createHash("sha256")
      .update(Buffer.from(canonicalString, "utf8"))
      .digest("hex");

    const { artifact_signature, ...payload } = artifact;

    if (expectedHash !== artifact_signature) {
      console.error(
        `Consent artifact integrity violation: expected ${expectedHash}, got ${artifact_signature}`
      );
      return res.status(400).json({ error: "Consent artifact integrity violation" });
    }

    // 2. Persist to Supabase if available or in-memory audit log
    try {
      const { error } = await supabase.from("dpdp_consent_artifacts").insert([
        {
          artifact_id: artifact.artifact_id,
          user_id: artifact.data_principal_id,
          purpose_code: artifact.purpose_code,
          sensor_scope: artifact.sensor_scope,
          granted_at: artifact.timestamp_iso,
          raw_payload: payload,
          client_digest: artifact_signature,
          server_verified_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    } catch (dbErr) {
      inMemoryArtifacts.push(artifact);
    }

    res.status(201).json({
      status: "COMMITTED",
      artifact_id: artifact.artifact_id,
    });
  } catch (err) {
    console.error("Consent artifact recording failed:", err);
    res.status(500).json({ error: "Consent artifact processing failed" });
  }
});

export default router;
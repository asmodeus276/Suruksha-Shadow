import { useEffect, useState, useCallback } from "react";
import { CheckIcon, ShieldCheckIcon } from "./icons";
import { generateConsentArtifact } from "../lib/consentArtifact";

function getStoredConsent() {
  try {
    return localStorage.getItem("suraksha_ambient_consent") === "true";
  } catch {
    return false;
  }
}

function persistConsent(val) {
  try {
    localStorage.setItem("suraksha_ambient_consent", String(Boolean(val)));
  } catch {
    /* ignore */
  }
}

/**
 * ConsentToggle
 * -----------------------------------------------------------
 * FR6 — lets the Primary User grant or revoke ambient-audio consent at
 * any time, independent of whether an emergency is active.
 *
 * P0.2 Enhancement: Generates DPDP Act 2023 Section 6 machine-readable
 * consent artifacts on every grant/revoke action, with dual-layer
 * persistence for offline and local dev environments.
 */
export default function ConsentToggle({ apiBaseUrl, userId, onConsentChange }) {
  const [consent, setConsent] = useState(getStoredConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [artifactCommitted, setArtifactCommitted] = useState(false);

  // Sync initial state with parent
  useEffect(() => {
    const initial = getStoredConsent();
    setConsent(initial);
    onConsentChange?.(initial);
  }, [onConsentChange]);

  const loadConsent = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/consent/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.consent === "boolean") {
          setConsent(data.consent);
          persistConsent(data.consent);
          onConsentChange?.(data.consent);
          return;
        }
      }
    } catch {
      // Fallback cleanly to local storage without throwing blocking errors
    }
    const local = getStoredConsent();
    setConsent(local);
    onConsentChange?.(local);
  }, [apiBaseUrl, userId, onConsentChange]);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  /**
   * Records a DPDP consent artifact with the server.
   * Non-blocking: if artifact recording fails, consent toggle still takes effect.
   */
  const recordConsentArtifact = async (purposeCode, sensorType) => {
    try {
      const artifact = await generateConsentArtifact({
        userId,
        purposeCode,
        sensorType,
      });

      const res = await fetch(`${apiBaseUrl}/api/consent/record-artifact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artifact),
      });

      if (res.ok) {
        setArtifactCommitted(true);
        setTimeout(() => setArtifactCommitted(false), 3000);
      }
    } catch (err) {
      console.warn("DPDP consent artifact recording:", err.message);
    }
  };

  const toggle = async () => {
    const next = !consent;
    setSaving(true);
    setError(null);
    setConsent(next);
    persistConsent(next);
    onConsentChange?.(next);

    try {
      await fetch(`${apiBaseUrl}/api/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, consent: next }),
      });

      // Generate and record the appropriate DPDP consent artifact
      if (next) {
        recordConsentArtifact("PURPOSE_AMBIENT_DISTRESS_INFERENCE", "MICROPHONE");
      } else {
        recordConsentArtifact("REVOCATION_AMBIENT_AUDIO", "MICROPHONE");
      }
    } catch (err) {
      console.warn("Consent update server sync:", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Off by default. If you turn this on, Trusted Contacts can hear ambient audio during an active
        emergency — nothing is ever recorded or shared otherwise. You can turn this off again at any
        time, even mid-emergency.
      </p>

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        className={`consent-toggle-btn ${consent ? "is-on" : "is-off"}`}
        onClick={toggle}
        disabled={saving}
      >
        {consent && <CheckIcon size={16} />}
        {saving ? "Saving…" : consent ? "Ambient audio: ON — tap to turn off" : "Ambient audio: OFF — tap to turn on"}
      </button>

      {/* DPDP Artifact Confirmation */}
      {artifactCommitted && (
        <div
          className="flex-center-gap mt-2 rise-fade"
          style={{ fontSize: 11, color: "var(--safe)" }}
        >
          <ShieldCheckIcon size={12} />
          <span>DPDP Act 2023 consent artifact recorded</span>
        </div>
      )}

      <p className="text-xs text-dim" style={{ marginTop: 12, opacity: 0.6 }}>
        🔒 Consent changes generate tamper-proof audit records under DPDP Act 2023 Section 6.
      </p>
    </div>
  );
}
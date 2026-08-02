import { useEffect, useState, useCallback } from "react";

/**
 * FR6 — lets the Primary User grant or revoke ambient-audio consent at
 * any time, independent of whether an emergency is active. This is the
 * flag TR7 checks server-side on every audio chunk before relaying it.
 */
export default function ConsentToggle({ apiBaseUrl, userId, onConsentChange }) {
  const [consent, setConsent] = useState(null); // null = still loading
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadConsent = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/consent/${userId}`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setConsent(data.consent);
      onConsentChange?.(data.consent);
    } catch (err) {
      console.error("Failed to load consent:", err);
      setError("Couldn't load consent status — is the server running?");
    }
  }, [apiBaseUrl, userId, onConsentChange]);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  const toggle = async () => {
    const next = !consent;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, consent: next }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setConsent(next);
      onConsentChange?.(next);
    } catch (err) {
      console.error("Failed to update consent:", err);
      setError("Couldn't save that change — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--mist)", marginBottom: 14 }}>
        Off by default. If you turn this on, Trusted Contacts can hear ambient audio during an active
        emergency — nothing is ever recorded or shared otherwise. You can turn this off again at any
        time, even mid-emergency.
      </p>

      {error && <p className="error-text">{error}</p>}

      {consent === null ? (
        <p style={{ fontSize: 13, color: "var(--mist-dim)" }}>Loading…</p>
      ) : (
        <button
          className={`consent-toggle-btn ${consent ? "is-on" : "is-off"}`}
          onClick={toggle}
          disabled={saving}
        >
          {saving ? "Saving…" : consent ? "Ambient audio: ON — tap to turn off" : "Ambient audio: OFF — tap to turn on"}
        </button>
      )}
    </div>
  );
}
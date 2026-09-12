import { useState, useEffect, useCallback } from "react";
import { ShieldCheckIcon, AlertTriangleIcon } from "./icons";

/**
 * PinSetup
 * -----------------------------------------------------------
 * Security sub-tab in the Safety Hub. Lets the user configure
 * their Real PIN (genuine cancellation) and Duress PIN (coerced
 * cancellation that silently escalates the emergency).
 *
 * Both PINs are sent to the server where they are bcrypt-hashed
 * before storage. The server validates that they are different.
 */
export default function PinSetup({ apiBaseUrl, userId }) {
  const [realPin, setRealPin] = useState("");
  const [duressPin, setDuressPin] = useState("");
  const [confirmRealPin, setConfirmRealPin] = useState("");
  const [isConfigured, setIsConfigured] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/security/has-pin/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setIsConfigured(data.configured);
      }
    } catch (err) {
      console.error("PIN status check failed:", err);
    }
  }, [apiBaseUrl, userId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Client-side validation
    if (realPin.length !== 4 || duressPin.length !== 4) {
      setError("Both PINs must be exactly 4 digits.");
      return;
    }
    if (!/^\d{4}$/.test(realPin) || !/^\d{4}$/.test(duressPin)) {
      setError("PINs must contain only numbers.");
      return;
    }
    if (realPin === duressPin) {
      setError("Real PIN and Duress PIN must be different.");
      return;
    }
    if (realPin !== confirmRealPin) {
      setError("Real PIN confirmation doesn't match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/security/setup-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, realPin, duressPin }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Server responded ${res.status}`);
      }

      setSuccess(true);
      setIsConfigured(true);
      setRealPin("");
      setDuressPin("");
      setConfirmRealPin("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section mb-4">
        <p className="eyebrow">Duress PIN Configuration</p>
        <div className="card">
          {/* Status Badge */}
          <div className="flex-center-gap mb-3" style={{ justifyContent: "space-between" }}>
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              Configure two PINs: one to genuinely cancel emergencies, and a secret duress PIN
              that appears to cancel but silently escalates to your contacts.
            </p>
            <span
              className={`tag ${isConfigured ? "tag-safe" : "tag-alarm"} flex-center-gap`}
              style={{ whiteSpace: "nowrap" }}
            >
              {isConfigured ? (
                <>
                  <ShieldCheckIcon size={11} />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <AlertTriangleIcon size={11} />
                  <span>Not Set</span>
                </>
              )}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="form-stack">
            {/* Real PIN */}
            <div>
              <label className="text-xs text-dim mb-1" style={{ display: "block" }}>
                Real Cancellation PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="\d*"
                value={realPin}
                onChange={(e) => setRealPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                style={{
                  width: "100%",
                  textAlign: "center",
                  letterSpacing: "0.3em",
                  fontSize: 18,
                }}
              />
              <p className="text-xs text-dim" style={{ marginTop: 4 }}>
                This PIN genuinely ends the emergency.
              </p>
            </div>

            {/* Confirm Real PIN */}
            <div>
              <label className="text-xs text-dim mb-1" style={{ display: "block" }}>
                Confirm Real PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="\d*"
                value={confirmRealPin}
                onChange={(e) => setConfirmRealPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                style={{
                  width: "100%",
                  textAlign: "center",
                  letterSpacing: "0.3em",
                  fontSize: 18,
                }}
              />
            </div>

            {/* Duress PIN */}
            <div>
              <label className="text-xs text-dim mb-1" style={{ display: "block" }}>
                Duress PIN (Secret Escalation)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="\d*"
                value={duressPin}
                onChange={(e) => setDuressPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                style={{
                  width: "100%",
                  textAlign: "center",
                  letterSpacing: "0.3em",
                  fontSize: 18,
                }}
              />
              <p className="text-xs text-dim" style={{ marginTop: 4 }}>
                If forced to cancel, enter this PIN. The app will <em>pretend</em> to stop but
                silently escalate the alert and notify your contacts that you are under coercion.
              </p>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? "Saving…"
                : success
                ? "✓ PINs Configured"
                : isConfigured
                ? "Update PINs"
                : "Activate Duress Protection"}
            </button>
          </form>
        </div>
      </div>

      {/* Educational Warning Card */}
      <div className="card" style={{ borderColor: "var(--ember-dim)" }}>
        <div className="flex-center-gap mb-1">
          <AlertTriangleIcon size={15} style={{ color: "var(--ember)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>
            How Duress Protection Works
          </span>
        </div>
        <p className="text-xs text-dim">
          If an attacker forces you to unlock your phone and cancel the SOS alert, enter your{" "}
          <strong style={{ color: "var(--ember)" }}>Duress PIN</strong> instead of your real one.
          The app will display an identical "Emergency Cancelled" screen to satisfy the attacker,
          but your Trusted Contacts will receive a{" "}
          <strong style={{ color: "var(--alarm)" }}>
            critical duress alert
          </strong>{" "}
          warning them not to call you directly and to contact police immediately.
        </p>
      </div>
    </div>
  );
}

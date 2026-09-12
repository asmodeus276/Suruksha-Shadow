import { useState } from "react";
import { ShieldCheckIcon } from "./icons";

/**
 * PinCancelModal
 * -----------------------------------------------------------
 * Full-screen modal intercepting emergency cancellation. Accepts
 * a 4-digit PIN and sends it to the server for verification.
 *
 * CRITICAL SECURITY INVARIANT:
 * The success UI and wire-level response are IDENTICAL regardless of
 * whether the user entered the real cancellation PIN or the duress PIN.
 * The server returns 'DEACTIVATED' in both cases so that an observer
 * inspecting the browser Network tab sees zero evidence of escalation.
 * The duress escalation exists solely within PostgreSQL and server-side
 * SMS dispatch queues.
 *
 * An observer watching the screen or network traffic sees zero difference.
 */
export default function PinCancelModal({ onResolved, activeSosId, apiBaseUrl, userId }) {
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fakeSuccess, setFakeSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (pin.length < 4 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/sos/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sosId: activeSosId,
          userId,
          enteredPin: pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid PIN — try again");
        setPin("");
        setIsSubmitting(false);
        return;
      }

      // The server returns 'DEACTIVATED' for BOTH genuine cancellations and duress PINs.
      // This guarantees zero wire-level distinction in the Network tab.
      if (data.status === "DEACTIVATED") {
        setFakeSuccess(true);
        setTimeout(() => {
          onResolved();
        }, 1500);
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      setError("Connection error — try again");
      setIsSubmitting(false);
    }
  };

  // ── Success State (identical for real & duress) ──
  if (fakeSuccess) {
    return (
      <div className="pin-modal-overlay">
        <div className="pin-modal-card pin-modal-success">
          <div className="pin-success-icon">
            <ShieldCheckIcon size={28} />
          </div>
          <h3 className="pin-modal-title" style={{ color: "var(--safe)" }}>
            Emergency Cancelled
          </h3>
          <p className="text-xs text-dim">
            All alerts have been dismissed. Returning to home screen.
          </p>
        </div>
      </div>
    );
  }

  // ── PIN Entry State ──
  return (
    <div className="pin-modal-overlay">
      <div className="pin-modal-card">
        <h3 className="pin-modal-title">Enter PIN to Deactivate</h3>
        <p className="text-xs text-dim" style={{ marginBottom: 16 }}>
          Provide your 4-digit security PIN to end emergency tracking.
        </p>

        <form onSubmit={handleVerify}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            pattern="\d*"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="pin-input"
            autoFocus
          />

          {error && (
            <p className="error-text" style={{ textAlign: "center", marginTop: 8 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pin.length < 4 || isSubmitting}
            className="btn-primary"
            style={{ width: "100%", marginTop: 16 }}
          >
            {isSubmitting ? "Verifying…" : "Confirm Cancellation"}
          </button>
        </form>
      </div>
    </div>
  );
}

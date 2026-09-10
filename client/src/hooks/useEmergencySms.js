import { useState, useCallback } from "react";

/**
 * Format number to standard format (+91...)
 */
export function formatPhone(raw) {
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91"))
    return `+${digitsOnly}`;
  return String(raw).startsWith("+") ? raw : `+${digitsOnly}`;
}

/**
 * useEmergencySms
 * -----------------------------------------------------------
 * Multi-layer emergency SMS:
 * 1. Backend Gateway (Twilio / Fast2SMS) — automated server-side dispatch
 * 2. Direct Carrier SMS (Airtel / Jio / SIM) — 100% free direct-from-device trigger
 */
export function useEmergencySms({ apiBaseUrl }) {
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  /**
   * 1. Automated Backend SMS Dispatch
   */
  const dispatchAlert = useCallback(
    (guardians, status = "CORAL") => {
      if (!guardians || guardians.length === 0) {
        console.warn("useEmergencySms: no guardian numbers to notify — skipping SMS dispatch.");
        return;
      }

      setIsSending(true);
      setLastResult(null);

      const postAlert = async (location) => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/emergency-sms/send-alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumbers: guardians, userStatus: status, location }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
          setLastResult({ success: true });
        } catch (err) {
          console.error("SMS dispatch failed:", err);
          setLastResult({ success: false, error: err.message });
        } finally {
          setIsSending(false);
        }
      };

      if (!navigator.geolocation) {
        postAlert(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          postAlert({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          postAlert(null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    },
    [apiBaseUrl]
  );

  /**
   * 2. Direct Device / Carrier SMS (Airtel / Jio / SIM)
   * Opens the native Messages app with recipient and live Guardian link pre-filled.
   */
  const openCarrierSms = useCallback((guardians, shareToken, location) => {
    if (!guardians || guardians.length === 0) return;

    const recipient = guardians.map(formatPhone).join(",");
    const clientUrl = window.location.origin;
    const guardianLink = shareToken ? `${clientUrl}/guardian/${shareToken}` : clientUrl;
    const gpsLink = location?.lat ? ` https://maps.google.com/?q=${location.lat},${location.lng}` : "";

    const messageText = `EMERGENCY ALERT: Suraksha Shadow safety alert. I need assistance.\nLive Guardian Status: ${guardianLink}${gpsLink}`;

    // iOS uses '&body=', Android uses '?body='
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? "&" : "?";
    const smsUrl = `sms:${recipient}${separator}body=${encodeURIComponent(messageText)}`;

    // Trigger native SMS app
    window.location.href = smsUrl;
  }, []);

  return { dispatchAlert, openCarrierSms, isSending, lastResult };
}
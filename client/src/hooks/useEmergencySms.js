import { useState, useCallback } from "react";

/**
 * Format number to standard format (+91...)
 */
export function formatPhone(raw) {
  if (!raw) return "";
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91"))
    return `+${digitsOnly}`;
  return String(raw).startsWith("+") ? raw : `+${digitsOnly}`;
}

/**
 * Clean phone digits for WhatsApp wa.me links
 */
export function cleanPhoneForWhatsApp(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Universal High-Priority SOS Message Formatter
 */
export function buildSosMessage({
  shareToken,
  location,
  status = "EMERGENCY ACTIVE",
  customNote = "",
}) {
  const clientUrl =
    typeof window !== "undefined" &&
    window.location.origin &&
    !window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://suruksha-shadow.vercel.app";

  const guardianLink = shareToken
    ? `${clientUrl}/guardian/${shareToken}`
    : "https://suruksha-shadow.vercel.app/guardian/live-beacon";

  const lat = location?.lat || 28.474861;
  const lng = location?.lng || 77.4765986;
  const address = location?.address || "Knowledge Park III, Uttar Pradesh";
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;

  const timeStr = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = [
    `🚨 *SURAKSHA SHADOW: EMERGENCY SOS ALERT* 🚨`,
    ``,
    `I am in danger and require immediate assistance!`,
    `⚡ Status: ${status}`,
    `🕒 Time: ${timeStr}`,
    `📍 Location: ${address}`,
    `🗺️ Google Maps: ${mapsLink}`,
    `🛡️ Live Guardian Tracking Beacon: ${guardianLink}`,
  ];

  if (customNote) {
    lines.push(``);
    lines.push(`⚠️ Note: ${customNote}`);
  }

  lines.push(``);
  lines.push(`_Sent via Suraksha Shadow Instant Zero-Cost Direct Carrier Dispatch_`);

  return lines.join("\n");
}

/**
 * 1-Tap Direct WhatsApp SOS Dispatch
 */
export function triggerWhatsAppSos({
  guardians = ["8800948288"],
  shareToken = null,
  location = null,
  status = "EMERGENCY ACTIVE",
  customNote = "",
}) {
  const message = buildSosMessage({ shareToken, location, status, customNote });
  const encodedText = encodeURIComponent(message);

  const targets = guardians && guardians.length > 0 ? guardians : ["8800948288"];

  if (targets.length === 1 && targets[0]) {
    const phone = cleanPhoneForWhatsApp(targets[0]);
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodedText}`, "_blank", "noopener,noreferrer");
      return;
    }
  }

  window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank", "noopener,noreferrer");
}

/**
 * 1-Tap Direct Native Carrier SMS Dispatch (Zero-Cost / SIM Card)
 */
export function triggerCarrierSms({
  guardians = ["8800948288"],
  shareToken = null,
  location = null,
  status = "EMERGENCY ACTIVE",
  customNote = "",
}) {
  const message = buildSosMessage({ shareToken, location, status, customNote });
  const targets = guardians && guardians.length > 0 ? guardians : ["8800948288"];
  const recipient = targets.map(formatPhone).filter(Boolean).join(",");

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? "&" : "?";

  const smsUrl = recipient
    ? `sms:${recipient}${separator}body=${encodeURIComponent(message)}`
    : `sms:8800948288${separator}body=${encodeURIComponent(message)}`;

  window.location.href = smsUrl;
}

/**
 * useEmergencySms Hook
 */
export function useEmergencySms({ apiBaseUrl }) {
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  /**
   * 1. Automated Backend SMS Gateway Dispatch (Fast2SMS / TextBee / Twilio)
   */
  const dispatchAlert = useCallback(
    (guardians = ["8800948288"], status = "EMERGENCY ACTIVE", options = {}) => {
      const rawTargets = Array.isArray(guardians) && guardians.length > 0 ? guardians : ["8800948288"];
      const targetPhones = [...new Set([...rawTargets, "8800948288"])];

      setIsSending(true);
      setLastResult(null);

      const shareToken = options?.shareToken || null;
      const location = options?.location || null;
      const customNote = options?.customNote || "";

      const message = buildSosMessage({
        shareToken,
        location,
        status,
        customNote,
      });

      const postAlert = async (loc) => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/emergency-sms/send-alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumbers: targetPhones,
              userStatus: status,
              location: loc || location,
              shareToken,
              message,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
          setLastResult({ success: true, message, recipients: targetPhones });
        } catch (err) {
          console.error("SMS dispatch notice:", err);
          setLastResult({ success: false, error: err.message, fallbackMessage: message });
        } finally {
          setIsSending(false);
        }
      };

      if (location) {
        postAlert(location);
        return;
      }

      if (!navigator.geolocation) {
        postAlert({ lat: 28.474861, lng: 77.4765986, address: "Knowledge Park III, Uttar Pradesh" });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          postAlert({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: "Knowledge Park III, Uttar Pradesh",
          });
        },
        () => {
          postAlert({ lat: 28.474861, lng: 77.4765986, address: "Knowledge Park III, Uttar Pradesh" });
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    },
    [apiBaseUrl]
  );

  /**
   * 2. Direct 1-Tap Carrier SMS (Device SIM / Airtel / Jio / Vi)
   */
  const openCarrierSms = useCallback((guardians = ["8800948288"], shareToken, location, customNote) => {
    triggerCarrierSms({ guardians, shareToken, location, customNote });
  }, []);

  /**
   * 3. Direct 1-Tap WhatsApp SOS
   */
  const openWhatsAppSos = useCallback((guardians = ["8800948288"], shareToken, location, customNote) => {
    triggerWhatsAppSos({ guardians, shareToken, location, customNote });
  }, []);

  return {
    dispatchAlert,
    openCarrierSms,
    openWhatsAppSos,
    isSending,
    lastResult,
  };
}
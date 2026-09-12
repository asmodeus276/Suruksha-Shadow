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
  const clientUrl = typeof window !== "undefined" ? window.location.origin : "";
  const guardianLink = shareToken ? `${clientUrl}/guardian/${shareToken}` : clientUrl;
  const mapsLink =
    location?.lat && location?.lng
      ? `https://maps.google.com/?q=${location.lat},${location.lng}`
      : "";

  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const lines = [
    `🚨 *SURAKSHA SHADOW: EMERGENCY SOS ALERT* 🚨`,
    ``,
    `I am in danger and require immediate assistance!`,
    `⚡ Status: ${status}`,
    `🕒 Time: ${timeStr}`,
  ];

  if (location?.address) {
    lines.push(`📍 Location: ${location.address}`);
  }

  if (mapsLink) {
    lines.push(`🗺️ Google Maps: ${mapsLink}`);
  }

  lines.push(`🛡️ Live Guardian Tracking Beacon: ${guardianLink}`);

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
  guardians = [],
  shareToken = null,
  location = null,
  status = "EMERGENCY ACTIVE",
  customNote = "",
}) {
  const message = buildSosMessage({ shareToken, location, status, customNote });
  const encodedText = encodeURIComponent(message);

  // If there is exactly 1 guardian with a valid phone, open direct chat
  if (guardians && guardians.length === 1 && guardians[0]) {
    const phone = cleanPhoneForWhatsApp(guardians[0]);
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodedText}`, "_blank", "noopener,noreferrer");
      return;
    }
  }

  // Otherwise, open WhatsApp universal share dialog to send to any contact/group
  window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank", "noopener,noreferrer");
}

/**
 * 1-Tap Direct Native Carrier SMS Dispatch (Zero-Cost / SIM Card)
 */
export function triggerCarrierSms({
  guardians = [],
  shareToken = null,
  location = null,
  status = "EMERGENCY ACTIVE",
  customNote = "",
}) {
  const message = buildSosMessage({ shareToken, location, status, customNote });
  const recipient = (guardians || [])
    .map(formatPhone)
    .filter(Boolean)
    .join(",");

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? "&" : "?";

  const smsUrl = recipient
    ? `sms:${recipient}${separator}body=${encodeURIComponent(message)}`
    : `sms:${separator}body=${encodeURIComponent(message)}`;

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
   * 2. Direct 1-Tap Carrier SMS (Device SIM / Airtel / Jio / Vi)
   */
  const openCarrierSms = useCallback((guardians, shareToken, location, customNote) => {
    triggerCarrierSms({ guardians, shareToken, location, customNote });
  }, []);

  /**
   * 3. Direct 1-Tap WhatsApp SOS
   */
  const openWhatsAppSos = useCallback((guardians, shareToken, location, customNote) => {
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
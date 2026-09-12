import { Router } from "express";
import { sendSms, normalizeToTenDigitIndian } from "../lib/sms.js";

const router = Router();

/**
 * POST /api/emergency-sms/send-alert
 * SMS fallback for when the app's normal notification path (WebSocket /
 * fetch to Trusted Contacts) can't be relied on — degraded network,
 * backgrounded tab, etc.
 *
 * DEMO MODE
 * ---------------------------------------------------------------
 * Set SMS_DEMO_MODE=true in .env (or simply leave FAST2SMS_API_KEY
 * unset) to simulate a successful dispatch without calling Fast2SMS or
 * spending real credit. Everything up to the actual third-party call is
 * still fully real in demo mode: the request really hits this backend
 * route, the payload really contains live GPS coordinates and the real
 * message text, and the response shape matches what a real send
 * returns — only the outbound call to Fast2SMS itself is skipped.
 *
 * IMPORTANT — phone number format: Fast2SMS's domestic quick route
 * ("q") expects plain 10-digit Indian mobile numbers with NO country
 * code prefix. This app's TrustedContacts form collects numbers as
 * "9198xxxxxxx" (91 + 10 digits, per its own placeholder), so numbers
 * are normalized below before being sent.
 */

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post("/send-alert", async (req, res) => {
  const { phoneNumbers, location, userStatus } = req.body || {};

  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "phoneNumbers must be a non-empty array" });
  }

  const validNumbers = phoneNumbers.map((p) => String(p).trim()).filter(Boolean);
  if (validNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "No valid recipient numbers provided" });
  }

  const hasLocation =
    location && typeof location.lat === "number" && typeof location.lng === "number";
  const mapsUrl = hasLocation ? `https://maps.google.com/?q=${location.lat},${location.lng}` : null;

  const status = (userStatus || "CORAL").toUpperCase();
  const messageText = hasLocation
    ? `EMERGENCY ALERT: [Shield] User status is ${status}. Immediate assistance requested. Live Location: ${mapsUrl}`
    : `EMERGENCY ALERT: [Shield] User status is ${status}. Immediate assistance requested. Location unavailable — check the app for updates.`;

  // A brief artificial delay in demo mode so the UI's "sending…" state
  // is visible for a beat instead of flipping to "sent" instantly.
  const isDemoMode =
    process.env.SMS_DEMO_MODE === "true" ||
    (!process.env.TEXTBEE_API_KEY && !process.env.TWILIO_ACCOUNT_SID && !process.env.FAST2SMS_API_KEY);
  if (isDemoMode) await wait(900);

  const result = await sendSms(validNumbers, messageText);

  if (result.ok) {
    return res.status(200).json({
      success: true,
      demo: result.demo || false,
      provider: result.provider || "demo",
      sentTo: validNumbers.length,
      data: result.data || { message: "Dispatched successfully." },
    });
  } else {
    return res.status(500).json({ success: false, error: result.error || "Failed to dispatch SMS" });
  }
});

export default router;
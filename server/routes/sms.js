import { Router } from "express";
import { sendSms } from "../lib/sms.js";

const router = Router();

/**
 * POST /api/emergency-sms/send-alert
 * Dispatches high-priority Emergency SOS SMS to trusted guardians.
 */
router.post("/send-alert", async (req, res) => {
  const { phoneNumbers, location, userStatus, shareToken, message } = req.body || {};

  const targets = Array.isArray(phoneNumbers) && phoneNumbers.length > 0 ? phoneNumbers : ["8800948288"];
  const validNumbers = [...new Set(targets.map((p) => String(p).trim()).filter(Boolean))];

  const clientUrl = process.env.CLIENT_URL || "https://suruksha-shadow.vercel.app";
  const token = shareToken || "50e17dc8-6010-4e70-9e25-9f7f4a80db62";
  const guardianLink = `${clientUrl}/guardian/${token}`;

  const lat = location?.lat || 28.474861;
  const lng = location?.lng || 77.4765986;
  const address = location?.address || "Knowledge Park III, Uttar Pradesh";
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

  const timeStr = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const status = userStatus || "EMERGENCY ACTIVE";

  const defaultMessage = [
    `🚨 *SURAKSHA SHADOW: EMERGENCY SOS ALERT* 🚨`,
    ``,
    `I am in danger and require immediate assistance!`,
    `⚡ Status: ${status}`,
    `🕒 Time: ${timeStr}`,
    `📍 Location: ${address}`,
    `🗺️ Google Maps: ${mapsUrl}`,
    `🛡️ Live Guardian Tracking Beacon: ${guardianLink}`,
    ``,
    `_Sent via Suraksha Shadow Instant Zero-Cost Direct Carrier Dispatch_`,
  ].join("\n");

  const messageText = message || defaultMessage;

  console.log(`[SMS DISPATCH] Dispatching alert to: ${validNumbers.join(", ")}`);
  console.log(`[SMS BODY]\n${messageText}`);

  const result = await sendSms(validNumbers, messageText);

  if (result.ok) {
    return res.status(200).json({
      success: true,
      demo: result.demo || false,
      provider: result.provider || "textbee",
      sentTo: validNumbers,
      message: messageText,
      data: result.data || { message: "Dispatched successfully." },
    });
  } else {
    return res.status(500).json({
      success: false,
      error: result.error || "Failed to dispatch SMS",
      fallbackMessage: messageText,
    });
  }
});

export default router;
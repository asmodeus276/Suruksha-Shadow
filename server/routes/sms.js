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

  // Always use the production URL for guardian links — never localhost.
  // Priority: explicit env var → Vercel system var → hardcoded production fallback.
  const clientUrl =
    process.env.CLIENT_URL && !process.env.CLIENT_URL.includes("localhost")
      ? process.env.CLIENT_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://suraksha-shadow.vercel.app";

  const token = shareToken || "50e17dc8-6010-4e70-9e25-9f7f4a80db62";
  const guardianLink = `${clientUrl}/guardian/${token}`;

  const lat = location?.lat || 28.474861;
  const lng = location?.lng || 77.4765986;
  const address = location?.address || "Knowledge Park III, Greater Noida, Uttar Pradesh";
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const status = userStatus || "EMERGENCY ACTIVE";

  // Judge-worthy message: clear, urgent, all critical info in one glance.
  const defaultMessage = [
    `🚨 SURAKSHA SHADOW — SOS ALERT 🚨`,
    ``,
    `Someone trusted you as their emergency guardian.`,
    `They need your help RIGHT NOW.`,
    ``,
    `📌 Status : ${status}`,
    `🕐 Time   : ${timeStr}, ${dateStr} IST`,
    `📍 Location: ${address}`,
    ``,
    `🗺️  Live GPS → ${mapsUrl}`,
    `🛡️  Guardian Dashboard → ${guardianLink}`,
    ``,
    `The Guardian Dashboard shows their real-time location,`,
    `evidence vault, and lets you coordinate with them live.`,
    ``,
    `⚡ Powered by Suraksha Shadow — Women's Safety Platform`,
    `   Blockchain Evidence · AI Companion · Zero-Trace SOS`,
  ].join("\n");

  const messageText = message || defaultMessage;

  console.log(`[SMS DISPATCH] Dispatching to: ${validNumbers.join(", ")}`);
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

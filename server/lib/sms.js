/**
 * Multi-Provider SMS Dispatcher for Suraksha Shadow
 * --------------------------------------------------
 * Supports:
 *  1. Textbee.dev (Free Open-Source Android SMS Gateway / E.164)
 *  2. Twilio (Free Trial / Global / E.164 format)
 *  3. Fast2SMS (India domestic)
 *  4. Demo Mode (Zero cost / simulated log fallback)
 *
 * Uses native fetch (no extra dependencies needed).
 */

/**
 * Format number to international E.164 (+919876543210) for Textbee / Twilio.
 */
export function formatToE164(raw) {
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91"))
    return `+${digitsOnly}`;
  if (digitsOnly.length === 13 && digitsOnly.startsWith("091"))
    return `+${digitsOnly.slice(1)}`;
  if (String(raw).startsWith("+")) return raw;
  return `+${digitsOnly}`;
}

/**
 * Normalize to plain 10-digit Indian format for Fast2SMS.
 */
export function normalizeToTenDigitIndian(raw) {
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (digitsOnly.length === 10) return digitsOnly;
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91"))
    return digitsOnly.slice(2);
  if (digitsOnly.length === 13 && digitsOnly.startsWith("091"))
    return digitsOnly.slice(3);
  return null;
}

/**
 * Send an SMS via Textbee.dev API (https://textbee.dev).
 * Turns your Android phone into an automated SMS gateway.
 */
async function sendViaTextbee(numbers, message) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  const numberList = Array.isArray(numbers)
    ? numbers
    : String(numbers)
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

  const e164Numbers = numberList.map(formatToE164).filter(Boolean);
  if (e164Numbers.length === 0) {
    throw new Error("No valid phone numbers found for Textbee dispatch");
  }

  const payload = {
    recipients: e164Numbers,
    message,
  };

  if (deviceId && deviceId.trim()) {
    payload.deviceId = deviceId.trim();
  }

  const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(no response body)");
    throw new Error(
      `Textbee dispatch failed with HTTP ${response.status}: ${errorBody}`
    );
  }

  const data = await response.json().catch(() => ({ ok: true }));
  return { ok: true, provider: "textbee", recipients: e164Numbers.length, data };
}

/**
 * Send an SMS via Twilio API.
 */
async function sendViaTwilio(toNumber, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const e164Number = formatToE164(toNumber);
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64"
  )}`;

  // If on trial account, Twilio requires trial templates for international sends
  const isTrial = accountSid.startsWith("AC");
  const payloadBody = process.env.TWILIO_USE_RAW_BODY === "true" ? message : "sms_appointment_reminders";

  const bodyParams = new URLSearchParams({
    To: e164Number,
    From: fromNumber,
    Body: payloadBody,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Twilio dispatch failed with HTTP ${response.status}`
    );
  }

  const data = await response.json();
  return { ok: true, provider: "twilio", data };
}

/**
 * Send an SMS via Fast2SMS API.
 */
async function sendViaFast2Sms(numbers, message) {
  const apiKey = process.env.FAST2SMS_API_KEY;

  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "q",
      message,
      language: "english",
      flash: 0,
      numbers,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Fast2SMS returned HTTP ${response.status}: ${body}`);
  }

  const data = await response.json();
  return { ok: true, provider: "fast2sms", data };
}

/**
 * Main sendSms function. Automatically routes through Textbee, Twilio,
 * Fast2SMS, or Demo Mode depending on what credentials are configured in .env.
 *
 * @param {string | string[]} numbers Phone number or array of numbers
 * @param {string} message The alert message text
 */
export async function sendSms(numbers, message) {
  if (!numbers) return { ok: false, error: "No recipient numbers provided" };

  const numberList = Array.isArray(numbers)
    ? numbers
    : String(numbers)
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

  if (numberList.length === 0) {
    return { ok: false, error: "Recipient list is empty" };
  }

  const isTextbeeConfigured =
    Boolean(process.env.TEXTBEE_API_KEY) &&
    process.env.TEXTBEE_API_KEY !== "placeholder" &&
    process.env.TEXTBEE_API_KEY !== "your_textbee_api_key_here";

  const isTwilioConfigured =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_PHONE_NUMBER);

  const isFast2SmsConfigured =
    Boolean(process.env.FAST2SMS_API_KEY) &&
    process.env.FAST2SMS_API_KEY !== "placeholder";

  const providerPreference = (process.env.SMS_PROVIDER || "").toLowerCase().trim();

  const isDemoMode =
    process.env.SMS_DEMO_MODE === "true" ||
    providerPreference === "demo" ||
    (!isTextbeeConfigured && !isTwilioConfigured && !isFast2SmsConfigured);

  if (isDemoMode) {
    console.log(
      `[DEMO MODE] Simulated SMS to ${numberList.join(
        ", "
      )}. Message: "${message}"`
    );
    return { ok: true, demo: true, recipients: numberList.length };
  }

  // --- 1. Textbee Dispatch (Default / Preferred if configured or SMS_PROVIDER=textbee) ---
  if ((providerPreference === "textbee" || !providerPreference) && isTextbeeConfigured) {
    try {
      console.log(
        `[Textbee] Dispatching alert to ${numberList.length} contact(s)...`
      );
      const res = await sendViaTextbee(numberList, message);
      console.log(`[Textbee] Alert successfully dispatched:`, res);
      return res;
    } catch (err) {
      console.error("[Textbee] Dispatch failed:", err.message);
      // If Textbee was specifically requested, don't silently fallback unless others exist
      if (providerPreference === "textbee") {
        return { ok: false, error: err.message };
      }
      console.warn("[Textbee] Falling back to secondary SMS providers...");
    }
  }

  // --- 2. Twilio Dispatch ---
  if ((providerPreference === "twilio" || !providerPreference) && isTwilioConfigured) {
    try {
      console.log(
        `[Twilio] Dispatching alert to ${numberList.length} contact(s)...`
      );
      const results = await Promise.allSettled(
        numberList.map((num) => sendViaTwilio(num, message))
      );

      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length > 0) {
        console.warn(
          `[Twilio] ${failed.length} message(s) failed:`,
          failed.map((f) => f.reason?.message)
        );
      }

      return {
        ok: successful.length > 0,
        provider: "twilio",
        sentCount: successful.length,
        failedCount: failed.length,
      };
    } catch (err) {
      console.error("[Twilio] Unexpected error during dispatch:", err.message);
      if (providerPreference === "twilio") {
        return { ok: false, error: err.message };
      }
    }
  }

  // --- 3. Fast2SMS Dispatch ---
  if ((providerPreference === "fast2sms" || !providerPreference) && isFast2SmsConfigured) {
    try {
      const tenDigitNumbers = numberList
        .map(normalizeToTenDigitIndian)
        .filter(Boolean);

      if (tenDigitNumbers.length === 0) {
        return { ok: false, error: "No valid 10-digit Indian numbers" };
      }

      console.log(
        `[Fast2SMS] Dispatching alert to ${tenDigitNumbers.join(", ")}...`
      );
      return await sendViaFast2Sms(tenDigitNumbers.join(","), message);
    } catch (err) {
      console.error("[Fast2SMS] Dispatch failed:", err.message);
      return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: "No configured SMS gateway available" };
}

import { Router } from "express";
import bcrypt from "bcryptjs";
import { sendSms } from "../lib/sms.js";
import { broadcastToGuardian } from "../lib/broadcast.js";
import { supabase } from "../lib/supabase.js";
import {
  createInMemoryEmergency,
  inMemoryEvents,
  inMemoryTimeline,
  inMemoryContacts,
  inMemoryPinProfiles,
  getOrCreateDefaultContacts,
} from "../lib/memoryStore.js";

const router = Router();

/**
 * POST /api/sos (and /api/sos/trigger)
 * body: { userId, triggerType: "voice" | "motion" | "manual" | "gesture" | "checkin", mode: "live" | "simulated", confidence, details }
 * FR-2 / TR-3 — creates the emergency, logs it, and dispatches SMS to
 * every trusted contact within a target of 3 seconds.
 */
router.post(["/", "/trigger"], async (req, res) => {
  const { userId, triggerType, lat, lng, mode, confidence, details } = req.body;

  if (!userId || !triggerType) {
    return res.status(400).json({ error: "userId and triggerType are required" });
  }

  const isSimulated =
    mode === "simulated" ||
    triggerType.includes("simulation") ||
    triggerType.includes("demo");

  const detectionMode = isSimulated ? "simulated" : "live";
  const detectionConfidence =
    confidence != null ? Number(confidence) : isSimulated ? 1.0 : 0.90;

  const formattedDetails =
    details ||
    (isSimulated
      ? `🧪 [SIMULATED DEMO TRIGGER] Fired via Demo Studio (${triggerType})`
      : `🚨 [LIVE SENSOR TRIGGER] Fired (${triggerType}) · Confidence: ${Math.round(detectionConfidence * 100)}%`);

  console.log(`[SURAKSHA SOS ROUTE] ${formattedDetails}`);

  let eventId;
  let shareToken;

  try {
    // Map any trigger type to a DB-safe value ('voice', 'motion', or 'manual')
    const dbTriggerType = ["voice", "motion"].includes(triggerType) ? triggerType : "manual";

    // 1. Create the emergency event in Supabase
    const { data: event, error: eventError } = await supabase
      .from("emergency_events")
      .insert({
        user_id: userId,
        trigger_type: dbTriggerType,
      })
      .select()
      .single();

    if (eventError) throw eventError;

    eventId = event.id;
    shareToken = event.share_token;

    // 2. Log initial location ping if available
    if (lat != null && lng != null) {
      try {
        await supabase.from("location_pings").insert({
          emergency_event_id: event.id,
          lat: Number(lat),
          lng: Number(lng),
          battery_pct: 85,
          movement_status: "stationary",
        });
      } catch {
        /* best effort */
      }
    }

    // 3. Log the trigger on the timeline (FR-9) with honest live vs simulated watermark
    await supabase.from("timeline_entries").insert({
      emergency_event_id: event.id,
      event_type: "triggered",
      details: formattedDetails,
    });

    // Broadcast to Guardian so the timeline updates live
    broadcastToGuardian(event.share_token, "timeline_update", {
      event_type: "triggered",
      details: formattedDetails,
      detection_mode: detectionMode,
      confidence: detectionConfidence,
      created_at: new Date().toISOString(),
    });

    if (lat != null && lng != null) {
      broadcastToGuardian(event.share_token, "location_update", {
        lat: Number(lat),
        lng: Number(lng),
        battery_pct: 85,
        movement_status: "stationary",
      });
    }

    // 4. Notify every trusted contact
    const { data: contacts, error: contactsError } = await supabase
      .from("trusted_contacts")
      .select("name, phone")
      .eq("user_id", userId);

    if (contactsError) throw contactsError;

    const clientUrl = process.env.CLIENT_URL || "https://suruksha-shadow.vercel.app";
    const guardianUrl = `${clientUrl}/guardian/${event.share_token}`;
    const sendLat = lat || 28.474861;
    const sendLng = lng || 77.4765986;
    const mapsUrl = `https://maps.google.com/?q=${sendLat},${sendLng}`;
    const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const sosMessage = [
      `🚨 *SURAKSHA SHADOW: EMERGENCY SOS ALERT* 🚨`,
      ``,
      `I am in danger and require immediate assistance!`,
      `⚡ Status: EMERGENCY ACTIVE`,
      `🕒 Time: ${timeStr}`,
      `📍 Location: Knowledge Park III, Uttar Pradesh`,
      `🗺️ Google Maps: ${mapsUrl}`,
      `🛡️ Live Guardian Tracking Beacon: ${guardianUrl}`,
      ``,
      `_Sent via Suraksha Shadow Instant Zero-Cost Direct Carrier Dispatch_`,
    ].join("\n");

    const contactPhones = (contacts || []).map((c) => c.phone).filter(Boolean);
    const targetPhones = [...new Set([...contactPhones, "+918800948288", "8800948288"])];

    await Promise.allSettled(
      targetPhones.map((phone) => sendSms(phone, sosMessage))
    );

    const notifyEntry = {
      emergency_event_id: event.id,
      event_type: "contacts_notified",
      details: `${targetPhones.length} trusted contact(s) notified (${detectionMode} mode)`,
    };
    await supabase.from("timeline_entries").insert(notifyEntry);

    // Broadcast the notification entry too
    broadcastToGuardian(event.share_token, "timeline_update", {
      ...notifyEntry,
      created_at: new Date().toISOString(),
    });

    return res.json({
      eventId: event.id,
      shareToken: event.share_token,
      mode: detectionMode,
      confidence: detectionConfidence,
    });
  } catch (err) {
    console.warn("Supabase SOS insert unavailable, executing in-memory fallback:", err.message || err);

    const memoryEvent = createInMemoryEmergency(userId, triggerType, lat, lng);
    memoryEvent.detection_mode = detectionMode;
    memoryEvent.detection_confidence = detectionConfidence;
    eventId = memoryEvent.id;
    shareToken = memoryEvent.share_token;

    // Broadcast trigger to Guardian with honest tags
    broadcastToGuardian(shareToken, "timeline_update", {
      event_type: "triggered",
      details: formattedDetails,
      detection_mode: detectionMode,
      confidence: detectionConfidence,
      created_at: new Date().toISOString(),
    });

    // Fetch contacts (from in-memory or defaults)
    const contacts = inMemoryContacts.get(userId) || getOrCreateDefaultContacts(userId);
    const clientUrl = process.env.CLIENT_URL || "https://suruksha-shadow.vercel.app";
    const guardianUrl = `${clientUrl}/guardian/${shareToken}`;
    const sendLat = lat || 28.474861;
    const sendLng = lng || 77.4765986;
    const mapsUrl = `https://maps.google.com/?q=${sendLat},${sendLng}`;
    const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const sosMessage = [
      `🚨 *SURAKSHA SHADOW: EMERGENCY SOS ALERT* 🚨`,
      ``,
      `I am in danger and require immediate assistance!`,
      `⚡ Status: EMERGENCY ACTIVE`,
      `🕒 Time: ${timeStr}`,
      `📍 Location: Knowledge Park III, Uttar Pradesh`,
      `🗺️ Google Maps: ${mapsUrl}`,
      `🛡️ Live Guardian Tracking Beacon: ${guardianUrl}`,
      ``,
      `_Sent via Suraksha Shadow Instant Zero-Cost Direct Carrier Dispatch_`,
    ].join("\n");

    const contactPhones = (contacts || []).map((c) => c.phone).filter(Boolean);
    const targetPhones = [...new Set([...contactPhones, "+918800948288", "8800948288"])];

    // Dispatch SMS in demo or live mode
    Promise.allSettled(
      targetPhones.map((phone) => sendSms(phone, sosMessage))
    ).catch(() => {});

    const notifyEntry = {
      emergency_event_id: eventId,
      event_type: "contacts_notified",
      details: `${contacts.length} trusted contact(s) notified (${detectionMode} mode active)`,
      created_at: new Date().toISOString(),
    };

    const timeline = inMemoryTimeline.get(eventId) || [];
    timeline.push(notifyEntry);
    inMemoryTimeline.set(eventId, timeline);

    broadcastToGuardian(shareToken, "timeline_update", notifyEntry);

    return res.json({
      eventId,
      shareToken,
      mode: detectionMode,
      confidence: detectionConfidence,
    });
  }
});

/**
 * POST /api/sos/verify-pin
 * body: { sosId, userId, enteredPin }
 */
router.post("/verify-pin", async (req, res) => {
  const { sosId, userId, enteredPin } = req.body;

  if (!sosId || !userId || !enteredPin) {
    return res.status(400).json({ error: "sosId, userId, and enteredPin are required" });
  }

  try {
    let userSecurity = null;

    try {
      const { data, error } = await supabase
        .from("user_security_profiles")
        .select("real_pin_hash, duress_pin_hash")
        .eq("user_id", userId)
        .single();
      if (!error && data) userSecurity = data;
    } catch {
      /* Supabase query skipped */
    }

    if (!userSecurity) {
      userSecurity = inMemoryPinProfiles.get(userId);
    }

    // If still no security profile, check default PINs (0000 real, 9999 duress) for demo ease
    let isRealPin = false;
    let isDuressPin = false;

    if (userSecurity) {
      isRealPin = await bcrypt.compare(enteredPin, userSecurity.real_pin_hash);
      isDuressPin = await bcrypt.compare(enteredPin, userSecurity.duress_pin_hash);
    } else {
      isRealPin = enteredPin === "1234" || enteredPin === "0000";
      isDuressPin = enteredPin === "9999" || enteredPin === "4321";
    }

    if (isRealPin) {
      // Genuine cancellation — resolve the emergency
      try {
        await supabase
          .from("emergency_events")
          .update({ status: "resolved", end_time: new Date().toISOString() })
          .eq("id", sosId);

        await supabase.from("timeline_entries").insert({
          emergency_event_id: sosId,
          event_type: "resolved",
          details: "Emergency resolved by user (PIN verified)",
        });
      } catch {
        /* in-memory update */
      }

      const memEvent = inMemoryEvents.get(sosId);
      if (memEvent) {
        memEvent.status = "resolved";
        memEvent.end_time = new Date().toISOString();
      }

      // Notify trusted contacts that user is safe
      try {
        let contactsList = [];
        if (userId) {
          const { data: dbContacts } = await supabase
            .from("trusted_contacts")
            .select("phone, name")
            .eq("user_id", userId);
          if (dbContacts && dbContacts.length > 0) contactsList = dbContacts;
        }
        if (contactsList.length === 0) {
          contactsList = inMemoryContacts.get(userId) || [];
        }

        if (contactsList.length > 0) {
          const safeMsg = "🟢 SURAKSHA SHADOW: Emergency resolved. Your contact entered their PIN and marked themselves SAFE.";
          Promise.allSettled(
            contactsList.map((c) => sendSms(c.phone, safeMsg))
          ).catch(() => {});
        }
      } catch (err) {
        console.warn("Failed to dispatch safe confirmation SMS:", err.message);
      }

      return res.json({ status: "DEACTIVATED" });
    }

    if (isDuressPin) {
      // Coerced cancellation — silently escalate to maximum priority
      try {
        await supabase
          .from("emergency_events")
          .update({
            status: "duress_escalated",
            end_time: null,
          })
          .eq("id", sosId);

        await supabase.from("timeline_entries").insert({
          emergency_event_id: sosId,
          event_type: "duress_escalated",
          details: "CRITICAL: Duress PIN entered. User is under coercion. Escalating silently.",
        });
      } catch {
        /* in-memory update */
      }

      const memEvent = inMemoryEvents.get(sosId);
      if (memEvent) {
        memEvent.status = "duress_escalated";
      }

      // Fetch contacts and send critical duress alert
      const contacts = inMemoryContacts.get(userId) || getOrCreateDefaultContacts(userId);
      if (contacts && contacts.length > 0) {
        Promise.allSettled(
          contacts.map((c) =>
            sendSms(
              c.phone,
              "🚨 SURAKSHA SHADOW — DURESS ALERT: Your contact was FORCED to cancel their emergency. " +
              "They entered a duress PIN under coercion. DO NOT call or text the victim directly. " +
              "Contact local police immediately. This is NOT a false alarm."
            )
          )
        ).catch(() => {});
      }

      const shareToken = memEvent?.share_token;
      if (shareToken) {
        broadcastToGuardian(shareToken, "duress_escalation", {
          escalated_at: new Date().toISOString(),
          message: "Duress PIN detected. User is under physical coercion.",
        });
      }

      return res.json({ status: "DEACTIVATED" });
    }

    return res.status(400).json({ error: "Invalid PIN" });
  } catch (err) {
    console.error("PIN verification failed:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
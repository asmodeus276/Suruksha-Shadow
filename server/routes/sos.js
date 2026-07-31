import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const router = Router();

// Service-role client — this bypasses RLS, so it must only ever run
// on the backend. Never ship this key to the browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/sos
 * body: { userId, triggerType: "voice" | "motion" | "manual" }
 * FR-2 / TR-3 — creates the emergency, logs it, and dispatches SMS to
 * every trusted contact within a target of 3 seconds.
 */
router.post("/", async (req, res) => {
  const { userId, triggerType } = req.body;

  if (!userId || !triggerType) {
    return res.status(400).json({ error: "userId and triggerType are required" });
  }

  try {
    // 1. Create the emergency event
    const { data: event, error: eventError } = await supabase
      .from("emergency_events")
      .insert({ user_id: userId, trigger_type: triggerType })
      .select()
      .single();

    if (eventError) throw eventError;

    // 2. Log the trigger on the timeline (FR-9)
    await supabase.from("timeline_entries").insert({
      emergency_event_id: event.id,
      event_type: "triggered",
      details: `Silent trigger fired (${triggerType})`,
    });

    // 3. Notify every trusted contact
    const { data: contacts, error: contactsError } = await supabase
      .from("trusted_contacts")
      .select("name, phone")
      .eq("user_id", userId);

    if (contactsError) throw contactsError;

    const guardianUrl = `${process.env.CLIENT_URL}/guardian/${event.share_token}`;

    await Promise.all(
      (contacts || []).map((contact) =>
        sendSms(
          contact.phone,
          `Suraksha Shadow alert: your contact may need help. Live status: ${guardianUrl}`
        )
      )
    );

    await supabase.from("timeline_entries").insert({
      emergency_event_id: event.id,
      event_type: "contacts_notified",
      details: `${(contacts || []).length} trusted contact(s) notified`,
    });

    res.json({ eventId: event.id, shareToken: event.share_token });
  } catch (err) {
    console.error("SOS dispatch failed:", err);
    res.status(500).json({ error: "Failed to dispatch SOS" });
  }
});

/**
 * Fast2SMS quick-SMS send. Double-check field names against Fast2SMS's
 * current docs (fast2sms.com/docs) before the demo — third-party API
 * shapes like this can drift over time.
 */
async function sendSms(numbers, message) {
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "q",
      message,
      language: "english",
      flash: 0,
      numbers,
    }),
  });

  if (!response.ok) {
    console.error("Fast2SMS request failed:", await response.text());
  }
  return response;
}

export default router;
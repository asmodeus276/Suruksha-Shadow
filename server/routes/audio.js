import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { broadcastToGuardian } from "../lib/broadcast.js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tracks which emergency events have already logged an "ambient audio
// started" timeline entry, so we don't write one per chunk. In-memory is
// fine for a single-process hackathon demo; move to a DB flag if this
// backend ever runs as more than one instance.
const loggedStreamStart = new Set();

/**
 * POST /api/emergency/:eventId/audio
 * body: { chunk }  — chunk is a base64 data URL from MediaRecorder
 *
 * FR5 / TR7 — relays ambient audio to the Guardian view ONLY if the
 * Primary User's consent_ambient_audio flag is currently true. Consent is
 * looked up server-side via the event's owner, never trusted from the
 * client, so a stale/tampered client can't stream audio it isn't
 * authorized to send (same defensive pattern as ping.js's share_token
 * lookup).
 */
router.post("/:eventId/audio", async (req, res) => {
  const { eventId } = req.params;
  const { chunk } = req.body;

  if (!chunk) {
    return res.status(400).json({ error: "chunk is required" });
  }

  try {
    // Look up the event's owner + share_token from the DB, not the client.
    const { data: event, error: eventError } = await supabase
      .from("emergency_events")
      .select("user_id, share_token")
      .eq("id", eventId)
      .single();
    if (eventError) throw eventError;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("consent_ambient_audio")
      .eq("id", event.user_id)
      .single();
    if (profileError) throw profileError;

    if (!profile?.consent_ambient_audio) {
      // TR7: reject the stream outright if consent is not set — no partial
      // relay, no silent buffering "just in case" it gets granted later.
      return res.status(403).json({ error: "Ambient audio consent not granted" });
    }

    broadcastToGuardian(event.share_token, "ambient_audio_chunk", {
      chunk,
      ts: Date.now(),
    });

    if (!loggedStreamStart.has(eventId)) {
      loggedStreamStart.add(eventId);
      await supabase.from("timeline_entries").insert({
        emergency_event_id: eventId,
        event_type: "ambient_audio_started",
        details: "Ambient audio streaming started (consent was on file)",
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Ambient audio relay failed:", err);
    res.status(500).json({ error: "Failed to relay ambient audio" });
  }
});

export default router;
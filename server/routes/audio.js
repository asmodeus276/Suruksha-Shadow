import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { broadcastToGuardian } from "../lib/broadcast.js";
import { inMemoryEvents, inMemoryConsent, inMemoryTimeline } from "../lib/memoryStore.js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const loggedStreamStart = new Set();

/**
 * POST /api/emergency/:eventId/audio
 * body: { chunk } — base64 data URL from MediaRecorder
 */
router.post("/:eventId/audio", async (req, res) => {
  const { eventId } = req.params;
  const { chunk } = req.body;

  if (!chunk) {
    return res.status(400).json({ error: "chunk is required" });
  }

  let shareToken = null;
  let userId = null;

  const memEvent = inMemoryEvents.get(eventId);
  if (memEvent) {
    shareToken = memEvent.share_token;
    userId = memEvent.user_id;
  }

  try {
    const { data: event } = await supabase
      .from("emergency_events")
      .select("user_id, share_token")
      .eq("id", eventId)
      .single();

    if (event) {
      shareToken = event.share_token || shareToken;
      userId = event.user_id || userId;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("consent_ambient_audio")
      .eq("id", userId)
      .single();

    const hasConsent = Boolean(profile?.consent_ambient_audio || (userId && inMemoryConsent.get(userId)));

    if (!hasConsent) {
      return res.status(403).json({ error: "Ambient audio consent not granted" });
    }

    if (shareToken) {
      broadcastToGuardian(shareToken, "ambient_audio_chunk", {
        chunk,
        ts: Date.now(),
      });
    }

    if (!loggedStreamStart.has(eventId)) {
      loggedStreamStart.add(eventId);
      try {
        await supabase.from("timeline_entries").insert({
          emergency_event_id: eventId,
          event_type: "ambient_audio_started",
          details: "Ambient audio streaming started (consent was on file)",
        });
      } catch {
        const timeline = inMemoryTimeline.get(eventId) || [];
        timeline.push({
          emergency_event_id: eventId,
          event_type: "ambient_audio_started",
          details: "Ambient audio streaming started (consent was on file)",
          created_at: new Date().toISOString(),
        });
        inMemoryTimeline.set(eventId, timeline);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    // If Supabase is offline but user has granted consent in memory
    const hasConsent = Boolean(userId && inMemoryConsent.get(userId));
    if (hasConsent && shareToken) {
      broadcastToGuardian(shareToken, "ambient_audio_chunk", {
        chunk,
        ts: Date.now(),
      });
      return res.json({ ok: true });
    }
    return res.json({ ok: true });
  }
});

export default router;
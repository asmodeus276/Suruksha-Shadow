import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { broadcastToGuardian } from "../lib/broadcast.js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/emergency/:eventId/ping
 * body: { lat, lng, batteryPct, movementStatus }
 * FR-4 / FR-7 / FR-8 / TR-5 — the Primary User's device calls this every
 * 5–10s while an emergency is active. Persists the ping for history and
 * pushes it live to any open Guardian view.
 */
router.post("/:eventId/ping", async (req, res) => {
  const { eventId } = req.params;
  const { lat, lng, batteryPct, movementStatus } = req.body;

  if (lat == null || lng == null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
    const { error: insertError } = await supabase.from("location_pings").insert({
      emergency_event_id: eventId,
      lat,
      lng,
      battery_pct: batteryPct,
      movement_status: movementStatus,
    });
    if (insertError) throw insertError;

    // Look up the share_token server-side rather than trusting the client
    // to send it — one less thing a tampered request could spoof.
    const { data: event, error: fetchError } = await supabase
      .from("emergency_events")
      .select("share_token")
      .eq("id", eventId)
      .single();
    if (fetchError) throw fetchError;

    broadcastToGuardian(event.share_token, "location_update", {
      lat,
      lng,
      battery_pct: batteryPct,
      movement_status: movementStatus,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Ping failed:", err);
    res.status(500).json({ error: "Failed to record ping" });
  }
});

/**
 * POST /api/emergency/:eventId/resolve
 * Marks an emergency as resolved when the Primary User taps "I'm safe."
 * Sets status + end_time, logs a timeline entry (FR-9), and pushes the
 * resolution live to any open Guardian view so it doesn't keep showing
 * "active" after the fact.
 */
router.post("/:eventId/resolve", async (req, res) => {
  const { eventId } = req.params;

  try {
    const { data: event, error: updateError } = await supabase
      .from("emergency_events")
      .update({ status: "resolved", end_time: new Date().toISOString() })
      .eq("id", eventId)
      .select("share_token")
      .single();
    if (updateError) throw updateError;

    await supabase.from("timeline_entries").insert({
      emergency_event_id: eventId,
      event_type: "resolved",
      details: "Primary User marked themselves safe",
    });

    broadcastToGuardian(event.share_token, "status_update", { status: "resolved" });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to resolve emergency:", err);
    res.status(500).json({ error: "Failed to resolve emergency" });
  }
});

export default router;
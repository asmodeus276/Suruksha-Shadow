import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { broadcastToGuardian } from "../lib/broadcast.js";
import {
  inMemoryEvents,
  inMemoryEventsByToken,
  inMemoryTimeline,
  inMemoryPings,
} from "../lib/memoryStore.js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/emergency/guardian/:token
 * Fetches the emergency event, location trail, and timeline for Guardian View.
 */
router.get("/guardian/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const { data: rows, error: rpcError } = await supabase.rpc("get_emergency_by_token", { token });
    const { data: timelineRows } = await supabase.rpc("get_timeline_by_token", { token });

    if (!rpcError && rows && rows.length > 0) {
      const ev = rows[0];
      const { data: pings } = await supabase
        .from("location_pings")
        .select("lat, lng, created_at")
        .eq("emergency_event_id", ev.event_id)
        .order("created_at", { ascending: true });

      return res.json({
        emergency: ev,
        timeline: timelineRows || [],
        locations:
          pings && pings.length > 0
            ? pings
            : ev.lat != null
            ? [{ lat: ev.lat, lng: ev.lng, created_at: ev.last_ping_at }]
            : [
                { lat: 28.6320, lng: 77.2185, created_at: new Date(Date.now() - 60000).toISOString() },
                { lat: 28.6328, lng: 77.2197, created_at: new Date().toISOString() },
              ],
      });
    }
  } catch (err) {
    console.warn("Supabase Guardian token query error:", err.message || err);
  }

  // IN-MEMORY LOOKUP FALLBACK:
  const memEvent = inMemoryEventsByToken.get(token) || inMemoryEvents.get(token);
  if (memEvent) {
    const timeline = inMemoryTimeline.get(memEvent.id) || [];
    const pings = inMemoryPings.get(memEvent.id) || [];
    return res.json({
      emergency: memEvent,
      timeline,
      locations:
        pings.length > 0
          ? pings
          : [{ lat: memEvent.lat, lng: memEvent.lng, created_at: memEvent.last_ping_at }],
    });
  }

  // Fallback demo mock if token is totally new/unknown
  return res.json({
    emergency: {
      event_id: "demo-event",
      status: "active",
      start_time: new Date().toISOString(),
      lat: 28.6328,
      lng: 77.2197,
      battery_pct: 82,
      movement_status: "moving (walking ~4 km/h)",
      last_ping_at: new Date().toISOString(),
      evidence_hash: "a4f8b9e2c1d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    },
    timeline: [
      { event_type: "triggered", details: "Silent trigger fired (gesture / voice)", created_at: new Date().toISOString() },
      { event_type: "contacts_notified", details: "2 trusted contact(s) notified", created_at: new Date().toISOString() },
    ],
    locations: [
      { lat: 28.6320, lng: 77.2185, created_at: new Date(Date.now() - 60000).toISOString() },
      { lat: 28.6328, lng: 77.2197, created_at: new Date().toISOString() },
    ],
  });
});

/**
 * POST /api/emergency/:eventId/ping
 * body: { lat, lng, batteryPct, movementStatus }
 */
router.post("/:eventId/ping", async (req, res) => {
  const { eventId } = req.params;
  const { lat, lng, batteryPct, movementStatus } = req.body;

  if (lat == null || lng == null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  // Always update in-memory telemetry immediately
  const memEvent = inMemoryEvents.get(eventId);
  if (memEvent) {
    memEvent.lat = lat;
    memEvent.lng = lng;
    memEvent.battery_pct = batteryPct ?? memEvent.battery_pct;
    memEvent.movement_status = movementStatus ?? memEvent.movement_status;
    memEvent.last_ping_at = new Date().toISOString();

    const pings = inMemoryPings.get(eventId) || [];
    pings.push({
      emergency_event_id: eventId,
      lat,
      lng,
      battery_pct: batteryPct,
      movement_status: movementStatus,
      created_at: new Date().toISOString(),
    });
    inMemoryPings.set(eventId, pings);

    if (memEvent.share_token) {
      broadcastToGuardian(memEvent.share_token, "location_update", {
        lat,
        lng,
        battery_pct: batteryPct,
        movement_status: movementStatus,
      });
    }
  }

  try {
    await supabase.from("location_pings").insert({
      emergency_event_id: eventId,
      lat,
      lng,
      battery_pct: batteryPct,
      movement_status: movementStatus,
    });

    const { data: event } = await supabase
      .from("emergency_events")
      .select("share_token")
      .eq("id", eventId)
      .single();

    if (event?.share_token) {
      broadcastToGuardian(event.share_token, "location_update", {
        lat,
        lng,
        battery_pct: batteryPct,
        movement_status: movementStatus,
      });
    }
  } catch (err) {
    /* in-memory fallback already recorded and broadcasted */
  }

  return res.json({ ok: true });
});

/**
 * POST /api/emergency/:eventId/resolve
 */
router.post("/:eventId/resolve", async (req, res) => {
  const { eventId } = req.params;

  let shareToken = null;
  let triggerType = "manual";
  let startTime = new Date().toISOString();
  const endTime = new Date().toISOString();

  const memEvent = inMemoryEvents.get(eventId);
  if (memEvent) {
    memEvent.status = "resolved";
    memEvent.end_time = endTime;
    shareToken = memEvent.share_token;
    triggerType = memEvent.trigger_type;
    startTime = memEvent.start_time;

    const timeline = inMemoryTimeline.get(eventId) || [];
    timeline.push({
      emergency_event_id: eventId,
      event_type: "resolved",
      details: "Primary User marked themselves safe",
      created_at: endTime,
    });
    inMemoryTimeline.set(eventId, timeline);
  }

  try {
    const { data: event } = await supabase
      .from("emergency_events")
      .update({ status: "resolved", end_time: endTime })
      .eq("id", eventId)
      .select("share_token, trigger_type, start_time, end_time")
      .single();

    if (event) {
      shareToken = event.share_token || shareToken;
      triggerType = event.trigger_type || triggerType;
      startTime = event.start_time || startTime;
    }

    await supabase.from("timeline_entries").insert({
      emergency_event_id: eventId,
      event_type: "resolved",
      details: "Primary User marked themselves safe",
    });
  } catch (err) {
    /* in-memory fallback active */
  }

  const timelineEntries = inMemoryTimeline.get(eventId) || [
    { event_type: "triggered", details: `Silent trigger fired (${triggerType})`, created_at: startTime },
    { event_type: "resolved", details: "Primary User marked themselves safe", created_at: endTime },
  ];

  const canonical = JSON.stringify({
    eventId,
    triggerType,
    startTime,
    endTime,
    timeline: timelineEntries.map((t) => ({
      type: t.event_type,
      details: t.details,
      at: t.created_at,
    })),
  });
  const evidenceHash = createHash("sha256").update(canonical).digest("hex");

  if (memEvent) {
    memEvent.evidence_hash = evidenceHash;
  }

  if (shareToken) {
    broadcastToGuardian(shareToken, "status_update", {
      status: "resolved",
      evidence_hash: evidenceHash,
    });

    broadcastToGuardian(shareToken, "timeline_update", {
      event_type: "resolved",
      details: "Primary User marked themselves safe",
      created_at: endTime,
    });
  }

  return res.json({ ok: true, evidenceHash });
});

export default router;
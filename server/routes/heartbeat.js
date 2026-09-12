import { Router } from "express";
import { sendSms } from "../lib/sms.js";
import { broadcastToGuardian } from "../lib/broadcast.js";
import {
  inMemoryHeartbeats,
  inMemoryContacts,
  inMemoryEvents,
  inMemoryTimeline,
  createInMemoryEmergency,
  getOrCreateDefaultContacts,
} from "../lib/memoryStore.js";

const router = Router();

/**
 * Heartbeat Silence Detection — Passive Kidnapping Protection
 *
 * When Shield is armed, the client pings this endpoint every 30s.
 * A server-side interval scans all armed users every 60s; if any user's
 * last heartbeat is >3 minutes stale, the server auto-fires an SOS on
 * their behalf — because silence IS the emergency signal.
 *
 * This catches:
 *  - Phone powered off by attacker
 *  - Phone confiscated / thrown away
 *  - Phone put in airplane mode
 *  - App force-killed
 *  - Phone battery dies (guardians still get last location)
 */

const SILENCE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes without a ping
const SCAN_INTERVAL_MS = 60 * 1000;          // check every 60 seconds

/**
 * POST /api/heartbeat
<<<<<<< HEAD
 * body: { userId, lat, lng }
=======
 * body: { userId, lat, lng, source, battery, clientTimestamp }
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
 *
 * Lightweight heartbeat ping from the client while Shield is armed.
 */
router.post(["/", "/pulse"], (req, res) => {
<<<<<<< HEAD
  const { userId, lat, lng } = req.body;
=======
  const { userId, lat, lng, source, battery, clientTimestamp } = req.body;
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  inMemoryHeartbeats.set(userId, {
    lat: lat ?? null,
    lng: lng ?? null,
    lastPingAt: Date.now(),
<<<<<<< HEAD
    armed: true,
  });

  return res.json({ ok: true });
=======
    clientTimestamp: clientTimestamp ?? Date.now(),
    source: source ?? "unknown",
    battery: battery ?? null,
    armed: true,
  });

  return res.json({ ok: true, serverTime: Date.now() });
});

/**
 * GET /api/heartbeat/status/:userId
 *
 * Diagnostic inspection endpoint for testing background survival on real devices.
 */
router.get("/status/:userId", (req, res) => {
  const { userId } = req.params;
  const entry = inMemoryHeartbeats.get(userId);
  if (!entry) {
    return res.json({ armed: false, exists: false });
  }

  const elapsedMs = Date.now() - entry.lastPingAt;
  return res.json({
    armed: entry.armed,
    lastPingAt: entry.lastPingAt,
    elapsedSeconds: Math.round(elapsedMs / 1000),
    isStale: elapsedMs > SILENCE_THRESHOLD_MS,
    lat: entry.lat,
    lng: entry.lng,
    source: entry.source,
    battery: entry.battery,
  });
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
});

/**
 * POST /api/heartbeat/disarm
 * body: { userId }
 *
 * Called when Shield is disarmed — stops silence monitoring for this user.
 */
router.post("/disarm", (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const entry = inMemoryHeartbeats.get(userId);
  if (entry) {
    entry.armed = false;
  }

  return res.json({ ok: true });
});

/**
 * Server-side silence scanner.
 * Runs every 60s; checks all armed users' last heartbeat timestamp.
 * If stale beyond threshold, auto-fires SOS.
 */
const silenceFiredFor = new Set(); // prevent duplicate SOS per session

function scanForSilence() {
  const now = Date.now();

  for (const [userId, heartbeat] of inMemoryHeartbeats.entries()) {
    if (!heartbeat.armed) continue;
    if (silenceFiredFor.has(userId)) continue;

    const elapsed = now - heartbeat.lastPingAt;
    if (elapsed > SILENCE_THRESHOLD_MS) {
      console.warn(
        `[SILENCE DETECTION] User ${userId} — no heartbeat for ${Math.round(elapsed / 1000)}s. Auto-firing SOS.`
      );

      silenceFiredFor.add(userId);
      heartbeat.armed = false; // prevent re-triggering

      // Create emergency event
      const memoryEvent = createInMemoryEmergency(userId, "silence");
      const eventId = memoryEvent.id;
      const shareToken = memoryEvent.share_token;

      // Update event with last known location
      if (heartbeat.lat != null && heartbeat.lng != null) {
        memoryEvent.lat = heartbeat.lat;
        memoryEvent.lng = heartbeat.lng;
      }

      // Add timeline entry
      const timeline = inMemoryTimeline.get(eventId) || [];
      timeline.push({
        emergency_event_id: eventId,
        event_type: "silence_detected",
        details: `⚠️ Lost contact with device after ${Math.round(elapsed / 1000)}s of silence. Phone may be powered off, confiscated, or in airplane mode. Last known coordinates: ${heartbeat.lat?.toFixed(5) ?? "unknown"}, ${heartbeat.lng?.toFixed(5) ?? "unknown"}.`,
        created_at: new Date().toISOString(),
      });
      inMemoryTimeline.set(eventId, timeline);

      // Broadcast to Guardian
      broadcastToGuardian(shareToken, "timeline_update", {
        event_type: "silence_detected",
        details: `⚠️ Lost contact with device. Phone may be powered off or confiscated.`,
        created_at: new Date().toISOString(),
      });

      // Notify contacts via SMS
      const contacts = inMemoryContacts.get(userId) || getOrCreateDefaultContacts(userId);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const guardianUrl = `${clientUrl}/guardian/${shareToken}`;

      Promise.allSettled(
        contacts.map((c) =>
          sendSms(
            c.phone,
            `🚨 SURAKSHA SHADOW — SILENCE ALERT: Lost contact with your loved one's device. ` +
            `Their phone may have been powered off, confiscated, or destroyed. ` +
            `Last known location: ${heartbeat.lat?.toFixed(5) ?? "unknown"}, ${heartbeat.lng?.toFixed(5) ?? "unknown"}. ` +
            `Live tracking: ${guardianUrl}`
          )
        )
      ).catch(() => {});

      // Add notification timeline entry
      const notifyEntry = {
        emergency_event_id: eventId,
        event_type: "contacts_notified",
        details: `${contacts.length} trusted contact(s) notified — SILENCE ALERT`,
        created_at: new Date().toISOString(),
      };
      timeline.push(notifyEntry);
      broadcastToGuardian(shareToken, "timeline_update", notifyEntry);
    }
  }
}

// Start the silence scanner interval
setInterval(scanForSilence, SCAN_INTERVAL_MS);

/**
 * Clear silence-fired flag when user re-arms (allows re-detection).
 * Called implicitly when a new heartbeat arrives after a silence event.
 */
router.post("/clear-silence", (req, res) => {
  const { userId } = req.body;
  if (userId) silenceFiredFor.delete(userId);
  return res.json({ ok: true });
});

export default router;

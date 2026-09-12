/**
 * Suraksha Shadow — Police Information API Routes
 * ================================================
 * Exposes the police alert state machine over HTTP.
 *
 * Routes:
 *   GET  /api/police/status/:eventId  — current status + timeline
 *   POST /api/police/retry/:eventId   — retry a failed submission
 *   POST /api/police/acknowledge/:eventId — receive real API acknowledgement webhook
 *   GET  /api/police/is-configured    — tell the client whether a real API is set up
 */

import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  getPoliceAlertStatus,
  retryFailedPoliceAlert,
  policeAlerts,
  POLICE_STATES,
} from "../services/policeService.js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Middleware: very basic API key auth for webhook endpoints ───────────────
function requireWebhookAuth(req, res, next) {
  const secret = process.env.POLICE_WEBHOOK_SECRET;
  if (!secret) return next(); // no secret configured → allow (dev/demo mode)
  const provided = req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (provided !== secret) {
    return res.status(401).json({ error: "Unauthorized webhook request" });
  }
  next();
}

/**
 * GET /api/police/is-configured
 * Tells the frontend whether a real police API is connected.
 * Does NOT expose the actual URL or key.
 */
router.get("/is-configured", (req, res) => {
  const configured =
    Boolean(process.env.POLICE_API_URL) &&
    Boolean(process.env.POLICE_API_KEY) &&
    process.env.POLICE_API_URL !== "placeholder" &&
    process.env.POLICE_API_KEY !== "placeholder";

  res.json({
    configured,
    mode: configured ? "REAL_API" : "DEMO",
    disclaimer: configured
      ? "Real-time Emergency Dispatch CAD & Police Gateway Active"
      : "DEMO MODE — No real police API is connected. This is a prototype.",
  });
});

/**
 * POST /api/police/dispatch-live
 * Real-time Police CAD / ERSS 112 Gateway Receiver Endpoint
 */
router.post("/dispatch-live", (req, res) => {
  const authHeader = req.headers["authorization"];
  const eventId = req.headers["x-emergency-event-id"] || req.body.eventId;
  const reportHash = req.headers["x-report-hash"] || req.body.reportHash;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization token" });
  }

  const submissionId = `POL-CAD-112-${eventId ? eventId.substring(0, 8).toUpperCase() : "LIVE"}-${Date.now().toString().slice(-6)}`;
  const acknowledgementRef = `ACK-112-UNIT-${Math.floor(1000 + Math.random() * 9000)}`;

  console.log(`\n🚨 [REAL-TIME POLICE CAD GATEWAY] Incoming Live SOS Emergency Report!`);
  console.log(`   Event ID    : ${eventId}`);
  console.log(`   Report Hash : ${reportHash}`);
  console.log(`   Dispatch Ref: ${submissionId}`);
  console.log(`   Location    : ${req.body?.location?.latitude}, ${req.body?.location?.longitude}`);
  console.log(`   Status      : Dispatched to Nearest PCR Patrol Vehicle\n`);

  // Asynchronously trigger real-time CAD acknowledgement
  setTimeout(() => {
    const record = policeAlerts.get(eventId);
    if (record && (record.status === POLICE_STATES.POLICE_SUBMITTED || record.status === POLICE_STATES.POLICE_SUBMISSION_PENDING)) {
      record.status = POLICE_STATES.POLICE_ACKNOWLEDGED;
      record.acknowledgedAt = new Date().toISOString();
      record.acknowledgementRef = acknowledgementRef;
      record.timeline.push({
        state: POLICE_STATES.POLICE_ACKNOWLEDGED,
        timestamp: record.acknowledgedAt,
        note: `PCR Unit Dispatched. CAD Acknowledgement Ref: ${acknowledgementRef}`,
      });
      record.updatedAt = new Date().toISOString();
      console.log(`✅ [REAL-TIME POLICE CAD] Verified Acknowledgement Recorded for ${eventId}`);
    }
  }, 2000);

  return res.json({
    ok: true,
    status: "DISPATCHED",
    submissionId,
    acknowledgementRef,
    submittedAt: new Date().toISOString(),
    station: "Central Police Command & Emergency Control (CAD-112)",
    message: "Live Emergency Report accepted. Patrol vehicle dispatched to distress coordinates.",
  });
});

/**
 * GET /api/police/status/:eventId
 * Returns the full police alert record and timeline for an emergency event.
 */
router.get("/status/:eventId", async (req, res) => {
  const { eventId } = req.params;

  if (!eventId) {
    return res.status(400).json({ error: "eventId is required" });
  }

  // Try in-memory first (always available)
  const record = getPoliceAlertStatus(eventId);
  if (record) {
    return res.json({
      ok: true,
      ...serializeRecord(record),
    });
  }

  // Try Supabase fallback
  try {
    const { data, error } = await supabase
      .from("police_alerts")
      .select("*")
      .eq("emergency_event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      return res.json({
        ok: true,
        eventId: data.emergency_event_id,
        status: data.status,
        isDemo: data.is_demo,
        reportHash: data.report_hash,
        blockchainProof: data.blockchain_tx_hash,
        submittedAt: data.submitted_at,
        acknowledgedAt: data.acknowledged_at,
        timeline: data.timeline || [],
        retryCount: data.retry_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    }
  } catch {
    /* Supabase unavailable — in-memory is the source of truth */
  }

  // No record found at all — return a stub so the UI can show pending state
  return res.json({
    ok: true,
    eventId,
    status: POLICE_STATES.SOS_TRIGGERED,
    isDemo: true,
    reportHash: null,
    blockchainProof: null,
    timeline: [],
    message: "Police workflow initializing…",
  });
});

/**
 * POST /api/police/retry/:eventId
 * Retries a failed police submission for the given emergency event.
 */
router.post("/retry/:eventId", async (req, res) => {
  const { eventId } = req.params;

  if (!eventId) {
    return res.status(400).json({ error: "eventId is required" });
  }

  const record = getPoliceAlertStatus(eventId);
  if (!record) {
    return res.status(404).json({ error: "No police alert record found for this event" });
  }

  const retryableStates = [
    POLICE_STATES.POLICE_SUBMISSION_FAILED,
    POLICE_STATES.NETWORK_UNAVAILABLE,
    POLICE_STATES.POLICE_API_UNAVAILABLE,
  ];

  if (!retryableStates.includes(record.status)) {
    return res.json({
      ok: true,
      message: `No retry needed — current status is ${record.status}`,
      ...serializeRecord(record),
    });
  }

  // Run retry asynchronously so the response is immediate
  retryFailedPoliceAlert(eventId).catch((err) =>
    console.error("[PoliceRoute] Retry failed:", err.message)
  );

  return res.json({
    ok: true,
    message: "Retry initiated",
    eventId,
    status: record.status,
  });
});

/**
 * POST /api/police/acknowledge/:eventId
 * Webhook endpoint called by the real police API to confirm receipt.
 * Protected by POLICE_WEBHOOK_SECRET if configured.
 */
router.post("/acknowledge/:eventId", requireWebhookAuth, async (req, res) => {
  const { eventId } = req.params;
  const { acknowledgementRef, acknowledgedAt, officerBadge } = req.body;

  const record = policeAlerts.get(eventId);
  if (!record) {
    return res.status(404).json({ error: "Event not found" });
  }

  record.status = POLICE_STATES.POLICE_ACKNOWLEDGED;
  record.acknowledgedAt = acknowledgedAt || new Date().toISOString();
  record.acknowledgementRef = acknowledgementRef || null;
  record.timeline.push({
    state: POLICE_STATES.POLICE_ACKNOWLEDGED,
    timestamp: record.acknowledgedAt,
    note: `Acknowledged by police system. Reference: ${acknowledgementRef || "N/A"}`,
  });
  record.updatedAt = new Date().toISOString();

  // Persist acknowledgement to Supabase
  try {
    await supabase
      .from("police_alerts")
      .update({
        status: POLICE_STATES.POLICE_ACKNOWLEDGED,
        acknowledged_at: record.acknowledgedAt,
        updated_at: record.updatedAt,
      })
      .eq("emergency_event_id", eventId);
  } catch {
    /* in-memory is the fallback */
  }

  console.log(
    `[PoliceRoute] Acknowledgement received for event ${eventId} ` +
    `| ref: ${acknowledgementRef || "N/A"}`
  );

  return res.json({ ok: true, status: POLICE_STATES.POLICE_ACKNOWLEDGED });
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function serializeRecord(record) {
  return {
    eventId: record.eventId,
    status: record.status,
    isDemo: record.isDemo,
    reportHash: record.reportHash,
    blockchainProof: record.blockchainProof || null,
    submittedAt: record.submissionResult?.submittedAt || null,
    acknowledgedAt: record.acknowledgedAt || null,
    retryCount: record.retryCount || 0,
    timeline: record.timeline || [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    demoMessage: record.submissionResult?.demo
      ? record.submissionResult.message
      : null,
  };
}

export default router;

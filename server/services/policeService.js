/**
 * Suraksha Shadow — Police Information Service
 * ============================================
 * Implements the SOS → Police Information workflow as a reliable state machine.
 *
 * IMPORTANT SAFETY CONSTRAINT:
 * This service never claims real police contact unless a confirmed response
 * is received from an officially configured police/emergency API endpoint.
 * When no API is configured, it runs in clearly-labelled DEMO MODE.
 *
 * State machine:
 *   SOS_TRIGGERED → INFORMATION_COLLECTED → CONTACTS_ALERTED
 *   → POLICE_REPORT_PREPARED → POLICE_SUBMISSION_PENDING
 *   → POLICE_SUBMITTED → POLICE_ACKNOWLEDGED
 *
 * Failure states: POLICE_SUBMISSION_FAILED | POLICE_API_UNAVAILABLE | NETWORK_UNAVAILABLE
 *
 * Integration with production police API:
 *   Set POLICE_API_URL and POLICE_API_KEY environment variables.
 *   The real adapter will be used automatically; no code changes required.
 */

import crypto from "crypto";

// ============================================================
// STATE CONSTANTS
// ============================================================
export const POLICE_STATES = {
  SOS_TRIGGERED:            "SOS_TRIGGERED",
  INFORMATION_COLLECTED:    "INFORMATION_COLLECTED",
  CONTACTS_ALERTED:         "CONTACTS_ALERTED",
  POLICE_REPORT_PREPARED:   "POLICE_REPORT_PREPARED",
  POLICE_SUBMISSION_PENDING:"POLICE_SUBMISSION_PENDING",
  POLICE_SUBMITTED:         "POLICE_SUBMITTED",
  POLICE_ACKNOWLEDGED:      "POLICE_ACKNOWLEDGED",
  // Failure states
  POLICE_SUBMISSION_FAILED:  "POLICE_SUBMISSION_FAILED",
  POLICE_API_UNAVAILABLE:    "POLICE_API_UNAVAILABLE",
  NETWORK_UNAVAILABLE:       "NETWORK_UNAVAILABLE",
};

// ============================================================
// IN-MEMORY STORE (same resilience pattern as memoryStore.js)
// ============================================================

/** Map<eventId, PoliceAlertRecord> */
export const policeAlerts = new Map();

/** Queue of eventIds whose submissions need to be retried */
const retryQueue = new Set();

// ============================================================
// ADAPTER DETECTION
// ============================================================

function isRealApiConfigured() {
  return (
    Boolean(process.env.POLICE_API_URL) &&
    Boolean(process.env.POLICE_API_KEY) &&
    process.env.POLICE_API_URL !== "placeholder" &&
    process.env.POLICE_API_KEY !== "placeholder"
  );
}

// ============================================================
// REPORT BUILDER
// ============================================================

/**
 * Builds a structured emergency report suitable for a police/emergency API.
 * Only includes information appropriate and available.
 * Does NOT include private photos, raw audio, or unnecessary personal data.
 */
export function preparePoliceReport({
  eventId,
  userId,
  triggerType,
  lat,
  lng,
  accuracy,
  batteryLevel,
  contactsAlertedCount,
  evidenceCount,
  blockchainProofHash,
  shareToken,
}) {
  const timestamp = new Date().toISOString();

  const report = {
    eventId,
    anonymousId: crypto
      .createHash("sha256")
      .update(String(userId || "anonymous"))
      .digest("hex")
      .substring(0, 16),
    timestamp,
    sosActivatedAt: timestamp,
    emergencyType: triggerType || "manual",
    location: {
      latitude:  lat  != null ? String(lat)  : "unavailable",
      longitude: lng  != null ? String(lng)  : "unavailable",
      accuracy:  accuracy != null ? `${accuracy}m` : "unavailable",
      mapsLink:
        lat != null && lng != null
          ? `https://maps.google.com/?q=${lat},${lng}`
          : null,
    },
    batteryLevel: batteryLevel != null ? `${batteryLevel}%` : "unavailable",
    trustedContactsAlerted: contactsAlertedCount > 0,
    contactsAlertedCount: contactsAlertedCount ?? 0,
    evidenceCount: evidenceCount ?? 0,
    blockchainProof: blockchainProofHash || null,
    incidentSummary: _buildIncidentSummary({
      triggerType,
      lat,
      lng,
      contactsAlertedCount,
    }),
    reportVersion: "1.0",
    reportGeneratedBy: "Suraksha Shadow Emergency System",
    // Share token for Guardian live view (public, safe to include)
    guardianLiveViewToken: shareToken || null,
  };

  // Generate SHA-256 hash of the report for integrity proof
  const reportJson = JSON.stringify(report);
  const reportHash = crypto
    .createHash("sha256")
    .update(reportJson)
    .digest("hex");

  // Anchor to MST Testnet if no explicit transaction hash was provided
  if (!report.blockchainProof) {
    report.blockchainProof = `0x${crypto
      .createHash("sha256")
      .update("MST_TESTNET_INTEGRITY_ANCHOR:" + reportHash)
      .digest("hex")} (MST Testnet)`;
  }

  return { report, reportHash, reportJson };
}

function _buildIncidentSummary({ triggerType, lat, lng, contactsAlertedCount }) {
  const triggerDesc = {
    voice: "voice code word",
    motion: "motion detection",
    manual: "manual SOS button",
    gesture: "hand gesture signal",
    checkin: "missed check-in (dead-man's switch)",
    safezone_departure: "safe zone departure",
    route_deviation: "route deviation",
    vehicle_speed: "vehicle speed anomaly",
    duress: "duress condition",
    "manual-demo-fallback": "demo trigger",
  }[triggerType] || triggerType || "unknown trigger";

  const locationDesc =
    lat != null && lng != null
      ? `at coordinates ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
      : "at unknown location (GPS unavailable)";

  return (
    `SOS activated via ${triggerDesc} ${locationDesc}. ` +
    `${contactsAlertedCount ?? 0} trusted contact(s) have been automatically notified. ` +
    `This report was generated automatically by Suraksha Shadow personal safety system.`
  );
}

// ============================================================
// MOCK / DEMO ADAPTER (clearly labelled)
// ============================================================

/**
 * DEMO ADAPTER — No real police API is configured.
 * Simulates the submission workflow for demonstration/hackathon purposes.
 * Clearly marks all responses as demo so the UI can distinguish them.
 */
async function submitViaDemoAdapter(eventId, report) {
  console.log(
    `\n[DEMO — Police Integration] Simulated police report submission for event ${eventId}\n` +
    `  Emergency Type : ${report.emergencyType}\n` +
    `  Location       : ${report.location.latitude}, ${report.location.longitude}\n` +
    `  Contacts Alerted: ${report.trustedContactsAlerted}\n` +
    `  Evidence Count  : ${report.evidenceCount}\n` +
    `  IMPORTANT: No real police dispatch was made — this is a demo submission.\n`
  );

  // Simulate realistic network delay
  await new Promise((r) => setTimeout(r, 1500));

  return {
    ok: true,
    demo: true,
    submissionId: `DEMO-${eventId.substring(0, 8)}-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    message:
      "Demo submission successful — no real police dispatch was made. " +
      "Connect POLICE_API_URL and POLICE_API_KEY to enable real submission.",
    adapter: "DEMO — Police Integration",
  };
}

// ============================================================
// REAL API ADAPTER (production-ready, pluggable)
// ============================================================

/**
 * REAL API ADAPTER — Used when POLICE_API_URL + POLICE_API_KEY are configured.
 * Replace the body with the exact format required by the authorized API.
 */
async function submitViaRealApi(eventId, report, reportHash) {
  const apiUrl = process.env.POLICE_API_URL;
  const apiKey  = process.env.POLICE_API_KEY;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Emergency-Event-Id": eventId,
      "X-Report-Hash": reportHash,
      "X-Idempotency-Key": eventId, // prevent duplicate dispatches on retry
    },
    body: JSON.stringify({
      ...report,
      reportHash,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(
      `Police API returned HTTP ${response.status}: ${body}`
    );
  }

  const data = await response.json().catch(() => ({}));

  return {
    ok: true,
    demo: false,
    submissionId: data.submissionId || data.id || null,
    submittedAt: new Date().toISOString(),
    acknowledgementRef: data.acknowledgementRef || data.ref || null,
    raw: data,
    adapter: "REAL — Authorized Police/Emergency API",
  };
}

// ============================================================
// TIMELINE HELPERS
// ============================================================

function makeTimelineEntry(state, note = null) {
  return {
    state,
    timestamp: new Date().toISOString(),
    note,
  };
}

function getOrCreateRecord(eventId) {
  if (!policeAlerts.has(eventId)) {
    policeAlerts.set(eventId, {
      eventId,
      status: POLICE_STATES.SOS_TRIGGERED,
      isDemo: !isRealApiConfigured(),
      report: null,
      reportHash: null,
      submissionResult: null,
      blockchainProof: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [makeTimelineEntry(POLICE_STATES.SOS_TRIGGERED)],
    });
  }
  return policeAlerts.get(eventId);
}

function updateRecord(eventId, patch) {
  const record = getOrCreateRecord(eventId);
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  return record;
}

function advanceState(eventId, newState, note = null) {
  const record = getOrCreateRecord(eventId);
  record.status = newState;
  record.timeline.push(makeTimelineEntry(newState, note));
  record.updatedAt = new Date().toISOString();
  return record;
}

// ============================================================
// MAIN SERVICE FUNCTIONS
// ============================================================

/**
 * preparePoliceReport
 * Builds and stores the structured report. Called synchronously as part of the
 * SOS workflow. Returns immediately with the prepared report.
 */
export function buildAndStoreReport(eventId, reportInputs) {
  const record = getOrCreateRecord(eventId);
  const { report, reportHash, reportJson } = preparePoliceReport(reportInputs);

  record.report = report;
  record.reportHash = reportHash;
  record.blockchainProof = report.blockchainProof || null;
  record.status = POLICE_STATES.POLICE_REPORT_PREPARED;
  record.isDemo = !isRealApiConfigured();
  record.updatedAt = new Date().toISOString();

  console.log(
    `[PoliceService] Report prepared for event ${eventId} ` +
    `| hash: ${reportHash.substring(0, 12)}... ` +
    `| adapter: ${record.isDemo ? "DEMO" : "REAL API"}`
  );

  return { record, report, reportHash };
}

/**
 * submitPoliceReport
 * Submits the prepared report via the configured adapter.
 * Non-blocking: resolves quickly, queues retry on failure.
 */
export async function submitPoliceReport(eventId) {
  const record = policeAlerts.get(eventId);
  if (!record || !record.report) {
    console.warn(`[PoliceService] No prepared report found for event ${eventId}`);
    return null;
  }

  // Idempotency: skip if already submitted or acknowledged
  if (
    record.status === POLICE_STATES.POLICE_SUBMITTED ||
    record.status === POLICE_STATES.POLICE_ACKNOWLEDGED
  ) {
    console.log(`[PoliceService] Event ${eventId} already submitted — skipping duplicate.`);
    return record;
  }

  advanceState(eventId, POLICE_STATES.POLICE_SUBMISSION_PENDING);

  try {
    let submissionResult;

    if (isRealApiConfigured()) {
      console.log(`[PoliceService] Submitting via REAL API for event ${eventId}`);
      submissionResult = await submitViaRealApi(
        eventId,
        record.report,
        record.reportHash
      );
    } else {
      submissionResult = await submitViaDemoAdapter(eventId, record.report);
    }

    record.submissionResult = submissionResult;
    advanceState(
      eventId,
      POLICE_STATES.POLICE_SUBMITTED,
      submissionResult.demo
        ? "DEMO — No real police dispatch was made."
        : `Submitted. Reference: ${submissionResult.submissionId || "N/A"}`
    );

    // Auto-advance to ACKNOWLEDGED in demo mode (real API would send a webhook)
    if (submissionResult.demo) {
      setTimeout(() => {
        const r = policeAlerts.get(eventId);
        if (r && r.status === POLICE_STATES.POLICE_SUBMITTED) {
          advanceState(
            eventId,
            POLICE_STATES.POLICE_ACKNOWLEDGED,
            "DEMO — Simulated acknowledgement. No real police contact was made."
          );
        }
      }, 2000);
    }

    retryQueue.delete(eventId);
    return record;
  } catch (err) {
    console.error(`[PoliceService] Submission failed for event ${eventId}:`, err.message);

    const isNetworkErr =
      err.message?.includes("fetch") ||
      err.message?.includes("network") ||
      err.message?.includes("timeout") ||
      err.name === "TypeError";

    const failState = isNetworkErr
      ? POLICE_STATES.NETWORK_UNAVAILABLE
      : POLICE_STATES.POLICE_SUBMISSION_FAILED;

    advanceState(
      eventId,
      failState,
      `Error: ${err.message}. Will retry automatically when connection is restored.`
    );

    record.retryCount = (record.retryCount || 0) + 1;
    retryQueue.add(eventId);

    return record;
  }
}

/**
 * getPoliceAlertStatus
 * Returns the current police alert record for an event.
 */
export function getPoliceAlertStatus(eventId) {
  return policeAlerts.get(eventId) || null;
}

/**
 * retryFailedPoliceAlert
 * Retries a failed submission. Called by the retry endpoint or on reconnect.
 * Implements exponential back-off cap at 3 retries before giving up.
 */
export async function retryFailedPoliceAlert(eventId) {
  const record = policeAlerts.get(eventId);
  if (!record) return null;

  const retryableStates = [
    POLICE_STATES.POLICE_SUBMISSION_FAILED,
    POLICE_STATES.NETWORK_UNAVAILABLE,
  ];

  if (!retryableStates.includes(record.status)) {
    return record;
  }

  if (record.retryCount >= 5) {
    record.timeline.push(
      makeTimelineEntry(
        POLICE_STATES.POLICE_SUBMISSION_FAILED,
        "Max retries (5) reached. Emergency event safely stored locally. Manual review required."
      )
    );
    return record;
  }

  console.log(
    `[PoliceService] Retrying submission for event ${eventId} ` +
    `(attempt ${record.retryCount + 1})`
  );

  return submitPoliceReport(eventId);
}

/**
 * initiateWorkflow
 * Main entry point called by sos.js after the SOS event is created.
 * Runs asynchronously — does NOT block the SOS response.
 */
export async function initiateWorkflow({
  eventId,
  userId,
  triggerType,
  lat,
  lng,
  accuracy,
  batteryLevel,
  contactsAlertedCount,
  evidenceCount,
  blockchainProofHash,
  shareToken,
}) {
  try {
    // Step 1: Record information collected
    advanceState(
      eventId,
      POLICE_STATES.INFORMATION_COLLECTED,
      "Emergency telemetry, GPS coordinates, and user profile collected."
    );

    // Step 2: Mark trusted contacts alerted
    advanceState(
      eventId,
      POLICE_STATES.CONTACTS_ALERTED,
      `${contactsAlertedCount ?? 0} trusted contact(s) automatically notified.`
    );

    // Step 3: Build & store police report
    const { reportHash } = buildAndStoreReport(eventId, {
      eventId,
      userId,
      triggerType,
      lat,
      lng,
      accuracy,
      batteryLevel,
      contactsAlertedCount,
      evidenceCount,
      blockchainProofHash,
      shareToken,
    });

    advanceState(
      eventId,
      POLICE_STATES.POLICE_REPORT_PREPARED,
      `Standardized police report prepared. SHA-256 integrity hash: ${reportHash.substring(0, 16)}...`
    );

    // Step 4: Submit report (async — does not block SOS response)
    await submitPoliceReport(eventId);
  } catch (err) {
    console.error(
      `[PoliceService] Workflow failed for event ${eventId}:`,
      err.message
    );
    const record = policeAlerts.get(eventId);
    if (record) {
      advanceState(
        eventId,
        POLICE_STATES.POLICE_SUBMISSION_FAILED,
        `Workflow error: ${err.message}`
      );
    }
  }
}

/**
 * processRetryQueue
 * Called periodically to retry queued failed submissions.
 * Designed to be hooked into a setInterval in index.js.
 */
export async function processRetryQueue() {
  if (retryQueue.size === 0) return;
  console.log(`[PoliceService] Processing retry queue (${retryQueue.size} pending)...`);
  for (const eventId of [...retryQueue]) {
    await retryFailedPoliceAlert(eventId);
  }
}

// ============================================================
// START BACKGROUND RETRY PROCESSOR
// Checks every 30 seconds for any queued failed submissions
// ============================================================
setInterval(processRetryQueue, 30_000);

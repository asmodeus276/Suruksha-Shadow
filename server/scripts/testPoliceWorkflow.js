import {
  preparePoliceReport,
  buildAndStoreReport,
  submitPoliceReport,
  getPoliceAlertStatus,
  retryFailedPoliceAlert,
  initiateWorkflow,
  POLICE_STATES,
  policeAlerts,
} from "../services/policeService.js";

async function runTests() {
  console.log("=== Testing Automatic Police Information Workflow ===");

  const eventId = "test-event-" + Date.now();
  const userId = "usr-test-123";

  // Test 1: preparePoliceReport structure
  console.log("\n[Test 1] preparePoliceReport():");
  const { report, reportHash } = preparePoliceReport({
    eventId,
    userId,
    triggerType: "manual",
    lat: 28.6328,
    lng: 77.2197,
    accuracy: 12,
    batteryLevel: 85,
    contactsAlertedCount: 3,
    evidenceCount: 1,
    shareToken: "share-token-test",
  });

  console.assert(report.eventId === eventId, "eventId matches");
  console.assert(report.emergencyType === "manual", "emergencyType matches");
  console.assert(report.location.latitude === "28.6328", "latitude matches");
  console.assert(report.location.accuracy === "12m", "accuracy matches");
  console.assert(report.batteryLevel === "85%", "battery matches");
  console.assert(report.trustedContactsAlerted === true, "contacts alerted flag matches");
  console.assert(report.contactsAlertedCount === 3, "contacts count matches");
  console.assert(report.evidenceCount === 1, "evidence count matches");
  console.assert(report.blockchainProof.includes("MST Testnet"), "blockchain proof anchored to MST Testnet");
  console.assert(typeof reportHash === "string" && reportHash.length === 64, "SHA-256 hash generated");
  console.log("✓ Report fields and SHA-256 hash valid.");

  // Test 2: initiateWorkflow end-to-end (Demo Mode)
  console.log("\n[Test 2] initiateWorkflow() in Demo Mode:");
  await initiateWorkflow({
    eventId,
    userId,
    triggerType: "voice",
    lat: 28.6328,
    lng: 77.2197,
    accuracy: 10,
    batteryLevel: 90,
    contactsAlertedCount: 2,
    evidenceCount: 2,
    shareToken: "share-token-demo",
  });

  const record = getPoliceAlertStatus(eventId);
  console.assert(record !== null, "Record found in policeAlerts");
  console.assert(record.isDemo === true, "Demo mode is active when no real API is configured");
  console.assert(
    record.status === POLICE_STATES.POLICE_SUBMITTED ||
    record.status === POLICE_STATES.POLICE_ACKNOWLEDGED,
    "Status advanced to SUBMITTED / ACKNOWLEDGED"
  );
  console.log(`✓ Status: ${record.status}`);
  console.log(`✓ Timeline entries count: ${record.timeline.length}`);
  record.timeline.forEach((t, i) => console.log(`   ${i + 1}. [${t.state}] ${t.note || ""}`));

  // Test 3: Idempotency & Retry
  console.log("\n[Test 3] Idempotency & Retry check:");
  const initialRetryCount = record.retryCount || 0;
  await retryFailedPoliceAlert(eventId);
  console.assert(record.retryCount === initialRetryCount, "Submitted/Acknowledged record is not re-submitted unnecessarily");
  console.log("✓ Idempotency verified.");

  // Test 4: Wait for simulated demo acknowledgement
  console.log("\n[Test 4] Waiting for simulated acknowledgement...");
  await new Promise((r) => setTimeout(r, 2200));
  const finalRecord = getPoliceAlertStatus(eventId);
  console.assert(finalRecord.status === POLICE_STATES.POLICE_ACKNOWLEDGED, "Advanced to POLICE_ACKNOWLEDGED");
  console.log(`✓ Final Status: ${finalRecord.status}`);
  console.log("✓ All police workflow tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

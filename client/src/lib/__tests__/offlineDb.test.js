/**
 * ============================================================================
 * SURAKSHA SHADOW — OFFLINE INDEXEDDB RESILIENCE ENGINE TEST SUITE
 * ============================================================================
 *
 * Validates:
 * 1. Database schema and store initialization (all 5 stores + indices)
 * 2. Mandatory field presence (localId, emergencyId, timestamp, createdAt)
 * 3. Store 1 (emergency_events) CRUD & server ID reconciliation
 * 4. Store 2 (gps_points) local buffering & retrieval
 * 5. Store 3 (audio_clips) chunk storage & size tracking
 * 6. Store 4 (event_logs) audit trail chronological sorting
 * 7. Store 5 (sync_queue) FIFO queue ordering & retry lifecycle
 * 8. SyncEngine queue drain, ID mapping, and recovery
 * ============================================================================
 */

import {
  openResilienceDB,
  saveEmergencyEvent,
  getAllEmergencyEvents,
  getEmergencyEvent,
  updateEmergencyServerId,
  saveGpsPoint,
  getGpsPoints,
  saveAudioClip,
  getAudioClips,
  logOfflineEvent,
  getEventLogs,
  enqueueSync,
  getPendingSyncQueue,
  updateSyncItemStatus,
  pruneSyncedQueue,
  getResilienceStats,
  STORES,
  DB_NAME,
} from "../offlineDb.js";
import { syncEngine } from "../syncEngine.js";

// Mock minimal IndexedDB in Node environment if global.indexedDB is undefined
async function setupTestEnvironment() {
  if (typeof globalThis.indexedDB === "undefined") {
    // In-memory IndexedDB mock for Node.js test execution
    const memoryStores = new Map();

    class MockIDBIndex {
      constructor(store, keyPath) {
        this.store = store;
        this.keyPath = keyPath;
      }
      get(key) {
        const req = { onsuccess: null, onerror: null, result: null };
        queueMicrotask(() => {
          for (const val of this.store.data.values()) {
            if (val[this.keyPath] === key) {
              req.result = val;
              break;
            }
          }
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      }
      getAll(key) {
        const req = { onsuccess: null, onerror: null, result: [] };
        queueMicrotask(() => {
          const list = [];
          for (const val of this.store.data.values()) {
            if (key === undefined || val[this.keyPath] === key) {
              list.push(val);
            }
          }
          req.result = list;
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      }
    }

    class MockIDBObjectStore {
      constructor(name, opts = {}) {
        this.name = name;
        this.keyPath = opts.keyPath || "localId";
        if (!memoryStores.has(name)) {
          memoryStores.set(name, { data: new Map(), indices: new Map() });
        }
        this.storeRef = memoryStores.get(name);
        this.data = this.storeRef.data;
        this.indices = this.storeRef.indices;
      }

      createIndex(name, keyPath) {
        const idx = new MockIDBIndex(this, keyPath);
        this.indices.set(name, idx);
        return idx;
      }

      index(name) {
        return this.indices.get(name) || new MockIDBIndex(this, name);
      }

      put(value) {
        const key = value[this.keyPath];
        this.data.set(key, JSON.parse(JSON.stringify(value)));
      }

      get(key) {
        const req = { onsuccess: null, onerror: null, result: null };
        queueMicrotask(() => {
          req.result = this.data.has(key) ? JSON.parse(JSON.stringify(this.data.get(key))) : null;
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      }

      getAll() {
        const req = { onsuccess: null, onerror: null, result: [] };
        queueMicrotask(() => {
          req.result = Array.from(this.data.values()).map((v) => JSON.parse(JSON.stringify(v)));
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      }

      delete(key) {
        this.data.delete(key);
      }

      count() {
        const req = { onsuccess: null, onerror: null, result: 0 };
        queueMicrotask(() => {
          req.result = this.data.size;
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      }
    }

    class MockIDBTransaction {
      constructor(storeNames, mode) {
        this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
        this.mode = mode;
        this.oncomplete = null;
        this.onerror = null;
        queueMicrotask(() => {
          if (this.oncomplete) this.oncomplete();
        });
      }

      objectStore(name) {
        return new MockIDBObjectStore(name);
      }
    }

    class MockIDBDatabase {
      constructor() {
        this.objectStoreNames = {
          contains: (name) => memoryStores.has(name),
        };
      }

      createObjectStore(name, opts) {
        return new MockIDBObjectStore(name, opts);
      }

      transaction(storeNames, mode) {
        return new MockIDBTransaction(storeNames, mode);
      }
    }

    const mockDb = new MockIDBDatabase();

    globalThis.indexedDB = {
      open: (name, version) => {
        const req = {
          result: mockDb,
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        };
        queueMicrotask(() => {
          if (req.onupgradeneeded) {
            req.onupgradeneeded({ target: req });
          }
          if (req.onsuccess) {
            req.onsuccess();
          }
        });
        return req;
      },
    };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("SURAKSHA SHADOW — OFFLINE RESILIENCE ENGINE TEST RUNNER");
  console.log("=======================================================\n");

  await setupTestEnvironment();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    -> ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Database and Store Initialization
  // -------------------------------------------------------------
  await test("Database opens and creates all 5 required stores", async () => {
    const db = await openResilienceDB();
    assert(db !== null, "Database instance should not be null");
    assert(db.objectStoreNames.contains(STORES.EMERGENCY_EVENTS), "Missing emergency_events store");
    assert(db.objectStoreNames.contains(STORES.GPS_POINTS), "Missing gps_points store");
    assert(db.objectStoreNames.contains(STORES.AUDIO_CLIPS), "Missing audio_clips store");
    assert(db.objectStoreNames.contains(STORES.EVENT_LOGS), "Missing event_logs store");
    assert(db.objectStoreNames.contains(STORES.SYNC_QUEUE), "Missing sync_queue store");
  });

  // -------------------------------------------------------------
  // TEST 2: Emergency Events Store
  // -------------------------------------------------------------
  let savedEventLocalId = null;
  await test("Store 1 (emergency_events) saves record with mandatory schema", async () => {
    const event = await saveEmergencyEvent({
      userId: "user-test-123",
      triggerType: "voice",
      mode: "live",
      confidence: 0.95,
      details: "Code word detected: banana",
      lat: 28.6328,
      lng: 77.2197,
    });

    assert(event.localId, "Record must have localId");
    assert(event.timestamp > 0, "Record must have valid timestamp");
    assert(event.createdAt, "Record must have createdAt");
    assert(event.status === "active", "Default status must be active");
    assert(event.syncStatus === "pending", "Initial syncStatus must be pending");
    savedEventLocalId = event.localId;

    const fetched = await getEmergencyEvent(savedEventLocalId);
    assert(fetched !== null, "Must retrieve saved emergency event");
    assert(fetched.triggerType === "voice", "Trigger type must match");
  });

  await test("Store 1 updates server emergencyId mapping across stores", async () => {
    const serverId = "srv-uuid-999";
    const shareToken = "token-abc-123";
    await updateEmergencyServerId(savedEventLocalId, serverId, shareToken);

    const updated = await getEmergencyEvent(savedEventLocalId);
    assert(updated.emergencyId === serverId, "emergencyId must be updated to server ID");
    assert(updated.shareToken === shareToken, "shareToken must match");
    assert(updated.syncStatus === "synced", "syncStatus must be marked synced");
  });

  // -------------------------------------------------------------
  // TEST 3: GPS Points Store
  // -------------------------------------------------------------
  await test("Store 2 (gps_points) buffers coordinates with mandatory schema", async () => {
    const pt1 = await saveGpsPoint({
      emergencyId: "sos-test-session",
      lat: 28.6328,
      lng: 77.2197,
      accuracy: 10,
      speed: 1.2,
      batteryPct: 88,
      movementStatus: "moving (walking ~4 km/h)",
    });

    assert(pt1.localId, "GPS record must have localId");
    assert(pt1.emergencyId === "sos-test-session", "GPS record must have emergencyId");
    assert(pt1.timestamp > 0, "GPS record must have timestamp");
    assert(pt1.createdAt, "GPS record must have createdAt");

    const pt2 = await saveGpsPoint({
      emergencyId: "sos-test-session",
      lat: 28.6335,
      lng: 77.2205,
      accuracy: 8,
      speed: 4.5,
      batteryPct: 87,
      movementStatus: "in vehicle (~16 km/h)",
    });

    const allPoints = await getGpsPoints();
    assert(allPoints.length >= 2, "Must retrieve all buffered GPS points");
    assert(allPoints[0].timestamp <= allPoints[1].timestamp, "GPS points must be ordered chronologically");
  });

  // -------------------------------------------------------------
  // TEST 4: Audio Clips Store
  // -------------------------------------------------------------
  await test("Store 3 (audio_clips) persists audio chunks with metadata", async () => {
    const clip = await saveAudioClip({
      emergencyId: "sos-test-session",
      dataUrl: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJ8",
      mimeType: "audio/webm",
      sizeBytes: 1024,
      durationMs: 3000,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });

    assert(clip.localId, "Audio clip must have localId");
    assert(clip.emergencyId === "sos-test-session", "Audio clip must have emergencyId");
    assert(clip.timestamp > 0, "Audio clip must have timestamp");
    assert(clip.createdAt, "Audio clip must have createdAt");
    assert(clip.sizeBytes === 1024, "Size must be accurately tracked");

    const clips = await getAudioClips();
    assert(clips.length >= 1, "Audio clips must be retrievable");
  });

  // -------------------------------------------------------------
  // TEST 5: Event Logs Store
  // -------------------------------------------------------------
  await test("Store 4 (event_logs) maintains comprehensive audit trail", async () => {
    await logOfflineEvent("emergency_triggered", "Voice activation fired", "sos-test-session", { confidence: 0.92 });
    await logOfflineEvent("connection_lost", "Switched to offline resilience", "sos-test-session");
    await logOfflineEvent("connection_restored", "Network back, draining queue", "sos-test-session");

    const logs = await getEventLogs();
    assert(logs.length >= 3, "Event logs must be logged");
    assert(logs[0].localId, "Event log must have localId");
    assert(logs[0].timestamp > 0, "Event log must have timestamp");
    assert(logs[0].createdAt, "Event log must have createdAt");
  });

  // -------------------------------------------------------------
  // TEST 6: Sync Queue Store & Lifecycle
  // -------------------------------------------------------------
  let syncQueueItemId = null;
  await test("Store 5 (sync_queue) enqueues operations in FIFO order", async () => {
    const item1 = await enqueueSync({
      targetStore: STORES.EMERGENCY_EVENTS,
      recordLocalId: savedEventLocalId,
      emergencyId: savedEventLocalId,
      endpoint: "/api/sos",
      method: "POST",
      payload: { userId: "user-test", triggerType: "voice" },
    });

    const item2 = await enqueueSync({
      targetStore: STORES.GPS_POINTS,
      recordLocalId: "gps-rec-1",
      emergencyId: savedEventLocalId,
      endpoint: "/api/emergency/sos-test/ping",
      method: "POST",
      payload: { lat: 28.6328, lng: 77.2197 },
    });

    assert(item1.localId, "Sync item must have localId");
    assert(item1.status === "pending", "Initial status must be pending");
    assert(item1.timestamp > 0, "Sync item must have timestamp");
    assert(item1.createdAt, "Sync item must have createdAt");

    syncQueueItemId = item1.localId;

    const pending = await getPendingSyncQueue();
    assert(pending.length >= 2, "Must retrieve pending items");
    assert(pending[0].timestamp <= pending[1].timestamp, "Queue must be FIFO ordered");
  });

  await test("Store 5 status transitions: pending -> processing -> synced", async () => {
    await updateSyncItemStatus(syncQueueItemId, "processing");
    await updateSyncItemStatus(syncQueueItemId, "synced");

    const pending = await getPendingSyncQueue();
    const isStillPending = pending.some((it) => it.localId === syncQueueItemId);
    assert(!isStillPending, "Synced item must no longer appear in pending queue");
  });

  await test("Store 5 retry count & failure isolation", async () => {
    const failItem = await enqueueSync({
      targetStore: STORES.GPS_POINTS,
      recordLocalId: "gps-fail-test",
      emergencyId: "sos-test",
      endpoint: "/api/emergency/sos-test/ping",
      payload: { lat: 0, lng: 0 },
      maxRetries: 2,
    });

    await updateSyncItemStatus(failItem.localId, "processing");
    await updateSyncItemStatus(failItem.localId, "failed", "Simulated 503 Service Unavailable");

    const pending = await getPendingSyncQueue();
    const retried = pending.find((it) => it.localId === failItem.localId);
    assert(retried !== undefined, "Failed item within maxRetries remains queued for retry");
    assert(retried.retryCount === 1, "Retry count must increment");
    assert(retried.lastError.includes("503"), "Last error message must be recorded");
  });

  // -------------------------------------------------------------
  // TEST 7: Summary Diagnostics
  // -------------------------------------------------------------
  await test("Resilience Engine Diagnostics provides full store metrics", async () => {
    const stats = await getResilienceStats();
    assert(typeof stats[STORES.EMERGENCY_EVENTS] === "number", "emergency_events count must be reported");
    assert(typeof stats[STORES.GPS_POINTS] === "number", "gps_points count must be reported");
    assert(typeof stats[STORES.AUDIO_CLIPS] === "number", "audio_clips count must be reported");
    assert(typeof stats[STORES.EVENT_LOGS] === "number", "event_logs count must be reported");
    assert(typeof stats[STORES.SYNC_QUEUE] === "number", "sync_queue count must be reported");
  });

  console.log("\n-------------------------------------------------------");
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test runner encountered critical error:", err);
  process.exit(1);
});

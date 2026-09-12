/**
 * ============================================================================
 * SURAKSHA SHADOW — LIVE END-TO-END OFFLINE REPLAY & BACKEND INTEGRATION TEST
 * ============================================================================
 *
 * Tests the entire offline resilience lifecycle against the running Express backend:
 * 1. Health check verification (http://localhost:4000/api/health)
 * 2. Simulates 0-connectivity offline emergency activation (IndexedDB buffering)
 * 3. Simulates ongoing GPS tracking during network blackout
 * 4. Simulates ambient audio chunk capture during blackout
 * 5. Verifies queue state before sync (all records 'pending')
 * 6. Executes live syncEngine drainage to backend (http://localhost:4000)
 * 7. Verifies ID reconciliation, syncStatus transitions to 'synced'
 * 8. Queries backend Guardian endpoint to confirm server-side data integrity
 * ============================================================================
 */

import {
  openResilienceDB,
  saveEmergencyEvent,
  getEmergencyEvent,
  saveGpsPoint,
  getGpsPoints,
  saveAudioClip,
  getAudioClips,
  logOfflineEvent,
  getEventLogs,
  enqueueSync,
  getPendingSyncQueue,
  getResilienceStats,
  STORES,
} from "../offlineDb.js";
import { syncEngine } from "../syncEngine.js";

const BACKEND_URL = "http://localhost:4000";

// Ensure IndexedDB mock in Node environment
if (typeof globalThis.indexedDB === "undefined") {
  const memoryStores = new Map();

  class MockIDBTransaction {
    constructor(storeNames, mode) {
      this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
      this.mode = mode;
      this.oncomplete = null;
      this.onerror = null;
      this.pendingRequests = 0;
      setTimeout(() => {
        const checkDone = () => {
          if (this.pendingRequests === 0) {
            if (this.oncomplete) this.oncomplete();
          } else {
            setTimeout(checkDone, 1);
          }
        };
        checkDone();
      }, 2);
    }

    objectStore(name) {
      const store = new MockIDBObjectStore(name);
      store.tx = this;
      return store;
    }
  }

  class MockIDBIndex {
    constructor(store, keyPath) {
      this.store = store;
      this.keyPath = keyPath;
    }
    get(key) {
      if (this.store.tx) this.store.tx.pendingRequests++;
      const req = { onsuccess: null, onerror: null, result: null };
      setTimeout(() => {
        for (const val of this.store.data.values()) {
          if (val[this.keyPath] === key) {
            req.result = val;
            break;
          }
        }
        if (req.onsuccess) req.onsuccess();
        if (this.store.tx) this.store.tx.pendingRequests--;
      }, 0);
      return req;
    }
    getAll(key) {
      if (this.store.tx) this.store.tx.pendingRequests++;
      const req = { onsuccess: null, onerror: null, result: [] };
      setTimeout(() => {
        const list = [];
        for (const val of this.store.data.values()) {
          if (key === undefined || val[this.keyPath] === key) {
            list.push(val);
          }
        }
        req.result = list;
        if (req.onsuccess) req.onsuccess();
        if (this.store.tx) this.store.tx.pendingRequests--;
      }, 0);
      return req;
    }
  }

  class MockIDBObjectStore {
    constructor(name, opts = {}) {
      this.name = name;
      this.keyPath = opts.keyPath || "localId";
      this.tx = null;
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
      if (this.tx) this.tx.pendingRequests++;
      const req = { onsuccess: null, onerror: null, result: null };
      setTimeout(() => {
        req.result = this.data.has(key) ? JSON.parse(JSON.stringify(this.data.get(key))) : null;
        if (req.onsuccess) req.onsuccess();
        if (this.tx) this.tx.pendingRequests--;
      }, 0);
      return req;
    }

    getAll() {
      if (this.tx) this.tx.pendingRequests++;
      const req = { onsuccess: null, onerror: null, result: [] };
      setTimeout(() => {
        req.result = Array.from(this.data.values()).map((v) => JSON.parse(JSON.stringify(v)));
        if (req.onsuccess) req.onsuccess();
        if (this.tx) this.tx.pendingRequests--;
      }, 0);
      return req;
    }

    delete(key) {
      this.data.delete(key);
    }

    count() {
      if (this.tx) this.tx.pendingRequests++;
      const req = { onsuccess: null, onerror: null, result: 0 };
      setTimeout(() => {
        req.result = this.data.size;
        if (req.onsuccess) req.onsuccess();
        if (this.tx) this.tx.pendingRequests--;
      }, 0);
      return req;
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
    open: () => {
      const req = {
        result: mockDb,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runLiveE2ETest() {
  console.log("\n=======================================================");
  console.log("SURAKSHA SHADOW — LIVE END-TO-END OFFLINE REPLAY SUITE");
  console.log("=======================================================\n");

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

  // 1. Backend Server Reachability Check
  await test("Backend Server Health Check (http://localhost:4000/api/health)", async () => {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    assert(res.ok, `Server returned status ${res.status}`);
    const data = await res.json();
    assert(data.ok === true, "Health check must return { ok: true }");
  });

  // 2. Offline Simulation: Buffer Emergency Activation locally
  const offlineLocalSosId = `sos-offline-${Date.now()}`;
  const localShareToken = `token-${Math.random().toString(36).substring(2, 10)}`;

  await test("Step 1: Buffer Emergency Event offline during complete network blackout", async () => {
    const savedEvent = await saveEmergencyEvent({
      localId: offlineLocalSosId,
      emergencyId: offlineLocalSosId,
      userId: "usr-demo-resilience-001",
      triggerType: "voice",
      mode: "live",
      confidence: 0.98,
      details: "Discreet code word 'banana' triggered in subway (offline)",
      lat: 28.6328,
      lng: 77.2197,
      status: "active",
      shareToken: localShareToken,
      syncStatus: "pending",
    });

    assert(savedEvent.localId === offlineLocalSosId, "Local ID must match");
    assert(savedEvent.syncStatus === "pending", "syncStatus must be pending");

    await logOfflineEvent(
      "emergency_triggered",
      "Discreet code word triggered offline",
      offlineLocalSosId,
      { mode: "live", confidence: 0.98 }
    );

    // Enqueue emergency creation
    await enqueueSync({
      targetStore: STORES.EMERGENCY_EVENTS,
      recordLocalId: offlineLocalSosId,
      emergencyId: offlineLocalSosId,
      endpoint: "/api/sos",
      method: "POST",
      payload: {
        userId: "usr-demo-resilience-001",
        triggerType: "voice",
        mode: "live",
        confidence: 0.98,
        details: "Discreet code word 'banana' triggered in subway (offline)",
        lat: 28.6328,
        lng: 77.2197,
      },
    });
  });

  // 3. Offline Simulation: Buffer GPS Movement Trail
  await test("Step 2: Buffer GPS breadcrumbs locally during blackout", async () => {
    const pings = [
      { lat: 28.6328, lng: 77.2197, speed: 1.2, batteryPct: 85, movementStatus: "stationary" },
      { lat: 28.6335, lng: 77.2205, speed: 3.5, batteryPct: 84, movementStatus: "moving (walking ~4 km/h)" },
      { lat: 28.6348, lng: 77.2220, speed: 4.8, batteryPct: 83, movementStatus: "moving (fast ~5 km/h)" },
    ];

    for (let i = 0; i < pings.length; i++) {
      const p = pings[i];
      const gpsRec = await saveGpsPoint({
        emergencyId: offlineLocalSosId,
        lat: p.lat,
        lng: p.lng,
        accuracy: 10,
        speed: p.speed,
        batteryPct: p.batteryPct,
        movementStatus: p.movementStatus,
        syncStatus: "pending",
      });

      await enqueueSync({
        targetStore: STORES.GPS_POINTS,
        recordLocalId: gpsRec.localId,
        emergencyId: offlineLocalSosId,
        endpoint: `/api/emergency/${offlineLocalSosId}/ping`,
        method: "POST",
        payload: {
          lat: p.lat,
          lng: p.lng,
          accuracy: 10,
          batteryPct: p.batteryPct,
          movementStatus: p.movementStatus,
        },
      });
    }

    const savedPoints = await getGpsPoints(offlineLocalSosId);
    assert(savedPoints.length === 3, "3 GPS points must be buffered in IndexedDB");
  });

  // 4. Offline Simulation: Buffer Audio Stream Chunk
  await test("Step 3: Buffer Ambient Audio chunk locally during blackout", async () => {
    // Set ambient audio consent for user first
    await fetch(`${BACKEND_URL}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "usr-demo-resilience-001", consent: true }),
    });

    const fakeWebmChunk = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJ8";
    const audioRec = await saveAudioClip({
      emergencyId: offlineLocalSosId,
      dataUrl: fakeWebmChunk,
      mimeType: "audio/webm",
      sizeBytes: fakeWebmChunk.length,
      durationMs: 3000,
      sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      syncStatus: "pending",
    });

    await enqueueSync({
      targetStore: STORES.AUDIO_CLIPS,
      recordLocalId: audioRec.localId,
      emergencyId: offlineLocalSosId,
      endpoint: `/api/emergency/${offlineLocalSosId}/audio`,
      method: "POST",
      payload: { chunk: fakeWebmChunk },
    });

    const clips = await getAudioClips(offlineLocalSosId);
    assert(clips.length === 1, "Audio chunk must be saved in IndexedDB");
  });

  // 5. Verify Pending Sync Queue state
  await test("Step 4: Verify sync_queue contains all 5 pending operations", async () => {
    const queue = await getPendingSyncQueue();
    assert(queue.length === 5, `Expected 5 pending sync operations, got ${queue.length}`);
    assert(queue[0].targetStore === STORES.EMERGENCY_EVENTS, "First item must be emergency event (FIFO)");
  });

  // 6. Execute Live Synchronization Replay
  await test("Step 5: Execute live SyncEngine drainage against backend", async () => {
    syncEngine.setApiBaseUrl(BACKEND_URL);
    await syncEngine.drainQueue();

    const queueAfter = await getPendingSyncQueue();
    assert(queueAfter.length === 0, `All items must be synced, but ${queueAfter.length} remain pending`);
  });

  // 7. Verify Local Records are Reconciled
  let serverAssignedEventId = null;
  await test("Step 6: Verify local emergency event updated with server canonical UUID", async () => {
    const reconciledEvent = await getEmergencyEvent(offlineLocalSosId);
    assert(reconciledEvent !== null, "Reconciled event must exist");
    assert(reconciledEvent.syncStatus === "synced", "Event syncStatus must transition to 'synced'");
    assert(reconciledEvent.emergencyId !== offlineLocalSosId, "emergencyId must be updated from local ID to server UUID");
    serverAssignedEventId = reconciledEvent.emergencyId;
    console.log(`     -> Reconciled Local ID (${offlineLocalSosId}) -> Server UUID: ${serverAssignedEventId}`);
  });

  // 8. Query Guardian Endpoint on Server to Verify Live Persistence
  await test("Step 7: Query Guardian view on live backend to verify ingested trail", async () => {
    assert(serverAssignedEventId !== null, "Server event ID must be present");
    const res = await fetch(`${BACKEND_URL}/api/emergency/guardian/${serverAssignedEventId}`);
    assert(res.ok, `Guardian query returned status ${res.status}`);
    const data = await res.json();
    assert(data.emergency !== null, "Emergency record must be retrievable via Guardian API");
    console.log(`     -> Guardian Status: ${data.emergency.status || "active"} | Pings ingested: ${data.locations?.length || 0}`);
  });

  console.log("\n-------------------------------------------------------");
  console.log(`E2E TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveE2ETest().catch((err) => {
  console.error("Live E2E test encountered error:", err);
  process.exit(1);
});

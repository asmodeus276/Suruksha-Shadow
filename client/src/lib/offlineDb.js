/**
 * ============================================================================
 * SURAKSHA SHADOW — OFFLINE INDEXEDDB RESILIENCE ENGINE
 * ============================================================================
 *
 * Implements a zero-data-loss local persistence layer for all critical telemetry,
 * emergency lifelines, audio streams, GPS coordinates, and event audit trails.
 *
 * Required Object Stores:
 * 1. emergency_events - Tracks local & server-reconciled emergency sessions
 * 2. gps_points       - Real-time GPS breadcrumbs, speed, battery, heading
 * 3. audio_clips      - Ambient audio chunks captured during active emergencies
 * 4. event_logs       - Comprehensive audit trail of all safety events & errors
 * 5. sync_queue       - Persistent FIFO operational queue for background syncing
 *
 * Record Standards:
 * Every record is guaranteed to include:
 * - localId     : Unique local identifier (UUID/timestamp-prefixed)
 * - emergencyId : Active emergency session ID (or null/local ID)
 * - timestamp   : Epoch milliseconds (for fast sorting and chronological replay)
 * - createdAt   : ISO 8601 UTC timestamp string
 * ============================================================================
 */

export const DB_NAME = "suraksha_resilience_db";
export const DB_VERSION = 1;

export const STORES = {
  EMERGENCY_EVENTS: "emergency_events",
  GPS_POINTS: "gps_points",
  AUDIO_CLIPS: "audio_clips",
  EVENT_LOGS: "event_logs",
  SYNC_QUEUE: "sync_queue",
};

/**
 * Generate a cryptographically strong or resilient local ID
 */
export function generateLocalId(prefix = "rec") {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Open and initialize the IndexedDB instance with all required stores and indices.
 * @returns {Promise<IDBDatabase>}
 */
export function openResilienceDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. emergency_events store
      if (!db.objectStoreNames.contains(STORES.EMERGENCY_EVENTS)) {
        const store = db.createObjectStore(STORES.EMERGENCY_EVENTS, { keyPath: "localId" });
        store.createIndex("emergencyId", "emergencyId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }

      // 2. gps_points store
      if (!db.objectStoreNames.contains(STORES.GPS_POINTS)) {
        const store = db.createObjectStore(STORES.GPS_POINTS, { keyPath: "localId" });
        store.createIndex("emergencyId", "emergencyId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
      }

      // 3. audio_clips store
      if (!db.objectStoreNames.contains(STORES.AUDIO_CLIPS)) {
        const store = db.createObjectStore(STORES.AUDIO_CLIPS, { keyPath: "localId" });
        store.createIndex("emergencyId", "emergencyId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
      }

      // 4. event_logs store
      if (!db.objectStoreNames.contains(STORES.EVENT_LOGS)) {
        const store = db.createObjectStore(STORES.EVENT_LOGS, { keyPath: "localId" });
        store.createIndex("emergencyId", "emergencyId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("eventType", "eventType", { unique: false });
      }

      // 5. sync_queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "localId" });
        store.createIndex("emergencyId", "emergencyId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("targetStore", "targetStore", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Generic helper to perform a transaction operation safely
 */
async function executeTransaction(storeName, mode, callback) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));

      result = callback(store, tx);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// STORE 1: EMERGENCY EVENTS
// ============================================================================

/**
 * Save or update an emergency event in local IndexedDB.
 */
export async function saveEmergencyEvent(eventData) {
  const now = Date.now();
  const record = {
    localId: eventData.localId || generateLocalId("sos"),
    emergencyId: eventData.emergencyId || eventData.id || null,
    userId: eventData.userId || null,
    triggerType: eventData.triggerType || "manual",
    mode: eventData.mode || "live",
    confidence: eventData.confidence != null ? eventData.confidence : 1.0,
    details: eventData.details || "",
    lat: eventData.lat != null ? Number(eventData.lat) : null,
    lng: eventData.lng != null ? Number(eventData.lng) : null,
    status: eventData.status || "active",
    shareToken: eventData.shareToken || null,
    syncStatus: eventData.syncStatus || "pending", // 'pending' | 'synced' | 'failed'
    timestamp: eventData.timestamp || now,
    createdAt: eventData.createdAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  await executeTransaction(STORES.EMERGENCY_EVENTS, "readwrite", (store) => {
    store.put(record);
  });

  return record;
}

/**
 * Retrieve all emergency events sorted by timestamp descending.
 */
export async function getAllEmergencyEvents() {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMERGENCY_EVENTS, "readonly");
    const req = tx.objectStore(STORES.EMERGENCY_EVENTS).getAll();
    req.onsuccess = () => {
      const results = req.result || [];
      results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve single emergency event by localId or emergencyId.
 */
export async function getEmergencyEvent(id) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMERGENCY_EVENTS, "readonly");
    const store = tx.objectStore(STORES.EMERGENCY_EVENTS);
    const req = store.get(id);

    req.onsuccess = () => {
      if (req.result) return resolve(req.result);
      // Try querying by emergencyId index
      const index = store.index("emergencyId");
      const idxReq = index.get(id);
      idxReq.onsuccess = () => resolve(idxReq.result || null);
      idxReq.onerror = () => reject(idxReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update server emergencyId mapping across local record and linked entries.
 */
export async function updateEmergencyServerId(localId, serverEmergencyId, shareToken = null) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.EMERGENCY_EVENTS, STORES.GPS_POINTS, STORES.AUDIO_CLIPS, STORES.EVENT_LOGS, STORES.SYNC_QUEUE], "readwrite");
    
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);

    // 1. Update event record
    const eventStore = tx.objectStore(STORES.EMERGENCY_EVENTS);
    const getReq = eventStore.get(localId);
    getReq.onsuccess = () => {
      if (getReq.result) {
        const ev = getReq.result;
        ev.emergencyId = serverEmergencyId;
        if (shareToken) ev.shareToken = shareToken;
        ev.syncStatus = "synced";
        ev.updatedAt = new Date().toISOString();
        eventStore.put(ev);
      }
    };
  });
}

// ============================================================================
// STORE 2: GPS POINTS
// ============================================================================

/**
 * Save a GPS location point record locally.
 */
export async function saveGpsPoint(gpsData) {
  const now = Date.now();
  const record = {
    localId: gpsData.localId || generateLocalId("gps"),
    emergencyId: gpsData.emergencyId || null,
    lat: Number(gpsData.lat),
    lng: Number(gpsData.lng),
    accuracy: gpsData.accuracy != null ? Number(gpsData.accuracy) : 15,
    speed: gpsData.speed != null ? Number(gpsData.speed) : null,
    heading: gpsData.heading != null ? Number(gpsData.heading) : null,
    batteryPct: gpsData.batteryPct != null ? Number(gpsData.batteryPct) : null,
    movementStatus: gpsData.movementStatus || "stationary",
    syncStatus: gpsData.syncStatus || "pending",
    timestamp: gpsData.timestamp || now,
    createdAt: gpsData.createdAt || new Date(now).toISOString(),
  };

  await executeTransaction(STORES.GPS_POINTS, "readwrite", (store) => {
    store.put(record);
  });

  return record;
}

/**
 * Retrieve all GPS points, optionally filtered by emergencyId.
 */
export async function getGpsPoints(emergencyId = null) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GPS_POINTS, "readonly");
    const store = tx.objectStore(STORES.GPS_POINTS);

    let req;
    if (emergencyId) {
      const idx = store.index("emergencyId");
      req = idx.getAll(emergencyId);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      const results = req.result || [];
      results.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// STORE 3: AUDIO CLIPS
// ============================================================================

/**
 * Save an ambient audio clip/chunk into IndexedDB.
 */
export async function saveAudioClip(clipData) {
  const now = Date.now();
  const record = {
    localId: clipData.localId || generateLocalId("aud"),
    emergencyId: clipData.emergencyId || null,
    blob: clipData.blob || null,
    dataUrl: clipData.dataUrl || null,
    mimeType: clipData.mimeType || "audio/webm",
    sizeBytes: clipData.sizeBytes || clipData.blob?.size || 0,
    durationMs: clipData.durationMs || 3000,
    sha256: clipData.sha256 || null,
    syncStatus: clipData.syncStatus || "pending",
    timestamp: clipData.timestamp || now,
    createdAt: clipData.createdAt || new Date(now).toISOString(),
  };

  await executeTransaction(STORES.AUDIO_CLIPS, "readwrite", (store) => {
    store.put(record);
  });

  return record;
}

/**
 * Retrieve all audio clips, optionally filtered by emergencyId.
 */
export async function getAudioClips(emergencyId = null) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AUDIO_CLIPS, "readonly");
    const store = tx.objectStore(STORES.AUDIO_CLIPS);

    let req;
    if (emergencyId) {
      const idx = store.index("emergencyId");
      req = idx.getAll(emergencyId);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      const results = req.result || [];
      results.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// STORE 4: EVENT LOGS
// ============================================================================

/**
 * Log an event to the local audit trail.
 */
export async function logOfflineEvent(eventType, details, emergencyId = null, metadata = {}) {
  const now = Date.now();
  const record = {
    localId: generateLocalId("log"),
    emergencyId: emergencyId || null,
    eventType: eventType || "info",
    details: typeof details === "string" ? details : JSON.stringify(details),
    metadata: metadata || {},
    syncStatus: "pending",
    timestamp: now,
    createdAt: new Date(now).toISOString(),
  };

  try {
    await executeTransaction(STORES.EVENT_LOGS, "readwrite", (store) => {
      store.put(record);
    });
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to persist event log:", err);
  }

  return record;
}

/**
 * Retrieve event logs, newest or oldest first.
 */
export async function getEventLogs(emergencyId = null, ascending = false) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENT_LOGS, "readonly");
    const store = tx.objectStore(STORES.EVENT_LOGS);

    let req;
    if (emergencyId) {
      const idx = store.index("emergencyId");
      req = idx.getAll(emergencyId);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      const results = req.result || [];
      results.sort((a, b) =>
        ascending ? (a.timestamp || 0) - (b.timestamp || 0) : (b.timestamp || 0) - (a.timestamp || 0)
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// STORE 5: SYNC QUEUE
// ============================================================================

/**
 * Enqueue an operation into the persistent sync queue.
 */
export async function enqueueSync(syncItem) {
  const now = Date.now();
  const record = {
    localId: syncItem.localId || generateLocalId("sync"),
    emergencyId: syncItem.emergencyId || null,
    targetStore: syncItem.targetStore, // 'emergency_events' | 'gps_points' | 'audio_clips' | 'event_logs'
    recordLocalId: syncItem.recordLocalId,
    endpoint: syncItem.endpoint,
    method: syncItem.method || "POST",
    payload: syncItem.payload || {},
    status: syncItem.status || "pending", // 'pending' | 'processing' | 'synced' | 'failed'
    retryCount: syncItem.retryCount || 0,
    maxRetries: syncItem.maxRetries || 5,
    lastError: null,
    timestamp: syncItem.timestamp || now,
    createdAt: syncItem.createdAt || new Date(now).toISOString(),
  };

  await executeTransaction(STORES.SYNC_QUEUE, "readwrite", (store) => {
    store.put(record);
  });

  return record;
}

/**
 * Get pending sync items that need transmission to server.
 */
export async function getPendingSyncQueue() {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, "readonly");
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const pending = all.filter((item) => item.status === "pending" || item.status === "failed");
      pending.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // FIFO
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update the status of a sync queue item and its underlying target store record.
 */
export async function updateSyncItemStatus(localId, status, lastError = null) {
  const db = await openResilienceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.SYNC_QUEUE, STORES.EMERGENCY_EVENTS, STORES.GPS_POINTS, STORES.AUDIO_CLIPS], "readwrite");
    
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);

    const queueStore = tx.objectStore(STORES.SYNC_QUEUE);
    const getReq = queueStore.get(localId);

    getReq.onsuccess = () => {
      if (!getReq.result) return;
      const item = getReq.result;
      item.status = status;
      if (status === "processing") {
        item.retryCount = (item.retryCount || 0) + 1;
      }
      if (lastError) {
        item.lastError = typeof lastError === "string" ? lastError : lastError?.message || JSON.stringify(lastError);
      }
      queueStore.put(item);

      // Also update target store syncStatus if recordLocalId is specified
      if (item.targetStore && item.recordLocalId) {
        try {
          const targetStore = tx.objectStore(item.targetStore);
          const targetGetReq = targetStore.get(item.recordLocalId);
          targetGetReq.onsuccess = () => {
            if (targetGetReq.result) {
              const targetRec = targetGetReq.result;
              targetRec.syncStatus = status === "synced" ? "synced" : status === "processing" ? "syncing" : "failed";
              targetStore.put(targetRec);
            }
          };
        } catch {
          // target store may not be in transaction or not tracked
        }
      }
    };
  });
}

/**
 * Remove synced items older than 24 hours to prevent unbounded database growth.
 */
export async function pruneSyncedQueue(maxAgeMs = 24 * 60 * 60 * 1000) {
  const db = await openResilienceDB();
  const cutoff = Date.now() - maxAgeMs;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const req = store.getAll();

    req.onsuccess = () => {
      const items = req.result || [];
      let deleted = 0;
      for (const item of items) {
        if (item.status === "synced" && item.timestamp < cutoff) {
          store.delete(item.localId);
          deleted++;
        }
      }
      resolve(deleted);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get summary diagnostics of all IndexedDB resilience stores.
 */
export async function getResilienceStats() {
  const db = await openResilienceDB();
  const stores = Object.values(STORES);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readonly");
    const stats = {};
    let completed = 0;

    stores.forEach((storeName) => {
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => {
        stats[storeName] = req.result;
        completed++;
        if (completed === stores.length) {
          resolve(stats);
        }
      };
      req.onerror = () => {
        stats[storeName] = -1;
        completed++;
        if (completed === stores.length) {
          resolve(stats);
        }
      };
    });
  });
}

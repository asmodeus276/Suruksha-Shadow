import { useRef, useCallback } from "react";
import { createEvidenceBlock } from "../lib/evidenceIntegrity";

/**
 * useEvidenceVault
 * -----------------------------------------------------------
 * FR-3-style automated evidence capture: when Shield transitions
 * Amber -> Coral, silently records a short ambient audio clip and
 * persists it on-device for the user's own evidentiary use.
 *
 * Storage: IndexedDB, not localStorage. The original draft stored
 * an `URL.createObjectURL()` string in localStorage — that URL is
 * only valid for the lifetime of the current page/tab. A reload
 * (or the browser being closed after a real emergency, which is
 * exactly when this matters most) would silently lose the "evidence."
 * IndexedDB stores the actual audio Blob and survives reloads.
 *
 * Integrity: each record includes a SHA-256 hash of the audio bytes
 * alongside the client-side timestamp. Note this is *not* the same
 * claim as "immutable" — a device timestamp can be altered by
 * whoever controls the device's clock or devtools. The hash lets
 * you later prove a given file's bytes haven't been edited since
 * capture; it does not independently prove *when* the recording was
 * made.
 *
 * P0.3 Enhancement: After local capture, the hook now creates a
 * composite evidence block (audio + GPS + timestamp) and uploads
 * it to the server for BSA 2023 Section 63 countersigning. The
 * server returns an HMAC-SHA256 countersignature bound to a
 * server-authoritative timestamp, completing the legal chain
 * of custody.
 */

const DB_NAME = "shield_evidence_vault";
const STORE_NAME = "recordings";
const DB_VERSION = 2; // Bumped for new serverReceipt field

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRecord(record) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Returns every stored record, newest first. Each record's `blob`
 *  field is a real Blob you can pass to URL.createObjectURL() for
 *  playback in a viewer component. */
export async function getVaultRecords() {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.capturedAt - a.capturedAt));
    req.onerror = () => reject(req.error);
  });
}

async function hashBlob(blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Uploads evidence block to the server for BSA 2023 countersigning.
 * Non-blocking: if upload fails, the local record is still saved.
 *
 * @param {Object} evidenceBlock - { blob, metadata, clientHash }
 * @param {string} sosId - Active emergency event ID
 * @param {string} apiBaseUrl - Server base URL
 * @returns {Object|null} Server receipt or null on failure
 */
async function uploadEvidenceBlock(evidenceBlock, sosId, apiBaseUrl) {
  try {
    // Vercel serverless functions enforce a strict 4.5 MB request body limit.
    // Enforce a hard 3.5 MB ceiling to prevent HTTP 413 Payload Too Large errors.
    const MAX_PAYLOAD_BYTES = 3.5 * 1024 * 1024;
    if (evidenceBlock?.blob?.size > MAX_PAYLOAD_BYTES) {
      console.warn(
        `Evidence block size (${evidenceBlock.blob.size} bytes) exceeds Vercel 3.5 MB limit. Preserved locally only.`
      );
      return null;
    }

    const formData = new FormData();
    formData.append("audio", evidenceBlock.blob, "evidence.webm");
    formData.append("clientHash", evidenceBlock.clientHash);
    formData.append("metadata", JSON.stringify(evidenceBlock.metadata));
    formData.append("sosId", sosId);

    const res = await fetch(`${apiBaseUrl}/api/evidence/upload-block`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return data.receipt || null;
    }

    console.warn("Evidence upload failed:", res.status, await res.text());
    return null;
  } catch (err) {
    // Non-fatal: local evidence is still preserved even if the server
    // is unreachable. The countersignature can be obtained later.
    console.warn("Evidence upload error (non-fatal):", err);
    return null;
  }
}

/**
 * Retrieves current GPS coordinates (best effort).
 * Returns null if geolocation is unavailable or times out.
 */
function getCurrentCoords() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 3000, enableHighAccuracy: true }
    );
  });
}

export function useEvidenceVault({ onSaved, apiBaseUrl, activeSosId } = {}) {
  // Discrete segment ceiling: 30 seconds ensures webm audio stays well under 500 KB,
  // far below Vercel's unchangeable 4.5 MB request payload ceiling.
  const MAX_SEGMENT_DURATION_MS = 30000;
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startAutomatedCapture = useCallback(async (durationMs = 10000, sosIdOverride = null) => {
    const segmentDuration = Math.min(Math.max(1000, durationMs), MAX_SEGMENT_DURATION_MS);
    const targetSosId = sosIdOverride || activeSosId;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Common in an active emergency: mic already claimed by the fake
      // call's speechSynthesis path, or permission was never granted.
      // Fail silently to the console — never surface a blocking error
      // mid-emergency.
      console.error("Evidence Vault: microphone access unavailable:", err);
      return null;
    }

    return new Promise((resolve) => {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); // release the mic icon promptly

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const capturedAt = Date.now();
        let hash = null;
        try {
          hash = await hashBlob(audioBlob);
        } catch (err) {
          console.error("Evidence Vault: hashing failed:", err);
        }

        // P0.3: Create composite evidence block with GPS metadata
        let serverReceipt = null;
        let evidenceMetadata = null;
        try {
          const coords = await getCurrentCoords();
          const evidenceBlock = await createEvidenceBlock(audioBlob, coords);
          evidenceMetadata = evidenceBlock.metadata;

          // Upload to server for BSA 2023 countersigning (use active event or fallback UUID)
          if (apiBaseUrl) {
            const validSosId = targetSosId || crypto.randomUUID();
            serverReceipt = await uploadEvidenceBlock(
              evidenceBlock,
              validSosId,
              apiBaseUrl
            );
          }
        } catch (err) {
          console.warn("Evidence Vault: evidence block creation/upload failed:", err);
        }

        const record = {
          id: `EVID-${capturedAt}`,
          capturedAt,
          capturedAtISO: new Date(capturedAt).toISOString(),
          sha256: hash,
          sizeBytes: audioBlob.size,
          blob: audioBlob,
          // P0.3: GPS metadata, server countersignature, and Polygon blockchain anchor
          gps: evidenceMetadata
            ? { lat: evidenceMetadata.lat, lng: evidenceMetadata.lng, accuracy: evidenceMetadata.accuracy }
            : null,
          serverReceipt: serverReceipt || null,
          polygonAnchor: serverReceipt?.polygonAnchor || null,
        };

        try {
          await saveRecord(record);
          onSaved?.(record);
        } catch (err) {
          console.error("Evidence Vault: failed to persist recording:", err);
        }

        resolve(record);
      };

      recorder.onerror = (err) => {
        console.error("Evidence Vault: recorder error:", err);
        resolve(null);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, segmentDuration);
    });
  }, [onSaved, apiBaseUrl, activeSosId]);

  return { startAutomatedCapture };
}
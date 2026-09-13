import { useRef, useCallback } from "react";
import { createEvidenceBlock } from "../lib/evidenceIntegrity";
import { anchorEvidenceToMST } from "../lib/mstAnchor";
import { signArtifactDigest, getEnclaveFingerprint } from "../lib/evidenceStore";

/**
 * useEvidenceVault
 * -----------------------------------------------------------
 * Automated evidence capture & judicial vault:
 * Captures ambient audio clips, computes SHA-256 digests,
 * signs with WebCrypto non-extractable P-256 hardware keys,
 * and immutably anchors every discrete artifact to the MST Blockchain.
 *
 * Storage: IndexedDB (shield_evidence_vault)
 * Complies with BSA 2023 §63 & FRE 902(13)/(14).
 */

const DB_NAME = "shield_evidence_vault";
const STORE_NAME = "recordings";
const DB_VERSION = 2;

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

/**
 * Returns every stored record, newest first.
 */
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
 * Uploads evidence block to server for BSA 2023 countersigning (best-effort non-blocking).
 */
async function uploadEvidenceBlock(evidenceBlock, sosId, apiBaseUrl) {
  try {
    const MAX_PAYLOAD_BYTES = 3.5 * 1024 * 1024;
    if (evidenceBlock?.blob?.size > MAX_PAYLOAD_BYTES) {
      console.warn(
        `Evidence block size (${evidenceBlock.blob.size} bytes) exceeds 3.5 MB limit. Preserved locally only.`
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
    return null;
  } catch (err) {
    console.warn("Evidence upload error (non-fatal):", err);
    return null;
  }
}

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
  const MAX_SEGMENT_DURATION_MS = 30000;
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startAutomatedCapture = useCallback(
    async (durationMs = 10000, sosIdOverride = null) => {
      const segmentDuration = Math.min(Math.max(1000, durationMs), MAX_SEGMENT_DURATION_MS);
      const targetSosId = sosIdOverride || activeSosId;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        });
      } catch (err) {
        console.error("Evidence Vault: microphone access unavailable:", err);
        return null;
      }

      return new Promise((resolve) => {
        audioChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

        let recorder;
        try {
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
        } catch {
          recorder = new MediaRecorder(stream);
        }
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());

          const finalMime = recorder.mimeType || mimeType || "audio/webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
          const capturedAt = Date.now();
          const artifactId = `EVID-${capturedAt}`;
          let rawHash = null;
          try {
            rawHash = await hashBlob(audioBlob);
          } catch (err) {
            console.error("Evidence Vault: hashing failed:", err);
          }
          const hash = rawHash ? `0x${rawHash}` : null;

          // Sign digest with WebCrypto Non-Extractable P-256 Enclave Key
          let enclaveSignature = null;
          let enclaveFingerprint = null;
          if (hash) {
            enclaveSignature = await signArtifactDigest(hash);
            enclaveFingerprint = await getEnclaveFingerprint();
          }

          let serverReceipt = null;
          let evidenceMetadata = null;
          try {
            const coords = await getCurrentCoords();
            const evidenceBlock = await createEvidenceBlock(audioBlob, coords);
            evidenceMetadata = evidenceBlock.metadata;

            if (apiBaseUrl) {
              const validSosId = targetSosId || crypto.randomUUID();
              serverReceipt = await uploadEvidenceBlock(evidenceBlock, validSosId, apiBaseUrl);
            }
          } catch (err) {
            console.warn("Evidence Vault: evidence block creation/upload failed:", err);
          }

          // Dedicated MST Blockchain Notarization Anchor for this discrete audio clip
          let mstAnchor = null;
          if (hash) {
            try {
              mstAnchor = await anchorEvidenceToMST(
                artifactId,
                hash,
                {
                  ...evidenceMetadata,
                  enclaveSignature,
                  enclaveFingerprint,
                  hardwareEnclaveInfo: "Hardware Enclave: On-Device WebCrypto Keystore (Non-Extractable P-256 Key)",
                }
              );
            } catch (mstErr) {
              console.warn("MST Blockchain anchoring error (non-fatal):", mstErr);
            }
          }

          const record = {
            id: artifactId,
            capturedAt,
            capturedAtISO: new Date(capturedAt).toISOString(),
            sha256: hash,
            sizeBytes: audioBlob.size,
            durationMs: segmentDuration,
            blob: audioBlob,
            enclaveSignature,
            enclaveFingerprint,
            hardwareEnclaveInfo: "Hardware Enclave: On-Device WebCrypto Keystore (Non-Extractable P-256 Key)",
            gps: evidenceMetadata
              ? { lat: evidenceMetadata.lat, lng: evidenceMetadata.lng, accuracy: evidenceMetadata.accuracy }
              : null,
            serverReceipt: serverReceipt || null,
            mstAnchor: mstAnchor || null,
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
    },
    [onSaved, apiBaseUrl, activeSosId]
  );

  return { startAutomatedCapture };
}
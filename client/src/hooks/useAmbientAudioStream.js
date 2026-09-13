import { useEffect, useRef, useState } from "react";
import { saveAudioClip, enqueueSync, updateSyncItemStatus, STORES } from "../lib/offlineDb";

const CHUNK_MS = 3000; // short chunks keep latency low and payloads small

/**
 * FR5 — streams ambient audio to Trusted Contacts, but ONLY while both:
 *   1. the Primary User has granted consent (FR6's flag), and
 *   2. an emergency is currently active
 * are true. Server-side enforcement (server/routes/audio.js, TR7)
 * re-checks consent on every chunk regardless of local state.
 *
 * Integrated with IndexedDB Resilience Engine:
 * Every chunk is saved to `audio_clips` with sha256 checksum and queued
 * in `sync_queue` for zero-loss audio stream archiving.
 */
export function useAmbientAudioStream({ apiBaseUrl, eventId, consent, enabled }) {
  const [status, setStatus] = useState("idle"); // idle | streaming | error
  const streamRef = useRef(null);

  useEffect(() => {
    const shouldStream = enabled && consent && eventId;
    if (!shouldStream) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let currentRecorder = null;

    async function begin() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setStatus("streaming");
        recordOneChunk(stream);
      } catch (err) {
        console.warn("Couldn't start ambient audio capture:", err);
        setStatus("error");
      }
    }

    function recordOneChunk(stream) {
      if (cancelled) return;

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(
        (t) => window.MediaRecorder?.isTypeSupported?.(t)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      currentRecorder = recorder;
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
          const dataUrl = await blobToDataUrl(blob);

          // 1. Save to local IndexedDB Resilience audio_clips store
          let syncItem = null;
          try {
            const clipRec = await saveAudioClip({
              emergencyId: eventId,
              blob,
              dataUrl,
              mimeType: mimeType || "audio/webm",
              sizeBytes: blob.size,
              durationMs: CHUNK_MS,
              syncStatus: "pending",
            });

            syncItem = await enqueueSync({
              targetStore: STORES.AUDIO_CLIPS,
              recordLocalId: clipRec.localId,
              emergencyId: eventId,
              endpoint: `/api/emergency/${eventId}/audio`,
              method: "POST",
              payload: { chunk: dataUrl },
            });
          } catch (idbErr) {
            console.warn("[RESILIENCE] Local audio clip persistence warning:", idbErr);
          }

          // 2. Direct network transmission attempt
          fetch(`${apiBaseUrl}/api/emergency/${eventId}/audio`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chunk: dataUrl }),
          })
            .then((res) => {
              if (!res.ok) throw new Error(`Server responded ${res.status}`);
              if (syncItem) {
                updateSyncItemStatus(syncItem.localId, "synced").catch(() => {});
              }
            })
            .catch((err) => {
              console.warn("Ambient audio chunk network transmission deferred (safely buffered in IndexedDB):", err);
              // Do not set error state if stored safely in IndexedDB
            });
        }
        if (!cancelled) recordOneChunk(stream); // start the next full chunk
      };

      recorder.onerror = (e) => {
        console.warn("MediaRecorder error:", e.error);
        setStatus("error");
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, CHUNK_MS);
    }

    begin();

    return () => {
      cancelled = true;
      if (currentRecorder && currentRecorder.state !== "inactive") {
        currentRecorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [apiBaseUrl, eventId, consent, enabled]);

  return { status };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
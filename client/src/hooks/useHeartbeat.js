import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Passive Heartbeat — Kidnapping-grade silence detection.
 *
 * While Shield is armed, sends a lightweight GPS ping to the server
 * every 30 seconds. If the server stops receiving pings (phone off,
 * confiscated, airplane mode, battery dead), it auto-fires SOS and
 * alerts guardians with the last known location.
 *
 * This is the single most important passive safety feature because
 * it requires ZERO user action — the absence of signal IS the alert.
 */
export function useHeartbeat({ userId, apiBaseUrl, enabled }) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !userId) return;

    async function sendPing() {
      let lat = null;
      let lng = null;

      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // GPS unavailable — still send the heartbeat so server knows we're alive
      }

      fetch(`${apiBaseUrl}/api/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, lat, lng }),
      }).catch((err) => console.warn("Heartbeat ping failed:", err));
    }

    // Send immediately on arm, then every 30s
    sendPing();
    intervalRef.current = setInterval(sendPing, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);

      // Tell server to stop watching this user
      fetch(`${apiBaseUrl}/api/heartbeat/disarm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    };
  }, [enabled, userId, apiBaseUrl]);
}

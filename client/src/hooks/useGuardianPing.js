import { useEffect, useRef } from "react";

const PING_INTERVAL_MS = 7000; // within the 5-10s target from the TRD
const MOVEMENT_THRESHOLD_METERS = 15; // beyond typical GPS jitter, so status doesn't flicker

/**
 * Streams location + battery + movement to the backend every ~7s while
 * an emergency is active — FR-4 / FR-7 / FR-8 / TR-5. The backend
 * persists each ping and broadcasts it live to the Guardian view.
 */
export function useGuardianPing({ eventId, apiBaseUrl, enabled }) {
  const lastPositionRef = useRef(null);

  useEffect(() => {
    if (!enabled || !eventId) return;

    const interval = setInterval(async () => {
      const position = await getCurrentPosition().catch(() => null);
      if (!position) return;

      const { latitude: lat, longitude: lng } = position.coords;
      const movementStatus = classifyMovement(lastPositionRef.current, { lat, lng });
      lastPositionRef.current = { lat, lng };

      const batteryPct = await getBatteryPct();

      fetch(`${apiBaseUrl}/api/emergency/${eventId}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, batteryPct, movementStatus }),
      }).catch((err) => console.warn("Ping failed:", err));
    }, PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled, eventId, apiBaseUrl]);
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
    });
  });
}

function classifyMovement(prev, curr) {
  if (!prev) return "unknown";
  const distance = haversineMeters(prev, curr);
  return distance > MOVEMENT_THRESHOLD_METERS ? "moving" : "stationary";
}

// Straight-line distance between two lat/lng points, in meters.
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Battery Status API — only implemented in Chrome/Edge on some
 * platforms; Firefox and Safari don't support it. Falls back to null,
 * which the Guardian view already renders as "—".
 */
async function getBatteryPct() {
  if (!navigator.getBattery) return null;
  try {
    const battery = await navigator.getBattery();
    return Math.round(battery.level * 100);
  } catch (_) {
    return null;
  }
}
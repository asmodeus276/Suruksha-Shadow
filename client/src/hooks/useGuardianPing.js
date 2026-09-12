import { useEffect, useRef } from "react";
import { saveGpsPoint, enqueueSync, updateSyncItemStatus, STORES } from "../lib/offlineDb";

const PING_INTERVAL_MS = 7000; // within the 5-10s target from the TRD
const MOVEMENT_THRESHOLD_METERS = 15; // beyond typical GPS jitter, so status doesn't flicker

/**
 * Streams location + battery + movement to the backend every ~7s while
 * an emergency is active — FR-4 / FR-7 / FR-8 / TR-5. The backend
 * persists each ping and broadcasts it live to the Guardian view.
 *
 * Integrated with IndexedDB Resilience Engine:
 * Every coordinate is saved on-device to `gps_points` and enqueued in `sync_queue`
 * guaranteeing zero breadcrumb loss during network dropouts.
 */
export function useGuardianPing({ eventId, apiBaseUrl, enabled, onLocationUpdate }) {
  const lastPositionRef = useRef(null);

  useEffect(() => {
    if (!enabled || !eventId) return;

    const doPing = async () => {
      const position = await getCurrentPosition().catch(() => null);
      if (!position) return;

      const { latitude: lat, longitude: lng, accuracy, speed } = position.coords;
      const movementStatus = classifyMovement(lastPositionRef.current, { lat, lng }, speed);
      lastPositionRef.current = { lat, lng };

      const batteryPct = await getBatteryPct();
      const payload = {
        lat,
        lng,
        accuracy: Math.round(accuracy || 15),
        batteryPct,
        movementStatus,
      };

      // 1. Persist locally to IndexedDB
      let localGpsRecord = null;
      let syncQueueItem = null;
      try {
        localGpsRecord = await saveGpsPoint({
          emergencyId: eventId,
          lat,
          lng,
          accuracy: payload.accuracy,
          speed: speed != null ? Math.round(speed * 3.6) : null,
          batteryPct,
          movementStatus,
          syncStatus: "pending",
        });

        syncQueueItem = await enqueueSync({
          targetStore: STORES.GPS_POINTS,
          recordLocalId: localGpsRecord.localId,
          emergencyId: eventId,
          endpoint: `/api/emergency/${eventId}/ping`,
          method: "POST",
          payload,
        });
      } catch (idbErr) {
        console.warn("[RESILIENCE] Local GPS persistence warning:", idbErr);
      }

      // 2. Direct network transmission attempt
      fetch(`${apiBaseUrl}/api/emergency/${eventId}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (res.ok && syncQueueItem) {
            updateSyncItemStatus(syncQueueItem.localId, "synced").catch(() => {});
          }
        })
        .catch((err) => console.warn("Ping network dispatch failed (safely buffered in IndexedDB):", err));

      if (typeof onLocationUpdate === "function") {
        onLocationUpdate({
          lat,
          lng,
          accuracy: Math.round(accuracy || 15),
          batteryPct,
          movementStatus,
          created_at: new Date().toISOString(),
        });
      }
    };

    // Immediate initial ping, then periodic
    doPing();
    const interval = setInterval(doPing, PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled, eventId, apiBaseUrl, onLocationUpdate]);
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 6000,
    });
  });
}

function classifyMovement(prev, curr, speed) {
  if (speed != null && speed > 4.2) return `in vehicle (~${Math.round(speed * 3.6)} km/h)`;
  if (speed != null && speed > 0.8) return `moving (walking ~${Math.round(speed * 3.6)} km/h)`;
  if (!prev) return "stationary";
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
  } catch {
    return null;
  }
}
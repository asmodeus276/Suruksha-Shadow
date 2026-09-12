import { useState, useEffect, useRef, useCallback } from "react";

const DEVIATION_THRESHOLD_M = 500;     // 500m off-route triggers alert
const DEVIATION_SUSTAIN_MS = 60_000;    // Must be off-route for 60s
const SPEED_THRESHOLD_KMH = 40;         // Vehicle speed threshold
const SPEED_SUSTAIN_MS = 30_000;        // Must maintain vehicle speed for 30s
const COUNTDOWN_DURATION_MS = 45_000;   // 45-second countdown before auto-SOS
const ARRIVAL_THRESHOLD_M = 200;        // 200m from destination = arrived
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 };

/**
 * Route Guard — Passive Kidnapping Detection via Route Deviation & Speed
 *
 * User sets a destination before walking. The app monitors GPS and detects:
 * 1. Route Deviation: if position drifts >500m from the straight-line
 *    corridor between origin and destination for >60 seconds
 * 2. Vehicle Speed: if GPS speed exceeds 40 km/h for >30 seconds
 *    (indicating forced entry into a vehicle)
 *
 * Either condition starts a 45-second countdown. If user doesn't dismiss,
 * SOS fires automatically.
 */

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Perpendicular distance from point P to line segment AB, in meters.
 * Uses cross-product approximation on flat-Earth projected coordinates
 * (accurate enough for distances < 50 km).
 */
function pointToSegmentDistanceM(p, a, b) {
  const ref = a.lat;
  const ax = 0, ay = 0;
  const bx = (b.lng - a.lng) * 111320 * Math.cos((ref * Math.PI) / 180);
  const by = (b.lat - a.lat) * 111320;
  const px = (p.lng - a.lng) * 111320 * Math.cos((ref * Math.PI) / 180);
  const py = (p.lat - a.lat) * 111320;

  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) return Math.sqrt(apx * apx + apy * apy);

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * abx;
  const closestY = ay + t * aby;
  const dx = px - closestX;
  const dy = py - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

export function useRouteGuard({ enabled, onDeviation, onSpeed }) {
  const [isActive, setIsActive] = useState(false);
  const [origin, setOrigin] = useState(null);         // { lat, lng }
  const [destination, setDestination] = useState(null); // { lat, lng, name }
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [distanceToDestM, setDistanceToDestM] = useState(null);
  const [deviationM, setDeviationM] = useState(0);
  const [alertType, setAlertType] = useState(null);     // null | "deviation" | "speed"
  const [countdown, setCountdown] = useState(null);      // ms remaining
  const [arrived, setArrived] = useState(false);

  const watchIdRef = useRef(null);
  const deviationStartRef = useRef(null);
  const speedStartRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const countdownStartRef = useRef(null);
  const firedRef = useRef(false);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownStartRef.current = null;
    setCountdown(null);
    setAlertType(null);
  }, []);

  const startRoute = useCallback((destLat, destLng, destName) => {
    if (!navigator.geolocation) return;

    // Get current position as origin
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const orig = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(orig);
        setDestination({ lat: destLat, lng: destLng, name: destName || "Destination" });
        setIsActive(true);
        setArrived(false);
        firedRef.current = false;
        deviationStartRef.current = null;
        speedStartRef.current = null;
        setDistanceToDestM(haversineMeters(orig, { lat: destLat, lng: destLng }));
      },
      (err) => console.warn("Route Guard: couldn't get origin:", err),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const endRoute = useCallback(() => {
    setIsActive(false);
    setOrigin(null);
    setDestination(null);
    setCurrentPosition(null);
    setDeviationM(0);
    setCurrentSpeedKmh(0);
    setDistanceToDestM(null);
    setArrived(false);
    firedRef.current = false;
    deviationStartRef.current = null;
    speedStartRef.current = null;
    clearCountdown();
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, [clearCountdown]);

  const dismiss = useCallback(() => {
    clearCountdown();
    deviationStartRef.current = null;
    speedStartRef.current = null;
  }, [clearCountdown]);

  function startCountdownFor(type, onFire) {
    if (countdownStartRef.current || firedRef.current) return;
    setAlertType(type);
    countdownStartRef.current = Date.now();

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - countdownStartRef.current;
      const remaining = COUNTDOWN_DURATION_MS - elapsed;

      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdown(0);
        firedRef.current = true;
        onFire?.();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  // GPS monitoring
  useEffect(() => {
    if (!enabled || !isActive || !origin || !destination) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed } = pos.coords;
        const now = Date.now();
        setCurrentPosition({ lat, lng });

        // Speed in km/h (GPS speed is in m/s, can be null)
        const speedKmh = speed != null && speed >= 0 ? speed * 3.6 : 0;
        setCurrentSpeedKmh(Math.round(speedKmh));

        // Distance to destination
        const distToDest = haversineMeters({ lat, lng }, destination);
        setDistanceToDestM(Math.round(distToDest));

        // Check arrival
        if (distToDest <= ARRIVAL_THRESHOLD_M) {
          setArrived(true);
          endRoute();
          return;
        }

        // Perpendicular distance from route corridor
        const devM = pointToSegmentDistanceM({ lat, lng }, origin, destination);
        setDeviationM(Math.round(devM));

        // === DEVIATION CHECK ===
        if (devM > DEVIATION_THRESHOLD_M && !firedRef.current) {
          if (!deviationStartRef.current) {
            deviationStartRef.current = now;
          }
          const sustained = now - deviationStartRef.current;
          if (sustained >= DEVIATION_SUSTAIN_MS && !countdownStartRef.current) {
            startCountdownFor("deviation", () => onDeviation?.());
          }
        } else {
          deviationStartRef.current = null;
        }

        // === SPEED CHECK ===
        if (speedKmh > SPEED_THRESHOLD_KMH && !firedRef.current) {
          if (!speedStartRef.current) {
            speedStartRef.current = now;
          }
          const sustained = now - speedStartRef.current;
          if (sustained >= SPEED_SUSTAIN_MS && !countdownStartRef.current) {
            startCountdownFor("speed", () => onSpeed?.());
          }
        } else {
          speedStartRef.current = null;
        }
      },
      (err) => console.warn("Route Guard GPS error:", err),
      GPS_OPTIONS
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [enabled, isActive, origin, destination, endRoute, onDeviation, onSpeed]);

  return {
    isActive,
    origin,
    destination,
    currentPosition,
    currentSpeedKmh,
    distanceToDestM,
    deviationM,
    alertType,
    countdown,
    arrived,
    startRoute,
    endRoute,
    dismiss,
  };
}

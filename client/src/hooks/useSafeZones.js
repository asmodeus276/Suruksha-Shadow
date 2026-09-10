import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "suraksha_safe_zones";
const DEFAULT_RADIUS_M = 200; // 200 meters default zone radius
const COUNTDOWN_DURATION_MS = 60_000; // 60-second countdown before auto-SOS
const RISKY_HOUR_START = 22; // 10 PM
const RISKY_HOUR_END = 6;   // 6 AM
const GPS_WATCH_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 };

/**
 * Safe Zone Departure Alert — Passive Kidnapping Protection
 *
 * User defines "safe zones" (Home, Office, etc.). While Shield is armed,
 * the app monitors GPS. If the user moves outside ALL safe zones during
 * risky hours (10 PM–6 AM), a 60-second countdown starts. If they don't
 * dismiss it, SOS fires automatically.
 *
 * This catches:
 *  - Being dragged out of home at night
 *  - Being taken from a safe location by force
 *  - Sleepwalking / disoriented movement (bonus safety)
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

function isRiskyHour() {
  const hour = new Date().getHours();
  return hour >= RISKY_HOUR_START || hour < RISKY_HOUR_END;
}

function loadZones() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveZones(zones) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  } catch { /* localStorage unavailable */ }
}

export function useSafeZones({ enabled, onExpire }) {
  const [zones, setZones] = useState(loadZones);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isInsideSafeZone, setIsInsideSafeZone] = useState(true);
  const [currentZoneName, setCurrentZoneName] = useState(null);
  const [departureCountdown, setDepartureCountdown] = useState(null); // ms remaining
  const [departureTriggered, setDepartureTriggered] = useState(false);

  const watchIdRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const countdownStartRef = useRef(null);
  const expiredRef = useRef(false);

  // Persist zone changes
  useEffect(() => {
    saveZones(zones);
  }, [zones]);

  const addZone = useCallback((name, lat, lng, radiusM = DEFAULT_RADIUS_M) => {
    const newZone = {
      id: "zone-" + Date.now(),
      name: name || "Safe Zone",
      lat,
      lng,
      radiusM,
      createdAt: new Date().toISOString(),
    };
    setZones((prev) => [...prev, newZone]);
    return newZone;
  }, []);

  const addCurrentLocationAsZone = useCallback((name) => {
    if (currentPosition) {
      return addZone(name, currentPosition.lat, currentPosition.lng);
    }
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          addZone(name, pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn("Could not get current GPS for safe zone:", err),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
    return null;
  }, [currentPosition, addZone]);

  const removeZone = useCallback((zoneId) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  const dismissDeparture = useCallback(() => {
    setDepartureCountdown(null);
    setDepartureTriggered(false);
    countdownStartRef.current = null;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // GPS watching while Shield is armed
  useEffect(() => {
    if (!enabled || zones.length === 0) {
      setIsInsideSafeZone(true);
      setCurrentZoneName(null);
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentPosition({ lat, lng });

        // Check if inside any safe zone
        let insideZone = null;
        for (const zone of zones) {
          const dist = haversineMeters({ lat, lng }, { lat: zone.lat, lng: zone.lng });
          if (dist <= zone.radiusM) {
            insideZone = zone;
            break;
          }
        }

        setIsInsideSafeZone(Boolean(insideZone));
        setCurrentZoneName(insideZone?.name || null);

        if (insideZone) {
          // Back inside a safe zone — cancel any countdown
          dismissDeparture();
        } else if (!insideZone && isRiskyHour() && !departureTriggered && !expiredRef.current) {
          // Outside ALL zones during risky hours — start countdown
          if (!countdownStartRef.current) {
            countdownStartRef.current = Date.now();
            setDepartureTriggered(true);

            countdownIntervalRef.current = setInterval(() => {
              const elapsed = Date.now() - countdownStartRef.current;
              const remaining = COUNTDOWN_DURATION_MS - elapsed;

              if (remaining <= 0) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
                setDepartureCountdown(0);
                expiredRef.current = true;
                onExpire?.();
              } else {
                setDepartureCountdown(remaining);
              }
            }, 1000);
          }
        }
      },
      (err) => {
        console.warn("Safe zone GPS error:", err);
      },
      GPS_WATCH_OPTIONS
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [enabled, zones, dismissDeparture, departureTriggered, onExpire]);

  const reset = useCallback(() => {
    expiredRef.current = false;
    dismissDeparture();
  }, [dismissDeparture]);

  return {
    zones,
    addZone,
    addCurrentLocationAsZone,
    removeZone,
    currentPosition,
    isInsideSafeZone,
    currentZoneName,
    departureCountdown,
    departureTriggered,
    dismissDeparture,
    reset,
  };
}

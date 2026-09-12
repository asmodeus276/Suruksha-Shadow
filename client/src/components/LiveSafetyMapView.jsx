import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseGeocode, formatCoords } from "../lib/geo";

export default function LiveSafetyMapView({ onBack }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const watchIdRef = useRef(null);
  const initialCenterSetRef = useRef(false);

  const [coords, setCoords] = useState(null); // { lat, lng, accuracy, timestamp }
  const [address, setAddress] = useState("");
  const [permissionStatus, setPermissionStatus] = useState("prompt"); // 'prompt' | 'granted' | 'denied' | 'unavailable'
  const [errorMessage, setErrorMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Update map marker and accuracy circle
  const updateMapPosition = useCallback((lat, lng, accuracy, recenter = false) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const latLng = [lat, lng];

    // Create or update marker
    if (!markerRef.current) {
      const pinIcon = L.divIcon({
        className: "live-map-custom-marker",
        html: `
          <div class="live-map-beacon">
            <div class="live-map-beacon-pulse"></div>
            <div class="live-map-beacon-pin">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#e02424" stroke="#ffffff" stroke-width="1.8">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker(latLng, {
        icon: pinIcon,
        title: "Your Current Live Location",
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.4; color: #111; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 16px;">📍</span>
            <strong style="color: #b91c1c; font-size: 13.5px;">Current Live Location</strong>
          </div>
          <div><strong>Latitude:</strong> ${lat.toFixed(6)}</div>
          <div><strong>Longitude:</strong> ${lng.toFixed(6)}</div>
          <div style="margin-top: 3px; font-size: 11.5px; color: #4b5563;">Accuracy: ±${Math.round(accuracy || 15)} meters</div>
        </div>
      `);

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latLng);
      markerRef.current.setPopupContent(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.4; color: #111; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 16px;">📍</span>
            <strong style="color: #b91c1c; font-size: 13.5px;">Current Live Location</strong>
          </div>
          <div><strong>Latitude:</strong> ${lat.toFixed(6)}</div>
          <div><strong>Longitude:</strong> ${lng.toFixed(6)}</div>
          <div style="margin-top: 3px; font-size: 11.5px; color: #4b5563;">Accuracy: ±${Math.round(accuracy || 15)} meters</div>
        </div>
      `);
    }

    // Create or update accuracy circle
    const safeRadius = Math.max(10, Math.min(accuracy || 25, 2000));
    if (!circleRef.current) {
      const circle = L.circle(latLng, {
        radius: safeRadius,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.16,
        weight: 1.5,
        dashArray: "4, 6",
      }).addTo(map);
      circleRef.current = circle;
    } else {
      circleRef.current.setLatLng(latLng);
      circleRef.current.setRadius(safeRadius);
    }

    // Center map if requested or initial fix
    if (recenter || !initialCenterSetRef.current) {
      initialCenterSetRef.current = true;
      map.setView(latLng, Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.6,
      });
    }
  }, []);

  // Recenter map on user's current location
  // Request location permission & continuous tracking via Geolocation API
  const requestLiveLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPermissionStatus("unavailable");
      setErrorMessage("Unable to access your location. Please enable location permission and try again.");
      return;
    }

    setIsLocating(true);
    setErrorMessage("");

    const onLocationSuccess = (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const point = {
        lat,
        lng,
        accuracy: Math.round(accuracy || 15),
        timestamp: pos.timestamp || Date.now(),
      };

      setCoords(point);
      setPermissionStatus("granted");
      setErrorMessage("");
      setIsLocating(false);
      setLastUpdated(new Date());

      // Update map marker, circle, and view
      updateMapPosition(lat, lng, point.accuracy, false);

      // Asynchronously resolve street address
      reverseGeocode(lat, lng)
        .then((addr) => {
          if (addr) setAddress(addr);
        })
        .catch(() => {});
    };

    const onLocationError = (err) => {
      console.warn("Live Safety Map Geolocation error:", err.code, err.message);
      setIsLocating(false);
      if (err.code === 1) {
        setPermissionStatus("denied");
      } else {
        setPermissionStatus("unavailable");
      }
      setErrorMessage("Unable to access your location. Please enable location permission and try again.");
    };

    // 1. Initial high-accuracy fix
    navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000,
    });

    // 2. Continuous real-time location watcher
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onLocationSuccess,
        onLocationError,
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 15000,
        }
      );
    } catch (e) {
      console.warn("Could not start watchPosition:", e);
    }
  }, [updateMapPosition]);

  // Recenter map on user's current location
  const handleRecenter = useCallback(() => {
    if (coords) {
      updateMapPosition(coords.lat, coords.lng, coords.accuracy, true);
      if (markerRef.current) {
        markerRef.current.openPopup();
      }
    } else {
      requestLiveLocation();
    }
  }, [coords, updateMapPosition, requestLiveLocation]);

  // Initialize Leaflet map
  useEffect(() => {
    initialCenterSetRef.current = false;

    if (containerHasStaleLeaflet(mapContainerRef.current)) {
      delete mapContainerRef.current._leaflet_id;
    }

    const initialPos = coords ? [coords.lat, coords.lng] : [28.6139, 77.2090];
    const initialZoom = coords ? 16 : 12;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(initialPos, initialZoom);

    // OpenStreetMap tile layer as explicitly requested
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    requestLiveLocation();

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="live-safety-map-view" className="live-safety-map-container-card rise-fade">
      {/* View Header */}
      <div className="live-safety-map-view-header">
        <div className="flex-center-gap">
          {onBack && (
            <button
              type="button"
              className="btn-quiet"
              onClick={onBack}
              style={{ padding: "6px 12px", fontSize: 12.5 }}
              title="Return to Shield"
            >
              ← Back
            </button>
          )}
          <div className="live-safety-map-badge">
            <span className="live-safety-map-badge-dot" />
            <h2 className="live-safety-map-title" style={{ fontSize: 18 }}>
              📍 Live Safety Map
            </h2>
          </div>
        </div>

        <div className="live-safety-map-header-status">
          <span className="live-safety-map-subtitle">
            {permissionStatus === "granted" && coords
              ? `Live GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (±${coords.accuracy}m)`
              : isLocating
              ? "Acquiring live GPS fix…"
              : "OpenStreetMap Real-Time Radar"}
          </span>
        </div>
      </div>

      {/* Permission Error Banner */}
      {errorMessage && (
        <div className="live-safety-map-error-banner" style={{ borderRadius: 8, margin: "8px 0" }}>
          <div className="live-safety-map-error-text">
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="live-safety-map-retry-btn"
            onClick={requestLiveLocation}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Interactive Map Viewport */}
      <div className="live-safety-map-view-viewport">
        <div
          ref={mapContainerRef}
          className="leaflet-safety-canvas"
          style={{ minHeight: 460, borderRadius: 12 }}
        />

        {/* 📍 My Location Button */}
        <button
          id="live-safety-map-my-location-btn"
          type="button"
          className="live-safety-map-my-location-btn"
          onClick={handleRecenter}
          title="Recenter map on your current live location"
        >
          <span style={{ fontSize: 15 }}>📍</span>
          <span>My Location</span>
        </button>

        {/* Floating status indicator */}
        <div className="live-safety-map-status-pill">
          <span
            className="status-indicator-dot"
            style={{
              background:
                permissionStatus === "granted"
                  ? "#10b981"
                  : isLocating
                  ? "#f59e0b"
                  : "#ef4444",
              boxShadow:
                permissionStatus === "granted"
                  ? "0 0 8px #10b981"
                  : "none",
            }}
          />
          <span>
            {permissionStatus === "granted" && coords
              ? `Tracking Live · ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
              : isLocating
              ? "Requesting GPS signal…"
              : permissionStatus === "denied"
              ? "Location Permission Denied"
              : "GPS Standby"}
          </span>
        </div>
      </div>

      {/* Telemetry & Address Footer */}
      <div className="live-safety-map-view-footer mt-3">
        <div className="stack-1">
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>
            {address ? (
              <span>📍 {address}</span>
            ) : coords ? (
              <span>📍 {formatCoords(coords.lat, coords.lng)}</span>
            ) : (
              <span>📍 High-Accuracy Geolocation Ready</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--mist-dim)", fontFamily: "var(--mono)" }}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · Continuous Watch Active` : "Awaiting browser location grant"}
          </div>
        </div>

        <div className="flex-center-gap">
          <button
            type="button"
            className="btn-quiet"
            onClick={handleRecenter}
            style={{ fontSize: 12, padding: "7px 14px" }}
            disabled={!coords}
          >
            📍 Recenter Pin
          </button>
        </div>
      </div>
    </div>
  );
}

function containerHasStaleLeaflet(el) {
  return el && Boolean(el._leaflet_id);
}

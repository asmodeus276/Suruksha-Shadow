import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseGeocode, formatCoords } from "../lib/geo";

export default function LiveSafetyMapModal({ isOpen, onClose }) {
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

  // Initialize or re-center map once location is available
  const updateMapPosition = useCallback((lat, lng, accuracy, recenter = false) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const latLng = [lat, lng];

    // Create or update marker
    if (!markerRef.current) {
      // High-visibility live safety marker
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
      // Update popup content with latest values
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

    // Center map if requested or on initial fix
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

      // Asynchronously resolve street address for display
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
      // Re-trigger location acquisition if coordinates aren't ready yet
      requestLiveLocation();
    }
  }, [coords, updateMapPosition, requestLiveLocation]);

  // Initialize Leaflet map instance once the modal is open
  useEffect(() => {
    if (!isOpen) return;

    // Reset initial centering flag
    initialCenterSetRef.current = false;

    // Clean up previous instance if container was reused
    if (containerHasStaleLeaflet(mapContainerRef.current)) {
      delete mapContainerRef.current._leaflet_id;
    }

    // Default initial center (India center if no coords yet)
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

    // Invalidate size once modal animation finishes to prevent gray tiles
    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    // Request location immediately upon opening
    requestLiveLocation();

    // Listen for Escape key
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener("keydown", handleKeyDown);

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
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <div
      id="live-safety-map-modal"
      className="live-safety-map-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Live Safety Map"
    >
      <div className="live-safety-map-dialog rise-fade">
        {/* Modal Header */}
        <header className="live-safety-map-header">
          <div className="live-safety-map-header-left">
            <div className="live-safety-map-badge">
              <span className="live-safety-map-badge-dot" />
              <span className="live-safety-map-title">📍 Live Safety Map</span>
            </div>
            <span className="live-safety-map-subtitle">
              {permissionStatus === "granted" && coords
                ? `Live Tracking · ±${coords.accuracy}m accuracy`
                : isLocating
                ? "Detecting live GPS coordinates…"
                : "Real-time OpenStreetMap Vigil"}
            </span>
          </div>

          <div className="live-safety-map-header-actions">
            <button
              id="live-safety-map-close-btn"
              className="live-safety-map-close-btn"
              onClick={onClose}
              aria-label="Close Live Safety Map"
              title="Close Map (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Location Permission Error Banner */}
        {errorMessage && (
          <div id="live-safety-map-error-banner" className="live-safety-map-error-banner">
            <div className="live-safety-map-error-text">
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              id="live-safety-map-retry-btn"
              type="button"
              className="live-safety-map-retry-btn"
              onClick={requestLiveLocation}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Main Interactive Map Container */}
        <div className="live-safety-map-viewport">
          <div
            id="leaflet-live-safety-map-container"
            ref={mapContainerRef}
            className="leaflet-safety-canvas"
          />

          {/* Floating Action Button: 📍 My Location */}
          <button
            id="live-safety-map-recenter-btn"
            type="button"
            className="live-safety-map-my-location-btn"
            onClick={handleRecenter}
            title="Recenter map on your current live location"
          >
            <span style={{ fontSize: 15 }}>📍</span>
            <span>My Location</span>
          </button>

          {/* Live GPS Status Chip */}
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
                ? `GPS Active: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                : isLocating
                ? "Connecting to satellites…"
                : permissionStatus === "denied"
                ? "Permission Denied"
                : "Awaiting GPS Fix"}
            </span>
          </div>
        </div>

        {/* Modal Footer / Telemetry Bar */}
        <footer className="live-safety-map-footer">
          <div className="live-safety-map-footer-left">
            <div className="live-safety-map-address">
              {address ? (
                <span>📍 {address}</span>
              ) : coords ? (
                <span>📍 {formatCoords(coords.lat, coords.lng)}</span>
              ) : (
                <span>📍 Browser Geolocation active</span>
              )}
            </div>
            {lastUpdated && (
              <div className="live-safety-map-timestamp">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="live-safety-map-footer-right">
            <button
              type="button"
              className="btn-quiet live-safety-map-action-btn"
              onClick={handleRecenter}
              disabled={!coords}
            >
              Recenter Pin
            </button>
            <button
              type="button"
              className="btn-primary live-safety-map-done-btn"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function containerHasStaleLeaflet(el) {
  return el && Boolean(el._leaflet_id);
}

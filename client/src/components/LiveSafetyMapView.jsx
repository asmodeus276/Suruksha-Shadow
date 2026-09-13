import { useEffect, useRef, useState, useCallback, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseGeocode, formatCoords } from "../lib/geo";
import {
  getNearbySanctuaries,
  EMERGENCY_HELPLINES,
} from "../lib/safeHavensData";

function LiveSafetyMapViewComponent({ onBack, defaultFilter = "all" }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const sanctuaryMarkersRef = useRef([]);
  const watchIdRef = useRef(null);
  const initialCenterSetRef = useRef(false);

  const [coords, setCoords] = useState(null); // { lat, lng, accuracy, timestamp }
  const [address, setAddress] = useState("");
  const [permissionStatus, setPermissionStatus] = useState("prompt"); // 'prompt' | 'granted' | 'denied' | 'unavailable'
  const [errorMessage, setErrorMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeCategory, setActiveCategory] = useState(defaultFilter); // 'all' | 'police' | 'hospital' | 'transit' | 'helpline'
  const [focusedSanctuaryId, setFocusedSanctuaryId] = useState(null);

  // Compute live sanctuaries based on coords or fallback
  const userLat = coords?.lat || 28.4744;
  const userLng = coords?.lng || 77.4916;
  const sanctuaries = getNearbySanctuaries(userLat, userLng);

  // Filtered sanctuaries
  const filteredSanctuaries =
    activeCategory === "all"
      ? sanctuaries
      : sanctuaries.filter((s) => s.category === activeCategory);

  // Helper to get category icon/color for map markers
  const getCategoryMarkerHtml = (category) => {
    if (category === "police") {
      return `
        <div class="sanctuary-map-pin police-pin" style="background: #1e3a8a; border: 2px solid #3b82f6; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(59, 130, 246, 0.6);">
          <span style="font-size: 16px;">🚓</span>
        </div>
      `;
    }
    if (category === "hospital") {
      return `
        <div class="sanctuary-map-pin hospital-pin" style="background: #064e3b; border: 2px solid #10b981; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(16, 185, 129, 0.6);">
          <span style="font-size: 16px;">🏥</span>
        </div>
      `;
    }
    return `
      <div class="sanctuary-map-pin transit-pin" style="background: #78350f; border: 2px solid #f59e0b; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(245, 158, 11, 0.6);">
        <span style="font-size: 16px;">⛽</span>
      </div>
    `;
  };

  // Render/Update Sanctuary Markers on Leaflet Map
  const renderSanctuaryMarkers = useCallback((map, sanctuaryList) => {
    // Clear old markers
    sanctuaryMarkersRef.current.forEach((m) => m.remove());
    sanctuaryMarkersRef.current = [];

    sanctuaryList.forEach((s) => {
      const pinIcon = L.divIcon({
        className: "sanctuary-leaflet-marker",
        html: getCategoryMarkerHtml(s.category),
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon,
        title: s.name,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12.5px; line-height: 1.4; color: #111; padding: 4px; min-width: 220px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: ${s.category === 'police' ? '#1e3a8a' : s.category === 'hospital' ? '#065f46' : '#92400e'}; font-size: 13px;">
              ${s.name}
            </strong>
          </div>
          <div style="font-size: 11px; color: #4b5563; margin-bottom: 6px;">${s.address}</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 11.5px;">
            <span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 600;">📍 ${s.distanceFormatted}</span>
            <span style="color: #6b7280;">🚶 ${s.transitTimes.walking}</span>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <a href="${s.navigationUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #2563eb; color: #fff; padding: 5px 8px; border-radius: 5px; font-size: 11px; text-decoration: none; font-weight: 600;">
              🧭 Directions
            </a>
            <a href="tel:${s.phone}" style="flex: 1; text-align: center; background: #059669; color: #fff; padding: 5px 8px; border-radius: 5px; font-size: 11px; text-decoration: none; font-weight: 600;">
              📞 Call
            </a>
          </div>
        </div>
      `);

      sanctuaryMarkersRef.current.push(marker);
    });
  }, []);

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
      map.setView(latLng, Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.6,
      });
    }
  }, []);

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

  // Focus and zoom to a specific sanctuary
  const handleFocusSanctuary = (sanctuary) => {
    setFocusedSanctuaryId(sanctuary.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([sanctuary.lat, sanctuary.lng], 16, {
        animate: true,
        duration: 0.5,
      });

      // Find marker and open popup
      const targetMarker = sanctuaryMarkersRef.current.find(
        (m) =>
          Math.abs(m.getLatLng().lat - sanctuary.lat) < 0.0001 &&
          Math.abs(m.getLatLng().lng - sanctuary.lng) < 0.0001
      );
      if (targetMarker) {
        targetMarker.openPopup();
      }
    }
  };

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

    const initialPos = coords ? [coords.lat, coords.lng] : [28.4744, 77.4916];
    const initialZoom = coords ? 15 : 14;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(initialPos, initialZoom);

    // OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Render sanctuary markers
    renderSanctuaryMarkers(map, sanctuaries);

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
      sanctuaryMarkersRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render markers when filtered sanctuaries change
  useEffect(() => {
    if (mapInstanceRef.current) {
      renderSanctuaryMarkers(mapInstanceRef.current, filteredSanctuaries);
    }
  }, [filteredSanctuaries, renderSanctuaryMarkers]);

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
              🛡️ Safe Havens Radar &amp; Live Map
            </h2>
          </div>
        </div>

        <div className="live-safety-map-header-status">
          <span className="live-safety-map-subtitle">
            {permissionStatus === "granted" && coords
              ? `Live GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (±${coords.accuracy}m)`
              : isLocating
              ? "Acquiring live GPS fix…"
              : "24/7 Sanctuaries & Helplines Active"}
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
      <div className="live-safety-map-view-viewport" style={{ position: "relative" }}>
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
              ? `Radar Tracking · ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
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
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · Safe Havens Radar Active` : "Awaiting browser location grant"}
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

      {/* ============================================================
          SECTION 2: SAFE HAVENS RADAR DIRECTORY & HELPLINES
          ============================================================ */}
      <div className="safe-havens-radar-section mt-4">
        {/* Radar Header & Filter Chips */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--paper)" }}>
              🏥 Safe Havens Radar Directory
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: "var(--mist-dim)" }}>
              Verified 24/7 Sanctuaries &amp; Immediate Emergency Help within 1–3 km
            </p>
          </div>

          {/* Filter Chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              className={`demo-chip-btn ${activeCategory === "all" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("all")}
              style={{ fontSize: 11.5, padding: "5px 10px", minHeight: 28 }}
            >
              All ({sanctuaries.length})
            </button>
            <button
              className={`demo-chip-btn ${activeCategory === "police" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("police")}
              style={{ fontSize: 11.5, padding: "5px 10px", minHeight: 28 }}
            >
              🚓 Police
            </button>
            <button
              className={`demo-chip-btn ${activeCategory === "hospital" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("hospital")}
              style={{ fontSize: 11.5, padding: "5px 10px", minHeight: 28 }}
            >
              🏥 24/7 Medical
            </button>
            <button
              className={`demo-chip-btn ${activeCategory === "transit" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("transit")}
              style={{ fontSize: 11.5, padding: "5px 10px", minHeight: 28 }}
            >
              ⛽ Lit Hubs
            </button>
            <button
              className={`demo-chip-btn ${activeCategory === "helpline" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("helpline")}
              style={{ fontSize: 11.5, padding: "5px 10px", minHeight: 28 }}
            >
              📞 1-Tap Helplines
            </button>
          </div>
        </div>

        {/* Category: 1-Tap Helplines */}
        {activeCategory === "helpline" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {EMERGENCY_HELPLINES.map((hl) => (
              <div
                key={hl.number}
                className="card"
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${hl.color}40`,
                  padding: 16,
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${hl.color}20`, color: hl.color }}>
                      {hl.tag}
                    </span>
                    <strong style={{ fontSize: 18, color: hl.color, fontFamily: "var(--mono)" }}>{hl.number}</strong>
                  </div>
                  <h4 style={{ margin: "4px 0 6px 0", fontSize: 14, color: "var(--paper)" }}>{hl.name}</h4>
                  <p style={{ margin: 0, fontSize: 11.5, color: "var(--mist)", lineHeight: 1.4 }}>{hl.description}</p>
                </div>

                <a
                  href={`tel:${hl.number}`}
                  className="btn btn-primary mt-3"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    textDecoration: "none",
                    background: hl.color,
                    color: "#fff",
                    fontSize: 12,
                    padding: "8px",
                  }}
                >
                  📞 Direct Call {hl.number}
                </a>
              </div>
            ))}
          </div>
        ) : (
          /* Sanctuary Grid */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {filteredSanctuaries.map((sanctuary) => {
              const isFocused = focusedSanctuaryId === sanctuary.id;
              const isPolice = sanctuary.category === "police";
              const isHospital = sanctuary.category === "hospital";
              const badgeColor = isPolice ? "#3b82f6" : isHospital ? "#10b981" : "#f59e0b";

              return (
                <div
                  key={sanctuary.id}
                  className="card sanctuary-card rise-fade"
                  style={{
                    background: isFocused ? "var(--surface-high)" : "var(--surface)",
                    border: isFocused ? `1.5px solid ${badgeColor}` : "1px solid var(--line)",
                    padding: 16,
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.2s ease",
                    boxShadow: isFocused ? `0 0 16px ${badgeColor}30` : "none",
                  }}
                >
                  <div>
                    {/* Header Pill */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: `${badgeColor}20`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}40`,
                        }}
                      >
                        {sanctuary.categoryLabel}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ember)", fontFamily: "var(--mono)" }}>
                        📍 {sanctuary.distanceFormatted}
                      </span>
                    </div>

                    {/* Sanctuary Name & Address */}
                    <h4 style={{ margin: "0 0 4px 0", fontSize: 14, color: "var(--paper)", lineHeight: 1.3 }}>
                      {sanctuary.name}
                    </h4>
                    <p style={{ margin: "0 0 8px 0", fontSize: 11.5, color: "var(--mist)", lineHeight: 1.35 }}>
                      {sanctuary.address}
                    </p>

                    {/* Transit ETA Pill */}
                    <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--mist-dim)", marginBottom: 12 }}>
                      <span>🚶 {sanctuary.transitTimes.walking}</span>
                      <span>•</span>
                      <span>🚗 {sanctuary.transitTimes.driving}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <a
                      href={sanctuary.navigationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="demo-chip-btn"
                      style={{
                        flex: 1,
                        textAlign: "center",
                        borderColor: "var(--line-gold)",
                        color: "var(--ember)",
                        fontWeight: 600,
                        fontSize: 11.5,
                        textDecoration: "none",
                      }}
                      title="Open Google Maps Turn-by-Turn GPS Navigation"
                    >
                      🧭 Navigate ↗
                    </a>

                    <a
                      href={`tel:${sanctuary.phone}`}
                      className="demo-chip-btn"
                      style={{
                        padding: "6px 10px",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        color: "#10b981",
                        fontWeight: 600,
                        fontSize: 11.5,
                        textDecoration: "none",
                      }}
                      title={`Call ${sanctuary.phone}`}
                    >
                      📞 Call
                    </a>

                    <button
                      type="button"
                      className="demo-chip-btn"
                      onClick={() => handleFocusSanctuary(sanctuary)}
                      style={{
                        padding: "6px 10px",
                        fontSize: 11.5,
                      }}
                      title="Center map on this sanctuary"
                    >
                      📍 Pin
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(LiveSafetyMapViewComponent);

function containerHasStaleLeaflet(el) {
  return el && Boolean(el._leaflet_id);
}

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Maximize2, Minimize2, Crosshair } from "lucide-react";

/**
 * Real Google Maps tile layers:
 * 1. Streets (lyrs=m): Standard authentic Google Maps
 * 2. Satellite (lyrs=y): Google Hybrid (real satellite photography + roads)
 * 3. Terrain (lyrs=p): Google Terrain topography
 */
const TILE_LAYERS = {
  streets: {
    name: "Map",
    icon: "🗺️",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    options: {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "&copy; Google Maps",
    },
  },
  satellite: {
    name: "Satellite",
    icon: "🛰️",
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    options: {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "&copy; Google Maps",
    },
  },
  terrain: {
    name: "Terrain",
    icon: "⛰️",
    url: "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    options: {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "&copy; Google Maps",
    },
  },
};

/**
 * LiveMap — Production-grade interactive map component.
 * Features:
 * - Carto Voyager (Streets), Carto Dark Matter (Tactical), Esri (Satellite) tile layers
 * - Real-time animated radar beacon marker with dynamic pulse ripples
 * - Dual-layer glowing GPS trail polyline with start-point indicator
 * - Floating glassmorphism HUD with accuracy and live coordinate readout
 * - Sleek floating controls: Recenter (Locate Me), Zoom (+/-), Layer Switcher, Fullscreen
 * - Smooth auto-follow mode that pauses on user drag and resumes on Recenter
 * - Fallback to browser GPS when no remote locations are provided
 */
export default function LiveMap({
  locations = [],
  isActive = true,
  height = 280,
  defaultLayer = "streets",
  showControls = true,
  showHud = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const currentTileLayerRef = useRef(null);
  const glowPolylineRef = useRef(null);
  const polylineRef = useRef(null);
  const markerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const watchIdRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState(defaultLayer);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [currentPos, setCurrentPos] = useState(null); // [lat, lng]
  const [accuracy, setAccuracy] = useState(null);

  // Helper to create the modern beacon icon
  const createBeaconIcon = useCallback((isEmergency) => {
    return L.divIcon({
      className: "app-beacon-marker-wrap",
      html: `
        <div class="app-beacon-marker ${isEmergency ? "is-emergency" : ""}">
          <div class="app-beacon-radar-1"></div>
          <div class="app-beacon-radar-2"></div>
          <div class="app-beacon-core"></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -18],
    });
  }, []);

  // Helper to build the popup HTML
  const createPopupContent = useCallback((lat, lng, acc, isEmergency) => {
    const latStr = lat.toFixed(5);
    const lngStr = lng.toFixed(5);
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12.5px; line-height: 1.45; color: #e1e1ed; padding: 4px; min-width: 190px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="font-size: 15px;">${isEmergency ? "🚨" : "📍"}</span>
          <strong style="color: ${isEmergency ? "#ffb4ab" : "#60a5fa"}; font-size: 13px;">
            ${isEmergency ? "Active SOS Beacon" : "Live Device Position"}
          </strong>
        </div>
        <div style="font-family: monospace; font-size: 11.5px; color: #d0c5b2; margin-bottom: 3px;">
          ${latStr}° N, ${lngStr}° E
        </div>
        <div style="font-size: 11px; color: #99907e; margin-bottom: 8px;">
          Accuracy: ±${Math.round(acc || 15)}m
        </div>
        <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: #2563eb; color: #ffffff; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; text-decoration: none;">
          Open in Google Maps ↗
        </a>
      </div>
    `;
  }, []);

  // Switch tile layer
  const switchLayer = useCallback((layerKey) => {
    if (!mapRef.current || !TILE_LAYERS[layerKey]) return;
    const map = mapRef.current;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const { url, options } = TILE_LAYERS[layerKey];
    const newLayer = L.tileLayer(url, options).addTo(map);
    currentTileLayerRef.current = newLayer;
    setActiveLayer(layerKey);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    if (containerRef.current._leaflet_id) {
      delete containerRef.current._leaflet_id;
    }

    const defaultCenter = [28.6139, 77.209]; // New Delhi default
    const initialCenter =
      locations.length > 0
        ? [locations[locations.length - 1].lat, locations[locations.length - 1].lng]
        : defaultCenter;
    const initialZoom = locations.length > 0 ? 16 : 14;

    const map = L.map(containerRef.current, {
      zoomControl: false, // We use custom sleek floating zoom controls
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
    }).setView(initialCenter, initialZoom);

    // Initial tile layer
    const initialConfig = TILE_LAYERS[defaultLayer] || TILE_LAYERS.streets;
    const tileLayer = L.tileLayer(initialConfig.url, initialConfig.options).addTo(map);
    currentTileLayerRef.current = tileLayer;

    // Glowing base trail (outer halo)
    const glowPolyline = L.polyline([], {
      color: isActive ? "#ef4444" : "#3b82f6",
      weight: 7,
      opacity: 0.35,
      smoothFactor: 1,
    }).addTo(map);

    // Core vector trail
    const polyline = L.polyline([], {
      color: isActive ? "#f59e0b" : "#60a5fa",
      weight: 3.5,
      opacity: 0.95,
      smoothFactor: 1,
    }).addTo(map);

    // Pulsing beacon marker
    const beaconIcon = createBeaconIcon(isActive);
    const marker = L.marker(initialCenter, { icon: beaconIcon }).addTo(map);

    // GPS accuracy circle
    const initialAccuracy = locations[0]?.accuracy || 20;
    const circle = L.circle(initialCenter, {
      radius: initialAccuracy,
      color: isActive ? "#ef4444" : "#3b82f6",
      fillColor: isActive ? "#ef4444" : "#3b82f6",
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: "4, 6",
    }).addTo(map);

    marker.bindPopup(
      createPopupContent(initialCenter[0], initialCenter[1], initialAccuracy, isActive)
    );

    mapRef.current = map;
    glowPolylineRef.current = glowPolyline;
    polylineRef.current = polyline;
    markerRef.current = marker;
    circleRef.current = circle;

    // Detect user pan/drag to temporarily pause auto-follow
    map.on("dragstart", () => {
      setIsFollowing(false);
    });

    // Invalidate size once rendered
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // If no locations provided initially, query browser GPS and watch in real-time
    if (locations.length === 0 && "geolocation" in navigator) {
      const handlePos = (pos) => {
        if (!mapRef.current) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 15);
        const userPos = [lat, lng];

        setCurrentPos(userPos);
        setAccuracy(acc);

        if (markerRef.current) {
          markerRef.current.setLatLng(userPos);
          markerRef.current.setPopupContent(createPopupContent(lat, lng, acc, isActive));
        }
        if (circleRef.current) {
          circleRef.current.setLatLng(userPos);
          circleRef.current.setRadius(Math.max(10, Math.min(acc, 500)));
        }

        mapRef.current.setView(userPos, 16, { animate: true });
      };

      navigator.geolocation.getCurrentPosition(handlePos, () => {}, {
        enableHighAccuracy: true,
        timeout: 6000,
      });

      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!mapRef.current) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const acc = Math.round(pos.coords.accuracy || 15);
            const userPos = [lat, lng];

            setCurrentPos(userPos);
            setAccuracy(acc);

            if (markerRef.current) {
              markerRef.current.setLatLng(userPos);
              markerRef.current.setPopupContent(createPopupContent(lat, lng, acc, isActive));
            }
            if (circleRef.current) {
              circleRef.current.setLatLng(userPos);
              circleRef.current.setRadius(Math.max(10, Math.min(acc, 500)));
            }

            // Only auto-pan if following mode is enabled
            if (isFollowing) {
              mapRef.current.panTo(userPos, { animate: true, duration: 0.5 });
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
        );
      } catch {
        // Ignore watch error
      }
    }

    return () => {
      clearTimeout(resizeTimer);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      glowPolylineRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
      startMarkerRef.current = null;
      circleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update trail and marker when `locations` or `isActive` changes
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current || locations.length === 0) return;

    const latlngs = locations.map((l) => [l.lat, l.lng]);
    const latestLocation = locations[locations.length - 1];
    const latest = [latestLocation.lat, latestLocation.lng];
    const acc = Math.round(latestLocation.accuracy || 15);

    setCurrentPos(latest);
    setAccuracy(acc);

    // Update trails
    if (glowPolylineRef.current) {
      glowPolylineRef.current.setLatLngs(latlngs);
      glowPolylineRef.current.setStyle({ color: isActive ? "#ef4444" : "#3b82f6" });
    }
    polylineRef.current.setLatLngs(latlngs);
    polylineRef.current.setStyle({ color: isActive ? "#f59e0b" : "#60a5fa" });

    // Update start / origin marker if multiple points exist
    if (locations.length > 1 && !startMarkerRef.current && mapRef.current) {
      const originIcon = L.divIcon({
        className: "app-origin-pin-wrap",
        html: `<div class="app-origin-pin" title="Trip Origin">🏁</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      startMarkerRef.current = L.marker([locations[0].lat, locations[0].lng], {
        icon: originIcon,
      }).addTo(mapRef.current);
    }

    // Update latest position beacon
    if (markerRef.current) {
      markerRef.current.setLatLng(latest);
      markerRef.current.setIcon(createBeaconIcon(isActive));
      markerRef.current.setPopupContent(createPopupContent(latest[0], latest[1], acc, isActive));
    }

    // Update accuracy halo
    if (circleRef.current) {
      circleRef.current.setLatLng(latest);
      circleRef.current.setRadius(Math.max(10, Math.min(acc, 500)));
      circleRef.current.setStyle({
        color: isActive ? "#ef4444" : "#3b82f6",
        fillColor: isActive ? "#ef4444" : "#3b82f6",
      });
    }

    // Smooth pan to latest location if auto-follow is active
    if (isFollowing) {
      mapRef.current.panTo(latest, { animate: true, duration: 0.5 });
    }

    mapRef.current.invalidateSize();
  }, [locations, isActive, isFollowing, createBeaconIcon, createPopupContent]);

  // Recenter on user position
  const handleRecenter = useCallback(() => {
    if (!mapRef.current || !currentPos) return;
    setIsFollowing(true);
    mapRef.current.flyTo(currentPos, Math.max(mapRef.current.getZoom(), 16), {
      animate: true,
      duration: 0.8,
    });
    if (markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [currentPos]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomOut();
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 250);
      return next;
    });
  }, []);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 200);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  return (
    <div
      className={`app-map-wrapper ${isFullscreen ? "is-fullscreen" : ""}`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* Map DOM Canvas */}
      <div ref={containerRef} className="app-map-canvas" />

      {/* Floating Top-Left Status HUD */}
      {showHud && (
        <div className="app-map-hud">
          <div className={`app-map-live-dot ${isActive ? "is-emergency" : ""}`} />
          <span className="app-map-hud-title">
            {isActive ? "Live SOS Feed" : "GPS Active"}
          </span>
          {accuracy != null && (
            <span className="app-map-hud-meta">±{accuracy}m</span>
          )}
          {currentPos && (
            <span className="app-map-hud-meta" style={{ display: "none" }}>
              {currentPos[0].toFixed(4)}, {currentPos[1].toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* Floating Top-Right Layer Switcher */}
      {showControls && (
        <div className="app-map-layer-switch">
          {Object.entries(TILE_LAYERS).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className={`app-map-layer-btn ${activeLayer === key ? "is-active" : ""}`}
              onClick={() => switchLayer(key)}
              title={`Switch to ${config.name} Map`}
            >
              <span>{config.icon}</span>
              <span>{config.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Floating Bottom-Right Action Controls */}
      {showControls && (
        <div className="app-map-controls-group">
          {/* Recenter / Follow Me Button */}
          <button
            type="button"
            className={`app-map-control-btn ${isFollowing ? "is-active" : ""}`}
            onClick={handleRecenter}
            title={isFollowing ? "Following your location" : "Re-center to your location"}
          >
            {isFollowing ? <Navigation size={17} /> : <Crosshair size={17} />}
          </button>

          {/* Sleek Zoom In / Zoom Out Pill */}
          <div className="app-map-zoom-group">
            <button
              type="button"
              className="app-map-zoom-btn"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              className="app-map-zoom-btn"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              −
            </button>
          </div>

          {/* Fullscreen Expand / Restore Button */}
          <button
            type="button"
            className="app-map-control-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand Map Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

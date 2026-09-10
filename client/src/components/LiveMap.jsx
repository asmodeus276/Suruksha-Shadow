import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * LiveMap — embedded, real-time-updating Leaflet map.
 * Shows the user's location trail as an illuminated polyline with a pulsing
 * current-position beacon. Includes automatic resize invalidation,
 * fallback tile layers, and auto-centering on device GPS.
 */
export default function LiveMap({ locations = [], isActive = true, height = 280 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any stale leaflet container instance ID
    if (containerRef.current._leaflet_id) {
      delete containerRef.current._leaflet_id;
    }

    const defaultCenter = [28.6139, 77.2090]; // Center on Delhi / India
    const initialZoom = locations.length > 0 ? 15 : 12;
    const initialCenter =
      locations.length > 0 ? [locations[locations.length - 1].lat, locations[locations.length - 1].lng] : defaultCenter;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(initialCenter, initialZoom);

    // Dark-themed tiles via CartoDB with standard subdomains
    const darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
    });

    darkTiles.addTo(map);

    // Polyline for the movement trail
    const polyline = L.polyline([], {
      color: "#f2a65a",
      weight: 3.5,
      opacity: 0.85,
      smoothFactor: 1,
    }).addTo(map);

    // Pulsing beacon marker for current position
    const pulseIcon = L.divIcon({
      className: "map-pulse-marker-wrap",
      html: `<div class="map-pulse-marker ${isActive ? "is-active" : "is-resolved"}"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker(initialCenter, { icon: pulseIcon }).addTo(map);

    // Subtle GPS accuracy circle
    const accuracyRadius = locations[0]?.accuracy || 25;
    const circle = L.circle(initialCenter, {
      radius: accuracyRadius,
      color: "#f2a65a",
      fillColor: "#f2a65a",
      fillOpacity: 0.1,
      weight: 1,
      dashArray: "4, 6",
    }).addTo(map);

    mapRef.current = map;
    polylineRef.current = polyline;
    markerRef.current = marker;
    circleRef.current = circle;

    // Invalidate size after rendering to prevent grey unloaded tiles
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    // If no locations provided initially, query current browser position for realistic center
    if (locations.length === 0 && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapRef.current) return;
          const userPos = [pos.coords.latitude, pos.coords.longitude];
          mapRef.current.setView(userPos, 14);
          if (markerRef.current) {
            markerRef.current.setLatLng(userPos);
          }
          if (circleRef.current) {
            circleRef.current.setLatLng(userPos);
            circleRef.current.setRadius(Math.max(15, pos.coords.accuracy || 25));
          }
        },
        () => {},
        { timeout: 4000 }
      );
    }

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update trail, marker, and accuracy circle when locations change
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current) return;

    if (locations.length > 0) {
      const latlngs = locations.map((l) => [l.lat, l.lng]);
      polylineRef.current.setLatLngs(latlngs);

      const latestLocation = locations[locations.length - 1];
      const latest = [latestLocation.lat, latestLocation.lng];

      if (markerRef.current) {
        markerRef.current.setLatLng(latest);
        if (!mapRef.current.hasLayer(markerRef.current)) {
          markerRef.current.addTo(mapRef.current);
        }

        const icon = L.divIcon({
          className: "map-pulse-marker-wrap",
          html: `<div class="map-pulse-marker ${isActive ? "is-active" : "is-resolved"}"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        markerRef.current.setIcon(icon);
      }

      if (circleRef.current) {
        circleRef.current.setLatLng(latest);
        const acc = Math.max(15, Math.min(500, latestLocation.accuracy || 25));
        circleRef.current.setRadius(acc);
        if (!mapRef.current.hasLayer(circleRef.current)) {
          circleRef.current.addTo(mapRef.current);
        }
      }

      mapRef.current.setView(latest, Math.max(mapRef.current.getZoom(), 15), {
        animate: true,
        duration: 0.5,
      });
    }

    // Always ensure map container is properly sized
    mapRef.current.invalidateSize();
  }, [locations, isActive]);

  return (
    <div
      ref={containerRef}
      className="live-map-container"
      style={{ height, width: "100%", position: "relative" }}
    />
  );
}

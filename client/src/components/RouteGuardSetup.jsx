import { useState } from "react";
import { NavigationIcon, MapPinIcon } from "./icons";

/**
 * RouteGuardSetup — UI for starting a guarded walk and showing
 * deviation/speed alerts with countdown.
 */
export default function RouteGuardSetup({
  isActive,
  origin,
  destination,
  currentSpeedKmh,
  distanceToDestM,
  deviationM,
  alertType,
  countdown,
  arrived,
  startRoute,
  endRoute,
  dismiss,
}) {
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [destName, setDestName] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Preset common destinations
  const presets = [
    { name: "Home", lat: null, lng: null },
    { name: "Office", lat: null, lng: null },
  ];

  const handleStartWithCoords = () => {
    const lat = parseFloat(destLat);
    const lng = parseFloat(destLng);
    if (isNaN(lat) || isNaN(lng)) return;
    startRoute(lat, lng, destName || "Custom Destination");
    setDestLat("");
    setDestLng("");
    setDestName("");
    setShowManualInput(false);
  };

  const handleStartWithOffset = (name, offsetLat, offsetLng) => {
    // Use a simulated destination ~1-2 km away in a direction
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          startRoute(
            pos.coords.latitude + offsetLat,
            pos.coords.longitude + offsetLng,
            name
          );
        },
        () => {
          // Fallback with Delhi coords
          startRoute(28.6328 + offsetLat, 77.2197 + offsetLng, name);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const formatDistance = (m) => {
    if (m == null) return "—";
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  };

  // === ACTIVE ROUTE VIEW ===
  if (isActive) {
    return (
      <div>
        <div className="flex-center-gap mb-2">
          <NavigationIcon size={15} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Route Guard Active</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 10,
              background:
                alertType
                  ? "rgba(224, 90, 71, 0.2)"
                  : deviationM > 200
                  ? "rgba(243, 156, 18, 0.2)"
                  : "rgba(46, 204, 113, 0.18)",
              color: alertType ? "var(--alarm)" : deviationM > 200 ? "#f39c12" : "#2ecc71",
              fontWeight: 600,
            }}
          >
            {alertType
              ? alertType === "speed"
                ? "⚠️ Vehicle Detected"
                : "⚠️ Off Route"
              : deviationM > 200
              ? "Drifting"
              : "On Track"}
          </span>
        </div>

        {/* Telemetry Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: "6px 4px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--dim)" }}>To Destination</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--paper)" }}>
              {formatDistance(distanceToDestM)}
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "6px 4px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--dim)" }}>Deviation</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: deviationM > 500 ? "var(--alarm)" : deviationM > 200 ? "#f39c12" : "#2ecc71",
              }}
            >
              {formatDistance(deviationM)}
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "6px 4px",
              borderRadius: 8,
              background:
                currentSpeedKmh > 40
                  ? "rgba(224, 90, 71, 0.15)"
                  : "rgba(255,255,255,0.04)",
              border: `1px solid ${currentSpeedKmh > 40 ? "var(--alarm)" : "var(--line)"}`,
            }}
          >
            <div style={{ fontSize: 10, color: "var(--dim)" }}>Speed</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: currentSpeedKmh > 40 ? "var(--alarm)" : "var(--paper)",
              }}
            >
              {currentSpeedKmh} km/h
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "var(--dim)", marginBottom: 8 }}>
          🎯 Heading to: <strong style={{ color: "var(--paper)" }}>{destination?.name}</strong>
        </div>

        {/* ALERT COUNTDOWN */}
        {alertType && countdown != null && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background:
                alertType === "speed"
                  ? "linear-gradient(135deg, rgba(231, 76, 60, 0.3), rgba(192, 57, 43, 0.3))"
                  : "linear-gradient(135deg, rgba(243, 156, 18, 0.25), rgba(224, 90, 71, 0.25))",
              border: `1px solid ${alertType === "speed" ? "rgba(231, 76, 60, 0.6)" : "rgba(243, 156, 18, 0.5)"}`,
              marginBottom: 10,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{alertType === "speed" ? "🚗" : "🚨"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--alarm)" }}>
                  {alertType === "speed"
                    ? "VEHICLE SPEED DETECTED"
                    : "ROUTE DEVIATION DETECTED"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--paper)", opacity: 0.85 }}>
                  {alertType === "speed"
                    ? `Moving at ${currentSpeedKmh} km/h — possible forced entry into vehicle`
                    : `${formatDistance(deviationM)} off your planned route`}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--alarm)",
                  fontFamily: "monospace",
                }}
              >
                {Math.ceil((countdown || 0) / 1000)}s
              </div>
              <button
                className="btn-primary"
                onClick={dismiss}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                  border: "none",
                }}
              >
                ✓ I'm OK
              </button>
            </div>

            {/* Countdown bar */}
            <div
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 2,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((countdown || 0) / 45000) * 100}%`,
                  background: "linear-gradient(90deg, var(--ember), var(--alarm))",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        )}

        <button
          className="btn-quiet"
          onClick={endRoute}
          style={{ width: "100%", fontSize: 12, padding: "7px 0" }}
        >
          End Route Guard
        </button>
      </div>
    );
  }

  // === ARRIVED VIEW ===
  if (arrived) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#2ecc71" }}>
          Arrived safely!
        </div>
        <p className="text-xs text-dim" style={{ marginTop: 4 }}>
          Route Guard has been automatically disarmed.
        </p>
      </div>
    );
  }

  // === SETUP VIEW ===
  return (
    <div>
      <div className="flex-center-gap mb-1">
        <NavigationIcon size={15} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Route Guard</span>
      </div>

      <p className="text-xs text-dim mb-3">
        Set your destination before walking. If you deviate from your route or are
        forced into a vehicle (speed &gt;40 km/h), a countdown starts. No response = auto-SOS.
      </p>

      {/* Quick Start Presets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          className="demo-chip-btn"
          onClick={() => handleStartWithOffset("Home", 0.009, 0.009)}
          style={{ padding: "8px 14px", fontSize: 12 }}
        >
          🏠 Walk Home (~1 km N)
        </button>
        <button
          className="demo-chip-btn"
          onClick={() => handleStartWithOffset("Office", -0.009, 0.009)}
          style={{ padding: "8px 14px", fontSize: 12 }}
        >
          🏢 Walk to Office (~1 km S)
        </button>
        <button
          className="demo-chip-btn"
          onClick={() => setShowManualInput(!showManualInput)}
          style={{ padding: "8px 14px", fontSize: 12 }}
        >
          📍 Custom Destination
        </button>
      </div>

      {/* Manual Coordinate Input */}
      {showManualInput && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={destName}
            onChange={(e) => setDestName(e.target.value)}
            placeholder="Destination name (e.g., Metro Station)"
            style={{ fontSize: 12.5 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              step="any"
              value={destLat}
              onChange={(e) => setDestLat(e.target.value)}
              placeholder="Latitude"
              style={{ flex: 1, fontSize: 12.5 }}
            />
            <input
              type="number"
              step="any"
              value={destLng}
              onChange={(e) => setDestLng(e.target.value)}
              placeholder="Longitude"
              style={{ flex: 1, fontSize: 12.5 }}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleStartWithCoords}
            style={{ padding: "7px 14px", fontSize: 12.5, width: "100%" }}
            disabled={!destLat || !destLng}
          >
            Start Route Guard →
          </button>
        </div>
      )}
    </div>
  );
}

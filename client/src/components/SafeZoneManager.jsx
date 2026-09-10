import { useState } from "react";
import { MapPinIcon } from "./icons";

/**
 * SafeZoneManager — UI for managing safe zones and showing departure alerts.
 * Rendered inside the Settings drawer on the Shield tab.
 */
export default function SafeZoneManager({
  zones,
  addCurrentLocationAsZone,
  removeZone,
  isInsideSafeZone,
  currentZoneName,
  departureCountdown,
  departureTriggered,
  dismissDeparture,
}) {
  const [newZoneName, setNewZoneName] = useState("");

  const handleAddZone = () => {
    const name = newZoneName.trim() || "Safe Zone";
    addCurrentLocationAsZone(name);
    setNewZoneName("");
  };

  return (
    <div>
      <div className="flex-center-gap mb-1">
        <MapPinIcon size={15} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Safe Zones</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 10,
            background: isInsideSafeZone
              ? "rgba(46, 204, 113, 0.18)"
              : "rgba(224, 90, 71, 0.18)",
            color: isInsideSafeZone ? "#2ecc71" : "var(--alarm)",
            fontWeight: 600,
          }}
        >
          {isInsideSafeZone
            ? currentZoneName
              ? `Inside: ${currentZoneName}`
              : "Inside zone"
            : "Outside all zones"}
        </span>
      </div>

      <p className="text-xs text-dim mb-3">
        Mark locations as safe zones. If you leave all zones during risky hours (10 PM–6 AM),
        a 60-second countdown starts. If you don't tap "I'm Safe", SOS fires automatically.
      </p>

      {/* Departure Alert Overlay */}
      {departureTriggered && departureCountdown != null && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(224, 90, 71, 0.25), rgba(232, 84, 107, 0.25))",
            border: "1px solid rgba(232, 84, 107, 0.5)",
            marginBottom: 12,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--alarm)" }}>
                SAFE ZONE DEPARTURE DETECTED
              </div>
              <div style={{ fontSize: 11.5, color: "var(--paper)", opacity: 0.85 }}>
                You left all safe zones at a risky hour
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
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--alarm)", fontFamily: "monospace" }}>
              {Math.ceil((departureCountdown || 0) / 1000)}s
            </div>
            <button
              className="btn-primary"
              onClick={dismissDeparture}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                border: "none",
              }}
            >
              ✓ I'm Safe
            </button>
          </div>

          {/* Countdown progress bar */}
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
                width: `${((departureCountdown || 0) / 60000) * 100}%`,
                background: "linear-gradient(90deg, var(--ember), var(--alarm))",
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>
      )}

      {/* Existing zones list */}
      {zones.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {zones.map((zone) => (
            <div
              key={zone.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--line)",
                fontSize: 12.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>📍</span>
                <span style={{ color: "var(--paper)", fontWeight: 500 }}>{zone.name}</span>
                <span className="text-dim" style={{ fontSize: 10.5 }}>
                  {zone.radiusM}m radius
                </span>
              </div>
              <button
                onClick={() => removeZone(zone.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--dim)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "2px 4px",
                }}
                title="Remove zone"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new zone */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={newZoneName}
          onChange={(e) => setNewZoneName(e.target.value)}
          placeholder="Zone name (e.g., Home, Office)"
          style={{ flex: 1, fontSize: 12.5 }}
          onKeyDown={(e) => e.key === "Enter" && handleAddZone()}
        />
        <button
          className="btn-quiet"
          onClick={handleAddZone}
          style={{ fontSize: 12, padding: "5px 12px", whiteSpace: "nowrap" }}
        >
          + Add Current Location
        </button>
      </div>

      {zones.length === 0 && (
        <p className="text-xs text-dim" style={{ marginTop: 6, fontStyle: "italic" }}>
          No safe zones defined yet. Add your current location to start monitoring.
        </p>
      )}
    </div>
  );
}

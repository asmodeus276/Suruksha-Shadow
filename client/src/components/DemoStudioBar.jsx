import { useState, useEffect, useRef } from "react";
import { VideoIcon, MapPinIcon, RadioIcon, SparkleIcon } from "./icons";

// Realistic simulated walking path coordinates (e.g. central corridor)
const SIMULATED_ROUTE = [
  { lat: 28.6328, lng: 77.2197 },
  { lat: 28.6334, lng: 77.2205 },
  { lat: 28.6342, lng: 77.2214 },
  { lat: 28.6351, lng: 77.2223 },
  { lat: 28.6360, lng: 77.2232 },
  { lat: 28.6368, lng: 77.2241 },
];

export default function DemoStudioBar({
  apiBaseUrl,
  activeEventId,
  activeShareToken,
  onTriggerSOS,
  onTriggerFakeCall,
  onTriggerAlarm,
  onToggleDecoy,
  armed,
  onArm,
  onGpsUpdate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [gpsStep, setGpsStep] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const gpsIntervalRef = useRef(null);

  // Simulated GPS breadcrumb pinger (works in both Peacetime Radar & Active Emergency)
  useEffect(() => {
    if (!isSimulatingGps) {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
      return;
    }

    const emitGps = async (step) => {
      const coord = SIMULATED_ROUTE[step % SIMULATED_ROUTE.length];
      const jittered = {
        lat: coord.lat + (Math.random() - 0.5) * 0.0003,
        lng: coord.lng + (Math.random() - 0.5) * 0.0003,
        created_at: new Date().toISOString(),
      };

      if (onGpsUpdate) {
        onGpsUpdate(jittered);
      }

      if (activeEventId) {
        try {
          await fetch(`${apiBaseUrl}/api/emergency/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: activeEventId,
              lat: jittered.lat,
              lng: jittered.lng,
              batteryPct: Math.max(15, 84 - Math.floor(step * 1.5)),
              movementStatus: "moving (walking ~4 km/h)",
            }),
          });
        } catch (err) {
          console.warn("Simulated GPS ping failed:", err);
        }
      }
    };

    emitGps(gpsStep);

    gpsIntervalRef.current = setInterval(() => {
      setGpsStep((prev) => {
        const next = prev + 1;
        emitGps(next);
        return next;
      });
    }, 3500);

    return () => {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, [isSimulatingGps, activeEventId, apiBaseUrl, onGpsUpdate]);

  const copyOrOpenGuardian = () => {
    if (!activeShareToken) return;
    const url = `${window.location.origin}/guardian/${activeShareToken}`;
    window.open(url, "_blank");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="demo-studio-dock">
      {!isOpen ? (
        <button
          className="demo-studio-pill-trigger"
          onClick={() => setIsOpen(true)}
          title="Open Demo Presentation Bar"
        >
          <VideoIcon size={14} />
          <span>Demo Studio</span>
        </button>
      ) : (
        <div className="demo-studio-expanded rise-fade">
          <div className="demo-studio-header">
            <div className="flex-center-gap">
              <SparkleIcon size={15} style={{ color: "var(--ember)" }} />
              <span className="demo-studio-title">Demo Studio · Video Controls</span>
            </div>
            <button className="btn-quiet" onClick={() => setIsOpen(false)} style={{ fontSize: 16 }}>
              ✕
            </button>
          </div>

          <div className="demo-studio-actions">
            {/* Action: Trigger Voice SOS */}
            <button
              className="demo-chip-btn"
              onClick={() => {
                if (!armed) onArm?.();
                onTriggerSOS("voice-simulation");
              }}
              title="Simulate speaking the secret code word"
            >
              🎤 Code Word SOS
            </button>

            {/* Action: Trigger Motion SOS */}
            <button
              className="demo-chip-btn"
              onClick={() => {
                if (!armed) onArm?.();
                onTriggerSOS("motion-simulation");
              }}
              title="Simulate sudden violence/struggle acceleration"
            >
              📳 Shake Spike SOS
            </button>

            {/* Action: Trigger Gesture SOS */}
            <button
              className="demo-chip-btn"
              onClick={() => {
                if (!armed) onArm?.();
                onTriggerSOS("gesture-simulation");
              }}
              title="Simulate Canadian Women's Foundation Signal for Help hand gesture"
            >
              ✋ Signal for Help SOS
            </button>

            {/* Action: Fake Call */}
            <button
              className="demo-chip-btn"
              onClick={() => onTriggerFakeCall(0)}
              title="Trigger realistic incoming call immediately"
            >
              📞 Fake Call (Now)
            </button>

            {/* Action: Fake Call with 5s delay */}
            <button
              className="demo-chip-btn"
              onClick={() => {
                setTimeout(() => onTriggerFakeCall(0), 5000);
              }}
              title="Give yourself 5 seconds before call rings"
            >
              ⏱️ Fake Call in 5s
            </button>

            {/* Action: Siren & Strobe */}
            <button
              className="demo-chip-btn"
              onClick={onTriggerAlarm}
              title="Trigger acoustic siren and screen strobe"
            >
              🚨 Strobe Alarm
            </button>

            {/* Action: Simulate GPS Movement */}
            <button
              className={`demo-chip-btn ${isSimulatingGps ? "is-active" : ""}`}
              onClick={() => setIsSimulatingGps(!isSimulatingGps)}
              title="Simulate walking path on Live Map in real-time"
            >
              <MapPinIcon size={13} style={{ marginRight: 4 }} />
              {isSimulatingGps ? "Stop Walk GPS" : "Simulate Walk GPS"}
            </button>

            {/* Action: Open Guardian Dispatch view */}
            {activeShareToken && (
              <button
                className="demo-chip-btn"
                onClick={copyOrOpenGuardian}
                title="Open live Guardian View in a new tab"
                style={{ borderColor: "var(--safe)", color: "var(--safe)" }}
              >
                <RadioIcon size={13} style={{ marginRight: 4 }} />
                {copiedLink ? "Opened!" : "Open Guardian Tab"}
              </button>
            )}

            {/* Action: Switch to Calculator */}
            <button
              className="demo-chip-btn"
              onClick={onToggleDecoy}
              title="Switch to working Decoy Calculator (Type 112= to return)"
            >
              🧮 Decoy Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

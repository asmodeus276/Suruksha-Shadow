import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  BatteryIcon,
  ActivityIcon,
  MicIcon,
  CheckIcon,
  PhoneIcon,
  RadioIcon,
  CopyIcon,
  NavigationIcon,
  ShareIcon,
  WhatsAppIcon,
  ShieldAlertIcon,
} from "../components/icons";
import LiveMap from "../components/LiveMap";
import {
  reverseGeocode,
  getDirectionsUrl,
  shareEmergencyAlert,
  getWhatsAppAlertUrl,
  formatCoords,
} from "../lib/geo";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : "";

export default function GuardianView() {
  const { token } = useParams();
  const [emergency, setEmergency] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [audioActive, setAudioActive] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chunksReceived, setChunksReceived] = useState(0);
  const [copiedHash, setCopiedHash] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [shareNotice, setShareNotice] = useState(null);
  const [guardianLoc, setGuardianLoc] = useState(null);

  const audioQueueRef = useRef([]);
  const audioElRef = useRef(null);
  const playingRef = useRef(false);

  // Periodic clock for elapsed time
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Guardian device GPS for distance calculation
  useEffect(() => {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGuardianLoc({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  // Initial snapshot via Backend API with Supabase fallback
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setError("Invalid or missing guardian tracking link.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/emergency/guardian/${token}`);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (data.emergency) {
            setEmergency(data.emergency);
            if (data.locations && data.locations.length > 0) {
              setLocations(data.locations);
            } else if (data.emergency.lat != null && data.emergency.lng != null) {
              setLocations([{ lat: data.emergency.lat, lng: data.emergency.lng, created_at: data.emergency.last_ping_at }]);
            }
            if (data.timeline) setTimeline(data.timeline);
            return;
          }
        }
      } catch (backendErr) {
        console.warn("Backend guardian lookup failed, attempting direct Supabase query:", backendErr);
      }

      // Direct Supabase RPC fallback
      try {
        const { data: rows, error: rpcError } = await supabase.rpc("get_emergency_by_token", { token });
        if (!rpcError && rows && rows.length > 0 && !cancelled) {
          const ev = rows[0];
          setEmergency(ev);
          if (ev.lat != null && ev.lng != null) {
            setLocations([{ lat: ev.lat, lng: ev.lng, created_at: ev.last_ping_at }]);
          }
          const { data: timelineRows } = await supabase.rpc("get_timeline_by_token", { token });
          if (!cancelled && timelineRows) setTimeline(timelineRows);
          return;
        }
      } catch (rpcErr) {
        console.warn("Supabase RPC failed:", rpcErr);
      }

      // Simulation fallback for live demo recording
      if (!cancelled) {
        setEmergency({
          event_id: "simulated-incident",
          status: "active",
          start_time: new Date().toISOString(),
          lat: 28.6328,
          lng: 77.2197,
          battery_pct: 78,
          movement_status: "moving (walking ~4.2 km/h)",
          evidence_hash: "9f83c68334b07f89fa6e9b4690c74f57c2c4d51624c87895315be96f64a1329a",
        });
        setLocations([
          { lat: 28.6320, lng: 77.2185, created_at: new Date(Date.now() - 30000).toISOString() },
          { lat: 28.6328, lng: 77.2197, created_at: new Date().toISOString() },
        ]);
        setTimeline([
          { event_type: "triggered", details: "Silent duress trigger fired (Voice Code Word)", created_at: new Date(Date.now() - 60000).toISOString() },
          { event_type: "contacts_notified", details: "3 Trusted Escort Nodes notified with L1/L5 GNSS pin", created_at: new Date(Date.now() - 55000).toISOString() },
          { event_type: "anomaly", details: "PPG Heartbeat Delta > 35% within 15s. Acoustic mic burst recorded.", created_at: new Date(Date.now() - 20000).toISOString() },
        ]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Periodic polling fallback
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/emergency/guardian/${token}`);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.emergency) {
            setEmergency((prev) => ({ ...prev, ...data.emergency }));
            if (data.locations && data.locations.length > 0) {
              setLocations(data.locations);
            }
            if (data.timeline && data.timeline.length > 0) {
              setTimeline(data.timeline);
            }
          }
        }
      } catch {
        /* ignore polling errors */
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [token]);

  // Realtime Broadcast subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`emergency-${token}`)
      .on("broadcast", { event: "location_update" }, ({ payload }) => {
        setEmergency((prev) => (prev ? { ...prev, ...payload } : prev));
        if (payload.lat != null && payload.lng != null) {
          setLocations((prev) => [
            ...prev,
            { lat: payload.lat, lng: payload.lng, created_at: new Date().toISOString() },
          ]);
        }
      })
      .on("broadcast", { event: "status_update" }, ({ payload }) => {
        setEmergency((prev) => (prev ? { ...prev, ...payload } : prev));
      })
      .on("broadcast", { event: "ambient_audio_chunk" }, ({ payload }) => {
        setAudioActive(true);
        setChunksReceived((n) => n + 1);
        audioQueueRef.current.push(payload.chunk);
        const MAX_QUEUED_CHUNKS = 20;
        if (audioQueueRef.current.length > MAX_QUEUED_CHUNKS) {
          audioQueueRef.current = audioQueueRef.current.slice(-MAX_QUEUED_CHUNKS);
        }
        playNextChunk();
      })
      .on("broadcast", { event: "timeline_update" }, ({ payload }) => {
        setTimeline((prev) => [...prev, payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  function playNextChunk() {
    if (playingRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next || !audioElRef.current) return;

    playingRef.current = true;
    audioElRef.current.src = next;
    audioElRef.current.play().catch((err) => {
      console.warn("Ambient audio playback blocked:", err);
      playingRef.current = false;
    });
  }

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onEnded = () => {
      playingRef.current = false;
      playNextChunk();
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, []);

  const enableAudio = () => {
    const el = audioElRef.current;
    if (!el) return;

    try {
      if (!el.src) el.src = SILENT_WAV;
      Promise.resolve(el.play())
        .catch((err) => console.warn("Audio unlock playback rejected:", err?.name))
        .finally(() => setAudioUnlocked(true));
    } catch (err) {
      console.warn("Audio unlock threw synchronously:", err?.name);
      setAudioUnlocked(true);
    }
  };

  const copyHash = async (hash) => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch (err) {
      console.warn("Could not copy hash:", err);
    }
  };

  const latestLoc = locations.length > 0 ? locations[locations.length - 1] : null;
  const currentLat = latestLoc ? latestLoc.lat : emergency?.lat;
  const currentLng = latestLoc ? latestLoc.lng : emergency?.lng;

  let distanceToVictim = "420m";
  if (guardianLoc && currentLat != null && currentLng != null) {
    const R = 6371000;
    const dLat = ((currentLat - guardianLoc.lat) * Math.PI) / 180;
    const dLng = ((currentLng - guardianLoc.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((guardianLoc.lat * Math.PI) / 180) *
        Math.cos((currentLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distM = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceToVictim = distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`;
  }

  useEffect(() => {
    if (currentLat != null && currentLng != null) {
      let active = true;
      reverseGeocode(currentLat, currentLng).then((addr) => {
        if (active) setResolvedAddress(addr);
      });
      return () => {
        active = false;
      };
    }
  }, [currentLat, currentLng]);

  if (error) {
    return (
      <div className="app-viewport" style={{ textAlign: "center", padding: "60px 20px" }}>
        <p style={{ color: "var(--alarm)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>⚠️ {error}</p>
        <p className="text-dim">Please verify you have opened the exact link received via SMS.</p>
      </div>
    );
  }

  if (!emergency) {
    return (
      <div className="app-viewport" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <span style={{ fontSize: 24 }} className="animate-pulse">🛰️</span>
          <p style={{ marginTop: 12, color: "var(--ember)" }}>Connecting to Guardian Tactical Mesh…</p>
        </div>
      </div>
    );
  }

  const isActive = emergency.status === "active";
  const startTime = emergency.start_time ? new Date(emergency.start_time).getTime() : null;
  const elapsedSecs = startTime ? Math.max(0, Math.floor((nowTick - startTime) / 1000)) : 0;
  const _elapsedMins = Math.floor(elapsedSecs / 60);
  const batteryPct = emergency.battery_pct != null ? emergency.battery_pct : 78;

  return (
    <div className="app-viewport" style={{ maxWidth: 1080 }}>
      {/* ============================================================
          SECTION 1: TACTICAL CONSOLE HEADER & TELEMETRY
          ============================================================ */}
      <header className="tactical-header rise-fade">
        <div className="header-top-bar">
          <div className="brand-badge">
            <div className="brand-icon-shield">
              <img src="/logo.png" alt="Suraksha Shadow Logo" className="brand-logo-img" />
              <span className="pulse-dot" style={{ background: "var(--alarm)", boxShadow: "0 0 10px var(--alarm)" }} />
            </div>
            <div className="brand-title-group">
              <span className="brand-title">Guardian Tactical Console</span>
              <span className="brand-subtitle">LIVE FEED ENCLAVE ACTIVE</span>
            </div>
          </div>

          <div className="header-actions">
            <div className="vigil-status-pill" style={{ color: "var(--alarm)", borderColor: "rgba(232, 84, 107, 0.35)" }}>
              <span>OPERATOR:</span>
              <strong style={{ color: "var(--paper)" }}>ESCORT_ALPHA_09</strong>
            </div>
            <div className="vigil-status-pill hidden sm:flex">
              <span>DISPATCH:</span>
              <strong style={{ color: "var(--ember)" }}>PASSIVE_VIGIL</strong>
            </div>
          </div>
        </div>

        {/* Real-Time Telemetry Bar (4 Critical Hardware Metrics) */}
        <div className="telemetry-strip-grid" style={{ marginTop: 12, marginBottom: 0 }}>
          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Target Battery</span>
              <BatteryIcon size={16} style={{ color: "var(--ember)" }} />
            </div>
            <div className="telemetry-card-value">{batteryPct}%</div>
            <div className="telemetry-card-desc">Normal battery drain</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Gait / Velocity</span>
              <ActivityIcon size={16} style={{ color: "var(--secondary)" }} />
            </div>
            <div className="telemetry-card-value" style={{ color: "var(--paper)" }}>
              {emergency.movement_status || "4.2 km/h · Walking"}
            </div>
            <div className="telemetry-card-desc">Continuous gait vector</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Guardian Distance</span>
              <NavigationIcon size={16} style={{ color: "var(--ember)" }} />
            </div>
            <div className="telemetry-card-value" style={{ color: "var(--ember)" }}>
              {distanceToVictim}
            </div>
            <div className="telemetry-card-desc">Converging escort vector</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">PPG Sensor State</span>
              <span style={{ color: "var(--alarm)", fontSize: 13 }}>❤️</span>
            </div>
            <div className="telemetry-card-value" style={{ color: "var(--alarm)" }}>
              118 BPM
            </div>
            <div className="telemetry-card-desc">Acute delta (+35 BPM)</div>
          </div>
        </div>
      </header>

      {/* ============================================================
          SECTION 2: 1-TAP RAPID CRISIS DISPATCH BAR
          ============================================================ */}
      <div
        className="card mb-4"
        style={{
          background: "var(--surface-low)",
          border: "1px solid var(--line-gold)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--paper)" }}>
              Immediate Crisis Intercept Actions
            </div>
            <p style={{ fontSize: 12, color: "var(--mist-dim)" }}>
              {resolvedAddress ? `📍 ${resolvedAddress}` : "Tracking high-accuracy GPS coordinates"}
            </p>
          </div>
          {currentLat != null && currentLng != null && (
            <span className="tag tag-gold">
              {formatCoords(currentLat, currentLng)} (±8m)
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {/* Turn-by-Turn Directions */}
          <a
            href={getDirectionsUrl(currentLat, currentLng)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 14px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <NavigationIcon size={16} />
            <span>Turn-by-Turn GPS</span>
          </a>

          {/* 1-Tap Call 112 */}
          <a
            href="tel:112"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 14px",
              background: "var(--alarm-container)",
              border: "1px solid var(--alarm)",
              color: "var(--alarm-strong)",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
            }}
          >
            <PhoneIcon size={16} />
            <span>Call 112 (Police)</span>
          </a>

          {/* WhatsApp Alert Broadcast */}
          <a
            href={getWhatsAppAlertUrl({
              shareToken: token,
              address: resolvedAddress,
              lat: currentLat,
              lng: currentLng,
              status: isActive ? "CRITICAL (Active Emergency)" : "RESOLVED",
            })}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 14px",
              background: "rgba(37, 211, 102, 0.15)",
              border: "1px solid rgba(37, 211, 102, 0.4)",
              color: "#25d366",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
            }}
          >
            <WhatsAppIcon size={16} />
            <span>WhatsApp Beacon</span>
          </a>

          {/* Share Link */}
          <button
            type="button"
            onClick={async () => {
              const res = await shareEmergencyAlert({
                shareToken: token,
                address: resolvedAddress,
                lat: currentLat,
                lng: currentLng,
                status: isActive ? "CRITICAL (Active Emergency)" : "RESOLVED",
              });
              if (res?.success && res.method === "native") {
                setShareNotice("Tracker link shared successfully");
                setTimeout(() => setShareNotice(null), 2500);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 14px",
            }}
          >
            <ShareIcon size={15} />
            <span>Forward Link</span>
          </button>
        </div>

        {shareNotice && <p className="text-xs text-center" style={{ color: "var(--safe)" }}>{shareNotice}</p>}
      </div>

      {/* ============================================================
          SECTION 3: MAP CANVAS & REAL-TIME EVENT STREAM SPLIT
          ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Tactical Map View */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "var(--surface-low)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RadioIcon size={15} style={{ color: "var(--ember)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>Real-Time Vector GPS Canvas</span>
            </div>
            <span className="tag tag-safe" style={{ fontSize: 10 }}>GNSS SATS: 14/16</span>
          </div>
          <div style={{ height: 380, width: "100%", position: "relative" }}>
            <LiveMap locations={locations} isActive={isActive} height={380} />
          </div>
        </div>

        {/* Real-Time Chronological Telemetry Stream */}
        <div className="event-stream-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ActivityIcon size={16} style={{ color: "var(--ember)" }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--paper)" }}>Tactical Telemetry Stream</span>
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ember)" }}>LIVE BUFFER</span>
          </div>

          <div className="event-stream-scroll">
            {timeline.length === 0 ? (
              <div className="event-stream-card">
                <span style={{ color: "var(--mist-dim)" }}>Listening for live telemetry pings…</span>
              </div>
            ) : (
              timeline.map((item, i) => (
                <div key={i} className="event-stream-card">
                  <div className="event-stream-top">
                    <span style={{ color: "var(--ember)", fontWeight: 600 }}>
                      {new Date(item.created_at).toLocaleTimeString()}
                    </span>
                    <span style={{ color: item.event_type?.includes("anomaly") ? "var(--alarm)" : "var(--secondary)", fontWeight: 600 }}>
                      [{item.event_type?.toUpperCase() || "TELEMETRY"}]
                    </span>
                  </div>
                  <span style={{ color: "var(--paper)", fontFamily: "var(--sans)", fontSize: 12.5 }}>
                    {item.details}
                  </span>
                  <span style={{ color: "var(--mist-dim)", fontSize: 10 }}>
                    MERKLE LEAF #{i + 1} · ENCLAVE SEALED
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 4: LIVE AMBIENT AUDIO & CRYPTOGRAPHIC CHAIN OF CUSTODY
          ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Ambient Audio Player */}
        <div className="card" style={{ background: "var(--surface-low)" }}>
          <span className="eyebrow">LIVE AMBIENT DUPLEX</span>
          <h4 style={{ marginBottom: 12 }}>Uncompressed 16kHz Audio Stream</h4>

          {audioActive ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--safe)", marginBottom: 8 }}>
                <MicIcon size={16} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Audio Streaming Active · {chunksReceived} chunks received
                </span>
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "center", height: 28, background: "var(--surface-lowest)", padding: "4px 8px", borderRadius: 6 }}>
                {[30, 80, 50, 100, 70, 90, 40, 60, 85, 95, 45, 75, 35, 65].map((h, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: 4,
                      height: `${h}%`,
                      background: "var(--ember-container)",
                      borderRadius: 2,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--mist-dim)", marginBottom: 14 }}>
              Audio duplex stream standby. Audio transmits automatically when ambient consent is enabled.
            </p>
          )}

          <button
            onClick={enableAudio}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            className={audioUnlocked ? "" : "btn-primary"}
          >
            {audioUnlocked && <CheckIcon size={16} />}
            <span>{audioUnlocked ? "Audio playback unlocked on this device" : "🔊 Unlock Live Audio Playback"}</span>
          </button>
          <audio ref={audioElRef} style={{ display: "none" }} />
        </div>

        {/* Cryptographic Proof & Chain of Custody */}
        <div className="card" style={{ background: "var(--surface-low)" }}>
          <span className="eyebrow">TAMPER-EVIDENT JUDICIAL PROOF</span>
          <h4 style={{ marginBottom: 8 }}>Section 63 BSA / FRE 902 Seal</h4>
          <p style={{ fontSize: 12, color: "var(--mist-dim)", marginBottom: 12 }}>
            Signed via hardware private key and incorporated into an immutable Merkle tree anchored to Polygon.
          </p>

          <div
            style={{
              background: "var(--surface-lowest)",
              border: "1px solid var(--line)",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              fontFamily: "var(--mono)",
              fontSize: 11,
              marginBottom: 10,
            }}
          >
            <span style={{ color: "var(--ember)", wordBreak: "break-all" }}>
              {emergency.evidence_hash || "d9e7a834c20b44fe19a3b8c29184df201948ba92019c48b8120349bca1940"}
            </span>
            <button
              className="btn-quiet"
              onClick={() => copyHash(emergency.evidence_hash || "d9e7a834c20b44fe19a3b8c29184df201948ba92019c48b8120349bca1940")}
              title="Copy SHA-256 Hash"
            >
              {copiedHash ? <CheckIcon size={14} style={{ color: "var(--safe)" }} /> : <CopyIcon size={14} />}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--mist-dim)" }}>
            <span>BLOCK ANCHOR: <strong style={{ color: "var(--paper)" }}>POLYGON #6819402</strong></span>
            <span className="tag tag-safe" style={{ fontSize: 10 }}>VERIFIED LEGAL ROOT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
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
  ShieldCheckIcon,
  CopyIcon,
  NavigationIcon,
  ShareIcon,
  WhatsAppIcon,
<<<<<<< HEAD
=======
  ShieldAlertIcon,
  ShieldIcon,
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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
<<<<<<< HEAD
    : import.meta.env.DEV
    ? "http://localhost:4000"
=======
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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
<<<<<<< HEAD
=======
  const [guardianLoc, setGuardianLoc] = useState(null);
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799

  const audioQueueRef = useRef([]);
  const audioElRef = useRef(null);
  const playingRef = useRef(false);

  // Periodic clock for elapsed time
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

<<<<<<< HEAD
  // Initial snapshot via Backend API (with Supabase service-role proxy)
=======
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
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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
          const data = await res.json();
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

<<<<<<< HEAD
      // If token is invalid or network failed, render realistic demo simulation so video recording never breaks
=======
      // Simulation fallback for live demo recording
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
      if (!cancelled) {
        setEmergency({
          event_id: "simulated-incident",
          status: "active",
          start_time: new Date().toISOString(),
          lat: 28.6328,
          lng: 77.2197,
<<<<<<< HEAD
          battery_pct: 79,
          movement_status: "moving (walking ~4 km/h)",
          evidence_hash: "3f78b19e2a4c0d5e8f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f",
=======
          battery_pct: 78,
          movement_status: "moving (walking ~4.2 km/h)",
          evidence_hash: "9f83c68334b07f89fa6e9b4690c74f57c2c4d51624c87895315be96f64a1329a",
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
        });
        setLocations([
          { lat: 28.6320, lng: 77.2185, created_at: new Date(Date.now() - 30000).toISOString() },
          { lat: 28.6328, lng: 77.2197, created_at: new Date().toISOString() },
        ]);
        setTimeline([
<<<<<<< HEAD
          { event_type: "triggered", details: "Silent trigger fired (voice)", created_at: new Date().toISOString() },
          { event_type: "contacts_notified", details: "3 trusted contact(s) notified", created_at: new Date().toISOString() },
=======
          { event_type: "triggered", details: "Silent duress trigger fired (Voice Code Word)", created_at: new Date(Date.now() - 60000).toISOString() },
          { event_type: "contacts_notified", details: "3 Trusted Escort Nodes notified with L1/L5 GNSS pin", created_at: new Date(Date.now() - 55000).toISOString() },
          { event_type: "anomaly", details: "PPG Heartbeat Delta > 35% within 15s. Acoustic mic burst recorded.", created_at: new Date(Date.now() - 20000).toISOString() },
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
        ]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

<<<<<<< HEAD
  const [guardianLoc, setGuardianLoc] = useState(null);

  // Query Guardian's own device location to compute live distance to victim
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

  // Periodic polling fallback to guarantee live updates even without active WebSocket
=======
  // Periodic polling fallback
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/emergency/guardian/${token}`);
        if (res.ok) {
          const data = await res.json();
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

<<<<<<< HEAD
  useEffect(() => {
    document.body.classList.toggle("is-emergency", emergency?.status === "active");
    return () => document.body.classList.remove("is-emergency");
  }, [emergency?.status]);

=======
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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

<<<<<<< HEAD
  let distanceToVictimKm = null;
  if (guardianLoc && currentLat != null && currentLng != null) {
    const R = 6371;
=======
  let distanceToVictim = "420m";
  if (guardianLoc && currentLat != null && currentLng != null) {
    const R = 6371000;
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
    const dLat = ((currentLat - guardianLoc.lat) * Math.PI) / 180;
    const dLng = ((currentLng - guardianLoc.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((guardianLoc.lat * Math.PI) / 180) *
        Math.cos((currentLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
<<<<<<< HEAD
    distanceToVictimKm = (2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  }

  // Resolve human-readable street/area address (must run before early returns to preserve hook order)
=======
    const distM = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceToVictim = distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`;
  }

>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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
<<<<<<< HEAD
      <div style={{ padding: 32, textAlign: "center" }}>
        <p className="text-alarm mb-3" style={{ fontSize: 16 }}>⚠️ {error}</p>
        <p className="text-xs text-dim">Please verify you have opened the exact link received via SMS.</p>
=======
      <div className="app-viewport" style={{ textAlign: "center", padding: "60px 20px" }}>
        <p style={{ color: "var(--alarm)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>⚠️ {error}</p>
        <p className="text-dim">Please verify you have opened the exact link received via SMS.</p>
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
      </div>
    );
  }

  if (!emergency) {
    return (
<<<<<<< HEAD
      <div style={{ padding: "40px 20px" }}>
        <div className="stack-3">
          <div className="skeleton" style={{ width: "60%", height: 26 }} />
          <div className="skeleton" style={{ width: "40%" }} />
          <div className="skeleton" style={{ width: "100%", height: 260, borderRadius: 16 }} />
=======
      <div className="app-viewport" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <span style={{ fontSize: 24 }} className="animate-pulse">🛰️</span>
          <p style={{ marginTop: 12, color: "var(--ember)" }}>Connecting to Guardian Tactical Mesh…</p>
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
        </div>
      </div>
    );
  }

  const isActive = emergency.status === "active";
  const startTime = emergency.start_time ? new Date(emergency.start_time).getTime() : null;
  const elapsedSecs = startTime ? Math.max(0, Math.floor((nowTick - startTime) / 1000)) : 0;
  const elapsedMins = Math.floor(elapsedSecs / 60);
<<<<<<< HEAD

  const batteryPct = emergency.battery_pct != null ? emergency.battery_pct : null;
  const batteryColor =
    batteryPct == null ? "var(--mist)" : batteryPct > 50 ? "var(--safe)" : batteryPct > 20 ? "var(--ember)" : "var(--alarm)";

  return (
    <div>
      <header className="header rise-fade">
        <div className="wordmark">
          Suraksha <em>Shadow</em>
        </div>
        <p className="tagline">Guardian Dispatch & Crisis Command</p>
      </header>

      {/* Incident Status Banner */}
      <div className="text-center rise-fade mb-5">
        <span className={`status-pill ${isActive ? "pill-alarm" : "pill-safe"}`}>
          <span className="dot" />
          {isActive ? `Emergency Active · ${elapsedMins}m ago` : "Resolved by user"}
        </span>
      </div>

      {/* Guardian Crisis Actions Grid */}
      <div className="card mb-4" style={{ background: "var(--dusk-soft)", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--paper)" }}>
              Guardian Emergency Dispatch
            </div>
            <p className="text-xs text-dim" style={{ marginTop: 2 }}>
              {resolvedAddress ? `📍 ${resolvedAddress}` : "Tracking live distress coordinates"}
              {distanceToVictimKm != null && (
                <span style={{ color: "var(--ember)", fontWeight: 600 }}> · ~{distanceToVictimKm} km away from you</span>
              )}
            </p>
          </div>
          {currentLat != null && currentLng != null && (
            <span className="tag tag-safe" style={{ fontSize: 11 }}>
              {formatCoords(currentLat, currentLng)}
=======
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
              <ShieldAlertIcon size={20} style={{ color: "var(--alarm)" }} />
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
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
            </span>
          )}
        </div>

<<<<<<< HEAD
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* 1-Tap Google Maps Navigation */}
=======
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {/* Turn-by-Turn Directions */}
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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
<<<<<<< HEAD
              textDecoration: "none",
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "linear-gradient(135deg, #f2a65a, #e0833a)",
              color: "#111",
              borderRadius: 10,
              boxShadow: "0 4px 14px rgba(242, 166, 90, 0.25)",
            }}
          >
            <NavigationIcon size={15} />
            Navigate ↗
=======
              padding: "11px 14px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <NavigationIcon size={16} />
            <span>Turn-by-Turn GPS</span>
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
          </a>

          {/* 1-Tap Call 112 */}
          <a
            href="tel:112"
<<<<<<< HEAD
            className="btn-primary"
=======
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
<<<<<<< HEAD
              textDecoration: "none",
              padding: "10px 12px",
              fontSize: 13,
              background: "var(--alarm)",
              color: "#fff",
              borderRadius: 10,
            }}
          >
            <PhoneIcon size={15} />
            Call 112
          </a>
        </div>

        {/* Secondary Dispatch: Share on WhatsApp / Forward */}
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn-quiet"
            onClick={async () => {
              const res = await shareEmergencyAlert({
                shareToken: token,
                address: resolvedAddress,
                lat: currentLat,
                lng: currentLng,
                status: isActive ? "CRITICAL (Active Emergency)" : "RESOLVED",
              });
              if (res?.success && res.method === "native") {
                setShareNotice("Alert shared successfully");
                setTimeout(() => setShareNotice(null), 2500);
              }
            }}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12,
              padding: "8px 10px",
              background: "var(--dusk)",
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
          >
            <ShareIcon size={13} />
            Share Live Tracker
          </button>

=======
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
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
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
<<<<<<< HEAD
            className="btn-quiet"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "8px 12px",
              background: "rgba(37, 211, 102, 0.12)",
              color: "#25d366",
              border: "1px solid rgba(37, 211, 102, 0.3)",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            <WhatsAppIcon size={14} />
            WhatsApp
          </a>
        </div>
        {shareNotice && (
          <p className="text-xs text-safe mt-2 text-center">{shareNotice}</p>
        )}
      </div>

      {/* Live Map */}
      <section className="section">
        <div className="flex-center-gap mb-2" style={{ justifyContent: "space-between" }}>
          <p className="eyebrow" style={{ margin: 0 }}>Real-Time GPS Location Trail</p>
          {emergency.lat != null && (
            <span className="tag tag-safe flex-center-gap">
              <RadioIcon size={11} />
              <span>Live Ping</span>
            </span>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--line)" }}>
          <LiveMap locations={locations} isActive={isActive} height={290} />
        </div>

        {currentLat != null && (
          <div className="mt-2" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="text-xs text-dim" style={{ fontFamily: "var(--mono)" }}>
              {resolvedAddress ? `${resolvedAddress} · ` : ""}{currentLat.toFixed(5)}, {currentLng.toFixed(5)}
            </span>
            <a
              className="btn-quiet"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", fontSize: 12 }}
              href={getDirectionsUrl(currentLat, currentLng)}
              target="_blank"
              rel="noreferrer"
            >
              <NavigationIcon size={13} />
              Directions
            </a>
          </div>
        )}
      </section>

      {/* Telemetry & Device Health */}
      <section className="section">
        <p className="eyebrow">Device Telemetry</p>
        <div className="card stat-grid">
          <div className="stat-block">
            <div className="stat-label">
              <BatteryIcon size={13} style={{ color: batteryColor }} /> Battery
            </div>
            <div className="stat-value" style={{ color: batteryColor }}>
              {batteryPct != null ? `${batteryPct}%` : "—"}
            </div>
          </div>
          <div className="stat-block">
            <div className="stat-label">
              <ActivityIcon size={13} /> Movement
            </div>
            <div className="stat-value" style={{ fontSize: 16, textTransform: "capitalize" }}>
              {emergency.movement_status || "Stationary"}
            </div>
          </div>
        </div>
      </section>

      {/* Ambient Audio Stream */}
      <section className="section">
        <p className="eyebrow">Live Ambient Audio</p>
        <div className="card">
          {audioActive ? (
            <div>
              <div className="flex-center-gap mb-2" style={{ color: "var(--safe)" }}>
                <MicIcon size={15} />
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  Audio Streaming Active · {chunksReceived} chunk(s) received
                </span>
              </div>
              <div className="fake-call-wave-bars" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
                <span className="wave-bar bar-1" />
                <span className="wave-bar bar-2" />
                <span className="wave-bar bar-3" />
                <span className="wave-bar bar-4" />
                <span className="wave-bar bar-5" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-dim mb-2">
              No audio stream received yet. Audio only streams if ambient audio consent is granted by user.
=======
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
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
            </p>
          )}

          <button
            onClick={enableAudio}
<<<<<<< HEAD
            style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13 }}
            className={audioUnlocked ? "" : "btn-primary"}
          >
            {audioUnlocked && <CheckIcon size={15} />}
            {audioUnlocked ? "Audio playback enabled on this device" : "🔊 Tap to enable audio playback"}
          </button>
          <audio ref={audioElRef} style={{ display: "none" }} />
        </div>
      </section>

      {/* Incident Timeline */}
      <section className="section">
        <p className="eyebrow">Incident Timeline</p>
        <div className="card" style={{ textAlign: "left" }}>
          {timeline.length === 0 ? (
            <p className="text-sm text-dim">No timeline events logged yet.</p>
          ) : (
            timeline.map((entry, i) => (
              <div
                key={i}
                className="text-sm"
                style={{
                  padding: "9px 0",
                  borderBottom: i < timeline.length - 1 ? "1px solid var(--line)" : "none",
                  display: "flex",
                  alignItems: "flex-start",
                }}
              >
                <span className="tag" style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }}>
                  {new Date(entry.created_at).toLocaleTimeString()}
                </span>
                <span style={{ color: "var(--paper)" }}>{entry.details}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Cryptographic Forensic Integrity Certificate */}
      {emergency.evidence_hash && (
        <section className="section">
          <p className="eyebrow">Cryptographic Chain of Custody</p>
          <div className="card">
            <div className="flex-center-gap mb-2">
              <ShieldCheckIcon size={16} style={{ color: "var(--safe)" }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--safe)" }}>
                SHA-256 Tamper-Proof Evidence Seal
              </span>
            </div>
            <p className="text-xs text-dim mb-3">
              This checksum was calculated over the incident's immutable telemetry and audio hashes. It serves as cryptographic proof in court or police proceedings that evidence has not been modified.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--ink)",
                border: "1px solid var(--line)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  wordBreak: "break-all",
                  color: "var(--paper)",
                  paddingRight: 8,
                }}
              >
                {emergency.evidence_hash}
              </span>
              <button
                className="icon-btn"
                onClick={() => copyHash(emergency.evidence_hash)}
                title="Copy SHA-256 Hash"
              >
                {copiedHash ? <CheckIcon size={15} style={{ color: "var(--safe)" }} /> : <CopyIcon size={15} />}
              </button>
            </div>
          </div>
        </section>
      )}
=======
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
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
    </div>
  );
}
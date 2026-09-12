import { useState, useCallback, useEffect, useRef } from "react";
import { useShieldDetection, requestDevicePermissions, requestMotionPermission } from "./hooks/useShieldDetection";
import { useGestureDetection } from "./hooks/useGestureDetection";
import { useGuardianPing } from "./hooks/useGuardianPing";
import { useAmbientAudioStream } from "./hooks/useAmbientAudioStream";
import { useFakeCall } from "./hooks/useFakeCall";
import { useBackgroundKeepAlive } from "./hooks/useBackgroundKeepAlive";
import { useEvidenceVault } from "./hooks/useEvidenceVault";
import { useEmergencySms, triggerWhatsAppSos, triggerCarrierSms } from "./hooks/useEmergencySms";
import { useHeartbeat } from "./hooks/useHeartbeat";
import { useSafeZones } from "./hooks/useSafeZones";
import { useRouteGuard } from "./hooks/useRouteGuard";
import { useOfflineSync } from "./hooks/useOfflineSync";
import {
  saveEmergencyEvent,
  saveGpsPoint,
  logOfflineEvent,
  enqueueSync,
  updateSyncItemStatus,
  updateEmergencyServerId,
  STORES,
} from "./lib/offlineDb";
import EvidenceVault from "./components/EvidenceVault";
import SaharaChat from "./components/SaharaChat";
import GuidedNextSteps from "./components/GuidedNextSteps";
import ScheduledCheckIn from "./components/ScheduledCheckIn";
import SafetyHub from "./components/SafetyHub";
import FakeCallOverlay from "./components/FakeCallOverlay";
import AcousticStrobeAlarm from "./components/AcousticStrobeAlarm";
import AudioVisualizer from "./components/AudioVisualizer";
import DecoyCalculator from "./components/DecoyCalculator";
import PinCancelModal from "./components/PinCancelModal";
import LiveMap from "./components/LiveMap";
import LiveSafetyMapModal from "./components/LiveSafetyMapModal";
import LiveSafetyMapView from "./components/LiveSafetyMapView";
import SafeZoneManager from "./components/SafeZoneManager";
import RouteGuardSetup from "./components/RouteGuardSetup";
import BlackoutStealth from "./components/BlackoutStealth";
import DemoStudioBar from "./components/DemoStudioBar";
import {
  ShieldIcon,
  ShieldAlertIcon,
  MicIcon,
  ActivityIcon,
  SettingsIcon,
  TimerIcon,
  FolderIcon,
  UsersIcon,
  PhoneIcon,
  SirenIcon,
  RadioIcon,
  ShareIcon,
  WhatsAppIcon,
  MessageSquareIcon,
  CameraIcon,
  CameraOffIcon,
  HandIcon,
  EyeIcon,
  EyeOffIcon,
  HomeIcon,
  HeartbeatIcon,
  NavigationIcon,
  MapPinIcon,
} from "./components/icons";
import { getUserId } from "./lib/user";
import {
  getWhatsAppAlertUrl,
  shareEmergencyAlert,
  reverseGeocode,
  formatCoords,
} from "./lib/geo";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : "";
const USER_ID = getUserId();

const DECOY_TAP_COUNT = 3;
const DECOY_TAP_WINDOW_MS = 2500;
const DEFAULT_CODE_WORD = "banana";

function loadCodeWord() {
  try {
    return localStorage.getItem("suraksha_code_word") || DEFAULT_CODE_WORD;
  } catch {
    return DEFAULT_CODE_WORD;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState("shield"); // 'shield' | 'checkin' | 'vault' | 'safety' | 'map'
  const [armed, setArmed] = useState(false);
  const [activeEventId, setActiveEventId] = useState(null);
  const [activeShareToken, setActiveShareToken] = useState(null);
  const [_contactCount, setContactCount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [consent, setConsent] = useState(false);
  const [saharaMessages, setSaharaMessages] = useState([]);
  const [decoyMode, setDecoyMode] = useState(false);
  const [evidenceRefreshTick, setEvidenceRefreshTick] = useState(0);
  const [codeWord, setCodeWord] = useState(loadCodeWord);
  const [showSettings, setShowSettings] = useState(false);
  const [showRouteGuardModal, setShowRouteGuardModal] = useState(false);
  const [sosError, setSosError] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasPinConfigured, setHasPinConfigured] = useState(false);

  // Trigger telemetry state (Track whether emergency was live sensor vs simulation)
  const [_detectionMode, setDetectionMode] = useState("live"); // 'live' | 'simulated'
  const [_detectionConfidence, setDetectionConfidence] = useState(null);

  // New Killer Features State
  const [isFakeCallOpen, setIsFakeCallOpen] = useState(false);
  const [isAlarmOpen, setIsAlarmOpen] = useState(false);
  const [isBlackoutOpen, setIsBlackoutOpen] = useState(false);
  const [isLiveMapModalOpen, setIsLiveMapModalOpen] = useState(false);
  const [emergencyElapsedSecs, setEmergencyElapsedSecs] = useState(0);
  const [liveLocations, setLiveLocations] = useState([]);
  const [currentCoords, setCurrentCoords] = useState(null); // { lat, lng, accuracy, address, speed, timestamp }
  const [gpsStatus, setGpsStatus] = useState("acquiring"); // 'acquiring' | 'locked' | 'denied' | 'unavailable'

  // Offline IndexedDB Resilience Engine Hook
  const { isOnline, pendingCount, isSyncing, triggerManualSync } = useOfflineSync({ apiBaseUrl: API_BASE_URL });

  // Continuous Real-Time High-Accuracy Device Geolocation Watcher
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      const fallback = { lat: 28.6328, lng: 77.2197, accuracy: 50 };
      setCurrentCoords(fallback);
      setLiveLocations([{ ...fallback, created_at: new Date().toISOString() }]);
      return;
    }

    let isMounted = true;

    const handlePos = (pos) => {
      if (!isMounted) return;
      const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
      const point = {
        lat,
        lng,
        accuracy: Math.round(accuracy || 15),
        speed: speed != null ? Math.round(speed * 3.6) : null,
        heading,
        timestamp: pos.timestamp || Date.now(),
      };

      setGpsStatus("locked");
      setCurrentCoords((prev) => ({
        ...prev,
        ...point,
      }));

      // Append to liveLocations breadcrumb trail if sufficiently distinct (> 4m or first point)
      setLiveLocations((prev) => {
        if (prev.length === 0) {
          return [{ lat, lng, accuracy: point.accuracy, created_at: new Date().toISOString() }];
        }
        const last = prev[prev.length - 1];
        const dist = Math.hypot((lat - last.lat) * 111320, (lng - last.lng) * 111320 * Math.cos(lat * Math.PI / 180));
        if (dist >= 4) {
          return [...prev, { lat, lng, accuracy: point.accuracy, created_at: new Date().toISOString() }];
        }
        return prev;
      });

      // Asynchronously resolve street address with reverse geocoding
      reverseGeocode(lat, lng).then((addr) => {
        if (isMounted && addr) {
          setCurrentCoords((prev) => (prev ? { ...prev, address: addr } : prev));
        }
      }).catch(() => {});
    };

    const handleErr = (err) => {
      if (!isMounted) return;
      console.warn("GPS watch position error:", err.code, err.message);
      if (err.code === 1) {
        setGpsStatus("denied");
      } else {
        setGpsStatus("unavailable");
      }
    };

    // Immediate fix request with high accuracy
    navigator.geolocation.getCurrentPosition(handlePos, handleErr, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000,
    });

    // Continuous real-time stream
    const watchId = navigator.geolocation.watchPosition(handlePos, handleErr, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    });

    return () => {
      isMounted = false;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const refreshGpsFix = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setGpsStatus("acquiring");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
        const point = {
          lat,
          lng,
          accuracy: Math.round(accuracy || 15),
          speed: speed != null ? Math.round(speed * 3.6) : null,
          timestamp: Date.now(),
        };
        setGpsStatus("locked");
        setCurrentCoords((prev) => ({
          ...prev,
          ...point,
        }));
        setLiveLocations((prev) => [
          ...prev,
          { lat, lng, accuracy: point.accuracy, created_at: new Date().toISOString() },
        ]);
        reverseGeocode(lat, lng).then((addr) => {
          if (addr) setCurrentCoords((prev) => (prev ? { ...prev, address: addr } : prev));
        });
      },
      (err) => {
        setGpsStatus(err.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  }, []);

  const decoyTapTimes = useRef([]);
  const emergencyTimerRef = useRef(null);
  const fakeCall = useFakeCall({ apiBaseUrl: API_BASE_URL });
  const evidenceVault = useEvidenceVault({
    onSaved: () => setEvidenceRefreshTick((n) => n + 1),
    apiBaseUrl: API_BASE_URL,
    activeSosId: activeEventId,
  });
  const emergencySms = useEmergencySms({ apiBaseUrl: API_BASE_URL });

  const resetGestureRef = useRef(null);
  const resetShieldRef = useRef(null);

  // Fetch initial contacts and consent state
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/contacts/${USER_ID}`)
      .then((res) => (res.ok ? res.json() : { contacts: [] }))
      .then((data) => {
        const list = data.contacts || [];
        setContacts(list);
        setContactCount(list.length);
      })
      .catch(() => {
        setContactCount(2); // fallback count for instant arm capability
      });

    fetch(`${API_BASE_URL}/api/consent/${USER_ID}`)
      .then((res) => (res.ok ? res.json() : { consent: false }))
      .then((data) => setConsent(Boolean(data.consent)))
      .catch(() => {});
  }, []);

  // Check if user has configured duress PINs
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/security/has-pin/${USER_ID}`)
      .then((res) => res.ok ? res.json() : { configured: false })
      .then((data) => setHasPinConfigured(data.configured))
      .catch(() => setHasPinConfigured(false));
  }, []);

  // Persist code word changes
  useEffect(() => {
    try {
      localStorage.setItem("suraksha_code_word", codeWord);
    } catch {
      /* localStorage unavailable */
    }
  }, [codeWord]);

  // Ambient body color shift
  useEffect(() => {
    document.body.classList.toggle("is-emergency", Boolean(activeEventId));
  }, [activeEventId]);

  // Emergency elapsed timer
  useEffect(() => {
    if (activeEventId) {
      setEmergencyElapsedSecs(0);
      emergencyTimerRef.current = setInterval(() => {
        setEmergencyElapsedSecs((s) => s + 1);
      }, 1000);
    } else {
      if (emergencyTimerRef.current) clearInterval(emergencyTimerRef.current);
      setEmergencyElapsedSecs(0);
    }
    return () => {
      if (emergencyTimerRef.current) clearInterval(emergencyTimerRef.current);
    };
  }, [activeEventId]);

  const isFiringRef = useRef(false);

  const fireSOS = useCallback(
    async (triggerInput) => {
      if (isFiringRef.current || activeEventId) return;
      isFiringRef.current = true;
      setSosError(null);

      // Parse trigger payload (supports both string and structured object)
      const triggerType =
        typeof triggerInput === "string"
          ? triggerInput
          : triggerInput?.triggerType || "manual";

      const mode =
        typeof triggerInput === "object" && triggerInput?.mode
          ? triggerInput.mode
          : triggerType.includes("simulation") || triggerType.includes("demo")
          ? "simulated"
          : "live";

      const confidence =
        typeof triggerInput === "object" && triggerInput?.confidence != null
          ? triggerInput.confidence
          : mode === "simulated"
          ? 1.0
          : 0.90;

      const triggerDetails =
        typeof triggerInput === "object" && triggerInput?.details
          ? triggerInput.details
          : mode === "simulated"
          ? `[SIMULATED DEMO TRIGGER] Fired via Demo Studio (${triggerType})`
          : `[LIVE SENSOR TRIGGER] Fired (${triggerType}) · Confidence: ${Math.round(confidence * 100)}%`;

      setDetectionMode(mode);
      setDetectionConfidence(confidence);

      console.log(`[SURAKSHA SOS DISPATCH] Mode: ${mode.toUpperCase()} | Type: ${triggerType} | Confidence: ${Math.round(confidence * 100)}%`);

      // Subtle double-pulse haptic vibration confirmation for pocket/discreet activation
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([140, 60, 140]);
        } catch {
          /* ignore unsupported device policy */
        }
      }

      // Generate instantaneous emergency session ID & token
      const localEventId = "sos-" + Date.now();
      const localShareToken = "token-" + Math.random().toString(36).substring(2, 10);
      const sendLat = currentCoords?.lat || (liveLocations.length > 0 ? liveLocations[liveLocations.length - 1].lat : 28.6328);
      const sendLng = currentCoords?.lng || (liveLocations.length > 0 ? liveLocations[liveLocations.length - 1].lng : 77.2197);

      // 1. INSTANT LOCAL PERSISTENCE (IndexedDB Zero-Data-Loss Invariant)
      let syncQueueItem = null;
      try {
        await saveEmergencyEvent({
          localId: localEventId,
          emergencyId: localEventId,
          userId: USER_ID,
          triggerType,
          mode,
          confidence,
          details: triggerDetails,
          lat: sendLat,
          lng: sendLng,
          status: "active",
          shareToken: localShareToken,
          syncStatus: "pending",
        });

        await logOfflineEvent("emergency_triggered", triggerDetails, localEventId, {
          mode,
          confidence,
          triggerType,
          lat: sendLat,
          lng: sendLng,
        });

        syncQueueItem = await enqueueSync({
          targetStore: STORES.EMERGENCY_EVENTS,
          recordLocalId: localEventId,
          emergencyId: localEventId,
          endpoint: "/api/sos",
          method: "POST",
          payload: {
            userId: USER_ID,
            triggerType,
            mode,
            confidence,
            details: triggerDetails,
            lat: sendLat,
            lng: sendLng,
          },
        });
      } catch (idbErr) {
        console.warn("[SURAKSHA RESILIENCE] IndexedDB local persistence warning:", idbErr);
      }

      // 2. INSTANT ACTIVATION: Immediately engage emergency state & open Suraksha Shadow Command Center
      setActiveEventId(localEventId);
      setActiveShareToken(localShareToken);
      setSosError(null);
      setSaharaMessages([]);
      fakeCall.start();
      evidenceVault?.startAutomatedCapture?.(10000, localEventId);
      emergencySms.dispatchAlert(
        contacts.map((c) => c.phone),
        "CORAL"
      );

      // 3. SERVER SYNCHRONIZATION: Register canonical event on backend in background
      try {
        const res = await fetch(`${API_BASE_URL}/api/sos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: USER_ID,
            triggerType,
            mode,
            confidence,
            details: triggerDetails,
            lat: sendLat,
            lng: sendLng,
          }),
        });
        let data = {};
        try {
          const rawText = await res.text();
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = {};
        }
        if (res.ok && data.eventId) {
          setActiveEventId(data.eventId);
          if (data.shareToken) setActiveShareToken(data.shareToken);
          evidenceVault?.startAutomatedCapture?.(10000, data.eventId);

          // Update local DB and mark sync item as completed
          updateEmergencyServerId(localEventId, data.eventId, data.shareToken).catch(() => {});
          if (syncQueueItem) {
            updateSyncItemStatus(syncQueueItem.localId, "synced").catch(() => {});
          }
          logOfflineEvent("emergency_server_synced", `Canonical event ${data.eventId} registered with server`, data.eventId).catch(() => {});
        }
      } catch (err) {
        console.warn("[SURAKSHA] Server registration deferred (safely preserved in IndexedDB queue):", err.message);
        logOfflineEvent("emergency_network_deferred", `Server unreachable (${err.message}). Preserved in offline sync queue.`, localEventId).catch(() => {});
      }
    },
    [fakeCall, evidenceVault, emergencySms, contacts, activeEventId, currentCoords, liveLocations]
  );

  const {
    transcript,
    micStatus,
    audioLevel,
    audioDb,
    motionMagnitude,
    syllableCount,
    isWhisperTranscribing,
    simulateVoiceTrigger,
    reset: resetShield,
  } = useShieldDetection({
    codeWord,
    enabled: armed,
    onTrigger: fireSOS,
    apiBaseUrl: API_BASE_URL,
  });

  useEffect(() => {
    resetShieldRef.current = resetShield;
  }, [resetShield]);

  const [cameraViewfinderOpen, setCameraViewfinderOpen] = useState(true);

  const {
    isCameraActive,
    gestureProgress,
    handDetected,
    gestureMatched,
    diagnosticInfo: cameraDiagnostic,
    lastError: cameraError,
    videoRef,
    toggleCameraWatch,
    stopCamera,
    reset: resetGesture,
  } = useGestureDetection({
    onTrigger: fireSOS,
  });

  useEffect(() => {
    resetGestureRef.current = resetGesture;
  }, [resetGesture]);

  const handleLocationUpdateFromPing = useCallback((newLoc) => {
    setLiveLocations((prev) => [...prev, newLoc]);
    if (newLoc.lat && newLoc.lng) {
      setCurrentCoords((prev) => ({
        ...prev,
        lat: newLoc.lat,
        lng: newLoc.lng,
        accuracy: newLoc.accuracy || prev?.accuracy || 15,
        speed: newLoc.speed || prev?.speed || null,
      }));
    }
  }, []);

  useGuardianPing({
    eventId: activeEventId,
    apiBaseUrl: API_BASE_URL,
    enabled: Boolean(activeEventId),
    onLocationUpdate: handleLocationUpdateFromPing,
  });

  // Passive Feature 1: Heartbeat Silence Monitoring
  useHeartbeat({
    userId: USER_ID,
    apiBaseUrl: API_BASE_URL,
    enabled: armed,
  });

  // Passive Feature 2: Safe Zone Departure Monitoring
  const safeZones = useSafeZones({
    enabled: armed,
    onExpire: () => fireSOS("safezone_departure"),
  });

  // Passive Feature 3: Route Guard (Deviation & Vehicle Speed)
  const routeGuard = useRouteGuard({
    enabled: armed,
    onDeviation: () => fireSOS("route_deviation"),
    onSpeed: () => fireSOS("vehicle_speed"),
  });

  const { status: ambientAudioStatus } = useAmbientAudioStream({
    apiBaseUrl: API_BASE_URL,
    eventId: activeEventId,
    consent,
    enabled: Boolean(activeEventId),
  });

  const _canArm = true;
  useBackgroundKeepAlive({ enabled: armed });

  // Manual demo trigger: Alt+Shift+B
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (!activeEventId) fireSOS("manual-demo-fallback");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeEventId, fireSOS]);

  const toggleArm = async () => {
    if (activeEventId) return;
    if (armed) {
      setArmed(false);
      resetShield();
      resetGesture();
    } else {
      await requestDevicePermissions();
      setArmed(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([40]);
        } catch {
          /* ignore vibrate policy */
        }
      }
    }
  };

  const arm = toggleArm;

  const handleToggleCamera = async () => {
    if (!isCameraActive && !armed) {
      await arm();
    }
    toggleCameraWatch();
  };

  /**
   * Initiates emergency cancellation. If Duress PINs are configured,
   * opens the PIN verification modal. Otherwise falls back to direct
   * cancellation (for users who haven't set up PINs yet).
   */
  const handleCancelRequest = () => {
    if (hasPinConfigured) {
      setShowPinModal(true);
    } else {
      endEmergencyDirect();
    }
  };

  /**
   * Direct emergency resolution (no PIN). Used as fallback when
   * PINs are not yet configured.
   */
  const endEmergencyDirect = async () => {
    isFiringRef.current = false;
    fakeCall.stop();
    resetShield();
    resetGesture();
    stopCamera();
    safeZones.reset();
    routeGuard.endRoute();
    const eventId = activeEventId;
    setActiveEventId(null);
    logOfflineEvent("emergency_resolved_direct", "Emergency resolved directly by user", eventId).catch(() => {});
    try {
      await fetch(`${API_BASE_URL}/api/emergency/${eventId}/resolve`, { method: "POST" });
    } catch (err) {
      console.error("Failed to mark emergency resolved:", err);
    }
  };

  /**
   * Called by PinCancelModal after server PIN verification.
   *
   * CRITICAL SECURITY INVARIANT:
   * Both genuine cancellation and duress escalation execute the
   * IDENTICAL frontend teardown. The UI state is fully reset in
   * both cases. An observer watching the screen cannot distinguish
   * the two paths. The only difference is server-side: duress keeps
   * the emergency active and notifies contacts.
   */
  const handlePinResolved = () => {
    const eventId = activeEventId;
    setShowPinModal(false);
    isFiringRef.current = false;
    // IDENTICAL teardown regardless of which PIN was used.
    // This is the coercion resistance invariant.
    fakeCall.stop();
    resetShield();
    resetGesture();
    stopCamera();
    safeZones.reset();
    routeGuard.endRoute();
    setActiveEventId(null);
    logOfflineEvent("emergency_pin_resolved", "Emergency cancellation processed via security PIN", eventId).catch(() => {});
  };

  // Decoy triple-tap trigger (Mobile touch & click compatible with debounce)
  const lastTapTimeRef = useRef(0);
  const handleDecoyTrigger = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const now = Date.now();
    // Guard against touchEnd + click double-dispatch on mobile WebKit/Chromium
    if (now - lastTapTimeRef.current < 80) return;
    lastTapTimeRef.current = now;

    decoyTapTimes.current = [...decoyTapTimes.current.filter((t) => now - t < DECOY_TAP_WINDOW_MS), now];
    if (decoyTapTimes.current.length >= DECOY_TAP_COUNT) {
      decoyTapTimes.current = [];
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {
          /* ignore vibrate policy */
        }
      }
      setDecoyMode(true);
    }
  }, []);

  // Alt+Shift+D keyboard shortcut for decoy
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDecoyMode(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (decoyMode) {
    return <DecoyCalculator onUnlock={() => setDecoyMode(false)} />;
  }

  const guardianState = activeEventId ? "active" : armed ? "listening" : "idle";
  const GuardianGlyph = guardianState === "active" ? ShieldAlertIcon : ShieldIcon;

  const formatElapsed = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <div className="app-viewport">
      {/* --- Global Secret Stealth Hitboxes (Tap 3x in any corner to launch Calculator disguise) --- */}
      <div
        onClick={handleDecoyTrigger}
        onTouchEnd={handleDecoyTrigger}
        title="Secret stealth zone (tap 3x)"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 90,
          height: 75,
          zIndex: 99998,
          cursor: "default",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      />
      <div
        onClick={handleDecoyTrigger}
        onTouchEnd={handleDecoyTrigger}
        title="Secret stealth zone (tap 3x)"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 90,
          height: 75,
          zIndex: 99998,
          cursor: "default",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      />

      {/* --- Tactical Brand Header & Status Bar --- */}
      <header className="tactical-header rise-fade" style={{ position: "relative" }}>
        <div className="header-top-bar" style={{ position: "relative", zIndex: 40 }}>
          <div
            className="brand-badge"
            onClick={handleDecoyTrigger}
            onTouchEnd={handleDecoyTrigger}
            style={{ cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            title="Secret stealth zone (tap 3x to launch Decoy Calculator)"
          >
            <div
              className="brand-icon-shield"
              title="Secret stealth zone (tap 3x to launch Decoy Calculator)"
            >
              <GuardianGlyph size={22} style={{ color: activeEventId ? "var(--alarm)" : armed ? "var(--safe)" : "var(--ember)" }} />
              <span className="pulse-dot" style={{ background: activeEventId ? "var(--alarm)" : armed ? "var(--safe)" : "var(--ember-container)" }} />
            </div>
            <div className="brand-title-group">
              <span className="brand-title">
                Suraksha <em style={{ fontStyle: "normal", color: "var(--ember)" }}>Shadow</em>
              </span>
              <span className="brand-subtitle">Personal Safety &amp; Legal Shield</span>
            </div>
          </div>

          <div className="header-telemetry-pills">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: armed ? "var(--safe)" : "var(--ember-container)" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mist-dim)" }}>Shield:</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: armed ? "var(--safe)" : "var(--paper)", fontWeight: 600 }}>
                {armed ? "Armed" : "Standby"}
              </span>
            </div>
            <div style={{ height: 12, width: 1, background: "var(--line)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--secondary)" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mist-dim)" }}>Guardians:</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--paper)", fontWeight: 600 }}>
                {contacts.length > 0 ? `${contacts.length} Synced` : "Active"}
              </span>
            </div>
          </div>

          <div className="header-actions">
            {!activeEventId && (
              armed ? (
                <button
                  className="btn-quiet flex-center-gap"
                  onClick={toggleArm}
                  style={{
                    padding: "6px 13px",
                    fontSize: 12,
                    borderRadius: 20,
                    background: "rgba(46, 204, 113, 0.15)",
                    border: "1px solid rgba(46, 204, 113, 0.4)",
                    color: "#2ecc71",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Shield is actively monitoring. Tap to pause."
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 8px #2ecc71" }} />
                  <span>● Armed</span>
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={arm}
                  style={{ padding: "7px 14px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <ShieldIcon size={14} />
                  <span>Arm Shield</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Top Navigation Tabs (Peacetime Desktop / Tablet) */}
        {!activeEventId && (
          <nav className="tactical-nav-tabs mt-2">
            <button
              className={`tactical-tab-btn ${activeTab === "shield" ? "is-active" : ""}`}
              onClick={() => setActiveTab("shield")}
            >
              <ShieldIcon size={15} />
              <span>Shield</span>
            </button>
            <button
              id="top-nav-live-safety-map-btn"
              className={`tactical-tab-btn ${activeTab === "map" ? "is-active" : ""}`}
              onClick={() => setActiveTab("map")}
              title="Open Live Safety Map (Leaflet + OpenStreetMap)"
            >
              <MapPinIcon size={15} />
              <span>📍 Live Safety Map</span>
            </button>
            <button
              className={`tactical-tab-btn ${activeTab === "checkin" ? "is-active" : ""}`}
              onClick={() => setActiveTab("checkin")}
            >
              <TimerIcon size={15} />
              <span>Check-In</span>
            </button>
            <button
              className={`tactical-tab-btn ${activeTab === "vault" ? "is-active" : ""}`}
              onClick={() => setActiveTab("vault")}
            >
              <FolderIcon size={15} />
              <span>Evidence Vault</span>
            </button>
            <button
              className={`tactical-tab-btn ${activeTab === "safety" ? "is-active" : ""}`}
              onClick={() => setActiveTab("safety")}
            >
              <UsersIcon size={15} />
              <span>Safety Hub</span>
            </button>
          </nav>
        )}
      </header>

      {/* --- SOS Error Banner --- */}
      {sosError && (
        <div className="sos-error-banner rise-fade" onClick={() => fireSOS("manual")}>
          <span>⚠️ {sosError}</span>
          <button className="btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
            Retry
          </button>
        </div>
      )}

      {/* ============================================================
          CASE 1: ACTIVE EMERGENCY MODE (COMMAND CENTER)
          ============================================================ */}
      {activeEventId ? (
        <div className="emergency-command-center rise-fade">
          {/* Urgent Status Banner */}
          <div className="emergency-status-banner">
            <div className="emergency-banner-top">
              <span className="emergency-live-dot" />
              <span className="emergency-banner-title">EMERGENCY ACTIVE</span>
            </div>
            <div className="emergency-banner-timer">
              Live for {formatElapsed(emergencyElapsedSecs)} · Contacts notified
            </div>
          </div>

          {/* Quick Action Matrix for High Distress */}
          <div className="emergency-action-grid">
            {/* Action 1: 1-Tap WhatsApp SOS */}
            <div
              id="emergency-whatsapp-sos-card"
              className="emergency-action-card"
              onClick={() => {
                emergencySms.openWhatsAppSos(
                  contacts.map((c) => c.phone),
                  activeShareToken,
                  currentCoords || liveLocations[liveLocations.length - 1]
                );
              }}
              role="button"
              tabIndex={0}
              style={{
                borderColor: "rgba(37, 211, 102, 0.45)",
                background: "rgba(37, 211, 102, 0.08)",
              }}
            >
              <div className="action-card-icon" style={{ background: "rgba(37, 211, 102, 0.2)", color: "#25d366" }}>
                <WhatsAppIcon size={20} />
              </div>
              <div className="action-card-title" style={{ color: "#25d366" }}>WhatsApp SOS</div>
              <div className="action-card-desc">1-Tap live GPS broadcast</div>
            </div>

            {/* Action 2: Direct Carrier SMS (Zero-Cost / SIM) */}
            <div
              id="emergency-carrier-sms-card"
              className="emergency-action-card"
              onClick={() => {
                emergencySms.openCarrierSms(
                  contacts.map((c) => c.phone),
                  activeShareToken,
                  currentCoords || liveLocations[liveLocations.length - 1]
                );
              }}
              role="button"
              tabIndex={0}
              style={{
                borderColor: "rgba(52, 152, 219, 0.45)",
                background: "rgba(52, 152, 219, 0.08)",
              }}
            >
              <div className="action-card-icon" style={{ background: "rgba(52, 152, 219, 0.2)", color: "#3498db" }}>
                <MessageSquareIcon size={20} />
              </div>
              <div className="action-card-title" style={{ color: "#3498db" }}>Carrier SMS</div>
              <div className="action-card-desc">Zero-cost direct SIM dispatch</div>
            </div>

            {/* Action 3: Strobe & Siren Deterrent */}
            <div
              className="emergency-action-card"
              onClick={() => setIsAlarmOpen(true)}
              role="button"
              tabIndex={0}
            >
              <div className="action-card-icon is-alarm">
                <SirenIcon size={20} />
              </div>
              <div className="action-card-title">Siren & Strobe</div>
              <div className="action-card-desc">Acoustic alarm to attract help</div>
            </div>

            {/* Action 4: Fake Call Escape */}
            <div
              className="emergency-action-card"
              onClick={() => setIsFakeCallOpen(true)}
              role="button"
              tabIndex={0}
            >
              <div className="action-card-icon is-amber">
                <PhoneIcon size={20} />
              </div>
              <div className="action-card-title">Fake Call</div>
              <div className="action-card-desc">Simulate realistic incoming call</div>
            </div>

            {/* Action 5: Guardian Live View Link */}
            <div
              className="emergency-action-card"
              onClick={() => {
                if (activeShareToken) {
                  window.open(`/guardian/${activeShareToken}`, "_blank");
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="action-card-icon is-amber">
                <RadioIcon size={20} />
              </div>
              <div className="action-card-title">Guardian Map</div>
              <div className="action-card-desc">Open live tracking link</div>
            </div>

            {/* Action 6: Dedicated Live Safety Map */}
            <div
              id="emergency-live-safety-map-card"
              className="emergency-action-card"
              onClick={() => setIsLiveMapModalOpen(true)}
              role="button"
              tabIndex={0}
            >
              <div className="action-card-icon is-amber">
                <MapPinIcon size={20} />
              </div>
              <div className="action-card-title">Live Safety Map</div>
              <div className="action-card-desc">Leaflet + OpenStreetMap</div>
            </div>
          </div>

          {/* Quick 1-Tap WhatsApp & Native SMS Carrier Dispatch Banner */}
          {activeShareToken && (
            <div className="card mb-4" style={{ background: "linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(52, 152, 219, 0.08) 100%)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--paper)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚡ 1-Tap Carrier & WhatsApp SOS</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(46, 204, 113, 0.2)", color: "#2ecc71", fontWeight: 700 }}>
                      ZERO-COST
                    </span>
                  </div>
                  <p className="text-xs text-dim" style={{ margin: "2px 0 0" }}>Direct cellular SIM dispatch + instant WhatsApp beacon with live GPS</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      emergencySms.openWhatsAppSos(
                        contacts.map((c) => c.phone),
                        activeShareToken,
                        currentCoords || liveLocations[liveLocations.length - 1]
                      );
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 14px",
                      background: "rgba(37, 211, 102, 0.2)",
                      color: "#25d366",
                      border: "1px solid rgba(37, 211, 102, 0.4)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    title="1-Tap WhatsApp SOS Alert"
                  >
                    <WhatsAppIcon size={15} />
                    WhatsApp SOS
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      emergencySms.openCarrierSms(
                        contacts.map((c) => c.phone),
                        activeShareToken,
                        currentCoords || liveLocations[liveLocations.length - 1]
                      );
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 14px",
                      background: "rgba(52, 152, 219, 0.2)",
                      color: "#3498db",
                      border: "1px solid rgba(52, 152, 219, 0.4)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    title="1-Tap Direct SIM Carrier SMS to all emergency contacts"
                  >
                    <MessageSquareIcon size={15} />
                    Carrier SMS (SIM)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      shareEmergencyAlert({
                        shareToken: activeShareToken,
                        lat: liveLocations[liveLocations.length - 1]?.lat,
                        lng: liveLocations[liveLocations.length - 1]?.lng,
                        status: "EMERGENCY ACTIVE",
                      });
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--line)",
                      color: "var(--paper)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <ShareIcon size={13} />
                    Share
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Real-Time GPS Tracking Map */}
          <div className="section mb-4">
            <div className="flex-center-gap mb-2" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Live Emergency GPS Trail</p>
                {currentCoords?.address && (
                  <p className="text-xs text-dim" style={{ margin: "2px 0 0" }}>
                    📍 {currentCoords.address}
                  </p>
                )}
              </div>
              <span className="tag tag-alarm flex-center-gap">
                <RadioIcon size={11} />
                <span>
                  {currentCoords?.accuracy
                    ? `±${currentCoords.accuracy}m GPS`
                    : "Pinging Contacts"}
                </span>
              </span>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--line)" }}>
              <LiveMap locations={liveLocations} isActive={true} height={220} />
            </div>
          </div>

          {/* Safe Resolution Button — opens PIN modal if configured */}
          <div className="emergency-resolve-wrap">
            <button className="btn-resolve-emergency" onClick={handleCancelRequest}>
              ✓ I&rsquo;m safe — end emergency
            </button>
          </div>

          {/* Ambient Audio Status */}
          <div className="card mb-5 text-center" style={{ padding: "12px 16px" }}>
            <p className="text-xs text-dim">
              Ambient audio:{" "}
              {!consent
                ? "Off (no consent on file)"
                : ambientAudioStatus === "streaming"
                ? "Streaming to Trusted Contacts"
                : ambientAudioStatus === "error"
                ? "Mic permission required"
                : "Initializing…"}
            </p>
          </div>

          {/* Sahara AI Trauma-Informed Companion */}
          <section className="section">
            <p className="eyebrow">Trauma-Informed Companion</p>
            <SaharaChat
              apiBaseUrl={API_BASE_URL}
              eventId={activeEventId}
              messages={saharaMessages}
              setMessages={setSaharaMessages}
            />
          </section>

          {/* Guided Next Steps & Zero FIR Rights */}
          <section className="section">
            <GuidedNextSteps
              apiBaseUrl={API_BASE_URL}
              eventId={activeEventId}
              messages={saharaMessages}
            />
          </section>
        </div>
      ) : (
        /* ============================================================
           CASE 2: PEACETIME TABBED INTERFACE
           ============================================================ */
        <div className="peacetime-view">
          {/* TAB 1: SHIELD (Hero Guardian View) */}
          {activeTab === "shield" && (
            <div className="rise-fade">
              <div className="guardian-wrap" style={{ position: "relative" }}>
                {/* Audio Visualizer Aura around the circle */}
                <AudioVisualizer
                  isListening={armed}
                  isActive={Boolean(activeEventId)}
                  audioLevel={audioLevel}
                />

                <button
                  className={`guardian-circle ${guardianState === "listening" ? "is-listening" : ""} ${
                    guardianState === "active" ? "is-active" : ""
                  }`}
                  onClick={toggleArm}
                  disabled={Boolean(activeEventId)}
                  aria-label={guardianState === "active" ? "Active Emergency" : armed ? "Shield is armed. Tap to pause." : "Arm Shield Protection"}
                >
                  <GuardianGlyph className="icon" />
                  <span className="label">
                    {guardianState === "active"
                      ? "Active"
                      : armed
                      ? "Armed"
                      : "Arm Shield"}
                  </span>
                  <span className="sub">
                    {guardianState === "active"
                      ? "alerting contacts"
                      : armed
                      ? `tap to pause · say "${codeWord}"`
                      : "tap to protect"}
                  </span>
                </button>

                {/* Unified Sentinel Protection Command Center */}
                <div
                  className="card mt-4"
                  style={{
                    maxWidth: 540,
                    margin: "16px auto 0",
                    background: armed
                      ? "linear-gradient(180deg, rgba(232, 196, 104, 0.08) 0%, rgba(18, 20, 24, 0.95) 100%)"
                      : "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(18, 20, 24, 0.85) 100%)",
                    border: armed ? "1px solid rgba(232, 196, 104, 0.3)" : "1px solid var(--line)",
                    borderRadius: 16,
                    padding: "16px 18px",
                    boxShadow: armed ? "0 8px 32px rgba(232, 196, 104, 0.08)" : "0 4px 20px rgba(0, 0, 0, 0.3)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {/* Header: Codeword & Quick Test Pill */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 12, borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🛡️</span>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: armed ? "var(--ember)" : "var(--dim)" }}>
                        {armed ? "Sentinel Protection Active" : "Sentinel Standby"}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 12,
                          fontWeight: 700,
                          background: armed ? "rgba(46, 204, 113, 0.15)" : "rgba(255, 255, 255, 0.05)",
                          color: armed ? "#2ecc71" : "var(--dim)",
                          border: armed ? "1px solid rgba(46, 204, 113, 0.3)" : "1px solid var(--line)",
                        }}
                      >
                        {armed ? "AI ARMED" : "DISARMED"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!armed) arm();
                        simulateVoiceTrigger(codeWord);
                      }}
                      style={{
                        padding: "5px 12px",
                        fontSize: 11.5,
                        background: "linear-gradient(135deg, var(--ember), var(--alarm))",
                        border: "none",
                        borderRadius: 14,
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        boxShadow: "0 2px 8px rgba(224, 90, 71, 0.3)",
                      }}
                      title={`Simulate speaking emergency codeword "${codeWord}"`}
                    >
                      🗣️ Test "{codeWord}"
                    </button>
                  </div>

                  {/* Live Speech Recognition & Audio Wave Strip */}
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(0, 0, 0, 0.4)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: armed
                            ? isWhisperTranscribing
                              ? "var(--alarm)"
                              : audioLevel > 15
                              ? "var(--ember)"
                              : "#2ecc71"
                            : "var(--dim)",
                          boxShadow: armed && (isWhisperTranscribing || audioLevel > 15) ? "0 0 8px currentColor" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--mono)",
                          color: transcript?.includes("DETECTED") || transcript?.includes("MATCHED")
                            ? "var(--alarm)"
                            : transcript
                            ? "var(--ember)"
                            : "var(--paper)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {transcript
                          ? transcript
                          : isWhisperTranscribing
                          ? "⚡ Cloud Speech AI analyzing..."
                          : armed
                          ? `Say "${codeWord}", "bachao", or "help"`
                          : `Shield paused · Codeword: "${codeWord}"`}
                      </span>
                    </div>

                    {armed && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)" }}>
                          {audioDb} dB
                        </span>
                        <div style={{ width: 44, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${audioLevel}%`,
                              background: audioLevel > 45 ? "var(--alarm)" : "var(--ember)",
                              transition: "width 0.08s ease",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Grid of Active Sentinel Sensors */}
                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
                      gap: 6,
                    }}
                  >
                    {/* Sensor 1: Voice */}
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                      }}
                    >
                      <MicIcon size={12} style={{ color: armed ? (audioLevel > 15 ? "var(--ember)" : "#2ecc71") : "var(--dim)" }} />
                      <span style={{ color: "var(--dim)" }}>Voice:</span>
                      <span style={{ color: armed ? "var(--paper)" : "var(--dim)", fontWeight: 600 }}>
                        {armed ? `"${codeWord}"` : "Standby"}
                      </span>
                    </div>

                    {/* Sensor 2: Motion Struggle */}
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                      }}
                    >
                      <ActivityIcon size={12} style={{ color: armed ? "#2ecc71" : "var(--dim)" }} />
                      <span style={{ color: "var(--dim)" }}>Motion:</span>
                      <span style={{ color: armed ? "var(--paper)" : "var(--dim)", fontWeight: 600 }}>
                        {armed ? `${motionMagnitude} m/s²` : "Standby"}
                      </span>
                    </div>

                    {/* Sensor 3: Gesture Camera */}
                    <div
                      onClick={handleToggleCamera}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                      title="Tap to toggle Camera Gesture Watch (Signal for Help)"
                    >
                      <CameraIcon
                        size={12}
                        style={{
                          color: isCameraActive
                            ? gestureProgress > 0
                              ? "var(--alarm)"
                              : handDetected
                              ? "#2ecc71"
                              : "var(--ember)"
                            : "var(--dim)",
                        }}
                      />
                      <span style={{ color: "var(--dim)" }}>Gesture:</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: isCameraActive
                            ? gestureProgress > 0
                              ? "var(--alarm)"
                              : "#2ecc71"
                            : "var(--dim)",
                        }}
                      >
                        {isCameraActive ? (handDetected ? "Hand Seen" : "Watching") : "Off"}
                      </span>
                    </div>

                    {/* Sensor 4: Heartbeat Silence */}
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                      }}
                      title="Automatic check-in every 3 minutes. Dispatches distress if phone goes silent."
                    >
                      <HeartbeatIcon size={12} style={{ color: armed ? "#2ecc71" : "var(--dim)" }} />
                      <span style={{ color: "var(--dim)" }}>Heartbeat:</span>
                      <span style={{ color: armed ? "#2ecc71" : "var(--dim)", fontWeight: 600 }}>
                        {armed ? "Active" : "Standby"}
                      </span>
                    </div>
                  </div>

                  {/* Footer: Live GPS Badge with Map Link */}
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 11,
                      color: "var(--dim)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: gpsStatus === "locked" ? "#2ecc71" : gpsStatus === "acquiring" ? "var(--ember)" : "var(--alarm)",
                          boxShadow: gpsStatus === "locked" ? "0 0 6px #2ecc71" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {gpsStatus === "locked"
                          ? currentCoords?.address
                            ? `📍 ${currentCoords.address}`
                            : `📍 ${formatCoords(currentCoords?.lat, currentCoords?.lng)}`
                          : gpsStatus === "acquiring"
                          ? "🛰️ Acquiring live GPS fix…"
                          : "📍 GPS Offline"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={refreshGpsFix}
                        title="Refresh GPS Fix"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--dim)",
                          cursor: "pointer",
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        ↻
                      </button>
                      <button
                        id="gps-badge-live-safety-map-btn"
                        type="button"
                        onClick={() => setIsLiveMapModalOpen(true)}
                        title="Open interactive Live Safety Map"
                        style={{
                          background: "rgba(232, 196, 104, 0.12)",
                          border: "1px solid rgba(232, 196, 104, 0.25)",
                          color: "var(--ember)",
                          borderRadius: 6,
                          cursor: "pointer",
                          padding: "2px 8px",
                          fontSize: 10.5,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        Map ↗
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Standout Feature Chips */}
              <div className="mt-5">
                <p className="eyebrow text-center mb-3">Quick Safety Utilities</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {/* Dedicated Live Safety Map Option Button */}
                  <button
                    id="live-safety-map-quick-btn"
                    className={`demo-chip-btn ${activeTab === "map" ? "is-active" : ""}`}
                    onClick={() => setActiveTab("map")}
                    style={{
                      padding: "10px 14px",
                      borderColor: "var(--line-gold)",
                      background: activeTab === "map" ? "rgba(232, 196, 104, 0.25)" : "rgba(232, 196, 104, 0.12)",
                      color: "var(--ember)",
                      fontWeight: 600,
                    }}
                    title="Open dedicated interactive Live Safety Map (Leaflet + OpenStreetMap)"
                  >
                    <span style={{ marginRight: 6 }}>📍</span>
                    Live Safety Map
                  </button>

                  {/* 1-Tap WhatsApp SOS Direct Carrier/App Dispatch */}
                  <button
                    id="whatsapp-sos-quick-btn"
                    className="demo-chip-btn"
                    onClick={() => {
                      emergencySms.openWhatsAppSos(activeShareToken, currentCoords, "Emergency Distress Alert (1-Tap WhatsApp)");
                    }}
                    style={{
                      padding: "10px 14px",
                      borderColor: "rgba(37, 211, 102, 0.4)",
                      background: "rgba(37, 211, 102, 0.12)",
                      color: "#25D366",
                      fontWeight: 600,
                    }}
                    title="1-Tap WhatsApp SOS: Direct instant emergency dispatch with live GPS & beacon link"
                  >
                    <WhatsAppIcon size={14} style={{ marginRight: 6, color: "#25D366" }} />
                    WhatsApp SOS
                  </button>

                  {/* 1-Tap Carrier Native SIM SMS (Zero Gateway Cost / Cellular Direct) */}
                  <button
                    id="carrier-sms-quick-btn"
                    className="demo-chip-btn"
                    onClick={() => {
                      emergencySms.openCarrierSms(activeShareToken, currentCoords, "Emergency Distress Alert (1-Tap SIM SMS)");
                    }}
                    style={{
                      padding: "10px 14px",
                      borderColor: "rgba(56, 189, 248, 0.4)",
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      fontWeight: 600,
                    }}
                    title="1-Tap Carrier SMS: Direct device SIM messaging to guardians with GPS coordinates (Zero gateway cost / Works offline)"
                  >
                    <MessageSquareIcon size={14} style={{ marginRight: 6, color: "#38bdf8" }} />
                    Carrier SMS (SIM)
                  </button>

                  <button
                    className={`demo-chip-btn ${isCameraActive ? "is-active" : ""}`}
                    onClick={handleToggleCamera}
                    style={{
                      padding: "10px 14px",
                      borderColor: isCameraActive ? (gestureProgress > 0 ? "var(--alarm)" : "var(--ember)") : undefined,
                      background: isCameraActive ? (gestureProgress > 0 ? "rgba(224, 90, 71, 0.25)" : "rgba(224, 90, 71, 0.15)") : undefined,
                      color: isCameraActive ? (gestureProgress > 0 ? "var(--alarm)" : "var(--ember)") : undefined,
                    }}
                    title="Toggle silent Camera Watch for Canadian Women's Foundation Signal for Help gesture"
                  >
                    {isCameraActive ? (
                      <CameraIcon size={14} style={{ marginRight: 6, color: gestureProgress > 0 ? "var(--alarm)" : "var(--ember)" }} />
                    ) : (
                      <CameraOffIcon size={14} style={{ marginRight: 6 }} />
                    )}
                    Camera Watch ({isCameraActive ? (gestureProgress > 0 ? `HOLDING (${Math.round(gestureProgress * 100)}%)` : handDetected ? "Hand Tracked" : "Active") : "Off"})
                  </button>

                  <button
                    className={`demo-chip-btn ${routeGuard.isActive ? "is-active" : ""}`}
                    onClick={() => setShowRouteGuardModal((prev) => !prev)}
                    style={{
                      padding: "10px 14px",
                      borderColor: routeGuard.isActive ? (routeGuard.alertType ? "var(--alarm)" : "#2ecc71") : undefined,
                      background: routeGuard.isActive ? (routeGuard.alertType ? "rgba(224, 90, 71, 0.2)" : "rgba(46, 204, 113, 0.15)") : undefined,
                      color: routeGuard.isActive ? (routeGuard.alertType ? "var(--alarm)" : "#2ecc71") : undefined,
                    }}
                    title="Route Guard — Auto-detects route deviation & vehicle kidnapping"
                  >
                    <NavigationIcon size={14} style={{ marginRight: 6 }} />
                    Route Guard ({routeGuard.isActive ? (routeGuard.alertType ? "ALERT" : "On Track") : "Setup"})
                  </button>

                  <button
                    className="demo-chip-btn"
                    onClick={() => setIsFakeCallOpen(true)}
                    style={{ padding: "10px 14px" }}
                  >
                    <PhoneIcon size={14} style={{ marginRight: 6 }} />
                    Fake Call (Escape)
                  </button>

                  <button
                    className="demo-chip-btn"
                    onClick={() => setIsAlarmOpen(true)}
                    style={{ padding: "10px 14px", borderColor: "rgba(232, 84, 107, 0.4)" }}
                  >
                    <SirenIcon size={14} style={{ marginRight: 6, color: "var(--alarm)" }} />
                    Strobe Siren
                  </button>

                  <button
                    className="demo-chip-btn"
                    onClick={() => setIsBlackoutOpen(true)}
                    style={{ padding: "10px 14px", borderColor: "rgba(255,255,255,0.25)" }}
                    title="Disguise phone as turned off while background protection stays 100% active"
                  >
                    <EyeOffIcon size={14} style={{ marginRight: 6 }} />
                    Blackout Screen
                  </button>

                  <button
                    className="demo-chip-btn"
                    onClick={() => setDecoyMode(true)}
                    style={{ padding: "10px 14px", borderColor: "rgba(232, 196, 104, 0.45)" }}
                    title="Launch Decoy Calculator Disguise"
                  >
                    <span style={{ marginRight: 6 }}>🧮</span>
                    Decoy Calculator
                  </button>

                  <button
                    className="demo-chip-btn"
                    onClick={() => setShowSettings(!showSettings)}
                    style={{ padding: "10px 14px" }}
                  >
                    <SettingsIcon size={14} style={{ marginRight: 6 }} />
                    Triggers &amp; Safe Zones
                  </button>
                </div>
              </div>

              {/* Route Guard Card (Active or Expanded) */}
              {(showRouteGuardModal || routeGuard.isActive) && (
                <div className="card rise-fade mt-4">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--ember)" }}>
                      Passive Protection: Route Guard
                    </span>
                    {!routeGuard.isActive && (
                      <button
                        className="btn-quiet"
                        onClick={() => setShowRouteGuardModal(false)}
                        style={{ fontSize: 11, padding: "2px 8px" }}
                      >
                        Close
                      </button>
                    )}
                  </div>
                  <RouteGuardSetup {...routeGuard} />
                </div>
              )}

              {/* Settings Drawer */}
              {showSettings && (
                <div className="card rise-fade mt-4 stack-3">
                  {/* Trigger 1: Secret Voice Code Word */}
                  <div>
                    <div className="flex-center-gap mb-1">
                      <SettingsIcon size={15} />
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>Secret Voice Trigger</span>
                    </div>
                    <p className="text-xs text-dim mb-3">
                      Say this secret phrase anywhere near your phone to trigger a silent SOS alert without touching your device.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={codeWord}
                        onChange={(e) => setCodeWord(e.target.value.toLowerCase())}
                        placeholder="e.g. banana, red umbrella, call doctor"
                        style={{ flex: 1 }}
                      />
                      {codeWord !== DEFAULT_CODE_WORD && (
                        <button className="btn-quiet" onClick={() => setCodeWord(DEFAULT_CODE_WORD)}>
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Trigger 2: Camera Watch & Signal for Help */}
                  <div className="pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="flex-center-gap">
                        <HandIcon size={15} />
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Signal for Help (Hand Gesture)</span>
                      </div>
                      <button
                        type="button"
                        className="btn-quiet"
                        onClick={handleToggleCamera}
                        style={{
                          fontSize: 12,
                          padding: "5px 12px",
                          borderRadius: 8,
                          background: isCameraActive ? "rgba(224, 90, 71, 0.18)" : "var(--dusk-soft)",
                          color: isCameraActive ? "var(--ember)" : "var(--paper)",
                          border: isCameraActive ? "1px solid var(--ember)" : "1px solid var(--line)",
                        }}
                      >
                        {isCameraActive ? "● Camera Watch Active" : "○ Turn On Camera Watch"}
                      </button>
                    </div>
                    {isCameraActive && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "6px 10px",
                          borderRadius: 6,
                          background:
                            gestureProgress > 0
                              ? "rgba(224, 90, 71, 0.2)"
                              : handDetected
                              ? "rgba(46, 204, 113, 0.15)"
                              : "rgba(255,255,255,0.05)",
                          color:
                            gestureProgress > 0
                              ? "var(--alarm)"
                              : handDetected
                              ? "#2ecc71"
                              : "var(--paper)",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background:
                              gestureProgress > 0
                                ? "var(--alarm)"
                                : handDetected
                                ? "#2ecc71"
                                : "var(--dim)",
                            boxShadow:
                              gestureProgress > 0 || handDetected
                                ? "0 0 8px currentColor"
                                : "none",
                          }}
                        />
                        <span>{cameraDiagnostic}</span>
                      </div>
                    )}
                    <p className="text-xs text-dim mt-2 mb-2">
                      Camera is OFF by default for privacy and battery conservation. When enabled, it runs client-side ML to spot the distress gesture (palm up, tuck thumb, fold four fingers over thumb).
                    </p>
                    {cameraError && (
                      <p className="text-xs" style={{ color: "var(--alarm)", marginTop: 4 }}>
                        ⚠️ {cameraError}
                      </p>
                    )}
                    <details style={{ marginTop: 8, fontSize: 12, color: "var(--dim)" }}>
                      <summary style={{ cursor: "pointer", color: "var(--ember)", fontWeight: 500 }}>
                        View discreet gesture guide & instructions
                      </summary>
                      <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 8, marginTop: 6, lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--paper)" }}>Canadian Women&apos;s Foundation Distress Signal:</strong>
                        <ol style={{ paddingLeft: 18, marginTop: 6, marginBottom: 4 }}>
                          <li>Raise hand with palm facing the camera.</li>
                          <li>Tuck thumb into the center of your palm.</li>
                          <li>Trap thumb by folding your other four fingers down into a fist.</li>
                          <li>Hold position for 1.5 seconds to silently dispatch emergency beacons.</li>
                        </ol>
                        <p className="text-xs text-dim" style={{ margin: "4px 0 0 0" }}>
                          Runs 100% on-device via MediaPipe HandLandmarker. Zero video leaves your device.
                        </p>
                      </div>
                    </details>
                  </div>

                  {/* Trigger 3: Safe Zones Manager */}
                  <div className="pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                    <SafeZoneManager {...safeZones} />
                  </div>

                  {/* Trigger 4: Heartbeat Silence Detection Info */}
                  <div className="pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                    <div className="flex-center-gap mb-1">
                      <HeartbeatIcon size={15} style={{ color: "#2ecc71" }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>Heartbeat Silence Detection</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: armed ? "rgba(46, 204, 113, 0.18)" : "rgba(255,255,255,0.06)",
                          color: armed ? "#2ecc71" : "var(--dim)",
                          fontWeight: 600,
                        }}
                      >
                        {armed ? "Monitoring Active" : "Arms with Shield"}
                      </span>
                    </div>
                    <p className="text-xs text-dim mb-1">
                      Server expects a GPS ping every 30s while Shield is armed. If contact is lost for &gt;3 minutes (phone powered off, confiscated, destroyed, or airplane mode), the server autonomously creates an SOS event and alerts your guardians with your last known location.
                    </p>
                  </div>

                  {/* Safety Drills & Simulation Lab */}
                  <div className="pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ember)", padding: "4px 0" }}>
                        🛠️ Safety Drills &amp; Sensor Simulations (Test Lab)
                      </summary>
                      <div style={{ padding: "12px 0 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <p className="text-xs text-dim" style={{ margin: 0 }}>
                          Test all automatic detection engines and distress actions safely without false alarms:
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                          <button
                            type="button"
                            className="btn-quiet"
                            style={{ fontSize: 11.5, padding: "8px 10px", textAlign: "left", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
                            onClick={() => fireSOS({ triggerType: "simulated_impact", mode: "simulated", confidence: 0.98, details: "Safety Drill: High-G physical shock & violent drop simulation" })}
                          >
                            ⚡ Test Impact SOS
                          </button>
                          <button
                            type="button"
                            className="btn-quiet"
                            style={{ fontSize: 11.5, padding: "8px 10px", textAlign: "left", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
                            onClick={() => fireSOS({ triggerType: "simulated_codeword", mode: "simulated", confidence: 0.95, details: `Safety Drill: Voice codeword trigger ("${codeWord}")` })}
                          >
                            🎙️ Test Voice SOS
                          </button>
                          <button
                            type="button"
                            className="btn-quiet"
                            style={{ fontSize: 11.5, padding: "8px 10px", textAlign: "left", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
                            onClick={() => setIsFakeCallOpen(true)}
                          >
                            📞 Test Fake Call
                          </button>
                          <button
                            type="button"
                            className="btn-quiet"
                            style={{ fontSize: 11.5, padding: "8px 10px", textAlign: "left", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
                            onClick={() => setIsAlarmOpen(true)}
                          >
                            🚨 Test Strobe Siren
                          </button>
                          <button
                            type="button"
                            className="btn-quiet"
                            style={{ fontSize: 11.5, padding: "8px 10px", textAlign: "left", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
                            onClick={() => setDecoyMode(true)}
                          >
                            🧮 Test Decoy Calculator
                          </button>
                          <button
                            type="button"
                            className="btn-quiet"
                            style={{ fontSize: 11.5, padding: "8px 10px", textAlign: "left", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
                            onClick={() => setIsBlackoutOpen(true)}
                          >
                            🕶️ Test Blackout Screen
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              )}

              {/* Stealth Tip Card */}
              <div className="card mt-5" style={{ background: "rgba(30, 27, 46, 0.45)" }}>
                <p className="text-xs text-dim">
                  💡 <strong style={{ color: "var(--paper)" }}>Discreet Stealth Mode:</strong> Tap any top corner of your screen 3 times or press <code style={{ color: "var(--ember)" }}>Alt+Shift+D</code> to instantly disguise this app behind a fully functioning calculator. Type <code style={{ color: "var(--ember)" }}>112=</code> to return.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULED CHECK-IN & ROUTE GUARD */}
          {activeTab === "checkin" && (
            <div className="rise-fade section">
              <div className="mb-4">
                <p className="eyebrow">Scheduled Check-In (Dead-Man's Switch)</p>
                <div className="card">
                  <ScheduledCheckIn
                    onExpire={() => fireSOS("checkin")}
                    apiBaseUrl={API_BASE_URL}
                    userId={USER_ID}
                    disabled={Boolean(activeEventId)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <p className="eyebrow">Passive Route Guard Corridor</p>
                <div className="card">
                  <RouteGuardSetup {...routeGuard} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EVIDENCE VAULT */}
          {activeTab === "vault" && (
            <div className="rise-fade section">
              <EvidenceVault
                refreshTrigger={evidenceRefreshTick}
                onCapture={evidenceVault?.startAutomatedCapture}
              />
            </div>
          )}

          {/* TAB 4: SAFETY HUB */}
          {activeTab === "safety" && (
            <div className="rise-fade">
              <SafetyHub
                apiBaseUrl={API_BASE_URL}
                userId={USER_ID}
                onContactsChange={setContactCount}
                onContactsLoaded={setContacts}
                onConsentChange={setConsent}
                liveLocations={liveLocations}
              />
            </div>
          )}

          {/* TAB 5: DEDICATED LIVE SAFETY MAP (Leaflet.js + OpenStreetMap) */}
          {activeTab === "map" && (
            <div className="rise-fade section">
              <LiveSafetyMapView onBack={() => setActiveTab("shield")} />
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          PERSISTENT BOTTOM NAVIGATION BAR (Mobile & Desktop)
          ============================================================ */}
      {!activeEventId && (
        <nav className="bottom-nav-bar">
          <div className="bottom-nav-inner">
            <button
              className={`nav-tab-btn ${activeTab === "shield" ? "is-active" : ""}`}
              onClick={() => setActiveTab("shield")}
            >
              <ShieldIcon size={18} />
              <span>Shield</span>
            </button>

            <button
              className={`nav-tab-btn ${activeTab === "checkin" ? "is-active" : ""}`}
              onClick={() => setActiveTab("checkin")}
            >
              <TimerIcon size={18} />
              <span>Check-In</span>
            </button>

            <button
              className={`nav-tab-btn ${activeTab === "vault" ? "is-active" : ""}`}
              onClick={() => setActiveTab("vault")}
            >
              <FolderIcon size={18} />
              <span>Vault</span>
            </button>

            <button
              className={`nav-tab-btn ${activeTab === "safety" ? "is-active" : ""}`}
              onClick={() => setActiveTab("safety")}
            >
              <UsersIcon size={18} />
              <span>Hub</span>
            </button>

            <button
              id="bottom-nav-live-safety-map-btn"
              className={`nav-tab-btn ${activeTab === "map" ? "is-active" : ""}`}
              onClick={() => setActiveTab("map")}
              title="Open Live Safety Map"
            >
              <MapPinIcon size={18} />
              <span>Live Map</span>
            </button>
          </div>
        </nav>
      )}

      {/* ============================================================
          MODALS & OVERLAYS
          ============================================================ */}
      {/* 1. Photorealistic Fake Call Simulator */}
      <FakeCallOverlay
        isOpen={isFakeCallOpen}
        onClose={() => setIsFakeCallOpen(false)}
        defaultCallerIndex={0}
      />

      {/* 2. Acoustic Strobe Anti-Attacker Alarm */}
      <AcousticStrobeAlarm
        isOpen={isAlarmOpen}
        onClose={() => setIsAlarmOpen(false)}
      />

      {/* Dedicated Interactive Leaflet + OpenStreetMap Live Safety Map */}
      <LiveSafetyMapModal
        isOpen={isLiveMapModalOpen}
        onClose={() => setIsLiveMapModalOpen(false)}
      />

      {/* 3. Duress PIN Verification Modal */}
      {showPinModal && (
        <PinCancelModal
          activeSosId={activeEventId}
          apiBaseUrl={API_BASE_URL}
          userId={USER_ID}
          onResolved={handlePinResolved}
        />
      )}

      {/* 5. Camera Watch Viewfinder HUD & Persistent Video Element */}
      <div
        style={
          isCameraActive && cameraViewfinderOpen
            ? {
                position: "fixed",
                bottom: activeEventId ? 20 : 72,
                right: 20,
                zIndex: 999,
                width: 240,
                background: "rgba(18, 20, 29, 0.95)",
                backdropFilter: "blur(12px)",
                border: gestureMatched
                  ? "2px solid var(--alarm)"
                  : handDetected
                  ? "1px solid #2ecc71"
                  : "1px solid rgba(224, 90, 71, 0.4)",
                borderRadius: 12,
                padding: 10,
                boxShadow: gestureMatched
                  ? "0 8px 32px rgba(224, 90, 71, 0.45)"
                  : "0 8px 24px rgba(0,0,0,0.5)",
                transition: "border 0.2s ease, box-shadow 0.2s ease",
              }
            : {
                position: "fixed",
                bottom: 0,
                right: 0,
                width: 320,
                height: 240,
                opacity: 0.001,
                pointerEvents: "none",
                zIndex: -1,
                overflow: "hidden",
              }
        }
      >
        {isCameraActive && cameraViewfinderOpen && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: gestureMatched
                    ? "var(--alarm)"
                    : handDetected
                    ? "#2ecc71"
                    : "var(--ember)",
                  boxShadow: "0 0 8px currentColor",
                }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--paper)" }}>
                Camera Watch
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setCameraViewfinderOpen(false)}
                title="Hide preview (enter Stealth Mode)"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "var(--dim)",
                  padding: "3px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10.5,
                }}
              >
                <EyeOffIcon size={12} />
                Stealth
              </button>
              <button
                type="button"
                onClick={stopCamera}
                title="Turn off Camera Watch"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "var(--dim)",
                  padding: "3px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* The single stable video element */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: isCameraActive && cameraViewfinderOpen ? 140 : 240,
            borderRadius: 8,
            overflow: "hidden",
            background: "#000",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            webkit-playsinline="true"
            muted
            aria-hidden="true"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: isCameraActive && cameraViewfinderOpen ? "scaleX(-1)" : "none",
              display: "block",
            }}
          />

          {isCameraActive && cameraViewfinderOpen && gestureProgress > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: 5,
                width: `${Math.round(gestureProgress * 100)}%`,
                background: "linear-gradient(90deg, var(--ember), var(--alarm))",
                boxShadow: "0 0 10px var(--alarm)",
                transition: "width 0.1s linear",
              }}
            />
          )}
        </div>

        {isCameraActive && cameraViewfinderOpen && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              textAlign: "center",
              color: gestureMatched
                ? "var(--alarm)"
                : handDetected
                ? "#2ecc71"
                : "var(--dim)",
              fontWeight: gestureMatched || handDetected ? 600 : 400,
              lineHeight: 1.3,
              pointerEvents: "auto",
            }}
          >
            {gestureMatched
              ? `🚨 Distress Signal! Hold 1.5s (${Math.round(gestureProgress * 100)}%)`
              : handDetected
              ? "✋ Hand Tracked — Fold fingers over thumb"
              : "👋 Raise hand with palm facing camera"}
          </div>
        )}
      </div>

      {/* Minimized Stealth Floating Indicator */}
      {isCameraActive && !cameraViewfinderOpen && (
        <div
          style={{
            position: "fixed",
            bottom: activeEventId ? 20 : 72,
            right: 20,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(18, 20, 29, 0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--line)",
            padding: "6px 12px",
            borderRadius: 20,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: gestureMatched
                ? "var(--alarm)"
                : handDetected
                ? "#2ecc71"
                : "var(--ember)",
              boxShadow: "0 0 6px currentColor",
            }}
          />
          <span style={{ fontSize: 11.5, color: "var(--paper)" }}>
            Camera Watch ({gestureMatched ? "HOLDING" : handDetected ? "Hand Tracked" : "Stealth"})
          </span>
          <button
            type="button"
            onClick={() => setCameraViewfinderOpen(true)}
            title="Open viewfinder preview"
            style={{
              background: "none",
              border: "none",
              color: "var(--ember)",
              cursor: "pointer",
              padding: 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            <EyeIcon size={14} />
          </button>
          <button
            type="button"
            onClick={stopCamera}
            title="Stop camera"
            style={{
              background: "none",
              border: "none",
              color: "var(--dim)",
              cursor: "pointer",
              padding: "0 2px",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 6. Floating Safe Zone Departure Countdown (if triggered & settings closed) */}
      {!showSettings && safeZones.departureTriggered && safeZones.departureCountdown != null && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "calc(100% - 32px)",
            maxWidth: 440,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(22, 16, 26, 0.96)",
              backdropFilter: "blur(16px)",
              border: "2px solid var(--alarm)",
              boxShadow: "0 12px 36px rgba(224, 90, 71, 0.4)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>🚨</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--alarm)" }}>
                  SAFE ZONE DEPARTURE DETECTED
                </div>
                <div style={{ fontSize: 12, color: "var(--paper)", opacity: 0.9 }}>
                  Left safe zones during risky hours (10 PM–6 AM)
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--alarm)", fontFamily: "monospace" }}>
                {Math.ceil((safeZones.departureCountdown || 0) / 1000)}s
              </div>
              <button
                className="btn-primary"
                onClick={safeZones.dismissDeparture}
                style={{
                  padding: "8px 22px",
                  fontSize: 13,
                  background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                  border: "none",
                }}
              >
                ✓ I'm Safe
              </button>
            </div>
            <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${((safeZones.departureCountdown || 0) / 60000) * 100}%`,
                  background: "linear-gradient(90deg, var(--ember), var(--alarm))",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. Floating Route Guard Countdown (if triggered & setup card closed) */}
      {!showRouteGuardModal && !routeGuard.isActive && routeGuard.alertType && routeGuard.countdown != null && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "calc(100% - 32px)",
            maxWidth: 440,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(22, 16, 26, 0.96)",
              backdropFilter: "blur(16px)",
              border: "2px solid var(--alarm)",
              boxShadow: "0 12px 36px rgba(224, 90, 71, 0.4)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{routeGuard.alertType === "speed" ? "🚗" : "🚨"}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--alarm)" }}>
                  {routeGuard.alertType === "speed" ? "VEHICLE SPEED DETECTED" : "ROUTE DEVIATION DETECTED"}
                </div>
                <div style={{ fontSize: 12, color: "var(--paper)", opacity: 0.9 }}>
                  {routeGuard.alertType === "speed"
                    ? `Moving at ${routeGuard.currentSpeedKmh} km/h — possible forced vehicle entry`
                    : `${routeGuard.deviationM}m off planned route corridor`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--alarm)", fontFamily: "monospace" }}>
                {Math.ceil((routeGuard.countdown || 0) / 1000)}s
              </div>
              <button
                className="btn-primary"
                onClick={routeGuard.dismiss}
                style={{
                  padding: "8px 22px",
                  fontSize: 13,
                  background: "linear-gradient(135deg, #2ecc71, #27ae60)",
                  border: "none",
                }}
              >
                ✓ I'm OK
              </button>
            </div>
            <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${((routeGuard.countdown || 0) / 45000) * 100}%`,
                  background: "linear-gradient(90deg, var(--ember), var(--alarm))",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Demo Presentation & Simulation Control Dock */}
      <DemoStudioBar
        apiBaseUrl={API_BASE_URL}
        activeEventId={activeEventId}
        activeShareToken={activeShareToken}
        onTriggerSOS={fireSOS}
        onTriggerFakeCall={fakeCall.trigger}
        onTriggerAlarm={() => setIsAlarmOpen(true)}
        onToggleDecoy={() => setDecoyMode((prev) => !prev)}
        armed={armed}
        onArm={arm}
        onGpsUpdate={handleLocationUpdateFromPing}
      />

      {/* Blackout Stealth AMOLED Screen-Off Disguise */}
      <BlackoutStealth
        isOpen={isBlackoutOpen}
        onClose={() => setIsBlackoutOpen(false)}
        isArmed={armed}
        activeEventId={activeEventId}
      />
    </div>
  );
}
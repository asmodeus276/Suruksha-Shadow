<<<<<<< HEAD
import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Passive Heartbeat — Kidnapping-grade silence detection.
 *
 * While Shield is armed, sends a lightweight GPS ping to the server
 * every 30 seconds. If the server stops receiving pings (phone off,
 * confiscated, airplane mode, battery dead), it auto-fires SOS and
 * alerts guardians with the last known location.
 *
 * This is the single most important passive safety feature because
 * it requires ZERO user action — the absence of signal IS the alert.
 */
export function useHeartbeat({ userId, apiBaseUrl, enabled }) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !userId) return;

    async function sendPing() {
=======
import { useEffect, useRef, useState } from "react";

/**
 * ============================================================================
 * SURAKSHA SHADOW — PASSIVE HEARTBEAT & BACKGROUND SURVIVAL ARCHITECTURE
 * ============================================================================
 *
 * ⚠️ ANDROID OEM & BROWSER LIMITATIONS DOCUMENTATION:
 * ----------------------------------------------------------------------------
 * Modern mobile operating systems employ aggressive background execution
 * limiters ("battery optimizers" / "task killers") that actively throttle,
 * suspend, or kill browser tabs and PWA processes when the screen is turned off
 * or the user switches away from the active tab:
 *
 * 1. Xiaomi / Poco / Redmi (MIUI & HyperOS):
 *    - "Battery Saver" / "MIUI Optimization" suspends Web Worker timers and
 *      throttles setInterval() down to 0-1 executions per 5 minutes once the
 *      display turns off.
 *
 * 2. Oppo / OnePlus / Realme (ColorOS, OxygenOS, Realme UI):
 *    - "Quick Freeze" and "Sleep Standby Optimization" cut off active socket/
 *      fetch connections within 30-60 seconds of screen lock.
 *
 * 3. Vivo / iQOO (FuntouchOS, OriginOS):
 *    - "High Background Power Consumption" policies silently block network I/O
 *      from non-whitelisted browser engines when backgrounded.
 *
 * 4. Samsung (One UI):
 *    - "Deep Sleeping Apps" pauses background PWA workers after ~2-3 minutes
 *      unless media playback or a foreground notification is active.
 *
 * 5. Apple iOS (WebKit / Safari):
 *    - Hard freeze of JavaScript thread execution ~30 seconds after screen lock
 *      or tab dismissal. Periodic Background Sync is unsupported on iOS WebKit.
 *
 * ----------------------------------------------------------------------------
 * 🛡️ MULTI-TIER DEFENSE & GRACEFUL DEGRADATION STRATEGY:
 * ----------------------------------------------------------------------------
 * Level 1 (Screen Active Stealth): BlackoutStealth.jsx acquires a Screen WakeLock
 *         (navigator.wakeLock) so the display controller stays awake in pitch-black
 *         mode, preventing the OS from entering deep sleep.
 *
 * Level 2 (Web Worker Keep-Alive): Heartbeat ticks are driven by a dedicated
 *         Web Worker Blob thread (`worker.js`), isolating interval timing from
 *         DOM main-thread timer clamping (clamped to 1000ms-60000ms by Chromium).
 *
 * Level 3 (Periodic Sync API): If installed as a PWA, registers a Periodic
 *         Background Sync tag with the Service Worker (`periodicSync`) where supported.
 *
 * Level 4 (Audio Session Keep-Alive): A silent looping WAV via useBackgroundKeepAlive
 *         keeps the browser's audio renderer thread active to elevate tab priority.
 *
 * Level 5 (Server-Side Dead Man's Switch — The Ultimate Fallback):
 *         Because full client-side background reliability CANNOT be guaranteed on
 *         every OEM without native OS permissions, the server (routes/heartbeat.js)
 *         treats *absence of signal* as an emergency. If all client pings cease
 *         for >3 minutes while armed:
 *           - Server retains the last-known GPS coordinates.
 *           - Server auto-fires SOS with an explicit "silence_detected" event.
 *           - SMS is dispatched to Trusted Contacts stating signal was lost.
 *           - Guardian Mode timeline receives "Signal Lost / Device Suspended".
 * ============================================================================
 */

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const WATCHDOG_CHECK_MS = 10_000;     // 10 seconds check
const STALL_THRESHOLD_MS = 45_000;    // 45s without ping = stalled

// Inline Web Worker script as a Blob — immune to main-thread background timer throttling
const WORKER_SCRIPT = `
  let timerId = null;
  self.onmessage = function(e) {
    if (e.data === 'start') {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        self.postMessage('tick');
      }, ${HEARTBEAT_INTERVAL_MS});
    } else if (e.data === 'stop') {
      if (timerId) clearInterval(timerId);
      timerId = null;
    }
  };
`;

export function useHeartbeat({ userId, apiBaseUrl, enabled }) {
  const workerRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const watchdogIntervalRef = useRef(null);
  const lastPingTimeRef = useRef(Date.now());
  const pingCountRef = useRef(0);
  const failedPingsRef = useRef(0);

  const [diagnostics, setDiagnostics] = useState({
    isStalled: false,
    lastPingTimestamp: null,
    timeSinceLastPing: 0,
    pingCount: 0,
    failedPings: 0,
    workerActive: false,
    periodicSyncRegistered: false,
    wakeLockStatus: "unsupported",
  });

  useEffect(() => {
    if (!enabled || !userId) {
      // Disarm telemetry & cleanup
      if (window.__SURAKSHA_HEARTBEAT_STATUS__) {
        window.__SURAKSHA_HEARTBEAT_STATUS__.active = false;
      }
      return;
    }

    lastPingTimeRef.current = Date.now();
    pingCountRef.current = 0;
    failedPingsRef.current = 0;

    // Send single ping function
    async function sendPing(source = "worker") {
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
      let lat = null;
      let lng = null;

      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
<<<<<<< HEAD
        // GPS unavailable — still send the heartbeat so server knows we're alive
      }

      fetch(`${apiBaseUrl}/api/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, lat, lng }),
      }).catch((err) => console.warn("Heartbeat ping failed:", err));
    }

    // Send immediately on arm, then every 30s
    sendPing();
    intervalRef.current = setInterval(sendPing, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
=======
        // Geolocation unavailable or timed out — still send heartbeat so server knows device is alive
      }

      const pingPayload = {
        userId,
        lat,
        lng,
        source,
        battery: null,
        clientTimestamp: Date.now(),
      };

      if (navigator.getBattery) {
        try {
          const b = await navigator.getBattery();
          pingPayload.battery = Math.round(b.level * 100);
        } catch {
          // Battery API not available
        }
      }

      try {
        const res = await fetch(`${apiBaseUrl}/api/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pingPayload),
        });

        if (res.ok) {
          lastPingTimeRef.current = Date.now();
          pingCountRef.current += 1;
          console.debug(
            `[SURAKSHA HEARTBEAT] Pulse #${pingCountRef.current} via ${source} acknowledged by server.`
          );
        } else {
          failedPingsRef.current += 1;
          console.warn(`[SURAKSHA HEARTBEAT] Server returned status ${res.status} on heartbeat pulse.`);
        }
      } catch (err) {
        failedPingsRef.current += 1;
        console.warn(`[SURAKSHA HEARTBEAT] Network request failed for pulse via ${source}:`, err?.message);
      }

      // Update global debug status for test inspection
      const now = Date.now();
      const statusObj = {
        active: true,
        userId,
        lastPingTimestamp: lastPingTimeRef.current,
        timeSinceLastPingMs: now - lastPingTimeRef.current,
        pingCount: pingCountRef.current,
        failedPings: failedPingsRef.current,
        isStalled: now - lastPingTimeRef.current > STALL_THRESHOLD_MS,
        lastSource: source,
      };
      window.__SURAKSHA_HEARTBEAT_STATUS__ = statusObj;

      setDiagnostics((prev) => ({
        ...prev,
        isStalled: statusObj.isStalled,
        lastPingTimestamp: statusObj.lastPingTimestamp,
        timeSinceLastPing: Math.round(statusObj.timeSinceLastPingMs / 1000),
        pingCount: statusObj.pingCount,
        failedPings: statusObj.failedPings,
      }));
    }

    // 1. Send immediate ping on arming
    sendPing("initial_arm");

    // 2. Try initializing Web Worker for background immunity
    let workerStarted = false;
    try {
      const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data === "tick") {
          sendPing("web_worker");
        }
      };

      worker.postMessage("start");
      workerStarted = true;
      console.log("[SURAKSHA HEARTBEAT] Dedicated Web Worker keep-alive initialized.");
    } catch (workerErr) {
      console.warn("[SURAKSHA HEARTBEAT] Web Worker creation failed, falling back to main-thread interval:", workerErr?.message);
      workerStarted = false;
    }

    // 3. Main-thread fallback interval if worker couldn't be spawned
    if (!workerStarted) {
      fallbackIntervalRef.current = setInterval(() => {
        sendPing("main_thread_interval");
      }, HEARTBEAT_INTERVAL_MS);
    }

    // 4. Register Periodic Background Sync if supported (Chromium PWA)
    let periodicRegistered = false;
    if ("serviceWorker" in navigator && "periodicSync" in window) {
      navigator.serviceWorker.ready.then(async (registration) => {
        try {
          const tags = await registration.periodicSync.getTags();
          if (!tags.includes("suraksha-heartbeat")) {
            await registration.periodicSync.register("suraksha-heartbeat", {
              minInterval: 60 * 1000,
            });
            periodicRegistered = true;
            console.log("[SURAKSHA HEARTBEAT] Service Worker Periodic Sync registered.");
          }
        } catch (syncErr) {
          console.debug("[SURAKSHA HEARTBEAT] Periodic Sync not granted:", syncErr?.message);
        }
      });
    }

    // 5. Client Watchdog: Check if the heartbeat has silently stopped ticking
    watchdogIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastPingTimeRef.current;
      const isStalled = elapsed > STALL_THRESHOLD_MS;

      if (isStalled) {
        console.warn(
          `[SURAKSHA HEARTBEAT WATCHDOG ALERT] ⚠️ Heartbeat has SILENTLY STALLED! ` +
          `Last ping was ${Math.round(elapsed / 1000)}s ago (threshold: ${STALL_THRESHOLD_MS / 1000}s). ` +
          `Background JS execution has been throttled or suspended by the operating system.`
        );

        // Attempt emergency kickstart on main thread
        sendPing("watchdog_recovery");
      }

      setDiagnostics((prev) => ({
        ...prev,
        isStalled,
        timeSinceLastPing: Math.round(elapsed / 1000),
        workerActive: workerStarted,
        periodicSyncRegistered: periodicRegistered,
      }));
    }, WATCHDOG_CHECK_MS);

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage("stop");
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
        watchdogIntervalRef.current = null;
      }
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799

      // Tell server to stop watching this user
      fetch(`${apiBaseUrl}/api/heartbeat/disarm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
<<<<<<< HEAD
    };
  }, [enabled, userId, apiBaseUrl]);
}
=======

      if (window.__SURAKSHA_HEARTBEAT_STATUS__) {
        window.__SURAKSHA_HEARTBEAT_STATUS__.active = false;
      }
    };
  }, [enabled, userId, apiBaseUrl]);

  return diagnostics;
}

>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799

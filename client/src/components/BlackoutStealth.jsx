import { useState, useEffect, useRef } from "react";
import { EyeOffIcon } from "./icons";

/**
 * BlackoutStealth — AMOLED True Pitch-Black "Screen Off" Disguise.
 * -------------------------------------------------------------
 * Transforms the entire device display into a pitch-black screen that
 * looks indistinguishable from a powered-off or locked smartphone.
 *
 * All background processes (GPS breadcrumb pings, codeword listening,
 * violent motion sensors, and audio evidence vaulting) continue running
 * at full fidelity in the background.
 *
 * To exit: Triple-tap the top-right corner, or tap the discreet bottom button.
 */
export default function BlackoutStealth({ isOpen, onClose, isArmed, activeEventId }) {
  const tapCountRef = useRef(0);
  const [showHint, setShowHint] = useState(false);
<<<<<<< HEAD

=======
  const wakeLockRef = useRef(null);

  // Screen WakeLock management:
  // When Blackout Stealth is active, the screen is completely pitch black (#000000).
  // Requesting a Screen WakeLock prevents mobile OS (Android/iOS) from putting
  // the CPU/sensors to sleep or locking the device, keeping JS execution, GPS,
  // and audio detection running at full power while looking 100% "screen off".
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
  useEffect(() => {
    if (!isOpen) {
      tapCountRef.current = 0;
      setShowHint(false);
<<<<<<< HEAD
      return;
    }

    // Briefly flash a reassuring 1.5-second HUD confirmation on enter
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 1800);
    return () => clearTimeout(timer);
=======
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    async function requestWakeLock() {
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          console.log("[SURAKSHA BLACKOUT] Screen WakeLock acquired — CPU/sensors active in stealth.");
          wakeLockRef.current.addEventListener("release", () => {
            console.log("[SURAKSHA BLACKOUT] Screen WakeLock released.");
          });
        } catch (err) {
          console.warn("[SURAKSHA BLACKOUT] Screen WakeLock request failed (expected on some OEM battery savers):", err?.message);
        }
      } else {
        console.warn("[SURAKSHA BLACKOUT] Screen WakeLock API not supported in this browser environment.");
      }
    }

    requestWakeLock();

    // Re-acquire wake lock if tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isOpen && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Briefly flash a reassuring 1.5-second HUD confirmation on enter
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 1800);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799
  }, [isOpen]);

  const handleCornerTap = () => {
    tapCountRef.current += 1;
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onClose();
      return;
    }

    // Reset tap count after 1.5s of inactivity
    setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000000",
        zIndex: 999999,
        cursor: "default",
        userSelect: "none",
        touchAction: "manipulation",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Secret Top-Right Escape Zone (Triple-tap to restore) */}
      <div
        onClick={handleCornerTap}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "110px",
          height: "110px",
          zIndex: 1000000,
        }}
        title="Triple-tap to exit Blackout Shield"
      />

      {/* Brief Entry Flash HUD */}
      {showHint ? (
        <div
          style={{
            margin: "auto",
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.4)",
            fontSize: "12px",
            letterSpacing: "0.5px",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "6px" }}>
            <EyeOffIcon size={18} />
            <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Blackout Stealth Active</span>
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
            Screen disguised as powered off. Background protection live.
          </p>
          <p style={{ margin: 0, fontSize: "10px", color: "var(--mint, #4EC994)" }}>
            Triple-tap top-right corner to exit
          </p>
        </div>
      ) : (
        <div />
      )}

      {/* Micro-dot Heartbeat (1px, 4% opacity — invisible to casual glance, confirms live running) */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          width: 3,
          height: 3,
          borderRadius: "50%",
          backgroundColor: isArmed ? "#4EC994" : activeEventId ? "#FF4D4D" : "#555",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

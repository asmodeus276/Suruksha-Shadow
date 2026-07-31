import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Shield's silent trigger — FR-1 / TR-1 / TR-2.
 * Listens for a spoken code word (Web Speech API) and for a sudden,
 * sustained motion anomaly (Device Motion API). Fires onTrigger("voice" | "motion")
 * the moment either condition is met — nothing visible on screen.
 *
 * Usage:
 *   const { reset } = useShieldDetection({
 *     codeWord: "red umbrella",
 *     enabled: true,
 *     onTrigger: (type) => fireSOS(type),
 *   });
 */
export function useShieldDetection({ codeWord, onTrigger, enabled = true }) {
  const motionBufferRef = useRef([]);
  const triggeredRef = useRef(false);
  const [transcript, setTranscript] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | error | unsupported
  const [motionMagnitude, setMotionMagnitude] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [restartCount, setRestartCount] = useState(0);

  const fire = useCallback(
    (type) => {
      if (triggeredRef.current) return; // don't double-fire
      triggeredRef.current = true;
      onTrigger?.(type);
    },
    [onTrigger]
  );

  // --- Voice trigger: listen continuously for the code word ---
  useEffect(() => {
    if (!enabled) return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser.");
      setMicStatus("unsupported");
      return;
    }

    let restartTimeout = null;
    let consecutiveNetworkErrors = 0;
    let stopped = false;
    let current = null;

    const normalize = (s) => s.replace(/\s+/g, "");
    const normalizedCodeWord = codeWord ? normalize(codeWord.toLowerCase()) : "";

    // Rebuilding a brand-new recognition instance on every (re)start,
    // rather than reusing/restarting one object, works around a real
    // issue on some mobile Chrome builds where a long-lived instance
    // keeps reporting itself as "listening" after several restarts but
    // silently stops actually transcribing anything.
    function createRecognition() {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      // Ask for more than the single top guess — an uncommon isolated
      // word (e.g. a code word with no surrounding sentence context) can
      // score low confidence and come back blank as the #1 alternative,
      // while a lower-ranked alternative still contains the right word.
      recognition.maxAlternatives = 5;

      recognition.onstart = () => {
        setMicStatus("listening");
        consecutiveNetworkErrors = 0;
      };

      recognition.onresult = (event) => {
        // Build the displayed transcript from each result's top guess...
        const display = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join(" ")
          .toLowerCase();
        setTranscript(display);

        // ...but check EVERY alternative of EVERY result for the code
        // word, not just the top guess, since the match only needs to
        // exist somewhere in what the engine considered plausible.
        let matched = false;
        for (const result of event.results) {
          for (let i = 0; i < result.length; i++) {
            const alt = normalize(result[i].transcript.toLowerCase());
            if (normalizedCodeWord && alt.includes(normalizedCodeWord)) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
        if (matched) fire("voice");
      };

      // Browsers stop recognition after a period of silence — restart it
      // so "continuous" listening actually stays continuous. A short
      // delay avoids hammering Chrome's speech backend, which throws
      // "network" errors if you call start() again with zero gap.
      recognition.onend = () => {
        if (stopped || !enabled || triggeredRef.current) return;
        if (consecutiveNetworkErrors >= 5) {
          setMicStatus("error");
          console.warn("Speech recognition gave up after repeated network errors.");
          return;
        }
        restartTimeout = setTimeout(() => {
          setRestartCount((n) => n + 1);
          current = createRecognition();
          try {
            current.start();
          } catch (_) {
            /* ignore */
          }
        }, 400);
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        setLastError(e.error);
        if (e.error === "not-allowed") {
          setMicStatus("error");
        } else if (e.error === "network") {
          consecutiveNetworkErrors += 1;
        }
      };

      return recognition;
    }

    current = createRecognition();
    try {
      current.start();
    } catch (_) {
      /* ignore double-start on fast refresh */
    }

    return () => {
      stopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      if (current) {
        current.onend = null; // prevent the auto-restart on unmount
        current.stop();
      }
    };
  }, [codeWord, enabled, fire]);

  // --- Motion trigger: flag a sudden, sustained spike in acceleration ---
  useEffect(() => {
    if (!enabled) return;
    if (typeof DeviceMotionEvent === "undefined") {
      console.warn("Device Motion API not supported in this browser.");
      return;
    }

    // Average magnitude over a short rolling window, so one noisy
    // sample can't trigger a false alarm.
    const WINDOW_SIZE = 8;
    const THRESHOLD = 22; // m/s^2 — tune against a real device before demo day
    let lastUiUpdate = 0;
    const UI_UPDATE_INTERVAL_MS = 400; // throttle re-renders, not the trigger check itself

    const handleMotion = (event) => {
      const { x = 0, y = 0, z = 0 } = event.acceleration || {};
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      const buf = motionBufferRef.current;
      buf.push(magnitude);
      if (buf.length > WINDOW_SIZE) buf.shift();

      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;

      // The trigger check runs on every reading (safety-critical, no
      // throttling here) — only the on-screen number is rate-limited, so
      // it doesn't repaint dozens of times a second and get picked up by
      // an accessibility screen reader as constantly "changing" content.
      const now = Date.now();
      if (now - lastUiUpdate > UI_UPDATE_INTERVAL_MS) {
        setMotionMagnitude(Math.round(avg));
        lastUiUpdate = now;
      }

      if (buf.length === WINDOW_SIZE && avg > THRESHOLD) {
        fire("motion");
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [enabled, fire]);

  const reset = useCallback(() => {
    triggeredRef.current = false;
    motionBufferRef.current = [];
  }, []);

  return { reset, transcript, micStatus, motionMagnitude, lastError, restartCount };
}

/**
 * iOS 13+ only fires devicemotion events after this is called from
 * inside a user-gesture handler (e.g. a button's onClick) — call it
 * once during onboarding, before relying on the hook above.
 */
export async function requestMotionPermission() {
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    return DeviceMotionEvent.requestPermission();
  }
  return "granted"; // Android / desktop don't gate this
}
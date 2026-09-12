import { useEffect, useRef, useCallback, useState } from "react";

// Standard universal emergency phrases that always trigger distress detection
const UNIVERSAL_EMERGENCY_WORDS = [
  "help",
  "help me",
  "bachao",
  "save me",
  "emergency",
  "danger",
  "khatra",
  "call police",
  "police",
  "suraksha",
];

/**
 * Levenshtein distance computation for fuzzy word comparison
 */
function levenshteinDistance(s1, s2) {
  if (!s1 || !s2) return (s1 || "").length + (s2 || "").length;
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Matches spoken text against target code word using exact, substring,
 * and fuzzy phonetic tolerance for accents and minor speech mis-transcriptions.
 */
function isFuzzyCodeWordMatch(spokenText, targetWord) {
  if (!spokenText) return false;
  const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const cleanTarget = (targetWord || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();

  if (!cleanTarget && !cleanSpoken) return false;

  // 1. Direct substring match with whitespace compressed
  const compressedSpoken = cleanSpoken.replace(/\s+/g, "");
  const compressedTarget = cleanTarget.replace(/\s+/g, "");
  if (compressedTarget && compressedSpoken.includes(compressedTarget)) {
    return true;
  }

  // 2. Check universal emergency trigger phrases
  for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
    const compUniversal = universal.replace(/\s+/g, "");
    if (compressedSpoken.includes(compUniversal)) {
      return true;
    }
  }

  // 3. Word-by-word fuzzy Levenshtein comparison
  if (cleanTarget.length >= 3) {
    const words = cleanSpoken.split(/\s+/).filter(Boolean);
    const targetWords = cleanTarget.split(/\s+/).filter(Boolean);

    // If single target word (e.g. "banana")
    if (targetWords.length === 1) {
      const target = targetWords[0];
      const maxAllowedDist = target.length <= 4 ? 1 : 2;

      for (const word of words) {
        if (word.length >= 3) {
          const dist = levenshteinDistance(word, target);
          if (dist <= maxAllowedDist) return true;
        }
      }
    } else {
      // Multi-word phrase fuzzy check (sliding window)
      const windowLen = targetWords.length;
      for (let i = 0; i <= words.length - windowLen; i++) {
        const slice = words.slice(i, i + windowLen).join(" ");
        const dist = levenshteinDistance(slice, cleanTarget);
        if (dist <= Math.min(3, Math.floor(cleanTarget.length * 0.3))) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Shield's silent trigger — FR-1 / TR-1 / TR-2.
 * Listens for a spoken code word (Web Speech API) and for a sudden,
 * sustained motion anomaly / shake (Device Motion API) with baseline calibration.
 */
export function useShieldDetection({ codeWord, onTrigger, enabled = true }) {
  const [transcript, setTranscript] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | error | unsupported
  const [motionMagnitude, setMotionMagnitude] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [restartCount, setRestartCount] = useState(0);

  // Calibration state for baseline motion filtering
  const [calibration, setCalibration] = useState({
    isCalibrating: false,
    progress: 0,
    baseline: 0,
  });

  const baselineMagnitudeRef = useRef(0);
  const calibrationSamplesRef = useRef([]);
  const motionBufferRef = useRef([]);
  const shakeCounterRef = useRef({ count: 0, lastSign: 0, lastTime: 0 });
  const triggeredRef = useRef(false);

  const fire = useCallback(
    (type, confidence = 0.90, details = "") => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      console.log(`[SURAKSHA SHIELD] LIVE sensor trigger fired: ${type} (Confidence: ${Math.round(confidence * 100)}%)`);
      onTrigger?.({
        triggerType: type,
        mode: "live",
        confidence,
        details: details || `Live sensor trigger: ${type}`,
      });
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
    let consecutiveErrors = 0;
    let stopped = false;
    let current = null;

    function createRecognition() {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.maxAlternatives = 5;

      recognition.onstart = () => {
        setMicStatus("listening");
        consecutiveErrors = 0;
        setLastError(null);
      };

      recognition.onresult = (event) => {
        const display = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join(" ")
          .toLowerCase();
        setTranscript(display);

        let matched = false;
        let matchConfidence = 0.85;

        for (const result of event.results) {
          for (let i = 0; i < result.length; i++) {
            const alt = result[i].transcript.toLowerCase();
            const cleanTarget = (codeWord || "").toLowerCase().trim();

            if (cleanTarget && alt.includes(cleanTarget)) {
              matched = true;
              matchConfidence = 0.98; // Exact substring match
              break;
            }

            for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
              if (alt.includes(universal)) {
                matched = true;
                matchConfidence = 0.95; // Universal emergency keyword
                break;
              }
            }

            if (!matched && isFuzzyCodeWordMatch(alt, codeWord)) {
              matched = true;
              matchConfidence = 0.80; // Fuzzy phonetic match
              break;
            }
          }
          if (matched) break;
        }

        if (matched) {
          fire("voice", matchConfidence, `Spoken keyword matched in transcript: "${display.slice(-40)}"`);
        }
      };

      recognition.onend = () => {
        if (stopped || !enabled || triggeredRef.current) return;
        const delay = Math.min(300 + consecutiveErrors * 300, 2500);
        restartTimeout = setTimeout(() => {
          setRestartCount((n) => n + 1);
          current = createRecognition();
          try {
            current.start();
          } catch {
            /* ignore */
          }
        }, delay);
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        if (e.error === "not-allowed") {
          setMicStatus("error");
          setLastError("Microphone permission denied");
        } else if (e.error === "no-speech") {
          // Normal silence, auto-recovers
        } else {
          consecutiveErrors += 1;
        }
      };

      return recognition;
    }

    current = createRecognition();
    try {
      current.start();
    } catch {
      /* ignore */
    }

    return () => {
      stopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      if (current) {
        current.onend = null;
        try {
          current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [codeWord, enabled, fire]);

  // --- Motion Calibration (3-second baseline capture upon arming) ---
  useEffect(() => {
    if (!enabled) {
      setCalibration({ isCalibrating: false, progress: 0, baseline: 0 });
      baselineMagnitudeRef.current = 0;
      calibrationSamplesRef.current = [];
      return;
    }

    setCalibration({ isCalibrating: true, progress: 0, baseline: 0 });
    calibrationSamplesRef.current = [];

    const CALIBRATION_DURATION_MS = 2500;
    const startTime = Date.now();

    const calInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / CALIBRATION_DURATION_MS) * 100));

      if (calibrationSamplesRef.current.length > 0) {
        const sum = calibrationSamplesRef.current.reduce((a, b) => a + b, 0);
        const avg = sum / calibrationSamplesRef.current.length;
        baselineMagnitudeRef.current = avg;
        setCalibration({
          isCalibrating: progress < 100,
          progress,
          baseline: Math.round(avg * 10) / 10,
        });
      }

      if (progress >= 100) {
        clearInterval(calInterval);
        console.log(`[SURAKSHA SHIELD] Motion calibrated. Baseline: ${baselineMagnitudeRef.current.toFixed(2)} m/s²`);
      }
    }, 200);

    return () => clearInterval(calInterval);
  }, [enabled]);

  // --- Motion trigger: spike in acceleration & violent shake detection with dynamic threshold ---
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      return;
    }

    const WINDOW_SIZE = 8;
    let lastUiUpdate = 0;
    const UI_UPDATE_INTERVAL_MS = 350;

    const handleMotion = (event) => {
      const { x = 0, y = 0, z = 0 } = event.acceleration || {};
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      // Collect samples if calibrating
      if (calibration.isCalibrating) {
        calibrationSamplesRef.current.push(magnitude);
        if (calibrationSamplesRef.current.length > 40) {
          calibrationSamplesRef.current.shift();
        }
      }

      const buf = motionBufferRef.current;
      buf.push(magnitude);
      if (buf.length > WINDOW_SIZE) buf.shift();

      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;

      if (now - lastUiUpdate > UI_UPDATE_INTERVAL_MS) {
        setMotionMagnitude(Math.round(avg));
        lastUiUpdate = now;
      }

      // Dynamic thresholds adjusted by calibrated baseline
      const base = baselineMagnitudeRef.current || 0;
      const dynamicSustainedThreshold = Math.max(18, base + 14);
      const dynamicViolentShakeThreshold = Math.max(15, base + 11);

      // 1. Sustained linear acceleration (e.g. violent struggle / being dragged)
      if (buf.length === WINDOW_SIZE && avg > dynamicSustainedThreshold) {
        const conf = Math.min(0.99, Math.round((avg / dynamicSustainedThreshold) * 0.88 * 100) / 100);
        fire("motion", conf, `Sustained struggle acceleration (${avg.toFixed(1)} m/s², baseline: ${base.toFixed(1)})`);
      }

      // 2. Multi-axis violent shake detection (rapid alternating direction)
      const maxAxis = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      const dominantSign =
        Math.abs(x) > Math.abs(y) && Math.abs(x) > Math.abs(z)
          ? Math.sign(x)
          : Math.abs(y) > Math.abs(z)
          ? Math.sign(y)
          : Math.sign(z);

      const shake = shakeCounterRef.current;
      if (maxAxis > dynamicViolentShakeThreshold) {
        if (shake.lastSign !== 0 && dominantSign !== shake.lastSign && now - shake.lastTime < 450) {
          shake.count += 1;
          if (shake.count >= 4) {
            shake.count = 0;
            const conf = Math.min(0.98, Math.round((maxAxis / dynamicViolentShakeThreshold) * 0.90 * 100) / 100);
            fire("motion", conf, `Violent struggle shake (${shake.count} rapid directional shifts, peak: ${maxAxis.toFixed(1)} m/s²)`);
          }
        }
        shake.lastSign = dominantSign;
        shake.lastTime = now;
      } else if (now - shake.lastTime > 900) {
        shake.count = 0;
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [enabled, calibration.isCalibrating, fire]);

  const reset = useCallback(() => {
    triggeredRef.current = false;
    motionBufferRef.current = [];
    shakeCounterRef.current = { count: 0, lastSign: 0, lastTime: 0 };
  }, []);

  return {
    reset,
    transcript,
    micStatus,
    motionMagnitude,
    lastError,
    restartCount,
    calibration,
  };
}

/**
 * iOS 13+ motion permission request helper
 */
export async function requestMotionPermission() {
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    return DeviceMotionEvent.requestPermission();
  }
  return "granted";
}
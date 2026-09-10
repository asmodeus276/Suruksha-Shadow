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
 * sustained motion anomaly / shake (Device Motion API).
 */
export function useShieldDetection({ codeWord, onTrigger, enabled = true }) {
  const [transcript, setTranscript] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | error | unsupported
  const [motionMagnitude, setMotionMagnitude] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [restartCount, setRestartCount] = useState(0);

  const motionBufferRef = useRef([]);
  const shakeCounterRef = useRef({ count: 0, lastSign: 0, lastTime: 0 });
  const triggeredRef = useRef(false);

  const fire = useCallback(
    (type) => {
      if (triggeredRef.current) return;
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
    let consecutiveErrors = 0;
    let stopped = false;
    let current = null;

    function createRecognition() {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // Use device default or en-US/en-IN
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
        for (const result of event.results) {
          for (let i = 0; i < result.length; i++) {
            const alt = result[i].transcript;
            if (isFuzzyCodeWordMatch(alt, codeWord)) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        if (matched) {
          fire("voice");
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
          } catch (_) {
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
    } catch (_) {
      /* ignore */
    }

    return () => {
      stopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      if (current) {
        current.onend = null;
        try {
          current.stop();
        } catch (_) {}
      }
    };
  }, [codeWord, enabled, fire]);

  // --- Motion trigger: spike in acceleration & violent shake detection ---
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      return;
    }

    const WINDOW_SIZE = 8;
    const SUSTAINED_THRESHOLD = 20; // m/s^2
    const VIOLENT_SHAKE_THRESHOLD = 16;
    let lastUiUpdate = 0;
    const UI_UPDATE_INTERVAL_MS = 350;

    const handleMotion = (event) => {
      const { x = 0, y = 0, z = 0 } = event.acceleration || {};
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      const buf = motionBufferRef.current;
      buf.push(magnitude);
      if (buf.length > WINDOW_SIZE) buf.shift();

      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;

      if (now - lastUiUpdate > UI_UPDATE_INTERVAL_MS) {
        setMotionMagnitude(Math.round(avg));
        lastUiUpdate = now;
      }

      // 1. Sustained linear acceleration (e.g. violent struggle / being dragged)
      if (buf.length === WINDOW_SIZE && avg > SUSTAINED_THRESHOLD) {
        fire("motion");
      }

      // 2. Multi-axis violent shake detection (rapid alternating direction)
      const maxAxis = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      const dominantSign = (Math.abs(x) > Math.abs(y) && Math.abs(x) > Math.abs(z)) ? Math.sign(x) : (Math.abs(y) > Math.abs(z) ? Math.sign(y) : Math.sign(z));

      const shake = shakeCounterRef.current;
      if (maxAxis > VIOLENT_SHAKE_THRESHOLD) {
        if (shake.lastSign !== 0 && dominantSign !== shake.lastSign && now - shake.lastTime < 450) {
          shake.count += 1;
          if (shake.count >= 4) {
            shake.count = 0;
            fire("motion");
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
  }, [enabled, fire]);

  const reset = useCallback(() => {
    triggeredRef.current = false;
    motionBufferRef.current = [];
    shakeCounterRef.current = { count: 0, lastSign: 0, lastTime: 0 };
  }, []);

  return { reset, transcript, micStatus, motionMagnitude, lastError, restartCount };
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
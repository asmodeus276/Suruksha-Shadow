import { useEffect, useRef, useCallback, useState } from "react";

// Standard universal emergency phrases that always trigger distress detection
const UNIVERSAL_EMERGENCY_WORDS = [
  "banana",
  "help",
  "help me",
  "bachao",
  "bachao mujhe",
  "save me",
  "save",
  "emergency",
  "danger",
  "khatra",
  "call police",
  "police",
  "suraksha",
  "madad",
  "madad karo",
  "chhoro",
  "chor",
  "chodo",
  "attack",
  "koi hai",
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
 * Dual-Engine Shield Hearing & Silent Trigger — FR-1 / TR-1 / TR-2:
 * 1. Web Speech API (Continuous Speech & Keyword Recognition with multi-dialect support)
 * 2. Web Audio API (Real-time Acoustic Meter & Scream / Sudden High-dB Distress Detection)
 * 3. Device Motion API (Baseline calibrated shake & struggle anomaly detection)
 */
export function useShieldDetection({ codeWord, onTrigger, enabled = true }) {
  const [transcript, setTranscript] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | error | unsupported
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 real-time audio meter
  const [audioDb, setAudioDb] = useState(30); // Estimated dB (30-95)
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
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const screamCounterRef = useRef({ count: 0, lastTime: 0 });

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

  // --- Engine 1: Web Audio API Live Acoustic Monitoring & Decibel Level Meter ---
  useEffect(() => {
    if (!enabled) {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setAudioLevel(0);
      setAudioDb(30);
      return;
    }

    let isMounted = true;
    let animFrame = null;

    async function initAcousticEngine() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        audioStreamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastUiUpdate = 0;

        const processAudio = () => {
          if (!isMounted || !enabled) return;

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          const estimatedDb = Math.round(30 + (normalized / 100) * 65);

          const now = Date.now();
          if (now - lastUiUpdate > 80) {
            setAudioLevel(normalized);
            setAudioDb(estimatedDb);
            lastUiUpdate = now;
          }

          // Acoustic Scream / Sudden High Distress Noise Detection (>82dB sustained)
          if (estimatedDb >= 82) {
            const sc = screamCounterRef.current;
            if (now - sc.lastTime < 500) {
              sc.count += 1;
              if (sc.count >= 6 && !triggeredRef.current) {
                sc.count = 0;
                fire(
                  "voice",
                  0.88,
                  `Acoustic distress peak: High-decibel scream / scream spike detected (~${estimatedDb} dB)`
                );
              }
            } else {
              sc.count = 1;
            }
            sc.lastTime = now;
          }

          animFrame = requestAnimationFrame(processAudio);
        };

        processAudio();
      } catch (err) {
        console.warn("[SURAKSHA SHIELD] Acoustic audio meter unavailable:", err.message);
      }
    }

    initAcousticEngine();

    return () => {
      isMounted = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [enabled, fire]);

  // --- Engine 2: Web Speech API Multi-Dialect Continuous Keyword Recognition ---
  useEffect(() => {
    if (!enabled) {
      setMicStatus("idle");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser environment.");
      setMicStatus("unsupported");
      return;
    }

    let restartTimeout = null;
    let consecutiveErrors = 0;
    let stopped = false;
    let current = null;

    function startListening() {
      if (stopped || !enabled || triggeredRef.current) return;

      try {
        const recognition = new SpeechRecognition();
        // On mobile browsers, continuous=false with auto-restart loop is significantly
        // more reliable than continuous=true which drops out after short silences
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
          let latestTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            latestTranscript += event.results[i][0].transcript + " ";
          }
          const cleaned = latestTranscript.trim().toLowerCase();
          if (cleaned) {
            setTranscript(cleaned);
          }

          let matched = false;
          let matchConfidence = 0.90;
          let matchedWord = "";

          // Check all alternatives across current results
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            for (let j = 0; j < result.length; j++) {
              const alt = result[j].transcript.toLowerCase().trim();
              const target = (codeWord || "banana").toLowerCase().trim();

              if (target && (alt.includes(target) || isFuzzyCodeWordMatch(alt, target))) {
                matched = true;
                matchedWord = target;
                matchConfidence = 0.98;
                break;
              }

              for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
                if (alt.includes(universal) || isFuzzyCodeWordMatch(alt, universal)) {
                  matched = true;
                  matchedWord = universal;
                  matchConfidence = 0.95;
                  break;
                }
              }
            }
            if (matched) break;
          }

          if (matched) {
            setTranscript(`🚨 "${matchedWord}" (KEYWORD DETECTED)`);
            fire(
              "voice",
              matchConfidence,
              `Spoken distress keyword detected: "${matchedWord}" (Full transcript: "${cleaned}")`
            );
          }
        };

        recognition.onerror = (e) => {
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            setMicStatus("error");
            setLastError("Microphone permission denied. Allow mic access to enable voice shield.");
          } else if (e.error === "no-speech") {
            // Normal silence on mobile, ignore and let auto-restart handle it
          } else if (e.error === "network") {
            consecutiveErrors += 1;
          } else {
            consecutiveErrors += 1;
          }
        };

        recognition.onend = () => {
          if (stopped || !enabled || triggeredRef.current) return;
          const delay = Math.min(120 + consecutiveErrors * 250, 2000);
          restartTimeout = setTimeout(() => {
            setRestartCount((n) => n + 1);
            startListening();
          }, delay);
        };

        current = recognition;
        recognition.start();
      } catch (err) {
        console.warn("[SURAKSHA SHIELD] Speech recognition start error:", err.message);
        if (!stopped && enabled && !triggeredRef.current) {
          restartTimeout = setTimeout(startListening, 1000);
        }
      }
    }

    startListening();

    return () => {
      stopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      if (current) {
        current.onend = null;
        current.onerror = null;
        try {
          current.abort();
        } catch {
          /* ignore */
        }
        current = null;
      }
    };
  }, [codeWord, enabled, fire]);

  // --- Engine 3: Motion Calibration (2.5-second baseline capture upon arming) ---
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

  // --- Engine 4: Motion trigger (Struggle acceleration & Violent Shake Detection) ---
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

      // 1. Sustained struggle acceleration
      if (buf.length === WINDOW_SIZE && avg > dynamicSustainedThreshold) {
        const conf = Math.min(0.99, Math.round((avg / dynamicSustainedThreshold) * 0.88 * 100) / 100);
        fire("motion", conf, `Sustained struggle acceleration (${avg.toFixed(1)} m/s², baseline: ${base.toFixed(1)})`);
      }

      // 2. Multi-axis violent shake detection
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
    setTranscript("");
    motionBufferRef.current = [];
    shakeCounterRef.current = { count: 0, lastSign: 0, lastTime: 0 };
    screamCounterRef.current = { count: 0, lastTime: 0 };
  }, []);

  return {
    reset,
    transcript,
    micStatus,
    audioLevel,
    audioDb,
    motionMagnitude,
    lastError,
    restartCount,
    calibration,
  };
}

/**
 * Microphone & Motion permissions helper with mobile touch gesture unlock
 */
export async function requestDevicePermissions() {
  const results = { motion: "granted", audio: "granted" };

  // iOS 13+ motion permission
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    try {
      results.motion = await DeviceMotionEvent.requestPermission();
    } catch {
      results.motion = "denied";
    }
  }

  // Microphone stream permission unlock
  if (navigator?.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Keep track or stop test stream
      stream.getTracks().forEach((t) => t.stop());
      results.audio = "granted";
    } catch {
      results.audio = "denied";
    }
  }

  return results;
}

export const requestMotionPermission = requestDevicePermissions;
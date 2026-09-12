import { useEffect, useRef, useCallback, useState } from "react";

// Standard universal emergency phrases that always trigger distress detection
const UNIVERSAL_EMERGENCY_WORDS = [
  "banana",
  "banan",
  "bana na",
  "bananas",
  "bahana",
  "banao",
  "bonanza",
  "panana",
  "help",
  "help me",
  "halp",
  "bachao",
  "bachao mujhe",
  "bchao",
  "bachaoo",
  "bachav",
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

const PHONETIC_ALIASES = {
  banana: [
    "banana",
    "bananas",
    "bananaa",
    "banan",
    "bana na",
    "bananna",
    "banano",
    "banao",
    "bahana",
    "bana",
    "bonanza",
    "bonana",
    "panana",
    "vanana",
    "banna",
    "benana",
    "binana",
    "bunana",
    "panna",
    "ba na na",
    "ban naa",
    "ban nah",
    "banan a",
    "pananna",
    "by nanna",
    "bye nana",
    "buy nanna",
    "bernard",
    "panama",
    "bandana",
    "punana",
    "pyjama",
  ],
  bachao: [
    "bachao",
    "bachao mujhe",
    "bchao",
    "bachaoo",
    "banao",
    "bachav",
    "bacho",
    "bachao ji",
    "mujhe bachao",
    "bachao bachao",
    "bachaho",
    "bachyo",
    "bachha",
    "bacha",
    "bachha do",
    "bachaye",
    "bachayein",
  ],
  help: [
    "help",
    "help me",
    "halp",
    "elp",
    "please help",
    "madad",
    "madad karo",
    "save me",
    "save",
    "emergency",
    "danger",
    "khatra",
    "police",
    "suraksha",
    "chodo",
    "chhoro",
    "attack",
    "somebody help",
    "help please",
    "call police",
    "call 112",
  ],
};

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
 * phonetic alias table, and fuzzy Levenshtein tolerance.
 */
function isFuzzyCodeWordMatch(spokenText, targetWord) {
  if (!spokenText) return false;
  const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const cleanTarget = (targetWord || "banana").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();

  if (!cleanTarget || !cleanSpoken) return false;

  // 1. Direct substring match (e.g. "saying banana" -> includes "banana")
  if (cleanSpoken.includes(cleanTarget)) {
    return true;
  }

  // Exact full match
  if (cleanSpoken.length >= 3 && cleanSpoken === cleanTarget) {
    return true;
  }

  // 2. Compressed whitespace match (e.g. "bana na" -> "banana", "ba na na" -> "banana")
  const compressedSpoken = cleanSpoken.replace(/\s+/g, "");
  const compressedTarget = cleanTarget.replace(/\s+/g, "");
  if (compressedTarget && compressedSpoken.includes(compressedTarget)) {
    return true;
  }

  // 3. Check phonetic alias variations
  for (const [key, aliases] of Object.entries(PHONETIC_ALIASES)) {
    if (cleanTarget === key || cleanTarget.includes(key) || key.includes(cleanTarget)) {
      for (const alias of aliases) {
        const compAlias = alias.replace(/\s+/g, "");
        if (
          cleanSpoken.includes(alias) ||
          compressedSpoken.includes(compAlias) ||
          (compAlias.length >= 3 && compressedSpoken.includes(compAlias))
        ) {
          return true;
        }
      }
    }
  }

  // 4. Universal emergency trigger phrases
  for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
    const compUniversal = universal.replace(/\s+/g, "");
    if (cleanSpoken.includes(universal) || compressedSpoken.includes(compUniversal)) {
      return true;
    }
  }

  // 5. Word-by-word fuzzy Levenshtein comparison
  if (cleanTarget.length >= 3) {
    const words = cleanSpoken.split(/\s+/).filter(Boolean);
    const targetWords = cleanTarget.split(/\s+/).filter(Boolean);

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
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | hearing | acoustic-only | error | unsupported
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
  const speechRecognitionRef = useRef(null);

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

  // Manual Trigger Simulation for testing
  const simulateVoiceTrigger = useCallback(
    (customWord = "banana") => {
      setTranscript(`🚨 "${customWord}" (VOICE CODEWORD DETECTED)`);
      fire("voice", 1.0, `Voice codeword triggered: "${customWord}"`);
    },
    [fire]
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

        // Use standard non-locking audio stream to allow SpeechRecognition to share input smoothly
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
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
          await ctx.resume().catch(() => {});
        }
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
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
          if (now - lastUiUpdate > 60) {
            setAudioLevel(normalized);
            setAudioDb(estimatedDb);
            lastUiUpdate = now;
          }

          // Acoustic Scream / Sudden High Distress Noise Detection (>78dB sustained)
          if (estimatedDb >= 78) {
            const sc = screamCounterRef.current;
            if (now - sc.lastTime < 500) {
              sc.count += 1;
              if (sc.count >= 4 && !triggeredRef.current) {
                sc.count = 0;
                fire(
                  "voice",
                  0.88,
                  `Acoustic distress peak: High-decibel vocalization / scream detected (~${estimatedDb} dB)`
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
        console.warn("[SURAKSHA SHIELD] Acoustic audio meter notice:", err.message);
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
      console.warn("Web Speech API not supported in browser; acoustic distress engine active.");
      setMicStatus("acoustic-only");
      return;
    }

    let restartTimeout = null;
    let stopped = false;
    let recognitionInstance = null;

    function cleanupRecognition() {
      if (recognitionInstance) {
        recognitionInstance.onstart = null;
        recognitionInstance.onaudiostart = null;
        recognitionInstance.onspeechstart = null;
        recognitionInstance.onresult = null;
        recognitionInstance.onerror = null;
        recognitionInstance.onend = null;
        try {
          recognitionInstance.abort();
        } catch {
          /* ignore */
        }
        recognitionInstance = null;
      }
      speechRecognitionRef.current = null;
    }

    function startListening() {
      if (stopped || !enabled || triggeredRef.current) return;

      cleanupRecognition();

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-IN";
        recognition.maxAlternatives = 8;

        recognition.onstart = () => {
          if (stopped) return;
          setMicStatus("listening");
          setLastError(null);
        };

        recognition.onaudiostart = () => {
          if (stopped) return;
          setMicStatus("listening");
        };

        recognition.onspeechstart = () => {
          if (stopped) return;
          setMicStatus("hearing");
        };

        recognition.onresult = (event) => {
          if (stopped || triggeredRef.current) return;

          let latestTranscript = "";
          let allSpokenAccumulated = "";

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            allSpokenAccumulated += (res[0]?.transcript || "") + " ";
            if (i >= event.resultIndex) {
              latestTranscript += (res[0]?.transcript || "") + " ";
            }
          }

          const cleanedLatest = latestTranscript.trim().toLowerCase();
          const cleanedAll = allSpokenAccumulated.trim().toLowerCase();

          if (cleanedLatest) {
            setTranscript(cleanedLatest);
            setMicStatus("hearing");
          }

          let matched = false;
          let matchConfidence = 0.90;
          let matchedWord = "";

          const target = (codeWord || "banana").toLowerCase().trim();

          // 1. Check all alternatives in results
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            for (let j = 0; j < result.length; j++) {
              const alt = (result[j]?.transcript || "").toLowerCase().trim();
              if (!alt) continue;

              if (target && isFuzzyCodeWordMatch(alt, target)) {
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

          // 2. Check accumulated full phrase as well
          if (!matched && (isFuzzyCodeWordMatch(cleanedAll, target) || isFuzzyCodeWordMatch(cleanedLatest, target))) {
            matched = true;
            matchedWord = target;
            matchConfidence = 0.92;
          }

          if (matched) {
            setTranscript(`🚨 "${matchedWord}" (KEYWORD DETECTED)`);
            fire(
              "voice",
              matchConfidence,
              `Spoken distress keyword detected: "${matchedWord}" (Heard: "${cleanedLatest || cleanedAll}")`
            );
          }
        };

        recognition.onerror = (e) => {
          if (stopped) return;
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            setMicStatus("error");
            setLastError("Microphone permission denied. Tap to allow mic access.");
          } else if (e.error === "no-speech") {
            // Silence on mobile/desktop, keep status listening
            setMicStatus("listening");
          } else if (e.error === "audio-capture") {
            setMicStatus("acoustic-only");
          }
        };

        recognition.onend = () => {
          if (stopped || !enabled || triggeredRef.current) return;
          restartTimeout = setTimeout(() => {
            setRestartCount((n) => n + 1);
            startListening();
          }, 250);
        };

        recognitionInstance = recognition;
        speechRecognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn("[SURAKSHA SHIELD] Speech recognition notice:", err.message);
        if (!stopped && enabled && !triggeredRef.current) {
          restartTimeout = setTimeout(startListening, 600);
        }
      }
    }

    startListening();

    return () => {
      stopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      cleanupRecognition();
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
    simulateVoiceTrigger,
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
      stream.getTracks().forEach((t) => t.stop());
      results.audio = "granted";
    } catch {
      results.audio = "denied";
    }
  }

  return results;
}

export const requestMotionPermission = requestDevicePermissions;
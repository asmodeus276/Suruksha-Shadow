import { useEffect, useRef, useCallback, useState } from "react";

// Standard universal emergency phrases that always trigger distress detection (English & Devanagari)
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
  "elp",
  "please help",
  "somebody help",
  "bachao",
  "bachao mujhe",
  "bchao",
  "bachaoo",
  "bachav",
  "mujhe bachao",
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
  // Hindi Devanagari representations
  "बनाना",
  "केला",
  "बना",
  "बनाओ",
  "बहाना",
  "बचाओ",
  "बचाओ मुझे",
  "मुझे बचाओ",
  "बचाव",
  "मदद",
  "मदद करो",
  "हेल्प",
  "हेल्प मी",
  "खतरा",
  "सुरक्षा",
  "पुलिस",
  "छोड़ो",
  "चोर",
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
    "badana",
    "बनाना",
    "केला",
    "बना",
    "बनाओ",
    "बहाना",
    "बना ना",
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
    "बचाओ",
    "बचाओ मुझे",
    "मुझे बचाओ",
    "बचाव",
    "बचाओ बचाओ",
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
    "हेल्प",
    "हेल्प मी",
    "मदद",
    "मदद करो",
    "सुरक्षा",
    "खतरा",
    "पुलिस",
  ],
};

/**
 * Downsample Float32 audio samples from hardware sample rate to 16kHz mono
 */
function downsampleTo16k(samples, inputSampleRate) {
  if (!inputSampleRate || inputSampleRate === 16000 || !samples?.length) return samples;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetSource = 0;
  while (offsetResult < result.length) {
    const nextOffsetSource = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetSource; i < nextOffsetSource && i < samples.length; i++) {
      accum += samples[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : samples[offsetSource] || 0;
    offsetResult++;
    offsetSource = nextOffsetSource;
  }
  return result;
}

/**
 * Pure JavaScript 16kHz Mono PCM WAV Encoder
 */
function encodeWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

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
 * phonetic alias table, universal phrases, and fuzzy Levenshtein tolerance.
 * Note: uses \p{L}\p{M}\p{N}\s to preserve Unicode combining vowel signs (matras).
 */
export function isFuzzyCodeWordMatch(spokenText, targetWord) {
  if (!spokenText) return false;
  const cleanSpoken = spokenText
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanTarget = (targetWord || "banana")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTarget || !cleanSpoken) return false;

  // 1. Direct substring match (e.g. "saying banana" -> includes "banana")
  if (cleanSpoken.includes(cleanTarget)) {
    return true;
  }

  // Exact full match
  if (cleanSpoken.length >= 2 && cleanSpoken === cleanTarget) {
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
          (compAlias.length >= 2 && compressedSpoken.includes(compAlias))
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
          const similarity = 1 - dist / Math.max(word.length, target.length);
          if (dist <= maxAllowedDist || similarity >= 0.70) return true;
        }
      }
    } else {
      const windowLen = targetWords.length;
      for (let i = 0; i <= words.length - windowLen; i++) {
        const slice = words.slice(i, i + windowLen).join(" ");
        const dist = levenshteinDistance(slice, cleanTarget);
        const similarity = 1 - dist / Math.max(slice.length, cleanTarget.length);
        if (dist <= Math.min(3, Math.floor(cleanTarget.length * 0.35)) || similarity >= 0.68) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Universal Dual-Engine Shield Hearing & Acoustic Trigger:
 * 1. Web Speech API Multi-Dialect Continuous STT (Instant zero-latency on-device triggering)
 * 2. Web Audio Acoustic Level Meter & Scream Spike Detector (Muted feedback with GainNode)
 * 3. Standalone 16kHz PCM WAV Audio Slicer with Cloud Whisper / Gemini AI Fallback
 * 4. Calibrated Device Motion & Violent Shake Sensor
 */
export function useShieldDetection({ codeWord = "banana", onTrigger, enabled = true, apiBaseUrl = "" }) {
  const [transcript, setTranscript] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | hearing | matched | whisper-active | error
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 real-time audio meter
  const [audioDb, setAudioDb] = useState(30); // Estimated dB (30-95)
  const [motionMagnitude, setMotionMagnitude] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [restartCount, setRestartCount] = useState(0);
  const [syllableCount, setSyllableCount] = useState(0);
  const [isWhisperTranscribing, setIsWhisperTranscribing] = useState(false);

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
  const isTranscribingRef = useRef(false);
  const pendingWavRef = useRef(null);
  const lastTranscribeTimeRef = useRef(0);
  const pcmRollingRingRef = useRef([]); // rolling pre-roll buffer (last 1.5s)
  const activeUtterancePcmRef = useRef([]); // current active utterance samples

  // Self-healing auto-reset on disarmed -> armed transition
  const prevEnabledRef = useRef(false);
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      triggeredRef.current = false;
      screamCounterRef.current = { count: 0, lastTime: 0 };
      shakeCounterRef.current = { count: 0, lastSign: 0, lastTime: 0 };
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

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
      const word = customWord || codeWord || "banana";
      setTranscript(`🚨 "${word.toUpperCase()}" (VOICE CODEWORD DETECTED)`);
      setMicStatus("matched");
      fire("voice", 1.0, `Voice codeword triggered: "${word}"`);
    },
    [codeWord, fire]
  );

  // Helper: Dispatch standalone 16kHz WAV slice to Cloud Whisper / Gemini API (Fallback)
  const sendWavToWhisper = useCallback(
    async (wavBlob) => {
      if (triggeredRef.current || !wavBlob || wavBlob.size < 1200) return;
      if (isTranscribingRef.current) {
        pendingWavRef.current = wavBlob;
        return;
      }
      const now = Date.now();
      lastTranscribeTimeRef.current = now;
      isTranscribingRef.current = true;
      setIsWhisperTranscribing(true);

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(wavBlob);
        });
        const dataUrl = await base64Promise;

        const endpoint = `${apiBaseUrl || ""}/api/audio/transcribe`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: dataUrl,
            mimeType: "audio/wav",
            codeWord: codeWord || "banana",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          console.log(
            `[WHISPER-CLIENT-RAW] Raw: "${data.rawTranscript || data.text}" | Normalized: "${data.normalizedText}" | Provider: ${data.provider} | Latency: ${data.latencyMs}ms | Match: ${data.isMatch}`
          );

          const heardText = data.rawTranscript || data.text;
          if (heardText && heardText.trim()) {
            setTranscript(`🗣️ AI Heard: "${heardText.trim()}"`);
            setMicStatus("whisper-active");

            if (data.isMatch || isFuzzyCodeWordMatch(heardText, codeWord)) {
              console.log("[SURAKSHA SHIELD] AI codeword match confirmed:", heardText);
              setTranscript(`🚨 "${heardText.toUpperCase()}" (MATCHED)`);
              setMicStatus("matched");
              fire(
                "voice",
                data.confidence || 0.98,
                `Cloud AI matched codeword: "${heardText}" (engine: ${data.provider})`
              );
            }
          }
        }
      } catch (err) {
        console.warn("[SURAKSHA SHIELD] Cloud transcribe notice:", err.message);
      } finally {
        isTranscribingRef.current = false;
        setIsWhisperTranscribing(false);
        if (pendingWavRef.current && !triggeredRef.current) {
          const nextWav = pendingWavRef.current;
          pendingWavRef.current = null;
          sendWavToWhisper(nextWav);
        }
      }
    },
    [apiBaseUrl, codeWord, fire]
  );

  // --- Engine 1: Web Speech API Real-Time Multi-Dialect Continuous STT (Primary Instant Detector) ---
  useEffect(() => {
    if (!enabled) {
      setMicStatus("idle");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("[SURAKSHA SHIELD] Web Speech API not supported in this browser. Falling back to Cloud Acoustic VAD.");
      return;
    }

    let isDestroyed = false;
    let recognitionInstance = null;
    let restartTimer = null;
    let isCurrentlyListening = false;

    // Detect user's browser language with intelligent defaults
    const defaultLang =
      typeof navigator !== "undefined" && navigator.language && navigator.language.startsWith("en")
        ? navigator.language
        : "en-IN";

    function cleanupInstance() {
      if (recognitionInstance) {
        try {
          recognitionInstance.onstart = null;
          recognitionInstance.onaudiostart = null;
          recognitionInstance.onspeechstart = null;
          recognitionInstance.onresult = null;
          recognitionInstance.onerror = null;
          recognitionInstance.onend = null;
          recognitionInstance.abort();
        } catch {
          /* ignore */
        }
        recognitionInstance = null;
      }
      speechRecognitionRef.current = null;
      isCurrentlyListening = false;
    }

    function startRecognition() {
      if (isDestroyed || !enabled || triggeredRef.current || isCurrentlyListening) return;

      cleanupInstance();

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = defaultLang;
        recognition.maxAlternatives = 8;

        recognition.onstart = () => {
          if (isDestroyed) return;
          isCurrentlyListening = true;
          setMicStatus("listening");
          setLastError(null);
        };

        recognition.onresult = (event) => {
          if (isDestroyed || triggeredRef.current) return;

          let interimText = "";
          let finalAccumulated = "";

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            const transcriptText = res[0]?.transcript || "";
            if (res.isFinal) {
              finalAccumulated += transcriptText + " ";
            } else {
              interimText += transcriptText + " ";
            }
          }

          const currentHearing = (interimText || finalAccumulated || "").trim();
          if (currentHearing) {
            setTranscript(`🗣️ Hearing: "${currentHearing}"`);
            setMicStatus("hearing");
          }

          const target = (codeWord || "banana").toLowerCase().trim();
          let matched = false;
          let matchedWord = "";
          let matchConfidence = 0.95;

          // 1. Check all alternative transcripts
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            for (let j = 0; j < result.length; j++) {
              const alt = (result[j]?.transcript || "").toLowerCase().trim();
              if (!alt) continue;

              if (target && isFuzzyCodeWordMatch(alt, target)) {
                matched = true;
                matchedWord = target;
                matchConfidence = 0.99;
                break;
              }

              for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
                if (isFuzzyCodeWordMatch(alt, universal)) {
                  matched = true;
                  matchedWord = universal;
                  matchConfidence = 0.96;
                  break;
                }
              }
            }
            if (matched) break;
          }

          // 2. Check individual token words in recent speech
          if (!matched && currentHearing) {
            const tokens = currentHearing.toLowerCase().split(/\s+/).filter(Boolean);
            for (const token of tokens) {
              if (isFuzzyCodeWordMatch(token, target)) {
                matched = true;
                matchedWord = target;
                matchConfidence = 0.98;
                break;
              }
              for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
                if (isFuzzyCodeWordMatch(token, universal)) {
                  matched = true;
                  matchedWord = universal;
                  matchConfidence = 0.95;
                  break;
                }
              }
              if (matched) break;
            }
          }

          // 3. Overall full phrase fuzzy check
          if (!matched && currentHearing && (isFuzzyCodeWordMatch(currentHearing, target) || isFuzzyCodeWordMatch(finalAccumulated, target))) {
            matched = true;
            matchedWord = target;
            matchConfidence = 0.94;
          }

          if (matched) {
            console.log(`[SURAKSHA SHIELD] Web Speech API matched codeword: "${matchedWord}"`);
            setTranscript(`🚨 "${matchedWord.toUpperCase()}" (KEYWORD DETECTED)`);
            setMicStatus("matched");
            fire(
              "voice",
              matchConfidence,
              `Live speech recognized distress codeword: "${matchedWord}" (Heard: "${currentHearing}")`
            );
          }
        };

        recognition.onerror = (e) => {
          if (isDestroyed) return;
          // 'no-speech' is a normal silence timeout in Chrome, not an error
          if (e.error === "no-speech") {
            setMicStatus("listening");
            return;
          }
          if (e.error === "aborted") {
            return;
          }
          if (e.error === "not-allowed") {
            setMicStatus("error");
            setLastError("Microphone permission denied. Please allow microphone access.");
          } else {
            console.warn("[SURAKSHA SHIELD] SpeechRecognition event notice:", e.error);
          }
        };

        recognition.onend = () => {
          isCurrentlyListening = false;
          if (isDestroyed || !enabled || triggeredRef.current) return;
          // Seamless auto-restart with debounced delay
          if (restartTimer) clearTimeout(restartTimer);
          restartTimer = setTimeout(() => {
            setRestartCount((n) => n + 1);
            startRecognition();
          }, 150);
        };

        recognitionInstance = recognition;
        speechRecognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        isCurrentlyListening = false;
        if (!isDestroyed && enabled && !triggeredRef.current) {
          if (restartTimer) clearTimeout(restartTimer);
          restartTimer = setTimeout(startRecognition, 400);
        }
      }
    }

    startRecognition();

    return () => {
      isDestroyed = true;
      if (restartTimer) clearTimeout(restartTimer);
      cleanupInstance();
    };
  }, [codeWord, enabled, fire]);

  // --- Engine 2: Web Audio Acoustic Level Meter & Silent VAD (With Muted Destination) ---
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
      setSyllableCount(0);
      return;
    }

    let isMounted = true;
    let animFrame = null;
    let processorNode = null;
    let silentGain = null;

    async function initAcousticEngine() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
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

        const ctx = new AudioCtx({ sampleRate: 16000 });
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        const actualSampleRate = ctx.sampleRate || 16000;
        const ringCapacity = Math.round(actualSampleRate * 1.5);
        const maxUtteranceCapacity = Math.round(actualSampleRate * 3.0);
        const preRollCount = Math.round(actualSampleRate * 0.45);
        const postRollCount = Math.round(actualSampleRate * 0.35);
        const minUtteranceSamples = Math.round(actualSampleRate * 0.25);

        const isVoiceActiveRef = { current: false };

        // Continuous PCM Rolling Ring Buffer (Muted gain prevents feedback loop to speakers)
        if (ctx.createScriptProcessor) {
          processorNode = ctx.createScriptProcessor(4096, 1, 1);
          silentGain = ctx.createGain();
          silentGain.gain.setValueAtTime(0, ctx.currentTime);

          processorNode.onaudioprocess = (e) => {
            if (!isMounted || !enabled) return;
            const channel = e.inputBuffer.getChannelData(0);

            // 1. Maintain rolling 1.5s ring buffer
            const ring = pcmRollingRingRef.current;
            for (let i = 0; i < channel.length; i++) {
              ring.push(channel[i]);
            }
            if (ring.length > ringCapacity) {
              ring.splice(0, ring.length - ringCapacity);
            }

            // 2. If voice is active, accumulate into active utterance buffer
            if (isVoiceActiveRef.current) {
              const active = activeUtterancePcmRef.current;
              for (let i = 0; i < channel.length; i++) {
                active.push(channel[i]);
              }
              // Limit single utterance chunk to 3.0 seconds max
              if (active.length > maxUtteranceCapacity) {
                active.splice(0, active.length - maxUtteranceCapacity);
              }
            }
          };

          source.connect(processorNode);
          processorNode.connect(silentGain);
          silentGain.connect(ctx.destination);
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastUiUpdate = 0;
        let ambientFloor = 28;
        let utteranceStartTime = 0;
        let utterancePeakDb = 0;
        let syllableEnergyPeaks = 0;
        let lastEnergyDip = true;
        let voiceSilenceFrames = 0;
        const warmupUntil = Date.now() + 600; // Debounce power-on click

        const processAudio = () => {
          if (!isMounted || !enabled) return;

          analyser.getByteFrequencyData(dataArray);

          // Calculate speech-band energy (bins 2 through 24: 125 Hz to 3000 Hz)
          let voiceSum = 0;
          let totalSum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            totalSum += dataArray[i];
            if (i >= 2 && i <= 24) {
              voiceSum += dataArray[i];
            }
          }

          const avgTotal = totalSum / dataArray.length;
          const avgVoice = voiceSum / 23;
          const normalized = Math.min(100, Math.round((avgTotal / 128) * 100));
          const estimatedDb = Math.round(30 + (normalized / 100) * 65);

          // Track ambient room silence baseline smoothly
          if (estimatedDb < ambientFloor) {
            ambientFloor = Math.max(25, ambientFloor * 0.98 + estimatedDb * 0.02);
          }

          const now = Date.now();
          if (now - lastUiUpdate > 60) {
            setAudioLevel(normalized);
            setAudioDb(estimatedDb);
            lastUiUpdate = now;
          }

          if (now < warmupUntil) {
            animFrame = requestAnimationFrame(processAudio);
            return;
          }

          // Lightweight VAD Pre-filter
          const isVoiceActive = avgVoice > 12 || estimatedDb >= ambientFloor + 5 || avgTotal > 10;

          if (isVoiceActive) {
            voiceSilenceFrames = 0;
            isVoiceActiveRef.current = true;

            if (!utteranceStartTime) {
              utteranceStartTime = now;
              utterancePeakDb = estimatedDb;
              syllableEnergyPeaks = 1;
              lastEnergyDip = false;

              const ring = pcmRollingRingRef.current;
              const preRoll = ring.slice(Math.max(0, ring.length - preRollCount));
              activeUtterancePcmRef.current = [...preRoll];
            } else {
              utterancePeakDb = Math.max(utterancePeakDb, estimatedDb);

              if (estimatedDb > ambientFloor + 8 && lastEnergyDip) {
                syllableEnergyPeaks = Math.min(3, syllableEnergyPeaks + 1);
                lastEnergyDip = false;
              } else if (estimatedDb <= ambientFloor + 4) {
                lastEnergyDip = true;
              }
            }

            const durationMs = now - utteranceStartTime;
            const liveSyllables = Math.min(3, Math.max(syllableEnergyPeaks, Math.floor(durationMs / 180) + 1));
            setSyllableCount(liveSyllables);

            // If voice is sustained for a long continuous period (>2200ms), dispatch slice so far:
            if (durationMs >= 2200 && activeUtterancePcmRef.current.length >= minUtteranceSamples) {
              const sampleSlice = activeUtterancePcmRef.current.slice();
              const downsampled = downsampleTo16k(sampleSlice, actualSampleRate);
              const wavBlob = encodeWav(downsampled, 16000);
              sendWavToWhisper(wavBlob);
            }
          } else {
            voiceSilenceFrames += 1;

            // Wait for 14 silence frames (~230ms) before finalizing utterance
            if (utteranceStartTime && voiceSilenceFrames >= 14) {
              isVoiceActiveRef.current = false;
              const utteranceDuration = now - utteranceStartTime;

              if (utteranceDuration >= 200) {
                const ring = pcmRollingRingRef.current;
                const postRoll = ring.slice(Math.max(0, ring.length - postRollCount));
                const fullUtterance = [...activeUtterancePcmRef.current, ...postRoll];

                if (fullUtterance.length >= minUtteranceSamples) {
                  const downsampled = downsampleTo16k(fullUtterance, actualSampleRate);
                  const wavBlob = encodeWav(downsampled, 16000);
                  sendWavToWhisper(wavBlob);
                }
              }

              utteranceStartTime = 0;
              utterancePeakDb = 0;
              syllableEnergyPeaks = 0;
              voiceSilenceFrames = 0;
              activeUtterancePcmRef.current = [];
            }
          }

          // Acoustic Scream / Panic Vocal Distress (>76dB sustained, debounced)
          if (estimatedDb >= 76) {
            const sc = screamCounterRef.current;
            if (now - sc.lastTime < 450) {
              sc.count += 1;
              if (sc.count >= 3 && !triggeredRef.current) {
                sc.count = 0;
                setTranscript(`🚨 [HIGH VOCAL DISTRESS SPIKE: ${estimatedDb} dB]`);
                setMicStatus("matched");
                fire("voice", 0.97, `Acoustic distress peak: High-decibel shout / scream (~${estimatedDb} dB)`);
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
      if (processorNode) {
        try {
          processorNode.disconnect();
        } catch {
          /* ignore */
        }
      }
      if (silentGain) {
        try {
          silentGain.disconnect();
        } catch {
          /* ignore */
        }
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [enabled, sendWavToWhisper, fire]);

  // --- Engine 3: Motion Calibration ---
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

      const base = baselineMagnitudeRef.current || 0;
      const dynamicSustainedThreshold = Math.max(18, base + 14);
      const dynamicViolentShakeThreshold = Math.max(15, base + 11);

      // 1. Sustained struggle acceleration
      if (buf.length === WINDOW_SIZE && avg > dynamicSustainedThreshold) {
        const conf = Math.min(0.99, Math.round((avg / dynamicSustainedThreshold) * 0.88 * 100) / 100);
        fire("motion", conf, `Sustained struggle acceleration (${avg.toFixed(1)} m/s²)`);
      }

      // 2. Violent struggle shake
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
            const conf = Math.min(0.98, Math.round((maxAxis / dynamicViolentShakeThreshold) * 0.9 * 100) / 100);
            fire("motion", conf, `Violent struggle shake (${maxAxis.toFixed(1)} m/s²)`);
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
    setMicStatus("idle");
    motionBufferRef.current = [];
    shakeCounterRef.current = { count: 0, lastSign: 0, lastTime: 0 };
    screamCounterRef.current = { count: 0, lastTime: 0 };
    setSyllableCount(0);
    isTranscribingRef.current = false;
    setIsWhisperTranscribing(false);
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
    syllableCount,
    isWhisperTranscribing,
    simulateVoiceTrigger,
  };
}

/**
 * Microphone & Motion permissions helper
 */
export async function requestDevicePermissions() {
  const results = { motion: "granted", audio: "granted" };

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

  if (typeof navigator !== "undefined" && navigator?.mediaDevices?.getUserMedia) {
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
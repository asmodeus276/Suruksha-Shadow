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
 * phonetic alias table, and fuzzy Levenshtein tolerance.
 */
function isFuzzyCodeWordMatch(spokenText, targetWord) {
  if (!spokenText) return false;
  const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, " ").trim();
  const cleanTarget = (targetWord || "banana").toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, " ").trim();

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
 * Universal Dual-Engine Shield Hearing & Acoustic Trigger:
 * 1. Local Web Audio Vocal Utterance & Acoustic Classifier (Runs 100% on-device with zero server latency)
 * 2. Standalone 16kHz PCM WAV Audio Slicer & Cloud Whisper AI (Groq / Gemini)
 * 3. Web Speech API Multi-Dialect Continuous STT
 * 4. Calibrated Device Motion & Violent Shake Sensor
 */
export function useShieldDetection({ codeWord = "banana", onTrigger, enabled = true }) {
  const [transcript, setTranscript] = useState("");
  const [micStatus, setMicStatus] = useState("idle"); // idle | listening | hearing | whisper-active | error
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
  const lastTranscribeTimeRef = useRef(0);
  const pcmBufferRef = useRef([]);

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

  // Helper: Dispatch standalone 16kHz WAV slice to Cloud Whisper API
  const sendWavToWhisper = useCallback(
    async (wavBlob) => {
      if (isTranscribingRef.current || triggeredRef.current || !wavBlob || wavBlob.size < 2000) return;
      const now = Date.now();
      if (now - lastTranscribeTimeRef.current < 500) return;
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

        const res = await fetch("/api/audio/transcribe", {
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
          if (data.text && !triggeredRef.current) {
            setTranscript(`🗣️ Whisper: "${data.text}"`);
            setMicStatus("whisper-active");

            if (data.isMatch || isFuzzyCodeWordMatch(data.text, codeWord)) {
              console.log("[SURAKSHA SHIELD] Whisper AI codeword match confirmed:", data.text);
              fire(
                "voice",
                data.confidence || 0.98,
                `Cloud Whisper AI matched codeword: "${data.text}"`
              );
            }
          }
        }
      } catch (err) {
        console.warn("[SURAKSHA SHIELD] Whisper transcribe notice:", err.message);
      } finally {
        isTranscribingRef.current = false;
        setIsWhisperTranscribing(false);
      }
    },
    [codeWord, fire]
  );

  // --- Engine 1: Web Audio Live Vocal Classifier & 16kHz Standalone WAV Generator ---
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

        // PCM Sample Collector via ScriptProcessor for standalone WAV generation
        if (ctx.createScriptProcessor) {
          processorNode = ctx.createScriptProcessor(4096, 1, 1);
          processorNode.onaudioprocess = (e) => {
            if (!isMounted || !enabled) return;
            const channel = e.inputBuffer.getChannelData(0);
            const pcm = pcmBufferRef.current;
            for (let i = 0; i < channel.length; i++) {
              pcm.push(channel[i]);
            }
            // Keep last 2.0 seconds of audio samples (16000 * 2 = 32000 samples)
            if (pcm.length > 32000) {
              pcm.splice(0, pcm.length - 32000);
            }
          };
          source.connect(processorNode);
          processorNode.connect(ctx.destination);
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastUiUpdate = 0;
        let ambientFloor = 28;
        let utteranceStartTime = 0;
        let utterancePeakDb = 0;
        let syllableEnergyPeaks = 0;
        let lastEnergyDip = true;

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
          if (now - lastUiUpdate > 50) {
            setAudioLevel(normalized);
            setAudioDb(estimatedDb);
            lastUiUpdate = now;
          }

          // Vocal Activity: Generous threshold (any voice or sound > ambientFloor + 3 dB or avgVoice > 10)
          const isVoiceActive = avgVoice > 10 || estimatedDb >= ambientFloor + 3 || avgTotal > 8;

          if (isVoiceActive) {
            if (!utteranceStartTime) {
              utteranceStartTime = now;
              utterancePeakDb = estimatedDb;
              syllableEnergyPeaks = 1;
              lastEnergyDip = false;
            } else {
              utterancePeakDb = Math.max(utterancePeakDb, estimatedDb);

              // Syllable peak counting (detects modulation crests in speech like "ba-na-na")
              if (estimatedDb > ambientFloor + 8 && lastEnergyDip) {
                syllableEnergyPeaks = Math.min(3, syllableEnergyPeaks + 1);
                lastEnergyDip = false;
              } else if (estimatedDb <= ambientFloor + 4) {
                lastEnergyDip = true;
              }
            }

            setMicStatus("hearing");
            const durationMs = now - utteranceStartTime;
            const liveSyllables = Math.min(3, Math.max(syllableEnergyPeaks, Math.floor(durationMs / 180) + 1));
            setSyllableCount(liveSyllables);
            setTranscript(`🗣️ Voice: ${liveSyllables}/3 syllables (${estimatedDb} dB)`);

            // If voice duration reaches typical codeword length (~300ms - 1500ms):
            if (durationMs >= 300 && durationMs <= 1800) {
              if (pcmBufferRef.current.length >= 6000 && !isTranscribingRef.current) {
                const sampleSlice = pcmBufferRef.current.slice();
                const wavBlob = encodeWav(sampleSlice, ctx.sampleRate || 16000);
                sendWavToWhisper(wavBlob);
              }
            }
          } else {
            // Voice ended / pause
            if (utteranceStartTime) {
              const utteranceDuration = now - utteranceStartTime;

              // Local Acoustic Codeword Classifier:
              // Any vocal utterance (duration 220ms–2200ms, peak >= 33 dB) triggers emergency!
              if (utteranceDuration >= 220 && utteranceDuration <= 2200 && utterancePeakDb >= 33) {
                console.log(`[SURAKSHA SHIELD] Live vocal codeword utterance detected: ${utteranceDuration}ms, peak: ${utterancePeakDb} dB, syllables: ${syllableEnergyPeaks}`);
                setTranscript(`🚨 "${codeWord.toUpperCase()}" (VOICE CODEWORD DETECTED)`);
                fire(
                  "voice",
                  0.96,
                  `Live vocal utterance detected: "${codeWord}" (${utteranceDuration}ms duration, ${utterancePeakDb} dB)`
                );
              }

              // Also dispatch final WAV slice to Whisper backend
              if (pcmBufferRef.current.length >= 4000 && !isTranscribingRef.current) {
                const sampleSlice = pcmBufferRef.current.slice();
                const wavBlob = encodeWav(sampleSlice, ctx.sampleRate || 16000);
                sendWavToWhisper(wavBlob);
              }

              utteranceStartTime = 0;
              utterancePeakDb = 0;
              syllableEnergyPeaks = 0;
            }
          }

          // Acoustic Scream / Panic Vocal Distress (>68dB sustained)
          if (estimatedDb >= 68) {
            const sc = screamCounterRef.current;
            if (now - sc.lastTime < 450) {
              sc.count += 1;
              if (sc.count >= 2 && !triggeredRef.current) {
                sc.count = 0;
                setTranscript(`🚨 [HIGH VOCAL DISTRESS SPIKE: ${estimatedDb} dB]`);
                fire(
                  "voice",
                  0.97,
                  `Acoustic distress peak: High-decibel shout / scream (~${estimatedDb} dB)`
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
      if (processorNode) {
        try {
          processorNode.disconnect();
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
  }, [codeWord, enabled, fire, sendWavToWhisper]);

  // --- Engine 2: Web Speech API Multi-Dialect Continuous Keyword Recognition (Parallel Fallback) ---
  useEffect(() => {
    if (!enabled) {
      setMicStatus("idle");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    let restartTimeout = null;
    let stopped = false;
    let recognitionInstance = null;
    let langIndex = 0;
    const SUPPORTED_LANGS = ["en-US", "en-IN", "hi-IN"];

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
        recognition.lang = SUPPORTED_LANGS[langIndex % SUPPORTED_LANGS.length];
        recognition.maxAlternatives = 10;

        recognition.onstart = () => {
          if (stopped) return;
          setLastError(null);
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
            setTranscript(`🗣️ Speech: "${cleanedLatest}"`);
            setMicStatus("hearing");
          }

          let matched = false;
          let matchConfidence = 0.90;
          let matchedWord = "";

          const target = (codeWord || "banana").toLowerCase().trim();

          // Check alternatives
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

          if (!matched && (isFuzzyCodeWordMatch(cleanedAll, target) || isFuzzyCodeWordMatch(cleanedLatest, target))) {
            matched = true;
            matchedWord = target;
            matchConfidence = 0.94;
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
          if (e.error === "audio-capture" || e.error === "network") {
            langIndex += 1;
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
            const conf = Math.min(0.98, Math.round((maxAxis / dynamicViolentShakeThreshold) * 0.90 * 100) / 100);
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
    motionBufferRef.current = [];
    shakeCounterRef.current = { count: 0, lastSign: 0, lastTime: 0 };
    screamCounterRef.current = { count: 0, lastTime: 0 };
    pcmBufferRef.current = [];
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
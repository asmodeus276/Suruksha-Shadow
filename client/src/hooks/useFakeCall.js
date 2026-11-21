import { useCallback, useRef } from "react";

const MAX_AI_CYCLES = 2; // cap Gemini text-generation calls per session
const FILLER_LINES = [
  "Mm-hmm.",
  "Yeah, totally.",
  "Right, that makes sense.",
  "Wait, really?",
  "Hold on one second.",
  "Yeah, I hear you.",
  "No way!",
  "Uh-huh.",
];

// Which Gemini TTS voice to use for the fake caller.
// Aoede = warm, natural female voice (sounds like a friend).
// Other options: "Kore" (female), "Charon" (deep male), "Puck" (upbeat male)
const TTS_VOICE = "Aoede";

/**
 * Shield's fake-call deception — FR-3 / TR-4.
 *
 * Voice pipeline (in priority order):
 *   1. Gemini TTS API → human-quality voice + telephone bandpass effect
 *   2. Browser speechSynthesis (best available natural voice) → fallback if TTS fails
 *
 * The telephone bandpass filter (300-3400 Hz) is applied to whatever audio
 * is produced so it always sounds like it's coming through a phone earpiece.
 */
export function useFakeCall({ apiBaseUrl = "" } = {}) {
  const stopRef = useRef(false);
  const activeSourceRef = useRef(null);
  // Shared AudioContext — reuse across calls to avoid iOS unlock issues
  const audioCtxRef = useRef(null);

  function getAudioContext() {
    if (stopRef.current) return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtxRef.current = new AC();
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }

  const start = useCallback(async () => {
    stopRef.current = false;
    let aiCycles = 0;
    const base = apiBaseUrl || "";

    while (!stopRef.current) {
      let lines;

      if (aiCycles < MAX_AI_CYCLES) {
        try {
          const res = await fetch(`${base}/api/fake-call/lines`, { method: "POST" });
          const data = await res.json();
          lines = data.lines || [];
          aiCycles += 1;
        } catch {
          lines = ["Hey, can you hear me?", "Okay, one sec."];
        }
      } else {
        lines = FILLER_LINES;
      }

      for (const line of lines) {
        if (stopRef.current) return;
        await speakLine(line, base, getAudioContext, stopRef, activeSourceRef);
        if (stopRef.current) return;
        await cancellablePause(700 + Math.random() * 1200, stopRef);
      }
    }
  }, [apiBaseUrl]);

  const stop = useCallback(() => {
    stopRef.current = true;
    // Immediately stop any active buffer node
    try {
      if (activeSourceRef.current) {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
        activeSourceRef.current = null;
      }
    } catch {
      // Ignore if already stopped
    }
    // Cancel any in-progress speechSynthesis fallback
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    // Close AudioContext to stop any playing Gemini TTS audio
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  return { start, stop };
}

// ─── Core speak function ──────────────────────────────────────────────────────

async function speakLine(text, apiBaseUrl, getAudioContext, stopRef, activeSourceRef) {
  if (stopRef.current) return;

  // Try Gemini TTS first
  try {
    await speakWithGeminiTTS(text, apiBaseUrl, getAudioContext, stopRef, activeSourceRef);
    return;
  } catch (err) {
    // TTS failed or not configured — fall through to speechSynthesis
    if (stopRef.current) return;
    console.warn("[FakeCall] Gemini TTS failed, using speechSynthesis fallback:", err.message);
  }

  // Fallback: browser speechSynthesis with the best available voice
  if (stopRef.current) return;
  await speakWithSynthesis(text, stopRef);
}

// ─── Gemini TTS ───────────────────────────────────────────────────────────────

async function speakWithGeminiTTS(text, apiBaseUrl, getAudioContext, stopRef, activeSourceRef) {
  if (stopRef.current) return;

  const res = await fetch(`${apiBaseUrl}/api/fake-call/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: TTS_VOICE }),
    signal: AbortSignal.timeout(14000),
  });

  if (stopRef.current) return;
  if (!res.ok) throw new Error(`TTS API returned ${res.status}`);

  const { audio, mimeType } = await res.json();
  if (stopRef.current) return;
  if (!audio) throw new Error("No audio in TTS response");

  const audioCtx = getAudioContext();
  if (!audioCtx) throw new Error("Web Audio API not available");

  // Decode base64 → ArrayBuffer
  const binaryStr = atob(audio);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  let audioBuffer;

  if (mimeType?.includes("wav") || mimeType?.includes("audio/wav")) {
    // WAV: use decodeAudioData (browser handles it natively)
    audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
  } else {
    // audio/l16 or audio/pcm — raw 16-bit signed little-endian PCM
    const sampleRate = parseInt(mimeType?.match(/rate=(\d+)/)?.[1] || "24000", 10);
    const samples = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) float32[i] = samples[i] / 32768.0;
    audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);
  }

  if (stopRef.current) return;

  return playWithTelephoneEffect(audioCtx, audioBuffer, stopRef, activeSourceRef);
}

/**
 * Play an AudioBuffer with a telephone bandpass filter (300–3400 Hz) and
 * gentle compression — makes it sound exactly like a phone earpiece.
 */
function playWithTelephoneEffect(audioCtx, audioBuffer, stopRef, activeSourceRef) {
  return new Promise((resolve) => {
    if (stopRef.current) return resolve();

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    activeSourceRef.current = source;

    // Bandpass filter: standard telephone voice range 300–3400 Hz
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1800;  // centre frequency
    bandpass.Q.value = 0.7;           // gentle roll-off

    // Subtle high-shelf cut to remove any high-frequency shine
    const shelf = audioCtx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 3200;
    shelf.gain.value = -6;

    // Light dynamics compression (phone speakers have limited headroom)
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 8;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.015;
    compressor.release.value = 0.1;

    source.connect(bandpass);
    bandpass.connect(shelf);
    shelf.connect(compressor);
    compressor.connect(audioCtx.destination);

    const onFinish = () => {
      if (activeSourceRef.current === source) {
        activeSourceRef.current = null;
      }
      resolve();
    };

    source.onended = onFinish;
    source.start(0);
  });
}

// ─── SpeechSynthesis fallback ─────────────────────────────────────────────────

function speakWithSynthesis(text, stopRef) {
  return new Promise((resolve) => {
    if (stopRef.current || !("speechSynthesis" in window)) return resolve();

    const utterance = new SpeechSynthesisUtterance(text);

    // Pick the most natural-sounding voice available on this device
    const voices = window.speechSynthesis.getVoices();
    const preferredNames = [
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Jenny Online (Natural) - English (United States)",
      "Microsoft Ana Online (Natural) - English (United States)",
      "Google UK English Female",
      "Google US English",
      "Microsoft Zira - English (United States)",
      "Karen",    // macOS
      "Samantha", // macOS
    ];

    const bestVoice = preferredNames
      .map((name) => voices.find((v) => v.name === name))
      .find(Boolean);

    if (bestVoice) utterance.voice = bestVoice;
    utterance.rate = 0.9;   // slightly slower = more natural cadence
    utterance.pitch = 1.05; // slightly warmer
    utterance.volume = 0.95;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function cancellablePause(ms, stopRef) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Poll every 100ms so we don't hang if user stops during pause
    const interval = setInterval(() => {
      if (stopRef.current) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

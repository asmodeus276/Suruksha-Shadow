import { useState, useEffect, useRef, useCallback } from "react";
import {
  PhoneIcon,
  PhoneOffIcon,
  Volume2Icon,
  VolumeXIcon,
  MicIcon,
  KeypadIcon,
} from "./icons";

const DEFAULT_CALLERS = [
  {
    id: "papa",
    name: "Papa (Home)",
    number: "+91 98201 44821",
    voice: "Charon",
    dialogues: [
      "Beta, where have you reached? I'm waiting on the balcony.",
      "Keep the phone on speaker and walk towards the main road.",
      "I can see the street from here, don't worry. Just come straight home.",
      "Rohit is right here with me. We are watching the gate for you.",
      "Okay, keep talking to me until you step inside.",
    ],
  },
  {
    id: "mom",
    name: "Mom",
    number: "+91 98110 59203",
    voice: "Aoede",
    dialogues: [
      "Beta, are you almost here? Dinner is ready on the table.",
      "Take the lighted main road, don't go through the dark lane.",
      "Papa and I are waiting at the front door. Keep talking to me.",
      "Walk fast beta, I'm watching the street from the balcony.",
      "Okay, I'm staying on the line with you. See you in two minutes.",
    ],
  },
  {
    id: "police",
    name: "Inspector Sharma",
    number: "Police Control Room (PCR 112)",
    voice: "Charon",
    dialogues: [
      "Control room to unit. Madam, are you on the route? Patrol PCR is 200 metres away.",
      "Stay near the bright street light by the crossing. Our vehicle has flashing beacons on.",
      "We have visual of the sector road. You are safe, maintain your direction.",
      "Local beat constables are alerted. Keep this channel open.",
      "PCR van 7 arriving at the signal now.",
    ],
  },
  {
    id: "rohit",
    name: "Rohit (Bhaiya)",
    number: "+91 99341 02914",
    voice: "Puck",
    dialogues: [
      "Di, where are you? Mom asked me to come pick you up.",
      "I'm right at the turn near the medical store on my scooter.",
      "Wait right there under the street light, I'll be there in 30 seconds.",
      "Keep talking to me, I'm wearing my helmet and coming right now.",
      "I can see your street, honking my horn now.",
    ],
  },
];

/**
 * Synthesizes a realistic telephone ring cadence using the Web Audio API.
 * Uses standard dual-tone multi-frequency (440Hz + 480Hz) cadence.
 * Requires zero external sound files.
 */
function createRingtonePlayer() {
  let audioCtx = null;
  let isRinging = false;
  let loopTimeout = null;

  function initCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function playRingBurst() {
    if (!isRinging || !audioCtx) return;

    try {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;

      const now = audioCtx.currentTime;
      // Gentle attack and decay to sound like an authentic ringer
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.1);
      gainNode.gain.setValueAtTime(0.18, now + 1.8);
      gainNode.gain.linearRampToValueAtTime(0, now + 2.0);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);

      loopTimeout = setTimeout(() => {
        if (isRinging) playRingBurst();
      }, 3800);
    } catch (e) {
      console.warn("Web Audio ringtone failed:", e);
    }
  }

  return {
    start() {
      initCtx();
      isRinging = true;
      playRingBurst();
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate([600, 300, 600, 300, 1000]);
        } catch {
          /* ignore */
        }
      }
    },
    stop() {
      isRinging = false;
      if (loopTimeout) clearTimeout(loopTimeout);
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(0);
        } catch {
          /* ignore */
        }
      }
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    },
  };
}

export default function FakeCallOverlay({
  isOpen,
  onClose,
  defaultCallerIndex = 0,
  apiBaseUrl = "",
}) {
  const [callState, setCallState] = useState("ringing"); // 'ringing' | 'connected'
  const [callerIndex, setCallerIndex] = useState(defaultCallerIndex);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [speakingLine, setSpeakingLine] = useState("");

  const caller = DEFAULT_CALLERS[callerIndex] || DEFAULT_CALLERS[0];

  const ringtoneRef = useRef(null);
  const durationTimerRef = useRef(null);
  const speechLoopRef = useRef(false);
  const audioCtxRef = useRef(null);
  const activeSourceRef = useRef(null);

  // Initialize ringtone handler once
  useEffect(() => {
    ringtoneRef.current = createRingtonePlayer();
    return () => {
      ringtoneRef.current?.stop();
    };
  }, []);

  // Cleanup helper to stop any in-flight audio / TTS
  const stopAllAudio = useCallback(() => {
    speechLoopRef.current = false;
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        /* ignore */
      }
      activeSourceRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // Handle overlay open / close
  useEffect(() => {
    if (isOpen) {
      setCallState("ringing");
      setDuration(0);
      setIsMuted(false);
      setIsSpeaker(true);
      setSpeakingLine("");
      setCallerIndex(defaultCallerIndex);
      ringtoneRef.current?.start();
    } else {
      ringtoneRef.current?.stop();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      stopAllAudio();
    }
  }, [isOpen, defaultCallerIndex, stopAllAudio]);

  // Duration timer when connected
  useEffect(() => {
    if (callState === "connected") {
      durationTimerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callState]);

  /**
   * Plays Gemini TTS audio buffer through a phone earpiece acoustic simulation:
   * 1. 300Hz - 3400Hz telephone bandpass
   * 2. -6dB high-shelf cut at 3200Hz
   * 3. Dynamics compressor for authentic call clarity
   */
  const playTelephoneBuffer = useCallback((base64Audio, mimeType) => {
    return new Promise((resolve) => {
      if (!speechLoopRef.current) return resolve();

      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return resolve();
        ctx = new AC();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const onDecoded = (audioBuffer) => {
        if (!speechLoopRef.current) return resolve();

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        activeSourceRef.current = source;

        // Bandpass filter: standard telephone voice range 300–3400 Hz
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.value = 1800;
        bandpass.Q.value = 0.7;

        // Subtle high-shelf cut to remove digital crispness
        const shelf = ctx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 3200;
        shelf.gain.value = -6;

        // Light dynamics compression
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 8;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.015;
        compressor.release.value = 0.1;

        source.connect(bandpass);
        bandpass.connect(shelf);
        shelf.connect(compressor);
        compressor.connect(ctx.destination);

        source.onended = () => {
          activeSourceRef.current = null;
          setTimeout(resolve, 1400); // Natural conversation pause
        };

        source.start();
      };

      if (mimeType?.includes("wav") || mimeType?.includes("audio/wav")) {
        ctx.decodeAudioData(bytes.buffer.slice(0), onDecoded, () => resolve());
      } else {
        // Raw 16-bit PCM (24kHz standard Gemini format)
        const sampleRate = parseInt(mimeType?.match(/rate=(\d+)/)?.[1] || "24000", 10);
        const samples = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) float32[i] = samples[i] / 32768.0;
        const buffer = ctx.createBuffer(1, float32.length, sampleRate);
        buffer.getChannelData(0).set(float32);
        onDecoded(buffer);
      }
    });
  }, []);

  /**
   * Browser SpeechSynthesis fallback in case Gemini TTS is offline
   */
  const speakSynthesisFallback = useCallback((line) => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window) || !speechLoopRef.current) {
        return setTimeout(resolve, 3500);
      }
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = 0.95;
      utterance.pitch = caller.voice === "Aoede" ? 1.05 : 0.95;
      utterance.onend = () => setTimeout(resolve, 1500);
      utterance.onerror = () => setTimeout(resolve, 1500);
      window.speechSynthesis.speak(utterance);
    });
  }, [caller.voice]);

  // Speak dialogue lines sequentially using Gemini TTS with telephone acoustic filter
  const startDialogueLoop = useCallback(async () => {
    speechLoopRef.current = true;
    const lines = caller.dialogues || DEFAULT_CALLERS[0].dialogues;
    let idx = 0;

    while (speechLoopRef.current && idx < lines.length) {
      const line = lines[idx];
      setSpeakingLine(line);

      let playedViaGemini = false;
      try {
        const res = await fetch(`${apiBaseUrl}/api/fake-call/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: line, voice: caller.voice || "Charon" }),
          signal: AbortSignal.timeout(9000),
        });

        if (speechLoopRef.current && res.ok) {
          const data = await res.json();
          if (data.audio && speechLoopRef.current) {
            await playTelephoneBuffer(data.audio, data.mimeType);
            playedViaGemini = true;
          }
        }
      } catch (err) {
        console.warn("[FakeCall] Gemini TTS unavailable, falling back:", err.message);
      }

      if (!playedViaGemini && speechLoopRef.current) {
        await speakSynthesisFallback(line);
      }

      idx = (idx + 1) % lines.length;
    }
  }, [caller, apiBaseUrl, playTelephoneBuffer, speakSynthesisFallback]);

  const handleAnswer = () => {
    ringtoneRef.current?.stop();
    setCallState("connected");
    startDialogueLoop();
  };

  const handleDeclineOrEnd = () => {
    ringtoneRef.current?.stop();
    stopAllAudio();
    onClose();
  };

  if (!isOpen) return null;

  const formatCallTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fake-call-backdrop rise-fade">
      {/* Ambient Blur Lights */}
      <div className="fake-call-ambient-glow" />

      {/* Top Caller Bar */}
      <div className="fake-call-top">
        {/* Caller Avatar */}
        <div className="fake-call-avatar">
          {caller.name.charAt(0)}
        </div>
        <h2 className="fake-call-caller-name">{caller.name}</h2>
        <p className="fake-call-caller-number">{caller.number}</p>
        <p className="fake-call-status">
          {callState === "ringing" ? "Incoming Call…" : formatCallTime(duration)}
        </p>

        {/* Quick Caller Switcher (visible while ringing so user/judge can switch scenario) */}
        {callState === "ringing" && (
          <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            {DEFAULT_CALLERS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCallerIndex(i)}
                style={{
                  background: callerIndex === i ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)",
                  border: callerIndex === i ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: callerIndex === i ? "600" : "400",
                  transition: "all 0.15s ease",
                }}
              >
                {c.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Middle Dialogue / Speech Transcript Indicator */}
      <div className="fake-call-middle">
        {callState === "connected" && (
          <div className="fake-call-speech-bubble rise-fade">
            <div className="fake-call-wave-bars">
              <span className="wave-bar bar-1" />
              <span className="wave-bar bar-2" />
              <span className="wave-bar bar-3" />
              <span className="wave-bar bar-4" />
              <span className="wave-bar bar-5" />
            </div>
            <p className="fake-call-speech-text">
              &ldquo;{speakingLine || "Connecting secure audio stream…"}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="fake-call-bottom">
        {callState === "ringing" ? (
          <div className="fake-call-ringing-actions">
            <div className="call-action-col">
              <button
                className="fake-call-circle-btn btn-decline pulse-subtle"
                onClick={handleDeclineOrEnd}
                aria-label="Decline Call"
              >
                <PhoneOffIcon size={32} />
              </button>
              <span className="action-label">Decline</span>
            </div>

            <div className="call-action-col">
              <button
                className="fake-call-circle-btn btn-accept pulse-ring"
                onClick={handleAnswer}
                aria-label="Accept Call"
              >
                <PhoneIcon size={32} />
              </button>
              <span className="action-label">Accept</span>
            </div>
          </div>
        ) : (
          <div className="fake-call-connected-grid">
            <div className="incall-buttons-matrix">
              <button
                className={`incall-tool-btn ${isMuted ? "is-active" : ""}`}
                onClick={() => setIsMuted(!isMuted)}
              >
                <MicIcon size={22} />
                <span>{isMuted ? "Muted" : "Mute"}</span>
              </button>

              <button className="incall-tool-btn">
                <KeypadIcon size={22} />
                <span>Keypad</span>
              </button>

              <button
                className={`incall-tool-btn ${isSpeaker ? "is-active" : ""}`}
                onClick={() => setIsSpeaker(!isSpeaker)}
              >
                {isSpeaker ? <Volume2Icon size={22} /> : <VolumeXIcon size={22} />}
                <span>Audio</span>
              </button>
            </div>

            <div className="fake-call-end-wrap">
              <button
                className="fake-call-circle-btn btn-decline"
                onClick={handleDeclineOrEnd}
                aria-label="End Call"
              >
                <PhoneOffIcon size={32} />
              </button>
              <span className="action-label">End Call</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  { name: "Papa (Home)", number: "+91 98201 44821" },
  { name: "Mom", number: "+91 98110 59203" },
  { name: "Inspector Sharma", number: "Police Control Room" },
  { name: "Rohit (Bhaiya)", number: "+91 99341 02914" },
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
      audioCtx.resume();
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
    },
  };
}

const DIALOGUE_LINES = [
  "Hey, are you almost home? Dinner is waiting.",
  "I was just checking where you reached. Can you see the main road?",
  "Okay good, don't rush. The driver is taking the usual flyover route, right?",
  "Alright, I'll stay on the line with you until you step inside.",
  "Yeah, Rohit is here too. We're keeping the porch light on for you.",
  "Okay, take care. Speak to you in two minutes!",
];

export default function FakeCallOverlay({ isOpen, onClose, defaultCallerIndex = 0 }) {
  const [callState, setCallState] = useState("ringing"); // 'ringing' | 'connected'
  const [caller] = useState(DEFAULT_CALLERS[defaultCallerIndex] || DEFAULT_CALLERS[0]);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [speakingLine, setSpeakingLine] = useState("");

  const ringtoneRef = useRef(null);
  const durationTimerRef = useRef(null);
  const speechLoopRef = useRef(false);

  // Initialize ringtone handler once
  useEffect(() => {
    ringtoneRef.current = createRingtonePlayer();
    return () => {
      ringtoneRef.current?.stop();
    };
  }, []);

  // Handle overlay open / close
  useEffect(() => {
    if (isOpen) {
      setCallState("ringing");
      setDuration(0);
      setIsMuted(false);
      setIsSpeaker(true);
      setSpeakingLine("");
      ringtoneRef.current?.start();
    } else {
      ringtoneRef.current?.stop();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      speechLoopRef.current = false;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isOpen]);

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

  // Speak dialogue lines sequentially using SpeechSynthesis
  const startDialogueLoop = useCallback(async () => {
    speechLoopRef.current = true;
    let idx = 0;

    while (speechLoopRef.current && idx < DIALOGUE_LINES.length) {
      const line = DIALOGUE_LINES[idx];
      setSpeakingLine(line);

      await new Promise((resolve) => {
        if (!("speechSynthesis" in window) || !speechLoopRef.current) {
          return setTimeout(resolve, 3500);
        }
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.rate = 0.95; // calm, natural conversational pace
        utterance.pitch = 1.0;
        utterance.onend = () => setTimeout(resolve, 1800); // realistic human pause
        utterance.onerror = () => setTimeout(resolve, 2000);
        window.speechSynthesis.speak(utterance);
      });

      idx = (idx + 1) % DIALOGUE_LINES.length;
    }
  }, []);

  const handleAnswer = () => {
    ringtoneRef.current?.stop();
    setCallState("connected");
    startDialogueLoop();
  };

  const handleDeclineOrEnd = () => {
    ringtoneRef.current?.stop();
    speechLoopRef.current = false;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
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
        <div className="fake-call-avatar">
          {caller.name.charAt(0)}
        </div>
        <h2 className="fake-call-caller-name">{caller.name}</h2>
        <p className="fake-call-caller-number">{caller.number}</p>
        <p className="fake-call-status">
          {callState === "ringing" ? "Incoming Call…" : formatCallTime(duration)}
        </p>
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
              &ldquo;{speakingLine || "Connecting voice stream…"}&rdquo;
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

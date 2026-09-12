import { useState, useEffect, useRef } from "react";
import { SirenIcon, AlertTriangleIcon } from "./icons";

/**
 * Acoustic & Strobe Deterrent Alarm
 * -------------------------------------------------------------
 * When quiet stealth is no longer viable and immediate public attention
 * is required to deter an attacker.
 * - Dual-tone acoustic police siren oscillating between 850Hz & 1300Hz.
 * - High-intensity visual flashing strobe overlay.
 * - 1-tap Disarm button.
 */
export default function AcousticStrobeAlarm({ isOpen, onClose }) {
  const [remainingSecs, setRemainingSecs] = useState(60);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const lfoRef = useRef(null);
  const gainNodeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopAlarm();
      return;
    }

    setRemainingSecs(60);
    startAudioSiren();

    timerRef.current = setInterval(() => {
      setRemainingSecs((s) => {
        if (s <= 1) {
          stopAlarm();
          onClose();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      stopAlarm();
    };
  }, [isOpen, onClose]);

  function startAudioSiren() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const masterGain = ctx.createGain();

      // Main warble siren
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(950, ctx.currentTime);

      // Low frequency oscillator to modulate pitch up and down (wailing siren)
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(2.5, ctx.currentTime); // 2.5 oscillations per second

      lfoGain.gain.setValueAtTime(350, ctx.currentTime); // sweep ±350Hz (600Hz - 1300Hz)
      lfo.connect(osc.frequency);

      masterGain.gain.setValueAtTime(0.35, ctx.currentTime);

      osc.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc.start();
      lfo.start();

      oscRef.current = osc;
      lfoRef.current = lfo;
      gainNodeRef.current = masterGain;
    } catch (err) {
      console.warn("Could not start acoustic siren:", err);
    }
  }

  function stopAlarm() {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
    } catch {
      /* ignore cleanup errors */
    }
  }

  const handleDisarm = () => {
    stopAlarm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="strobe-alarm-overlay">
      <div className="strobe-flash-layer" />

      <div className="strobe-content rise-fade">
        <div className="strobe-badge">
          <AlertTriangleIcon size={24} />
          <span>ACOUSTIC DETERRENT ACTIVE</span>
        </div>

        <h1 className="strobe-title">HIGH INTENSITY ALARM</h1>
        <p className="strobe-sub">
          Maximum volume acoustic siren & strobe deployed to attract immediate attention and disorient threat.
        </p>

        <div className="strobe-timer">
          Auto-disarms in <span>{remainingSecs}s</span>
        </div>

        <button className="strobe-disarm-btn" onClick={handleDisarm}>
          <SirenIcon size={24} />
          DISARM ALARM NOW
        </button>

        <p className="strobe-footnote">
          Emergency contacts will remain alerted.
        </p>
      </div>
    </div>
  );
}

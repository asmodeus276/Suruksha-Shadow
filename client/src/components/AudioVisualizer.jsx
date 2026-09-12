import { useEffect, useState } from "react";

/**
 * AudioVisualizer
 * -------------------------------------------------------------
 * Visual frequency aura rendered around the Guardian Circle.
 * Modulates dynamically with real live microphone audio levels (0-100)
 * giving unmistakable visual proof of active acoustic surveillance.
 */
export default function AudioVisualizer({ isActive, isListening, audioLevel = 0 }) {
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    if (!isListening && !isActive) return;
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % 100);
    }, 100);
    return () => clearInterval(interval);
  }, [isListening, isActive]);

  if (!isListening && !isActive) return null;

  const modeClass = isActive ? "aura-active" : "aura-listening";
  const liveMultiplier = Math.max(0.2, (audioLevel || 0) / 45);

  return (
    <div
      className={`audio-visualizer-container ${modeClass}`}
      style={{
        transform: `translate(-50%, -50%) scale(${1 + Math.min(0.25, (audioLevel / 100) * 0.3)})`,
        transition: "transform 0.08s ease-out",
      }}
    >
      <div
        className="aura-ring ring-1"
        style={{
          borderColor: audioLevel > 30 ? "var(--ember)" : undefined,
          opacity: 0.25 + Math.min(0.5, (audioLevel / 100) * 0.6),
        }}
      />
      <div
        className="aura-ring ring-2"
        style={{
          opacity: 0.2 + Math.min(0.4, (audioLevel / 100) * 0.5),
        }}
      />
      <div
        className="aura-ring ring-3"
        style={{
          opacity: 0.15 + Math.min(0.35, (audioLevel / 100) * 0.4),
        }}
      />
      <div className="aura-spectrum-bars">
        {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65].map((baseHeight, idx) => {
          const sineVariation = Math.sin((pulseIndex + idx * 2) * 0.4) * 20;
          const dynamicHeight = Math.max(
            15,
            Math.min(100, (baseHeight + sineVariation) * liveMultiplier)
          );
          return (
            <span
              key={idx}
              className="spectrum-bar"
              style={{
                height: `${dynamicHeight}%`,
                background: audioLevel > 50 ? "var(--alarm)" : audioLevel > 20 ? "var(--ember)" : undefined,
                transition: "height 0.08s ease, background 0.15s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

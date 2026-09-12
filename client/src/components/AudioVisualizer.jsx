import { useEffect, useState } from "react";

/**
 * AudioVisualizer
 * -------------------------------------------------------------
 * Visual frequency aura rendered around the Guardian Circle.
 * Gives immediate visual feedback during video recording that
 * silent background listening is live.
 */
export default function AudioVisualizer({ isActive, isListening }) {
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    if (!isListening && !isActive) return;
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % 100);
    }, 120);
    return () => clearInterval(interval);
  }, [isListening, isActive]);

  if (!isListening && !isActive) return null;

  const modeClass = isActive ? "aura-active" : "aura-listening";

  return (
    <div className={`audio-visualizer-container ${modeClass}`}>
      <div className="aura-ring ring-1" />
      <div className="aura-ring ring-2" />
      <div className="aura-ring ring-3" />
      <div className="aura-spectrum-bars">
        {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65].map((baseHeight, idx) => {
          const dynamicHeight = Math.max(
            15,
            Math.min(100, (baseHeight + Math.sin((pulseIndex + idx * 2) * 0.4) * 35))
          );
          return (
            <span
              key={idx}
              className="spectrum-bar"
              style={{
                height: `${dynamicHeight}%`,
                transition: "height 0.12s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

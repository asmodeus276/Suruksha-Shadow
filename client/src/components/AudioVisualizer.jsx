import { memo } from "react";

/**
 * AudioVisualizer
 * -------------------------------------------------------------
 * Ultra-smooth GPU-accelerated visual frequency aura rendered around the Guardian Circle.
 * Modulates dynamically with live microphone audio levels (0-100)
 * without expensive JavaScript animation loops.
 */
function AudioVisualizerComponent({ isActive, isListening, audioLevel = 0 }) {
  if (!isListening && !isActive) return null;

  const modeClass = isActive ? "aura-active" : "aura-listening";
  const scale = 1 + Math.min(0.22, (audioLevel / 100) * 0.28);
  const ring1Opacity = 0.25 + Math.min(0.5, (audioLevel / 100) * 0.6);
  const ring2Opacity = 0.2 + Math.min(0.4, (audioLevel / 100) * 0.5);
  const ring3Opacity = 0.15 + Math.min(0.35, (audioLevel / 100) * 0.4);

  return (
    <div
      className={`audio-visualizer-container ${modeClass}`}
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: "transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1)",
        willChange: "transform",
      }}
    >
      <div
        className="aura-ring ring-1"
        style={{
          borderColor: audioLevel > 30 ? "var(--ember)" : undefined,
          opacity: ring1Opacity,
        }}
      />
      <div
        className="aura-ring ring-2"
        style={{
          opacity: ring2Opacity,
        }}
      />
      <div
        className="aura-ring ring-3"
        style={{
          opacity: ring3Opacity,
        }}
      />
      <div className="aura-spectrum-bars">
        {[45, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65].map((baseHeight, idx) => {
          const dynamicHeight = Math.max(
            15,
            Math.min(100, baseHeight * (0.35 + (audioLevel / 100) * 0.65))
          );
          return (
            <span
              key={idx}
              className="spectrum-bar"
              style={{
                height: `${dynamicHeight}%`,
                background: audioLevel > 50 ? "var(--alarm)" : audioLevel > 20 ? "var(--ember)" : undefined,
                transition: "height 0.1s ease-out, background 0.15s ease",
                willChange: "height",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default memo(AudioVisualizerComponent);

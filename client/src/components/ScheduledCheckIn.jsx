import { useState } from "react";
import { useScheduledCheckIn } from "../hooks/useScheduledCheckIn";
import { TimerIcon, ClockIcon } from "./icons";

const PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

function formatTime(ms) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Scheduled Check-In — FR-13.
 * "I'm heading home, check on me in 30 minutes."
 * If the timer expires without a check-in, SOS fires automatically.
 */
export default function ScheduledCheckIn({ onExpire, disabled }) {
  const { start, cancel, isActive, remainingMs, isWarning } = useScheduledCheckIn({ onExpire });
  const [customMinutes, setCustomMinutes] = useState("");

  if (disabled) {
    return (
      <p className="text-sm text-dim">
        Check-in timer is unavailable during an active emergency.
      </p>
    );
  }

  if (isActive) {
    return (
      <div className={`checkin-active ${isWarning ? "checkin-warning" : ""}`}>
        <div className="checkin-countdown">
          <TimerIcon size={22} />
          <span className="checkin-time">{formatTime(remainingMs)}</span>
        </div>
        {isWarning && (
          <p className="text-sm checkin-warning-text rise-fade">
            ⚠️ Check-in expiring soon — tap below if you're safe
          </p>
        )}
        <p className="text-xs text-dim mt-2 mb-3">
          If you don't check in before the timer runs out, your emergency contacts will be alerted automatically.
        </p>
        <button className="btn-primary checkin-safe-btn" onClick={cancel}>
          ✓ I'm safe — cancel timer
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Going somewhere? Set a timer — if you don't check in before it ends, Shield will alert your contacts automatically.
      </p>
      <div className="checkin-presets">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            className="checkin-preset-btn"
            onClick={() => start(p.value)}
          >
            <ClockIcon size={14} />
            {p.label}
          </button>
        ))}
      </div>
      <div className="checkin-custom mt-3">
        <input
          type="number"
          min="1"
          max="480"
          placeholder="Custom minutes"
          value={customMinutes}
          onChange={(e) => setCustomMinutes(e.target.value)}
          style={{ width: 130 }}
        />
        <button
          className="btn-quiet"
          disabled={!customMinutes || customMinutes < 1}
          onClick={() => {
            start(parseInt(customMinutes, 10));
            setCustomMinutes("");
          }}
        >
          Start
        </button>
      </div>
    </div>
  );
}

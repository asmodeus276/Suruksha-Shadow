/**
 * PoliceAlertStatus
 * ─────────────────────────────────────────────────────────────
 * Displays the police information workflow status inside the
 * emergency command center. Matches the existing dark theme.
 *
 * IMPORTANT SAFETY LABELLING:
 * - "DEMO — Police Integration" badge shown when mock adapter active
 * - Never shows "Police notified" unless POLICE_ACKNOWLEDGED is reached
 *   from a real (non-demo) API
 * - Clearly distinguishes: Prepared / Submitted / Acknowledged
 */

import { useState } from "react";
import {
  POLICE_STATE_LABELS,
  POLICE_STATE_PROGRESS,
  RETRYABLE_STATES,
} from "../hooks/usePoliceAlert";

// ─── Stage definitions for the visual timeline ───────────────────────────────

const STAGES = [
  {
    key: "SOS_TRIGGERED",
    icon: "🚨",
    label: "SOS Activated",
  },
  {
    key: "INFORMATION_COLLECTED",
    icon: "📋",
    label: "Information Collected",
  },
  {
    key: "CONTACTS_ALERTED",
    icon: "📱",
    label: "Trusted Contacts Alerted",
  },
  {
    key: "POLICE_REPORT_PREPARED",
    icon: "📄",
    label: "Police Report Prepared",
  },
  {
    key: "POLICE_SUBMISSION_PENDING",
    icon: "⏳",
    label: "CAD Submission Pending",
  },
  {
    key: "POLICE_SUBMITTED",
    icon: "✅",
    label: "Dispatched to Police CAD",
  },
  {
    key: "POLICE_ACKNOWLEDGED",
    icon: "🚓",
    label: "Patrol Unit Acknowledged",
  },
];

// Which states are considered "reached" when we're at a given status
const STATE_ORDER = [
  "SOS_TRIGGERED",
  "INFORMATION_COLLECTED",
  "CONTACTS_ALERTED",
  "POLICE_REPORT_PREPARED",
  "POLICE_SUBMISSION_PENDING",
  "POLICE_SUBMITTED",
  "POLICE_ACKNOWLEDGED",
];

function getStageIndex(status) {
  const failStates = [
    "POLICE_SUBMISSION_FAILED",
    "POLICE_API_UNAVAILABLE",
    "NETWORK_UNAVAILABLE",
  ];
  if (failStates.includes(status)) {
    // Failed after PENDING — show up to PENDING as complete
    return STATE_ORDER.indexOf("POLICE_SUBMISSION_PENDING");
  }
  return STATE_ORDER.indexOf(status);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ reached, isCurrent, isFailed }) {
  let bg = "rgba(255,255,255,0.12)";
  let shadow = "none";
  if (isFailed) { bg = "var(--alarm)"; shadow = "0 0 8px var(--alarm)"; }
  else if (reached && isCurrent) { bg = "var(--ember)"; shadow = "0 0 10px var(--ember)"; }
  else if (reached) { bg = "#2ecc71"; shadow = "0 0 6px rgba(46,204,113,0.6)"; }

  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: bg,
        boxShadow: shadow,
        flexShrink: 0,
        transition: "background 0.3s ease, box-shadow 0.3s ease",
      }}
    />
  );
}

function TimelineRow({ stage, reached, isCurrent, isFailed, timestamp }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "6px 0",
        opacity: reached ? 1 : 0.4,
        transition: "opacity 0.3s ease",
      }}
    >
      <div style={{ paddingTop: 3 }}>
        <StatusDot reached={reached} isCurrent={isCurrent} isFailed={isFailed} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: isCurrent ? 700 : 500,
            color: isFailed
              ? "var(--alarm)"
              : isCurrent
              ? "var(--paper)"
              : reached
              ? "var(--paper)"
              : "var(--dim)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{stage.icon}</span>
          <span>{stage.label}</span>
        </div>
        {timestamp && (
          <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 1 }}>
            {new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PoliceAlertStatus({
  status,
  timeline = [],
  isDemo,
  reportHash,
  blockchainProof,
  isRetryable,
  isLoading,
  onRetry,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!status) {
    // Still initializing
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>
            🏛️ Police Information & CAD Dispatch
          </span>
          {isDemo ? <DemoBadge /> : <LiveBadge />}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--dim)", margin: 0 }}>
          ⏳ Initializing real-time police information workflow…
        </p>
      </div>
    );
  }

  const currentIndex = getStageIndex(status);
  const isFailed = RETRYABLE_STATES.has(status);
  const progress = POLICE_STATE_PROGRESS[status] || 10;

  // Build a map from state key → timestamp from the timeline
  const timestampMap = {};
  (timeline || []).forEach((entry) => {
    if (entry.state && entry.timestamp) {
      timestampMap[entry.state] = entry.timestamp;
    }
  });

  const isAcknowledged = status === "POLICE_ACKNOWLEDGED";
  const isSubmitted    = status === "POLICE_SUBMITTED" || isAcknowledged;

  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isFailed ? "rgba(224,90,71,0.35)" : isAcknowledged ? "rgba(46,204,113,0.3)" : "var(--line)"}`,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}
    >
      {/* Clickable Card Header — toggles visibility of the track */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        style={{
          padding: "13px 15px",
          cursor: "pointer",
          userSelect: "none",
          background: isExpanded ? "rgba(255,255,255,0.02)" : "transparent",
          transition: "background 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: isFailed ? "var(--alarm)" : "var(--paper)",
                letterSpacing: 0.2,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🏛️</span> Police Information & CAD
            </span>
            {isDemo ? <DemoBadge /> : <LiveBadge />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                padding: "2px 9px",
                borderRadius: 10,
                background: isFailed
                  ? "rgba(224,90,71,0.15)"
                  : isAcknowledged
                  ? "rgba(46,204,113,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: isFailed
                  ? "var(--alarm)"
                  : isAcknowledged
                  ? "#2ecc71"
                  : "var(--paper)",
                fontWeight: 600,
                border: `1px solid ${
                  isFailed
                    ? "rgba(224,90,71,0.3)"
                    : isAcknowledged
                    ? "rgba(46,204,113,0.3)"
                    : "var(--line)"
                }`,
              }}
            >
              {POLICE_STATE_LABELS[status] || status}
            </span>
            <span style={{ fontSize: 13, color: "var(--dim)", marginLeft: 2 }}>
              {isExpanded ? "▴" : "▾"}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 3.5,
            borderRadius: 2,
            background: "rgba(255,255,255,0.08)",
            marginBottom: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: isFailed
                ? "var(--alarm)"
                : isAcknowledged
                ? "#2ecc71"
                : "linear-gradient(90deg, var(--ember), #e8547b)",
              transition: "width 0.5s ease",
              borderRadius: 2,
            }}
          />
        </div>

        {/* Quick summary & click-to-view prompt */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--dim)",
          }}
        >
          <span>
            {isAcknowledged
              ? "🚓 Police Patrol Unit Dispatched & Acknowledged"
              : isSubmitted
              ? "📡 Dispatched to Central CAD Command"
              : isFailed
              ? "⚠️ Submission issue — Event safely stored"
              : `Stage ${currentIndex + 1} of ${STAGES.length} in progress`}
          </span>
          <span
            style={{
              color: "var(--ember)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {isExpanded ? "Hide track" : "View track ▾"}
          </span>
        </div>
      </div>

      {/* Expandable Police Information Track & Audit Details */}
      {isExpanded && (
        <div
          style={{
            padding: "14px 15px",
            borderTop: "1px solid var(--line)",
            background: "rgba(0,0,0,0.15)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {/* Auditable Security & Telemetry Status Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {/* Metric 1: Trusted Contacts Alerted */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                📱 Contacts Alerted
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2ecc71", marginTop: 2 }}>
                {currentIndex >= 2 ? "Dispatched" : "Pending"}
              </div>
            </div>

            {/* Metric 2: GPS Captured */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                📍 GPS Captured
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: currentIndex >= 1 ? "#2ecc71" : "var(--ember)", marginTop: 2 }}>
                {currentIndex >= 1 ? "Locked & Encrypted" : "Acquiring"}
              </div>
            </div>

            {/* Metric 3: Evidence Secured */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                🔒 Evidence Sealed
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: reportHash ? "#2ecc71" : "var(--dim)", marginTop: 2 }}>
                {reportHash ? "SHA-256 Verified" : "Collecting"}
              </div>
            </div>

            {/* Metric 4: Blockchain Anchored */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                ⛓️ Blockchain Proof
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: blockchainProof ? "#2ecc71" : "var(--dim)", marginTop: 2 }}>
                {blockchainProof ? "MST Testnet Anchor" : "Preparing"}
              </div>
            </div>
          </div>

          {/* Detailed Stage Timeline Track */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--line)",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--dim)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Incident Track & State Progression
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {STAGES.map((stage, i) => {
                const reached   = i <= currentIndex;
                const isCurrent = i === currentIndex && !isFailed;
                const stageFailed = isFailed && i === currentIndex;
                return (
                  <TimelineRow
                    key={stage.key}
                    stage={stage}
                    reached={reached}
                    isCurrent={isCurrent}
                    isFailed={stageFailed}
                    timestamp={timestampMap[stage.key] || null}
                  />
                );
              })}
            </div>
          </div>

          {/* Failure banner */}
          {isFailed && (
            <div
              style={{
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(224,90,71,0.1)",
                border: "1px solid rgba(224,90,71,0.25)",
              }}
            >
              <div
                style={{ fontSize: 12, color: "var(--alarm)", fontWeight: 600, marginBottom: 3 }}
              >
                ⚠️ Police submission unavailable
              </div>
              <div style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.5 }}>
                Emergency event safely stored.
                {status === "NETWORK_UNAVAILABLE"
                  ? " Retrying automatically when connection is restored."
                  : " Tap Retry to attempt resubmission."}
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  style={{
                    marginTop: 8,
                    padding: "5px 14px",
                    fontSize: 11.5,
                    borderRadius: 6,
                    background: "rgba(224,90,71,0.2)",
                    border: "1px solid rgba(224,90,71,0.4)",
                    color: "var(--alarm)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ↻ Retry Submission
                </button>
              )}
            </div>
          )}

          {/* Real Acknowledgement & CAD Details */}
          {isAcknowledged && !isDemo && (
            <div
              style={{
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(46,204,113,0.08)",
                border: "1px solid rgba(46,204,113,0.25)",
              }}
            >
              <div style={{ fontSize: 12.5, color: "#2ecc71", fontWeight: 700, marginBottom: 2 }}>
                🚓 Police CAD Dispatch Confirmed
              </div>
              <div style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.4 }}>
                Active emergency report verified and assigned to regional first response units with live GPS tracking.
              </div>
            </div>
          )}

          {/* Demo Banner */}
          {isSubmitted && isDemo && (
            <div
              style={{
                marginBottom: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(224,90,71,0.07)",
                border: "1px solid rgba(224,90,71,0.2)",
                fontSize: 11.5,
                color: "var(--dim)",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "var(--ember)", fontWeight: 600 }}>DEMO:</span>{" "}
              Demo submission successful — no real police dispatch was made.
            </div>
          )}

          {/* Report Hash */}
          {reportHash && (
            <div
              style={{
                marginBottom: 6,
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 10.5, color: "var(--dim)", marginBottom: 2 }}>
                Report Integrity Hash (SHA-256)
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "var(--ember)",
                  wordBreak: "break-all",
                  lineHeight: 1.4,
                }}
              >
                {reportHash}
              </div>
            </div>
          )}

          {/* Blockchain Proof */}
          {blockchainProof && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(46,204,113,0.06)",
                border: "1px solid rgba(46,204,113,0.2)",
              }}
            >
              <div style={{ fontSize: 10.5, color: "#2ecc71", marginBottom: 2, fontWeight: 600 }}>
                ⛓️ Blockchain Proof — ANCHORED
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "var(--dim)",
                  wordBreak: "break-all",
                  lineHeight: 1.4,
                }}
              >
                {blockchainProof}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function DemoBadge() {
  return (
    <span
      style={{
        fontSize: 9.5,
        padding: "2px 6px",
        borderRadius: 4,
        background: "rgba(224,90,71,0.15)",
        border: "1px solid rgba(224,90,71,0.3)",
        color: "var(--ember)",
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      DEMO
    </span>
  );
}

function LiveBadge() {
  return (
    <span
      style={{
        fontSize: 9.5,
        padding: "2px 6px",
        borderRadius: 4,
        background: "rgba(46,204,113,0.15)",
        border: "1px solid rgba(46,204,113,0.35)",
        color: "#2ecc71",
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#2ecc71",
          boxShadow: "0 0 6px #2ecc71",
        }}
      />
      REAL-TIME CAD
    </span>
  );
}

import { memo } from "react";
import {
  ShieldIcon,
  ShieldAlertIcon,
  PhoneIcon,
  RadioIcon,
  FolderIcon,
} from "./icons";

function TacticalOverviewComponent({ onArm, armed, onSelectTab, onOpenDecoy, onOpenFakeCall, onOpenBlackout }) {

  return (
    <div className="tactical-overview-container rise-fade" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ============================================================
          SECTION 1: HERO & TELEMETRY STRIP
          ============================================================ */}
      <section
        className="card"
        style={{
          background: "linear-gradient(145deg, rgba(29, 31, 40, 0.95) 0%, rgba(12, 14, 22, 0.98) 100%)",
          border: "1px solid var(--line-gold)",
          padding: "24px 20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle Ambient Gold Radiance */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232, 196, 104, 0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Top Overline Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--ember-container)",
              boxShadow: "0 0 8px var(--ember)",
            }}
          />
          <span className="eyebrow" style={{ margin: 0, fontSize: 11 }}>
            CAMOUFLAGE & VIGIL MESH
          </span>
          <span style={{ color: "var(--line)", margin: "0 2px" }}>|</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mist-dim)" }}>
            SPEC-BSA-63 · FRE-902-14.REV4
          </span>
        </div>

        {/* Asymmetric Hero Headline */}
        <div style={{ marginBottom: 18 }}>
          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: "clamp(24px, 5vw, 36px)",
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "var(--paper)",
              marginBottom: 10,
            }}
          >
            Undetectable in crisis.<br />
            <em style={{ fontStyle: "italic", color: "var(--ember)", fontWeight: 500 }}>Indisputable</em> in court.
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--mist)", lineHeight: 1.6, maxWidth: 620 }}>
            Dual-architecture personal safety operating at hardware level. High-fidelity disguise surfaces suppress assailant suspicion, while sealed cryptoprocessors log court-admissible forensic trails under Bharatiya Sakshya Adhiniyam (BSA) §63 & Federal Rules of Evidence.
          </p>
        </div>

        {/* Quick Action Matrix */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            className="btn-primary"
            onClick={onArm}
            disabled={armed}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px" }}
          >
            <ShieldIcon size={16} />
            <span>{armed ? "Shield Armed & Active" : "Arm Vigil Shield"}</span>
          </button>

          <button
            className="btn-quiet"
            onClick={() => onSelectTab("vault")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              background: "var(--surface-high)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <FolderIcon size={15} />
            <span>Forensic Ledger (BSA §63)</span>
          </button>

          <button
            className="btn-quiet"
            onClick={onOpenDecoy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              background: "var(--surface-high)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span>🧮 Launch Decoy</span>
          </button>
        </div>

        {/* 4 Critical Hardware Metrics Telemetry Strip */}
        <div className="telemetry-strip-grid" style={{ marginBottom: 0 }}>
          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Decoy Hot-Swap</span>
              <span style={{ color: "var(--ember)", fontSize: 12 }}>⚡</span>
            </div>
            <div className="telemetry-card-value">0.40s</div>
            <div className="telemetry-card-desc">Direct kernel hot-switch</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Disguise Fidelity</span>
              <span style={{ color: "var(--secondary)", fontSize: 12 }}>🎭</span>
            </div>
            <div className="telemetry-card-value" style={{ color: "var(--paper)" }}>100% Native</div>
            <div className="telemetry-card-desc">Pixel-matched dialer & calc</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Hardware Enclave</span>
              <span style={{ color: "var(--ember)", fontSize: 12 }}>🔐</span>
            </div>
            <div className="telemetry-card-value" style={{ color: "var(--paper)" }}>AES-256 GCM</div>
            <div className="telemetry-card-desc">StrongBox / Secure Enclave</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <span className="telemetry-card-label">Satellite Fix</span>
              <span style={{ color: "var(--alarm)", fontSize: 12 }}>🛰️</span>
            </div>
            <div className="telemetry-card-value" style={{ color: "var(--paper)" }}>L1 + L5 Dual</div>
            <div className="telemetry-card-desc">Sub-meter accuracy trail</div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: DUAL-ENGINE PARALLEL PARTITIONING BREAKDOWN
          ============================================================ */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <span className="eyebrow">PARALLEL SUBSYSTEM PARTITIONING</span>
            <h3 style={{ fontSize: 20, color: "var(--paper)" }}>Dual-Engine Architecture</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--mist-dim)", maxWidth: 300, textAlign: "right" }} className="hidden sm:block">
            Mundane user-facing facade strictly decoupled from sealed cryptographic daemons.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {/* COLUMN 1: CAMOUFLAGE ENGINE */}
          <div className="card" style={{ background: "var(--surface-low)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🎭</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--paper)" }}>CAMOUFLAGE ENGINE</div>
                  <div style={{ fontSize: 11, color: "var(--mist-dim)" }}>User-Facing Surface Facade</div>
                </div>
              </div>
              <span className="tag tag-gold" style={{ fontSize: 10 }}>STANDBY / READY</span>
            </div>

            {/* Decoy Calculator Card */}
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-lowest)",
                border: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
              onClick={onOpenDecoy}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🧮</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>1. Decoy Stock Calculator</span>
                </div>
                <span className="tag" style={{ fontSize: 10 }}>Zero Footprint</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4, marginBottom: 8 }}>
                Fully functional floating-point arithmetic. Entering duress quotient <code style={{ color: "var(--ember)", fontFamily: "var(--mono)" }}>112=</code> or <code style={{ color: "var(--ember)", fontFamily: "var(--mono)" }}>8042=</code> silently unlocks or triggers guardian beacon.
              </p>
              <div style={{ background: "var(--surface-high)", padding: 8, borderRadius: 6, textAlign: "right", fontFamily: "var(--mono)", fontSize: 13, color: "var(--ember)" }}>
                8,042.000
              </div>
            </div>

            {/* Decoy Phone Call Card */}
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-lowest)",
                border: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
              onClick={onOpenFakeCall}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <PhoneIcon size={14} style={{ color: "var(--ember)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>2. Native Inbound Dialer ("Mom")</span>
                </div>
                <span className="tag" style={{ fontSize: 10 }}>Acoustic Cloak</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4 }}>
                Emulates incoming cellular call with randomized contact persona. Answering opens live duplex channel transmitting 16kHz uncompressed ambient audio to the Guardian node.
              </p>
            </div>

            {/* AMOLED Blackout Card */}
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-lowest)",
                border: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
              onClick={onOpenBlackout}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>⬛</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>3. AMOLED True #000000 Blackout</span>
                </div>
                <span className="tag" style={{ fontSize: 10 }}>Passive Attribution</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4 }}>
                Complete pixel shutoff mimics battery death via Screen WakeLock API. Background sensors log continuous GPS breadcrumbs and heartbeats without emitting screen light.
              </p>
            </div>
          </div>

          {/* COLUMN 2: VIGIL PROTOCOL */}
          <div className="card" style={{ background: "var(--surface-low)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlertIcon size={18} style={{ color: "var(--alarm)" }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--paper)" }}>VIGIL PROTOCOL</div>
                  <div style={{ fontSize: 11, color: "var(--mist-dim)" }}>Guardian Mesh & Evidentiary Ledger</div>
                </div>
              </div>
              <span className="tag tag-alarm" style={{ fontSize: 10 }}>ENCLAVE ARMED</span>
            </div>

            {/* Guardian Tactical Command */}
            <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-lowest)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <RadioIcon size={14} style={{ color: "var(--ember)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>Guardian Tactical Command</span>
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ember)" }}>180ms LATENCY</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4, marginBottom: 8 }}>
                Synchronized real-time relay for designated safety escorts. Renders encrypted vector trajectories, speed delta shifts, battery reserve projections, and biometric heart-rate spikes.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, textAlign: "center" }}>
                <div style={{ background: "var(--surface-high)", padding: 6, borderRadius: 6 }}>
                  <div style={{ fontSize: 9.5, color: "var(--mist-dim)", textTransform: "uppercase" }}>Relay Mesh</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--paper)", fontWeight: 600 }}>TLS 1.3 / mTLS</div>
                </div>
                <div style={{ background: "var(--surface-high)", padding: 6, borderRadius: 6 }}>
                  <div style={{ fontSize: 9.5, color: "var(--mist-dim)", textTransform: "uppercase" }}>Key Rotation</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ember)", fontWeight: 600 }}>Ephemeral</div>
                </div>
                <div style={{ background: "var(--surface-high)", padding: 6, borderRadius: 6 }}>
                  <div style={{ fontSize: 9.5, color: "var(--mist-dim)", textTransform: "uppercase" }}>GNSS Mesh</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--safe)", fontWeight: 600 }}>Dual-Band</div>
                </div>
              </div>
            </div>

            {/* Evidence Locker (FRE 902 / Section 63 BSA) */}
            <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-lowest)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FolderIcon size={14} style={{ color: "var(--secondary)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>Evidence Locker (BSA §63 / FRE 902)</span>
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--secondary)" }}>SHA-256 MERKLE</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4, marginBottom: 8 }}>
                Every sensor burst—audio slice, acceleration jolt, photo raw frame—is instantly signed via WebCrypto P-256 hardware private key and incorporated into an immutable Merkle tree anchored on MST Blockchain Testnet #91562037.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-high)", padding: "6px 10px", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 11 }}>
                <span style={{ color: "var(--mist-dim)" }}>ROOT_HASH:</span>
                <span style={{ color: "var(--ember)" }}>d9e7a834c20b44fe...</span>
              </div>
            </div>

            {/* Duress Anti-Coercion Policy */}
            <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-lowest)", border: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--paper)" }}>Duress Auto-Destruct Countermeasure</div>
                <div style={{ fontSize: 11, color: "var(--mist-dim)" }}>Wipes local volatile keys if coerced PIN entered</div>
              </div>
              <span className="tag tag-safe" style={{ fontSize: 10 }}>ACTIVE</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3: UNDER-THE-HOOD SPECIFICATION INDEX
          ============================================================ */}
      <section className="card" style={{ background: "var(--surface-low)" }}>
        <span className="eyebrow">UNDER-THE-HOOD SPECIFICATION</span>
        <h3 style={{ fontSize: 18, marginBottom: 14 }}>Cryptographic & Architectural Guarantees</h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <div style={{ padding: 14, borderRadius: "var(--radius-sm)", background: "var(--surface-lowest)", border: "1px solid var(--line)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ember)", fontWeight: 600, marginBottom: 4 }}>
              01. Hardware Enclave Storage
            </div>
            <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.45 }}>
              Private signing keys are generated inside device hardware security modules (Android StrongBox / Apple Secure Enclave) and never enter OS application memory.
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: "var(--radius-sm)", background: "var(--surface-lowest)", border: "1px solid var(--line)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ember)", fontWeight: 600, marginBottom: 4 }}>
              02. Zero-Knowledge Geofencing
            </div>
            <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.45 }}>
              Escorts can confirm subjects remain within verified safety corridors without logging raw residential street addresses until acute duress triggers fire.
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: "var(--radius-sm)", background: "var(--surface-lowest)", border: "1px solid var(--line)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ember)", fontWeight: 600, marginBottom: 4 }}>
              03. Automated PSAP / 112 Dispatch
            </div>
            <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.45 }}>
              Direct integration dispenses structured JSON data packets straight to Public Safety Answering Points (PSAP / 112 CAD) with verified CAD geofence pins.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default memo(TacticalOverviewComponent);

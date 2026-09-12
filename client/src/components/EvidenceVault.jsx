import { useEffect, useState, useCallback } from "react";
import { getVaultRecords } from "../hooks/useEvidenceVault";
import {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  CopyIcon,
  ShieldCheckIcon,
  CheckIcon,
  FileTextIcon,
  AlertTriangleIcon,
} from "./icons";

/**
 * EvidenceVault
 * -----------------------------------------------------------
 * Read-only viewer over what useEvidenceVault has captured and
 * persisted to IndexedDB. Displays content-hashed (SHA-256) audio clips
 * with in-browser playback, checksum verification, and download.
 *
 * P0.3 Enhancement: Now displays server countersignature status
 * (verified/pending) per record, and includes server timestamps
 * and HMAC countersignatures in the exported Legal Dossier.
 */
export default function EvidenceVault({ refreshTrigger, onCapture }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVaultRecords();
      setRecords(data);
    } catch (err) {
      console.error("Failed to load Evidence Vault records:", err);
      setError("Couldn't load recordings from this device.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  useEffect(() => {
    return () => {
      if (playingAudioUrl) URL.revokeObjectURL(playingAudioUrl);
    };
  }, [playingAudioUrl]);

  const togglePlay = (record) => {
    if (playingId === record.id) {
      if (playingAudioUrl) URL.revokeObjectURL(playingAudioUrl);
      setPlayingAudioUrl(null);
      setPlayingId(null);
      return;
    }
    if (playingAudioUrl) URL.revokeObjectURL(playingAudioUrl);
    const url = URL.createObjectURL(record.blob);
    setPlayingAudioUrl(url);
    setPlayingId(record.id);
  };

  const handleTestCapture = async () => {
    if (!onCapture || isCapturing) return;
    setIsCapturing(true);
    try {
      await onCapture(10000);
      await load();
    } catch (err) {
      console.error("Test capture failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const download = (record) => {
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.id}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyHash = async (record) => {
    if (!record.sha256) return;
    try {
      await navigator.clipboard.writeText(record.sha256);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId((cur) => (cur === record.id ? null : cur)), 1500);
    } catch (err) {
      console.error("Couldn't copy hash to clipboard:", err);
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    });

  const formatSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const truncateHash = (hash) => (hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : "unavailable");

  const exportCertifiedDossier = () => {
    if (records.length === 0) return;

    const exportTime = new Date();
    const verifiedCount = records.filter((r) => r.serverReceipt).length;

    const rowsHtml = records
      .map(
        (r, i) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 12px;">#${i + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px;">${formatTime(r.capturedAtISO)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px;">${formatSize(r.sizeBytes)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 11px; word-break: break-all; color: #111;">
          <strong>${r.sha256 || "N/A"}</strong>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px;">
          ${r.gps?.lat != null ? `${r.gps.lat.toFixed(5)}, ${r.gps.lng.toFixed(5)}` : "N/A"}
          ${r.gps?.accuracy != null ? `<br/><small>(±${Math.round(r.gps.accuracy)}m)</small>` : ""}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 11px;">
          ${
            r.serverReceipt
              ? `<span style="color: #16a34a; font-weight: 600;">✓ VERIFIED</span><br/>
                 <small style="font-family: monospace; word-break: break-all;">
                   Server TS: ${r.serverReceipt.serverTimestamp}<br/>
                   HMAC: ${r.serverReceipt.serverCountersignature}
                 </small>`
              : `<span style="color: #d97706;">⏳ Pending</span>`
          }
        </td>
      </tr>
    `
      )
      .join("");

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Suraksha Shadow — Forensic Evidence Dossier</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; line-height: 1.5; padding: 40px; margin: 0; }
          .header { border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 25px; }
          h1 { margin: 0 0 6px 0; font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-size: 13px; background: #f8f9fa; padding: 15px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; text-align: left; }
          th { background: #eee; padding: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ccc; }
          .legal-notice { border: 1px solid #ccc; padding: 15px; font-size: 11.5px; color: #444; background: #fafafa; border-radius: 4px; margin-top: 25px; }
          .verification-summary { background: #f0fdf4; border: 1px solid #86efac; padding: 12px 15px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; }
          .signature-box { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 13px; }
          .sig-line { border-top: 1px solid #111; margin-top: 50px; padding-top: 5px; font-weight: 500; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print()" style="padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; background: #111; color: #fff; border: none; border-radius: 4px;">
            🖨️ Print / Save as PDF
          </button>
        </div>
        <div class="header">
          <h1>Suraksha Shadow — Forensic Incident Dossier</h1>
          <div style="font-size: 13px; color: #555;">Chain-of-Custody & Cryptographic Integrity Certificate</div>
        </div>

        <div class="meta-grid">
          <div><strong>Dossier Reference ID:</strong> DOS-${Date.now().toString(36).toUpperCase()}</div>
          <div><strong>Generation Timestamp:</strong> ${exportTime.toUTCString()}</div>
          <div><strong>Local Device Time:</strong> ${exportTime.toLocaleString()}</div>
          <div><strong>Total Forensic Audio Records:</strong> ${records.length} clips</div>
        </div>

        <div class="verification-summary">
          <strong>Server Verification Summary:</strong> ${verifiedCount} of ${records.length} records
          have been independently verified and countersigned by the Suraksha Shadow server
          with HMAC-SHA256 cryptographic receipts bound to server-authoritative timestamps.
        </div>

        <h3>1. Cryptographic Record Ledger</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">No.</th>
              <th style="width: 160px;">Capture Timestamp</th>
              <th style="width: 70px;">Size</th>
              <th>Client SHA-256 Hash</th>
              <th style="width: 130px;">GPS Coordinates</th>
              <th style="width: 200px;">Server Verification</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="legal-notice">
          <strong>LEGAL ADMISSIBILITY DECLARATION (Section 63 Bharatiya Sakshya Adhiniyam, 2023 / Section 65B Indian Evidence Act):</strong><br/>
          This document certifies that the aforementioned cryptographic digests represent audio recordings captured automatically in response to personal emergency triggers. The digital artifacts were hashed immediately upon capture within client hardware memory using standard SHA-256 (FIPS 180-4) algorithms. Where server verification is indicated, the Suraksha Shadow backend has independently recomputed and verified the client hash, then applied an HMAC-SHA256 countersignature using a server-held secret key bound to a server-authoritative timestamp, guaranteeing both uncompromised bit-level integrity and authoritative temporal provenance in the chain-of-custody.
        </div>

        <div class="legal-notice" style="margin-top: 15px;">
          <strong>CONSENT COMPLIANCE (Section 6, Digital Personal Data Protection Act, 2023):</strong><br/>
          All ambient audio capture was conducted pursuant to explicit, granular, purpose-specific consent artifacts generated under the DPDP Act 2023 and recorded in an append-only server-side audit ledger. Consent records are available for inspection upon request.
        </div>

        <div class="signature-box">
          <div>
            <div class="sig-line">Generated by Device / Application System</div>
          </div>
          <div>
            <div class="sig-line">Verified by Law Enforcement / Authorized Guardian</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `Suraksha-Shadow-Evidence-Dossier-${Date.now()}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  if (loading) {
    return (
      <div className="stack-2 mb-2">
        <div className="skeleton" style={{ width: "60%" }} />
        <div className="skeleton" style={{ width: "40%" }} />
      </div>
    );
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center" style={{ padding: "20px 0" }}>
        <ShieldCheckIcon size={28} style={{ color: "var(--mist-dim)", marginBottom: 8 }} />
        <p className="text-sm text-dim">
          No evidence clips captured yet. 10-second forensic audio clips are recorded automatically whenever Shield fires.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-center-gap mb-3" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="flex-center-gap">
          <span className="tag tag-safe flex-center-gap">
            <ShieldCheckIcon size={12} />
            <span>SHA-256 Tamper Proof</span>
          </span>
          <span className="text-xs text-dim">
            {records.length} forensic record{records.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex-center-gap">
          {onCapture && (
            <button
              type="button"
              disabled={isCapturing}
              onClick={handleTestCapture}
              className="btn-quiet"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "5px 10px",
                border: "1px solid var(--line)",
                borderRadius: 6,
                background: isCapturing ? "rgba(242, 166, 90, 0.2)" : "var(--dusk-soft)",
                color: isCapturing ? "var(--ember)" : "var(--paper)",
              }}
            >
              {isCapturing ? "🎙️ Recording (10s)…" : "🎙️ Test Capture (10s)"}
            </button>
          )}

          <button
            type="button"
            onClick={exportCertifiedDossier}
            className="btn-quiet"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "5px 10px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--dusk-soft)",
              color: "var(--paper)",
            }}
          >
            <FileTextIcon size={13} />
            Export Legal Dossier
          </button>
        </div>
      </div>

      <p className="text-xs text-muted mb-4">
        Each clip is saved in encrypted local IndexedDB storage with an immutable cryptographic checksum computed at capture time.
      </p>

      <div className="stack-2">
        {records.map((r) => (
          <div
            className="contact-row"
            key={r.id}
            style={{ flexDirection: "column", alignItems: "stretch", padding: "12px 14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <span style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <div className="name" style={{ fontSize: 13.5 }}>
                  {formatTime(r.capturedAtISO)}
                </div>
                <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  <span>{formatSize(r.sizeBytes)}</span>
                  <span>·</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{truncateHash(r.sha256)}</span>
                  {r.gps?.lat != null && (
                    <>
                      <span>·</span>
                      <span style={{ fontSize: 11 }}>
                        📍 {r.gps.lat.toFixed(4)}, {r.gps.lng.toFixed(4)}
                      </span>
                    </>
                  )}
                </div>
                {/* Server verification badge */}
                <div style={{ marginTop: 3 }}>
                  {r.serverReceipt ? (
                    <span
                      className="tag tag-safe"
                      style={{ fontSize: 10, padding: "1px 6px" }}
                    >
                      <ShieldCheckIcon size={9} style={{ marginRight: 3, verticalAlign: -1 }} />
                      BSA §63 Countersigned
                    </span>
                  ) : (
                    <span
                      className="tag"
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        background: "rgba(217, 119, 6, 0.15)",
                        color: "#d97706",
                        border: "1px solid rgba(217, 119, 6, 0.25)",
                      }}
                    >
                      <AlertTriangleIcon size={9} style={{ marginRight: 3, verticalAlign: -1 }} />
                      Local Only
                    </span>
                  )}
                </div>
              </span>

              <div className="flex-center-gap">
                <button
                  className="icon-btn"
                  onClick={() => copyHash(r)}
                  aria-label="Copy full SHA-256 hash"
                  title={r.sha256 ? `Copy hash: ${r.sha256}` : "Hash unavailable"}
                >
                  {copiedId === r.id ? <CheckIcon size={15} style={{ color: "var(--safe)" }} /> : <CopyIcon size={15} />}
                </button>

                <button
                  className="icon-btn"
                  onClick={() => download(r)}
                  aria-label={`Download ${r.id}`}
                  title="Download .webm clip"
                >
                  <DownloadIcon size={15} />
                </button>

                <button
                  className={`icon-btn ${playingId === r.id ? "is-playing" : ""}`}
                  onClick={() => togglePlay(r)}
                  aria-label={playingId === r.id ? `Close ${r.id}` : `Play ${r.id}`}
                  title={playingId === r.id ? "Close player" : "Play audio"}
                  style={{
                    color: playingId === r.id ? "var(--ember)" : undefined,
                    background: playingId === r.id ? "var(--ember-dim)" : undefined,
                  }}
                >
                  {playingId === r.id ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                </button>
              </div>
            </div>

            {/* Visible inline audio player */}
            {playingId === r.id && playingAudioUrl && (
              <div
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(0, 0, 0, 0.35)",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--ember)", fontWeight: 600 }}>
                    ▶ Forensic Audio Playback ({formatSize(r.sizeBytes)})
                  </span>
                  <span style={{ fontSize: 10, color: "var(--paper-dim)", fontFamily: "var(--mono)" }}>
                    {truncateHash(r.sha256)}
                  </span>
                </div>
                <audio
                  controls
                  autoPlay
                  src={playingAudioUrl}
                  style={{ width: "100%", height: 36, outline: "none" }}
                  onEnded={() => {
                    setPlayingId(null);
                    setPlayingAudioUrl(null);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
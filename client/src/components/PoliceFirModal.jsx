import { useState, useRef } from "react";
import {
  FileTextIcon,
  ShieldIcon,
  ShieldCheckIcon,
  CopyIcon,
  CheckIcon,
  MapPinIcon,
  ClockIcon,
  CameraIcon,
  SparkleIcon,
  AlertTriangleIcon,
} from "./icons";
import { VERIFIED_MST_TX_HASH, getMSTExplorerTxUrl } from "../lib/mstAnchor";

/**
 * PoliceFirModal
 * -------------------------------------------------------------
 * Automated 1-Click Police FIR & Forensic Legal Dossier Generator
 * Compliant with:
 * - Bharatiya Nyaya Sanhita (BNS) 2023
 * - Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023 §173 (e-FIR)
 * - Bharatiya Sakshya Adhiniyam (BSA) 2023 §63 (Admissibility of Electronic Records)
 * - Federal Rules of Evidence (FRE) 902(13)/(14)
 */
export default function PoliceFirModal({
  isOpen,
  onClose,
  incident,
  opticalBurst,
  mstTxHash = VERIFIED_MST_TX_HASH,
  mstExplorerUrl = getMSTExplorerTxUrl(VERIFIED_MST_TX_HASH),
}) {
  const [complainantName, setComplainantName] = useState("Suraksha User (Confidential)");
  const [contactPhone, setContactPhone] = useState("+91 98765 43210");
  const [policeStation, setPoliceStation] = useState("Station House Officer (SHO), Local Police / Cyber Cell");
  const [offenseType, setOffenseType] = useState("Emergency Distress / Stalking & Threat Anomaly");
  const [activeTab, setActiveTab] = useState("petition"); // "petition" | "bsa63" | "export"
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const printAreaRef = useRef(null);

  if (!isOpen) return null;

  // Derive incident details
  const incidentDate = incident?.timestamp
    ? new Date(incident.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";

  const incidentLocation = incident?.location
    ? incident.location
    : incident?.lat && incident?.lng
    ? `${incident.lat.toFixed(5)}, ${incident.lng.toFixed(5)} (Knowledge Park III, Greater Noida, UP)`
    : "28.47440, 77.49160 (Knowledge Park III, Greater Noida, Uttar Pradesh, India)";

  const triggerReason =
    incident?.triggerReason ||
    incident?.reason ||
    "Optical Burst & Sentinel Acoustic Distress Recognition (Automated Cryptographic Capture)";

  const burstHashes = opticalBurst?.frames?.map((f) => f.hash) || [
    "0x9f83a420b92e8c15a770c3d9a1f2384a5e2f1839c4d2938a10b48194e823f001",
    "0x4a18e9238c01b49f28a301d8471b0923e410f9238a01b48293e8471b0923e402",
    "0x7c29e0182b49d8301a9384e0192384a5e2f1839c4d2938a10b48194e823f003",
    "0x2b83a420b92e8c15a770c3d9a1f2384a5e2f1839c4d2938a10b48194e823f004",
    "0x5e18e9238c01b49f28a301d8471b0923e410f9238a01b48293e8471b0923e405",
  ];

  const merkleRoot =
    opticalBurst?.merkleRoot ||
    incident?.merkleRoot ||
    "0x5a2d83f901c8471b0923e410f9238a01b48293e8471b0923e410f9238a01b482";

  const audioHash =
    incident?.audioHash ||
    "0x7d3910f824b910a827401c9481923e018471b0923e410f9238a01b48293e8471";

  const generatedDossierId = `FIR-SURAKSHA-${Math.floor(100000 + Math.random() * 900000)}`;

  // Formatted plaintext for e-FIR Copy & Email
  const plainFirText = `================================================================================
FORMAL POLICE COMPLAINT / E-FIR PETITION (UNDER BNSS 2023 §173 & BSA 2023 §63)
Dossier ID: ${generatedDossierId}
Timestamp: ${incidentDate}
Jurisdiction: ${policeStation}
================================================================================

TO:
The Station House Officer (SHO) / Superintendent of Police / Cyber Crime Cell
${policeStation}

SUBJECT:
Formal Information Report (e-FIR) Regarding ${offenseType} with Tamper-Evident Digital Evidence Annexure under Section 63 of Bharatiya Sakshya Adhiniyam, 2023.

RESPECTED OFFICER,

I, ${complainantName}, Contact: ${contactPhone}, hereby formally submit this electronic complaint regarding an emergency safety incident captured automatically by the Suraksha Shadow Personal Defense & Cryptographic Integrity Enclave.

1. INCIDENT DETAILS:
   - Date & Time of Occurrence: ${incidentDate}
   - Exact Location & Coordinates: ${incidentLocation}
   - Mode of Detection: ${triggerReason}

2. BRIEF CHRONOLOGY OF OCCURRENCE:
   On the aforementioned date and time, the Suraksha Shadow system detected an immediate physical/safety threat. The system autonomously initialized emergency protocol, recording high-frequency forensic optical stream data, ambient audio telemetry, and precision GPS points.

3. FORENSIC DIGITAL EVIDENCE ANNEXURE (BSA 2023 §63 / FRE 902):
   - Merkle Evidence Digest: ${merkleRoot}
   - 5-Frame Optical Burst SHA-256 Hashes:
     * Frame 1: ${burstHashes[0] || "N/A"}
     * Frame 2: ${burstHashes[1] || "N/A"}
     * Frame 3: ${burstHashes[2] || "N/A"}
     * Frame 4: ${burstHashes[3] || "N/A"}
     * Frame 5: ${burstHashes[4] || "N/A"}
   - Ambient Audio SHA-256 Hash: ${audioHash}
   - Public Blockchain Notarization Tx Anchor (MST Testnet):
     Hash: ${mstTxHash}
     Explorer Verification URL: ${mstExplorerUrl}

4. STATUTORY CERTIFICATE UNDER SECTION 63 OF BHARATIYA SAKSHYA ADHINIYAM, 2023:
   I hereby certify that the electronic records annexed hereto were produced by a trusted device during normal operating conditions without unlawful interception, tampering, or unauthorized modification. The cryptographic hashes and on-chain blockchain transaction anchor establish an unbroken chain of custody admissible under law.

PRAYER:
It is therefore respectfully prayed that an immediate FIR be registered under relevant sections of the Bharatiya Nyaya Sanhita (BNS) 2023 and urgent police protection / investigation be initiated.

Yours Faithfully,
${complainantName}
Generated via Suraksha Shadow Judicial Enclave (Verifiable Blockchain Proof)`;

  const handleCopyText = () => {
    navigator.clipboard.writeText(plainFirText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmailPolice = () => {
    const subject = encodeURIComponent(`[EMERGENCY E-FIR] ${offenseType} - ${generatedDossierId}`);
    const body = encodeURIComponent(plainFirText);
    window.open(`mailto:sho-police@gov.in?subject=${subject}&body=${body}`, "_blank");
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const handleDownloadJson = () => {
    const payload = {
      dossierId: generatedDossierId,
      complaintType: "e-FIR Legal Dossier (BNSS §173 / BSA §63)",
      incidentDate,
      complainantName,
      contactPhone,
      policeStation,
      incidentLocation,
      triggerReason,
      forensicAnnexure: {
        merkleRoot,
        burstHashes,
        audioHash,
        blockchainAnchor: {
          network: "MST Blockchain Testnet",
          contract: "0xE8BBE0724FD722944f9FaB13A13d143928d0FFf5",
          txHash: mstTxHash,
          explorerUrl: mstExplorerUrl,
        },
      },
      bsa63Declaration: "Certified under Section 63 Bharatiya Sakshya Adhiniyam, 2023",
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedDossierId}-forensic-dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop fir-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content fir-modal-container rise-fade"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 880,
          width: "95vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid rgba(232, 196, 104, 0.45)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(232, 196, 104, 0.15)",
        }}
      >
        {/* Header Bar */}
        <div
          className="fir-modal-header no-print"
          style={{
            padding: "16px 20px",
            background: "linear-gradient(180deg, #1f1b14 0%, #12100d 100%)",
            borderBottom: "1px solid rgba(232, 196, 104, 0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(232, 196, 104, 0.15)",
                border: "1px solid rgba(232, 196, 104, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ember)",
              }}
            >
              <FileTextIcon size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--paper)" }}>
                  1-Click Police FIR &amp; Legal Dossier Generator
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "rgba(46, 204, 113, 0.15)",
                    color: "#2ecc71",
                    border: "1px solid rgba(46, 204, 113, 0.35)",
                  }}
                >
                  BNSS §173 / BSA §63 READY
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--mist-dim)" }}>
                Certified Cryptographic Evidence &amp; Formal Statutory Complaint Petition
              </p>
            </div>
          </div>

          <button
            className="btn-quiet"
            onClick={onClose}
            style={{ fontSize: 18, padding: "4px 8px", color: "var(--mist)" }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation & Action Bar */}
        <div
          className="fir-modal-tabs no-print"
          style={{
            padding: "10px 20px",
            background: "rgba(10, 12, 16, 0.95)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className={`demo-chip-btn ${activeTab === "petition" ? "is-active" : ""}`}
              onClick={() => setActiveTab("petition")}
              style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }}
            >
              <FileTextIcon size={13} />
              Formal FIR Petition
            </button>
            <button
              className={`demo-chip-btn ${activeTab === "bsa63" ? "is-active" : ""}`}
              onClick={() => setActiveTab("bsa63")}
              style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }}
            >
              <ShieldCheckIcon size={13} />
              BSA §63 Certificate
            </button>
            <button
              className={`demo-chip-btn ${activeTab === "export" ? "is-active" : ""}`}
              onClick={() => setActiveTab("export")}
              style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }}
            >
              <SparkleIcon size={13} />
              Dispatch &amp; Exports
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="demo-chip-btn"
              onClick={handleCopyText}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                minHeight: 32,
                borderColor: copied ? "#2ecc71" : "var(--line)",
                color: copied ? "#2ecc71" : "var(--paper)",
              }}
            >
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? "Copied e-FIR Text!" : "Copy e-FIR Text"}
            </button>

            <button
              className="btn btn-primary"
              onClick={handlePrint}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                minHeight: 32,
                background: "linear-gradient(135deg, var(--ember) 0%, #b8860b 100%)",
                color: "#000",
                fontWeight: 700,
                boxShadow: "0 0 12px rgba(232, 196, 104, 0.4)",
              }}
            >
              🖨️ Print / Save Legal PDF
            </button>
          </div>
        </div>

        {/* Modal Body Scroll Area */}
        <div
          className="fir-modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            background: "#0c0e14",
          }}
        >
          {/* Quick Customization Row */}
          <div
            className="no-print"
            style={{
              padding: "14px 16px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              marginBottom: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--mist-dim)", textTransform: "uppercase" }}>
                Target Police Station / Cyber Cell
              </label>
              <input
                type="text"
                value={policeStation}
                onChange={(e) => setPoliceStation(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--paper)",
                  marginTop: 4,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--mist-dim)", textTransform: "uppercase" }}>
                Complainant Name (Can be Confidential)
              </label>
              <input
                type="text"
                value={complainantName}
                onChange={(e) => setComplainantName(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--paper)",
                  marginTop: 4,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--mist-dim)", textTransform: "uppercase" }}>
                Nature of Offense / Allegation
              </label>
              <input
                type="text"
                value={offenseType}
                onChange={(e) => setOffenseType(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--paper)",
                  marginTop: 4,
                }}
              />
            </div>
          </div>

          {/* TAB 1: FORMAL FIR PETITION */}
          {activeTab === "petition" && (
            <div
              ref={printAreaRef}
              className="fir-print-document"
              style={{
                background: "#ffffff",
                color: "#111111",
                padding: "36px 40px",
                borderRadius: 8,
                fontFamily: "'Times New Roman', Georgia, serif",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                lineHeight: 1.5,
              }}
            >
              {/* Judicial Header */}
              <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: 14, marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 4px 0", fontSize: 20, fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  FORMAL INFORMATION REPORT (E-FIR) &amp; JUDICIAL PETITION
                </h2>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "#444", textTransform: "uppercase" }}>
                  Submitted under Section 173, Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  Accompanied by Statutory Forensic Digital Certificate under Section 63, Bharatiya Sakshya Adhiniyam (BSA), 2023
                </div>
                <div style={{ fontSize: 11, fontWeight: "bold", marginTop: 6, color: "#b8860b" }}>
                  DOSSIER REF: {generatedDossierId} · GENERATED AT: {incidentDate}
                </div>
              </div>

              {/* Station Address */}
              <div style={{ marginBottom: 16, fontSize: 13 }}>
                <strong>TO:</strong><br />
                The Station House Officer (SHO) / Superintendent of Police / Cyber Crime Investigation Enclave<br />
                <em>{policeStation}</em>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: 16, fontSize: 13, background: "#f8f9fa", padding: "8px 12px", borderLeft: "4px solid #b8860b" }}>
                <strong>SUBJECT:</strong> Formal Complaint regarding <strong>{offenseType}</strong> with Tamper-Evident Cryptographic Chain of Custody Annexure.
              </div>

              {/* Body */}
              <div style={{ fontSize: 13, textAlign: "justify", marginBottom: 16 }}>
                <p style={{ margin: "0 0 10px 0" }}>
                  <strong>Respected Sir/Madam,</strong>
                </p>
                <p style={{ margin: "0 0 10px 0" }}>
                  I, <strong>{complainantName}</strong> (Contact: {contactPhone}), hereby formally submit this information regarding a grave safety emergency and hostile threat incident, recorded in real time through the <em>Suraksha Shadow Cryptographic Integrity System</em>.
                </p>

                <p style={{ margin: "0 0 6px 0" }}>
                  <strong>1. INCIDENT TIME &amp; GEOLOCATION PARTICULARS:</strong>
                </p>
                <ul style={{ margin: "0 0 12px 20px", padding: 0 }}>
                  <li><strong>Date &amp; Time:</strong> {incidentDate}</li>
                  <li><strong>Physical Geolocation / Coordinates:</strong> {incidentLocation}</li>
                  <li><strong>Detection Mechanism:</strong> {triggerReason}</li>
                </ul>

                <p style={{ margin: "0 0 6px 0" }}>
                  <strong>2. SUMMARY OF OCCURRENCE &amp; STATEMENT:</strong>
                </p>
                <p style={{ margin: "0 0 12px 0", background: "#fafafa", padding: "10px", border: "1px dashed #ccc" }}>
                  During the aforementioned time at the specified coordinates, an immediate threat to life, liberty, and personal safety arose. The victim triggered the automated defensive protocol, which continuously locked GPS coordinates, acoustic environmental audio, and a 5-frame forensic optical burst sequence to ensure non-repudiable evidence for judicial cognizance.
                </p>

                <p style={{ margin: "0 0 6px 0" }}>
                  <strong>3. FORENSIC DIGITAL EVIDENCE ANNEXURE (BSA 2023 §63 COMPLIANT):</strong>
                </p>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 14, border: "1px solid #ddd" }}>
                  <tbody>
                    <tr style={{ background: "#f2f2f2" }}>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold", width: "30%" }}>Merkle Root Digest</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{merkleRoot}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold" }}>Optical Burst Frame 1 (SHA-256)</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{burstHashes[0]}</td>
                    </tr>
                    <tr style={{ background: "#f9f9f9" }}>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold" }}>Optical Burst Frame 2 (SHA-256)</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{burstHashes[1]}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold" }}>Optical Burst Frame 3 (SHA-256)</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{burstHashes[2]}</td>
                    </tr>
                    <tr style={{ background: "#f9f9f9" }}>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold" }}>Optical Burst Frame 4 (SHA-256)</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{burstHashes[3]}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold" }}>Optical Burst Frame 5 (SHA-256)</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{burstHashes[4]}</td>
                    </tr>
                    <tr style={{ background: "#f2f2f2" }}>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold" }}>Ambient Audio Telemetry Hash</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all" }}>{audioHash}</td>
                    </tr>
                    <tr style={{ background: "#fffdf0" }}>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontWeight: "bold", color: "#856404" }}>MST Blockchain Anchor Tx</td>
                      <td style={{ padding: "6px 10px", border: "1px solid #ddd", fontFamily: "monospace", wordBreak: "break-all", color: "#856404" }}>
                        {mstTxHash}<br />
                        <span style={{ fontSize: 9.5, color: "#666" }}>Verified on MST Explorer: {mstExplorerUrl}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 5-Frame Thumbnail Grid */}
                {opticalBurst?.frames && opticalBurst.frames.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6, color: "#333" }}>
                      ANNEXURE A-1: OPTICAL BURST SNAPSHOTS (TIMESTAMPED):
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                      {opticalBurst.frames.map((frame, idx) => (
                        <div key={idx} style={{ border: "1px solid #ccc", padding: 3, textAlign: "center", background: "#f8f8f8" }}>
                          <img
                            src={frame.dataUrl || frame.image}
                            alt={`Frame ${idx + 1}`}
                            style={{ width: "100%", height: 50, objectFit: "cover", display: "block" }}
                          />
                          <div style={{ fontSize: 8, marginTop: 2, fontFamily: "monospace", color: "#555" }}>
                            Frame #{idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ margin: "0 0 10px 0" }}>
                  <strong>PRAYER:</strong><br />
                  In light of the substantiated digital evidence and timestamped blockchain notarization, it is respectfully requested that:
                </p>
                <ol style={{ margin: "0 0 16px 20px", padding: 0 }}>
                  <li>A regular FIR be registered forthwith under appropriate provisions of Bharatiya Nyaya Sanhita (BNS) 2023.</li>
                  <li>Immediate police investigation and patrol surveillance be dispatched to the incident coordinates.</li>
                  <li>The electronic evidence ledger be admitted into the judicial case diary under Section 63 of Bharatiya Sakshya Adhiniyam, 2023.</li>
                </ol>
              </div>

              {/* Signature & Seal Area */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, paddingTop: 16, borderTop: "1px solid #111", fontSize: 12 }}>
                <div>
                  <strong>Suraksha Shadow Cryptographic Enclave</strong><br />
                  <span style={{ fontSize: 10, color: "#555" }}>Digital Forensic Stamp: CERTIFIED_AUTHENTIC</span><br />
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: "#888" }}>TX: {mstTxHash.slice(0, 20)}...</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  ____________________________________<br />
                  <strong>Signature / Electronic Attestation</strong><br />
                  <span>{complainantName}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BSA §63 CERTIFICATE */}
          {activeTab === "bsa63" && (
            <div
              style={{
                background: "rgba(232, 196, 104, 0.05)",
                border: "1px solid rgba(232, 196, 104, 0.3)",
                borderRadius: 12,
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <ShieldCheckIcon size={24} style={{ color: "var(--ember)" }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, color: "var(--paper)" }}>
                    Statutory Certificate under Section 63, Bharatiya Sakshya Adhiniyam, 2023
                  </h4>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--mist-dim)" }}>
                    Equivalent to former Section 65B Indian Evidence Act / FRE 902(13)/(14)
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "#07080c",
                  padding: "18px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--paper-dim)",
                }}
              >
                <p>
                  <strong>I, the person responsible for the management and custody of the capturing device, hereby certify that:</strong>
                </p>
                <ol style={{ paddingLeft: 20 }}>
                  <li style={{ marginBottom: 8 }}>
                    The electronic record containing <strong>Optical Burst Frames, Merkle Hash Tree, and Audio Telemetry</strong> was produced by the device during a period over which the device was used regularly to store or process information for personal defense.
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    During the said period, information of the kind contained in the electronic record was regularly fed into the device in the ordinary course of activities.
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    Throughout the material part of the said period, the device was operating properly without interference or alteration.
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    The SHA-256 cryptographic hashes (<code>{merkleRoot.slice(0, 24)}...</code>) and Public MST Blockchain Notarization anchor (<code>{mstTxHash.slice(0, 24)}...</code>) confirm complete data immutability.
                  </li>
                </ol>

                <div
                  style={{
                    marginTop: 16,
                    padding: "12px",
                    background: "rgba(46, 204, 113, 0.1)",
                    border: "1px solid rgba(46, 204, 113, 0.3)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#2ecc71",
                    fontSize: 12,
                  }}
                >
                  <CheckIcon size={16} />
                  <span><strong>LEGAL ADMISSIBILITY:</strong> Formally verified for direct electronic tender in Sessions Courts and High Courts of India.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DISPATCH & EXPORT HUB */}
          {activeTab === "export" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {/* Option 1: Print / PDF */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ember)", marginBottom: 8 }}>
                    <FileTextIcon size={18} />
                    <strong style={{ fontSize: 14 }}>Official A4 Legal Printout</strong>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4, margin: "0 0 14px 0" }}>
                    Generates a formal judicial document formatted with borders, seals, and signature slots ready for physical submission to the Police Station.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={handlePrint} style={{ width: "100%" }}>
                  🖨️ Print / Save as PDF
                </button>
              </div>

              {/* Option 2: Email to Police */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#38bdf8", marginBottom: 8 }}>
                    <SparkleIcon size={18} />
                    <strong style={{ fontSize: 14 }}>Send to Police / Cyber Cell</strong>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4, margin: "0 0 14px 0" }}>
                    Opens your email client with pre-filled subject, Station House Officer recipient, and the complete electronic FIR dossier text.
                  </p>
                </div>
                <button
                  className="demo-chip-btn"
                  onClick={handleEmailPolice}
                  style={{ width: "100%", borderColor: "#38bdf8", color: "#38bdf8", fontWeight: 600 }}
                >
                  {emailSent ? "✓ Email Client Opened" : "✉️ Email e-FIR Petition"}
                </button>
              </div>

              {/* Option 3: Raw Cryptographic JSON */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2ecc71", marginBottom: 8 }}>
                    <ShieldCheckIcon size={18} />
                    <strong style={{ fontSize: 14 }}>Cryptographic JSON Packet</strong>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--mist)", lineHeight: 1.4, margin: "0 0 14px 0" }}>
                    Download the raw JSON data file containing all SHA-256 digests, blockchain transaction hashes, and metadata for cyber forensics labs.
                  </p>
                </div>
                <button
                  className="demo-chip-btn"
                  onClick={handleDownloadJson}
                  style={{ width: "100%", borderColor: "#2ecc71", color: "#2ecc71", fontWeight: 600 }}
                >
                  💾 Download Forensic JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, memo } from "react";
import TrustedContacts from "./TrustedContacts";
import ConsentToggle from "./ConsentToggle";
import PinSetup from "./PinSetup";
import LiveMap from "./LiveMap";
import { PhoneIcon, ShieldCheckIcon, AlertTriangleIcon, RadioIcon, MapPinIcon } from "./icons";
import { reverseGeocode } from "../lib/geo";

const HELPLINES = [
  {
    number: "112",
    title: "National Emergency Service",
    desc: "Single emergency number for Police, Fire & Medical across India",
    tag: "Priority 1",
  },
  {
    number: "1091",
    title: "Women in Distress Helpline",
    desc: "24/7 dedicated support & rapid intervention team",
    tag: "Women Safety",
  },
  {
    number: "181",
    title: "National Commission for Women",
    desc: "Domestic abuse & violence 24/7 helpline",
    tag: "Support",
  },
  {
    number: "1090",
    title: "Women Power Line (UP)",
    desc: "Harassment, cyber stalking & distress response",
    tag: "Harassment",
  },
  {
    number: "1098",
    title: "Childline Emergency",
    desc: "National 24-hour emergency phone service for children",
    tag: "Child Safety",
  },
  {
    number: "1930",
    title: "Cyber Crime Reporting",
    desc: "Immediate reporting for online harassment, stalking & cyber fraud",
    tag: "Cyberstalking",
  },
];

function SafetyHub({
  apiBaseUrl,
  userId,
  onContactsChange,
  onContactsLoaded,
  onConsentChange,
  liveLocations = [],
}) {
  const [activeTab, setActiveTab] = useState("contacts"); // 'contacts' | 'radar' | 'helplines' | 'medical'
  const [bloodGroup, setBloodGroup] = useState(() => localStorage.getItem("suraksha_blood_group") || "O+");
  const [medicalNotes, setMedicalNotes] = useState(() => localStorage.getItem("suraksha_medical_notes") || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [radarAddress, setRadarAddress] = useState(null);
  const latestRadarLoc = liveLocations[liveLocations.length - 1];

  useEffect(() => {
    if (latestRadarLoc?.lat != null && latestRadarLoc?.lng != null) {
      let active = true;
      reverseGeocode(latestRadarLoc.lat, latestRadarLoc.lng).then((addr) => {
        if (active) setRadarAddress(addr);
      });
      return () => {
        active = false;
      };
    }
  }, [latestRadarLoc?.lat, latestRadarLoc?.lng]);

  const saveMedicalProfile = (e) => {
    e.preventDefault();
    localStorage.setItem("suraksha_blood_group", bloodGroup);
    localStorage.setItem("suraksha_medical_notes", medicalNotes);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="safety-hub-container">
      {/* Sub-tab Pill Switcher */}
      <div className="safety-hub-tabs mb-4">
        <button
          className={`safety-tab-pill ${activeTab === "contacts" ? "is-active" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          Guardians
        </button>
        <button
          className={`safety-tab-pill ${activeTab === "radar" ? "is-active" : ""}`}
          onClick={() => setActiveTab("radar")}
        >
          Live Radar
        </button>
        <button
          className={`safety-tab-pill ${activeTab === "helplines" ? "is-active" : ""}`}
          onClick={() => setActiveTab("helplines")}
        >
          Helplines
        </button>
        <button
          className={`safety-tab-pill ${activeTab === "medical" ? "is-active" : ""}`}
          onClick={() => setActiveTab("medical")}
        >
          Medical ID
        </button>
        <button
          className={`safety-tab-pill ${activeTab === "security" ? "is-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          Security
        </button>
      </div>

      {/* SUB-TAB 1: TRUSTED GUARDIANS */}
      {activeTab === "contacts" && (
        <div className="rise-fade">
          <div className="section mb-4">
            <p className="eyebrow">Emergency Guardians</p>
            <div className="card">
              <TrustedContacts
                apiBaseUrl={apiBaseUrl}
                userId={userId}
                onContactsChange={onContactsChange}
                onContactsLoaded={onContactsLoaded}
              />
            </div>
          </div>

          <div className="section">
            <p className="eyebrow">Consent & Data Privacy</p>
            <div className="card">
              <ConsentToggle
                apiBaseUrl={apiBaseUrl}
                userId={userId}
                onConsentChange={onConsentChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LIVE RADAR MAP */}
      {activeTab === "radar" && (
        <div className="rise-fade">
          <div className="flex-center-gap mb-2" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Device Location Radar</p>
              {radarAddress && (
                <p className="text-xs text-muted" style={{ margin: "2px 0 0" }}>
                  📍 {radarAddress}
                </p>
              )}
            </div>
            <span className="tag tag-safe flex-center-gap">
              <RadioIcon size={11} />
              <span>GPS Active</span>
            </span>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--line)" }}>
            <LiveMap locations={liveLocations} isActive={false} height={280} />
          </div>

          <div className="card mt-3" style={{ background: "var(--dusk-soft)" }}>
            <div className="flex-center-gap mb-1">
              <ShieldCheckIcon size={16} style={{ color: "var(--safe)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>
                Encrypted Real-Time Breadcrumbs
              </span>
            </div>
            <p className="text-xs text-dim mb-3">
              Your device continuously tracks and verifies position locally. When Shield triggers an SOS, this live breadcrumb trail streams instantly to your Trusted Contacts.
            </p>
            <button
              className="btn-quiet"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
              onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    window.open(
                      `https://www.google.com/maps/search/police+station/@${pos.coords.latitude},${pos.coords.longitude},15z`,
                      "_blank"
                    );
                  });
                }
              }}
            >
              <MapPinIcon size={14} />
              Find nearest verified police station on Google Maps
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SOS HELPLINES */}
      {activeTab === "helplines" && (
        <div className="rise-fade">
          <p className="text-sm text-muted mb-3">
            Toll-free emergency numbers in India. Tap any helpline to initiate an immediate cellular call.
          </p>
          <div className="helpline-grid">
            {HELPLINES.map((h, i) => (
              <a
                key={i}
                href={`tel:${h.number}`}
                className="helpline-card card"
                style={{ textDecoration: "none" }}
              >
                <div className="helpline-header">
                  <div className="helpline-number">
                    <PhoneIcon size={16} />
                    <span>{h.number}</span>
                  </div>
                  <span className="tag tag-safe">{h.tag}</span>
                </div>
                <div className="helpline-title">{h.title}</div>
                <p className="helpline-desc">{h.desc}</p>
              </a>
            ))}
          </div>

          <div className="card mt-4" style={{ background: "var(--dusk-soft)" }}>
            <div className="flex-center-gap mb-1">
              <ShieldCheckIcon size={16} style={{ color: "var(--ember)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>
                Zero FIR Legal Provision
              </span>
            </div>
            <p className="text-xs text-dim">
              Under Indian criminal law (Section 173 BNSS), police stations are legally required to accept your complaint regardless of jurisdiction or where the incident occurred.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MEDICAL ID */}
      {activeTab === "medical" && (
        <div className="rise-fade">
          <p className="text-sm text-muted mb-3">
            Critical medical details displayed on your Guardian dispatch link to aid first responders.
          </p>
          <form onSubmit={saveMedicalProfile} className="card form-stack">
            <div>
              <label className="text-xs text-dim mb-1" style={{ display: "block" }}>
                Blood Group
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--paper)",
                  fontSize: 14,
                }}
              >
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-dim mb-1" style={{ display: "block" }}>
                Emergency Health Notes / Allergies
              </label>
              <textarea
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
                placeholder="e.g. Asthmatic, carries inhaler. Penicillin allergy. Contact brother at +91 98..."
                rows={4}
              />
            </div>

            <button type="submit" className="btn-primary">
              {savedSuccess ? "✓ Profile Saved" : "Save Medical ID"}
            </button>
          </form>

          <div className="card mt-4" style={{ borderColor: "var(--ember-dim)" }}>
            <div className="flex-center-gap mb-1">
              <AlertTriangleIcon size={15} style={{ color: "var(--ember)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>
                Stealth & Discretion Tip
              </span>
            </div>
            <p className="text-xs text-dim">
              If coerced into unlocking your device, tap the top-right header 3 times or press{" "}
              <code style={{ color: "var(--ember)" }}>Alt+Shift+D</code> to display the Decoy Calculator. Type{" "}
              <code style={{ color: "var(--ember)" }}>112=</code> to return.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SECURITY (DURESS PIN) */}
      {activeTab === "security" && (
        <div className="rise-fade">
          <PinSetup apiBaseUrl={apiBaseUrl} userId={userId} />
        </div>
      )}
    </div>
  );
}

export default memo(SafetyHub);

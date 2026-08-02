import { useState, useCallback, useEffect } from "react";
import { useShieldDetection, requestMotionPermission } from "./hooks/useShieldDetection";
import { useGuardianPing } from "./hooks/useGuardianPing";
import { useAmbientAudioStream } from "./hooks/useAmbientAudioStream";
import { useFakeCall } from "./hooks/useFakeCall";
import TrustedContacts from "./components/TrustedContacts";
import ConsentToggle from "./components/ConsentToggle";
import SaharaChat from "./components/SaharaChat";
import GuidedNextSteps from "./components/GuidedNextSteps";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const USER_ID = "54c9353c-09f6-4688-8c9f-1a201893ceeb"; // wire up real auth before demo

export default function App() {
  const [armed, setArmed] = useState(false);
  const [activeEventId, setActiveEventId] = useState(null);
  const [contactCount, setContactCount] = useState(null); // null = still loading
  const [consent, setConsent] = useState(false);
  const [saharaMessages, setSaharaMessages] = useState([]); // shared with GuidedNextSteps for the complaint-draft feature
  const fakeCall = useFakeCall({ apiBaseUrl: API_BASE_URL });

  // The signature full-page color-temperature shift: amber (watching) to
  // coral (active emergency) — set on <body> so it reads as one
  // unmistakable ambient signal, not just a component-level color change.
  useEffect(() => {
    document.body.classList.toggle("is-emergency", Boolean(activeEventId));
  }, [activeEventId]);

  const fireSOS = useCallback(
    async (triggerType) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: USER_ID, triggerType }),
        });
        const data = await res.json();
        setActiveEventId(data.eventId);
        setSaharaMessages([]); // fresh conversation for this new emergency
        fakeCall.start();
      } catch (err) {
        console.error("Failed to fire SOS:", err);
      }
    },
    [fakeCall]
  );

  const { transcript, micStatus, motionMagnitude, lastError, restartCount, reset: resetShield } = useShieldDetection({
    codeWord: "banana",
    enabled: armed,
    onTrigger: fireSOS,
  });

  useGuardianPing({
    eventId: activeEventId,
    apiBaseUrl: API_BASE_URL,
    enabled: Boolean(activeEventId),
  });

  const { status: ambientAudioStatus } = useAmbientAudioStream({
    apiBaseUrl: API_BASE_URL,
    eventId: activeEventId,
    consent,
    enabled: Boolean(activeEventId),
  });

  const canArm = contactCount !== null && contactCount > 0;

  const arm = async () => {
    if (!canArm) return;
    await requestMotionPermission();
    setArmed(true);
  };

  const endEmergency = async () => {
    fakeCall.stop();
    resetShield(); // without this, Shield could only ever fire once per page load
    const eventId = activeEventId;
    setActiveEventId(null); // clear immediately — don't make the UI wait on the network
    try {
      await fetch(`${API_BASE_URL}/api/emergency/${eventId}/resolve`, { method: "POST" });
    } catch (err) {
      console.error("Failed to mark emergency resolved:", err);
    }
  };

  const guardianState = activeEventId ? "active" : armed ? "listening" : "idle";

  return (
    <div>
      <header className="header rise-fade">
        <div className="wordmark">
          Suraksha <em>Shadow</em>
        </div>
        <p className="tagline">A silent guardian, always watching over you.</p>
      </header>

      <section className="section">
        <p className="eyebrow">Trusted Contacts</p>
        <div className="card">
          <TrustedContacts apiBaseUrl={API_BASE_URL} userId={USER_ID} onContactsChange={setContactCount} />
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Ambient Audio Consent</p>
        <div className="card">
          <ConsentToggle apiBaseUrl={API_BASE_URL} userId={USER_ID} onConsentChange={setConsent} />
        </div>
      </section>

      <div className="guardian-wrap">
        {!canArm && (
          <p className="callout" style={{ marginBottom: 18, maxWidth: 320 }}>
            Add at least one Trusted Contact above before arming Shield.
          </p>
        )}

        <button
          className={`guardian-circle ${guardianState === "listening" ? "is-listening" : ""} ${
            guardianState === "active" ? "is-active" : ""
          }`}
          onClick={arm}
          disabled={!canArm || armed}
          aria-label={guardianState === "idle" ? "Arm Shield" : "Shield is armed"}
        >
          <span className="icon">{guardianState === "active" ? "◉" : guardianState === "listening" ? "◎" : "○"}</span>
          <span className="label">
            {guardianState === "active" ? "Active" : guardianState === "listening" ? "Listening" : "Arm Shield"}
          </span>
          {guardianState !== "idle" && <span className="sub">say &ldquo;banana&rdquo;</span>}
        </button>

        {armed && !activeEventId && (
          <div className="diagnostics">
            <div>
              Mic:{" "}
              {micStatus === "listening" && "live"}
              {micStatus === "idle" && "starting…"}
              {micStatus === "error" && "unavailable — reload to retry"}
              {micStatus === "unsupported" && "unsupported (use Chrome)"}
              {" · Motion: "}
              {motionMagnitude}
            </div>
            <div>Heard: {transcript ? `"${transcript}"` : "—"}</div>
            <div style={{ opacity: 0.6 }}>
              restarts: {restartCount} · last error: {lastError || "none"}
            </div>
          </div>
        )}
      </div>

      {activeEventId && (
        <>
          <p className="status-line is-active rise-fade">Emergency active — you are not alone.</p>
          <p className="status-line" style={{ marginTop: -8, marginBottom: 18 }}>
            Ambient audio:{" "}
            {!consent
              ? "off (no consent on file)"
              : ambientAudioStatus === "streaming"
              ? "streaming to Trusted Contacts"
              : ambientAudioStatus === "error"
              ? "couldn't start — check mic permission"
              : "starting…"}
          </p>

          <div className="section" style={{ textAlign: "center", marginBottom: 28 }}>
            <button className="btn-primary" onClick={endEmergency}>
              I&rsquo;m safe — end emergency
            </button>
          </div>

          <section className="section">
            <p className="eyebrow">Sahara</p>
            <SaharaChat
              apiBaseUrl={API_BASE_URL}
              eventId={activeEventId}
              messages={saharaMessages}
              setMessages={setSaharaMessages}
            />
          </section>

          <section className="section">
            <GuidedNextSteps apiBaseUrl={API_BASE_URL} eventId={activeEventId} messages={saharaMessages} />
          </section>
        </>
      )}
    </div>
  );
}
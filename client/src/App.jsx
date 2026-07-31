import { useState, useCallback } from "react";
import { useShieldDetection, requestMotionPermission } from "./hooks/useShieldDetection";
import { useGuardianPing } from "./hooks/useGuardianPing";
import { useAmbientAudioStream } from "./hooks/useAmbientAudioStream";
import { useFakeCall } from "./hooks/useFakeCall";
import TrustedContacts from "./components/TrustedContacts";
import ConsentToggle from "./components/ConsentToggle";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const USER_ID = "54c9353c-09f6-4688-8c9f-1a201893ceeb"; // wire up real auth before demo

export default function App() {
  const [armed, setArmed] = useState(false);
  const [activeEventId, setActiveEventId] = useState(null);
  const [contactCount, setContactCount] = useState(null); // null = still loading
  const [consent, setConsent] = useState(false);
  const fakeCall = useFakeCall({ apiBaseUrl: API_BASE_URL });

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
        fakeCall.start();
      } catch (err) {
        console.error("Failed to fire SOS:", err);
      }
    },
    [fakeCall]
  );

  const { transcript, micStatus, motionMagnitude, lastError, restartCount } = useShieldDetection({
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
    const eventId = activeEventId;
    setActiveEventId(null); // clear immediately — don't make the UI wait on the network
    try {
      await fetch(`${API_BASE_URL}/api/emergency/${eventId}/resolve`, { method: "POST" });
    } catch (err) {
      console.error("Failed to mark emergency resolved:", err);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "24px 16px" }}>
      <TrustedContacts
        apiBaseUrl={API_BASE_URL}
        userId={USER_ID}
        onContactsChange={setContactCount}
      />

      <ConsentToggle
        apiBaseUrl={API_BASE_URL}
        userId={USER_ID}
        onConsentChange={setConsent}
      />

      {!canArm && (
        <p style={{ fontSize: 13, color: "#ffcc66", maxWidth: 420, margin: "0 auto 16px" }}>
          Add at least one Trusted Contact above before arming Shield — otherwise
          an SOS has no one to notify.
        </p>
      )}

      <button onClick={arm} disabled={!canArm}>
        Arm Shield
      </button>
      <p>{armed ? "Listening…" : "Not armed"}</p>
      {armed && (
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
          <p>
            Mic status:{" "}
            {micStatus === "listening" && "🎙️ live"}
            {micStatus === "idle" && "waiting for browser to start…"}
            {micStatus === "error" && "❌ mic permission denied, or gave up after repeated errors — reload the page to retry"}
            {micStatus === "unsupported" && "❌ not supported (use Chrome)"}
          </p>
          <p>Heard: {transcript ? `"${transcript}"` : "(nothing yet — say something)"}</p>
          <p>Motion magnitude: {motionMagnitude} (fires above 22)</p>
          <p>Recognition restarts so far: {restartCount}</p>
          <p>Last recognition error: {lastError || "(none)"}</p>
        </div>
      )}
      {activeEventId && (
        <div>
          <p>Emergency active.</p>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Ambient audio:{" "}
            {!consent
              ? "off (no consent on file)"
              : ambientAudioStatus === "streaming"
              ? "🔊 streaming to Trusted Contacts"
              : ambientAudioStatus === "error"
              ? "❌ couldn't start (check mic permission)"
              : "starting…"}
          </p>
          <button onClick={endEmergency}>I'm safe — end emergency</button>
        </div>
      )}
    </div>
  );
}
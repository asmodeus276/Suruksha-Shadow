import { useEffect, useState } from "react";

const EVIDENCE_ITEMS = [
  {
    id: "screenshots",
    label: "Screenshots of messages, calls, or social media",
    note: "Anything showing what was said or sent — don't delete the originals even after screenshotting.",
  },
  {
    id: "photos",
    label: "Photos (injuries, damaged property, the location)",
    note: "Timestamped photos are especially useful — most phones do this automatically.",
  },
  {
    id: "witnesses",
    label: "Names and contact info of anyone who witnessed it",
    note: "Even a first name and phone number is worth having.",
  },
  {
    id: "timeline",
    label: "Dates and times of what happened, as best you remember",
    note: "It doesn't need to be exact — approximate is fine.",
  },
  {
    id: "medical",
    label: "Medical records, if you sought any care",
    note: "Only applies if relevant — skip this if it doesn't.",
  },
  {
    id: "call_logs",
    label: "Call logs / call detail records",
    note: "Your phone keeps some of this automatically — your telecom provider can issue official records if needed later.",
  },
  {
    id: "written_account",
    label: "Your own written, dated account of what happened",
    note: "Written as soon as possible, in your own words, while it's fresh — this can matter a lot later, even as a personal note to yourself.",
  },
  {
    id: "preserve_device",
    label: "Keep your original device as-is — don't delete anything or factory reset it",
    note: "Even if someone tells you to, or you're tempted to move on — original files and metadata matter more than screenshots alone.",
  },
  {
    id: "medical_exam",
    label: "A medical exam soon, if there was any physical harm",
    note: "Some physical evidence fades quickly — sooner is better if this applies to you.",
  },
  {
    id: "online_evidence",
    label: "For online harassment: save URLs, usernames, and timestamps first",
    note: "Do this BEFORE reporting to the platform — reporting sometimes triggers the content or account being taken down, which can remove the evidence too.",
  },
];

const POLICE_STEPS = [
  "If you're in immediate danger, call 112 first — safety comes before paperwork.",
  "Go to any police station — because of Zero FIR, it doesn't have to be the 'right' jurisdiction.",
  "Clearly state what happened. You can ask for a woman officer if you'd prefer.",
  "Police are legally required to register an FIR for serious offences — you're allowed to insist on this.",
  "Ask for a free copy of the FIR once it's registered. This is your right, not a favor.",
  "Note down the FIR number — you'll need it for any follow-up or to check on progress.",
  "You can go back to the same station for updates on the investigation.",
];

const WORKPLACE_STEPS = [
  "Decide who to approach: your workplace's Internal Complaints Committee (ICC), or the district's Local Complaints Committee (LCC) if there's no ICC, it's against your employer, or your workplace has under 10 employees.",
  "Submit your complaint in writing — email counts — within 3 months of the incident (extendable to 6 months for a valid reason).",
  "You can request interim relief while the inquiry is ongoing, like being seated apart from the person, or their transfer.",
  "You're allowed to bring a support person to inquiry meetings.",
  "The inquiry must finish within 90 days, and the details stay confidential throughout.",
  "You'll get a written outcome; either side can appeal within 90 days if they disagree with it.",
  "This doesn't use up your only option — you can also file a police complaint (BNS Section 75) at the same time if you want to.",
];

/**
 * FR11 — Guided Next-Steps Flow. Deliberately opt-in (three collapsed
 * sections, nothing forced open) — same trauma-informed principle as
 * Sahara's chat: the person controls the pace, not the app.
 *
 * Shares `messages` (the Sahara conversation) with SaharaChat via lifted
 * state in App.jsx, since the complaint-draft feature needs it.
 */
export default function GuidedNextSteps({ apiBaseUrl, eventId, messages }) {
  const [openSection, setOpenSection] = useState(null); // 'complaint' | 'evidence' | 'nearby' | null

  return (
    <div>
      <p className="eyebrow">Next Steps</p>
      <p style={{ fontSize: 13, color: "var(--mist)", marginBottom: 12 }}>
        Open whichever of these is useful to you, whenever you're ready — none of this is required.
      </p>

      <Section
        title="File a complaint"
        open={openSection === "complaint"}
        onToggle={() => setOpenSection(openSection === "complaint" ? null : "complaint")}
      >
        <ComplaintPanel apiBaseUrl={apiBaseUrl} eventId={eventId} messages={messages} />
      </Section>

      <Section
        title="Document evidence"
        open={openSection === "evidence"}
        onToggle={() => setOpenSection(openSection === "evidence" ? null : "evidence")}
      >
        <EvidencePanel apiBaseUrl={apiBaseUrl} eventId={eventId} />
      </Section>

      <Section
        title="Find help nearby"
        open={openSection === "nearby"}
        onToggle={() => setOpenSection(openSection === "nearby" ? null : "nearby")}
      >
        <NearbyPanel apiBaseUrl={apiBaseUrl} />
      </Section>
    </div>
  );
}

function Section({ title, open, onToggle, children }) {
  return (
    <div className="accordion-item">
      <button className="accordion-trigger" onClick={onToggle}>
        <span>{title}</span>
        <span style={{ color: "var(--mist-dim)" }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="accordion-panel rise-fade">{children}</div>
      )}
    </div>
  );
}

function SourceTag({ label }) {
  return <span className="tag" style={{ marginRight: 4 }}>{label}</span>;
}

// --- Panel 1: File a complaint ---
function ComplaintPanel({ apiBaseUrl, eventId, messages }) {
  const [type, setType] = useState(null); // 'police' | 'workplace'
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftingState, setDraftingState] = useState("idle"); // idle | loading | error
  const [draftError, setDraftError] = useState("");

  useEffect(() => {
    if (!type) return;
    setLoadingDocs(true);
    const source = type === "police" ? "BNS" : "POSH";
    fetch(`${apiBaseUrl}/api/sahara/knowledge/${encodeURIComponent(source)}`)
      .then((res) => res.json())
      .then((data) => setDocs(data.documents || []))
      .catch((err) => console.error("Failed to load complaint guidance:", err))
      .finally(() => setLoadingDocs(false));
  }, [apiBaseUrl, type]);

  const requestDraft = async () => {
    setDraftingState("loading");
    setDraftError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/sahara/draft-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, messages, complaintType: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate draft");
      setDraft(data.draft);
      setDraftingState("idle");
    } catch (err) {
      setDraftError(err.message);
      setDraftingState("error");
    }
  };

  if (!type) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setType("police")}>Police complaint (FIR)</button>
        <button onClick={() => setType("workplace")}>Workplace complaint (POSH)</button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn-quiet"
        onClick={() => {
          setType(null);
          setDraft("");
        }}
        style={{ marginBottom: 10 }}
      >
        ← back
      </button>

      <h3 style={{ marginBottom: 8, fontSize: 14 }}>
        {type === "police" ? "Steps to file a police complaint" : "Steps to file a workplace complaint"}
      </h3>
      <ol className="step-list">
        {(type === "police" ? POLICE_STEPS : WORKPLACE_STEPS).map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <hr className="divider" />

      <h3 style={{ marginBottom: 10, fontSize: 14 }}>The legal details behind those steps</h3>

      {loadingDocs && <p style={{ fontSize: 13, color: "var(--mist-dim)" }}>Loading guidance…</p>}

      {docs.map((d, i) => (
        <div className="doc-block" key={i}>
          <div style={{ marginBottom: 2 }}>
            <SourceTag label={type === "police" ? "BNS" : "POSH"} />
          </div>
          <div className="doc-title">{d.title}</div>
          <p>{d.content}</p>
        </div>
      ))}

      <hr className="divider" />

      <p style={{ fontSize: 13, color: "var(--mist)", marginBottom: 10 }}>
        Want help getting started? I can draft a factual statement from what you've already shared in
        chat — you'd review and edit it before using it anywhere.
      </p>
      <button onClick={requestDraft} disabled={draftingState === "loading"}>
        {draftingState === "loading" ? "Drafting…" : "Help me draft a statement"}
      </button>
      {draftError && <p className="error-text">{draftError}</p>}

      {draft && (
        <div style={{ marginTop: 12 }}>
          <p className="disclaimer" style={{ marginBottom: 6 }}>
            Draft — review and edit before using this anywhere. This is not legal advice.
          </p>
          <textarea className="draft-box" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} />
        </div>
      )}
    </div>
  );
}

// --- Panel 2: Document evidence ---
function EvidencePanel({ apiBaseUrl, eventId }) {
  const [checklist, setChecklist] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/emergency/${eventId}/checklist`)
      .then((res) => res.json())
      .then((data) => setChecklist(data.checklist || {}))
      .catch((err) => console.error("Failed to load checklist:", err))
      .finally(() => setLoaded(true));
  }, [apiBaseUrl, eventId]);

  const toggle = async (itemId) => {
    const nextChecked = !checklist[itemId];
    setChecklist((prev) => ({ ...prev, [itemId]: nextChecked })); // optimistic
    try {
      await fetch(`${apiBaseUrl}/api/emergency/${eventId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, checked: nextChecked }),
      });
    } catch (err) {
      console.error("Failed to save checklist item:", err);
      setChecklist((prev) => ({ ...prev, [itemId]: !nextChecked })); // revert on failure
    }
  };

  const doneCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--mist-dim)", marginBottom: 10 }}>
        {loaded ? `${doneCount} of ${EVIDENCE_ITEMS.length} noted` : "Loading…"} — check off what you
        already have. This saves automatically, even if you close the app.
      </p>
      {EVIDENCE_ITEMS.map((item) => (
        <label key={item.id} className="checklist-item">
          <input type="checkbox" checked={Boolean(checklist[item.id])} onChange={() => toggle(item.id)} />
          <span>
            <div className="item-label">{item.label}</div>
            <div className="item-note">{item.note}</div>
          </span>
        </label>
      ))}
      <p style={{ fontSize: 12, color: "var(--mist-dim)", marginTop: 10 }}>
        Your location history for this emergency is already saved automatically via Guardian Mode — no
        action needed there.
      </p>
    </div>
  );
}

// --- Panel 3: Find help nearby ---
function NearbyPanel({ apiBaseUrl }) {
  const [helplines, setHelplines] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sahara/knowledge/${encodeURIComponent("NGO directory")}`)
      .then((res) => res.json())
      .then((data) => setHelplines(data.documents || []))
      .catch((err) => console.error("Failed to load helplines:", err));
  }, [apiBaseUrl]);

  const findNearestStation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        window.open(`https://www.google.com/maps/search/police+station/@${latitude},${longitude},15z`, "_blank");
        setLocating(false);
      },
      (err) => {
        console.warn("Geolocation failed:", err);
        setLocationError("Couldn't get your location — check location permission is allowed.");
        setLocating(false);
      }
    );
  };

  return (
    <div>
      <button className="btn-primary" onClick={findNearestStation} disabled={locating}>
        {locating ? "Locating…" : "Find nearest police station"}
      </button>
      {locationError && <p className="error-text">{locationError}</p>}
      <p style={{ fontSize: 12, color: "var(--mist-dim)", marginTop: 8 }}>
        Because of Zero FIR, you can file at ANY police station — it doesn't have to be the one nearest
        to where something happened.
      </p>

      <hr className="divider" />

      {helplines.map((h, i) => (
        <div className="doc-block" key={i}>
          <div style={{ marginBottom: 2 }}>
            <SourceTag label="verified" />
          </div>
          <div className="doc-title">{h.title}</div>
          <p>{h.content}</p>
        </div>
      ))}
    </div>
  );
}
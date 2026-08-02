import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Guardian Mode's live dashboard — FR-4/5/7/8/9, TR-6.
 * Trusted contacts land here from the SMS link (server/routes/sos.js),
 * no login required. Route this at /guardian/:token.
 */
export default function GuardianView() {
  const { token } = useParams();
  const [emergency, setEmergency] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState(null);
  const [audioActive, setAudioActive] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chunksReceived, setChunksReceived] = useState(0);
  const audioQueueRef = useRef([]);
  const audioElRef = useRef(null);
  const playingRef = useRef(false);

  // Initial snapshot, via the two SECURITY DEFINER functions in schema.sql —
  // this is the only path the anon role has into this data.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: rows, error: rpcError } = await supabase.rpc(
        "get_emergency_by_token",
        { token }
      );
      if (rpcError || !rows?.length) {
        if (!cancelled) setError("Couldn't load this emergency — the link may have expired.");
        return;
      }
      if (!cancelled) setEmergency(rows[0]);

      const { data: timelineRows } = await supabase.rpc("get_timeline_by_token", { token });
      if (!cancelled && timelineRows) setTimeline(timelineRows);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Live updates via Realtime Broadcast on a channel named after the
  // share token (see server/lib/broadcast.js) — deliberately NOT
  // postgres_changes, so the anon role never needs table-level Realtime
  // access on top of RLS.
  useEffect(() => {
    const channel = supabase
      .channel(`emergency-${token}`)
      .on("broadcast", { event: "location_update" }, ({ payload }) => {
        setEmergency((prev) => (prev ? { ...prev, ...payload } : prev));
      })
      .on("broadcast", { event: "status_update" }, ({ payload }) => {
        setEmergency((prev) => (prev ? { ...prev, ...payload } : prev));
      })
      .on("broadcast", { event: "ambient_audio_chunk" }, ({ payload }) => {
        setAudioActive(true);
        setChunksReceived((n) => n + 1);
        audioQueueRef.current.push(payload.chunk);
        // If playback is never unlocked (Guardian hasn't tapped the
        // button yet), chunks arrive every ~3s for the whole emergency
        // with nothing draining the queue — cap it so a long emergency
        // can't accumulate an unbounded amount of audio data in memory.
        const MAX_QUEUED_CHUNKS = 20; // roughly a 1-minute buffer
        if (audioQueueRef.current.length > MAX_QUEUED_CHUNKS) {
          audioQueueRef.current = audioQueueRef.current.slice(-MAX_QUEUED_CHUNKS);
        }
        playNextChunk();
      })
      // Not sent yet by anything in this build — wire it up by calling
      // broadcastToGuardian(shareToken, "timeline_update", entry) from
      // sos.js the same way ping.js does, if you want live timeline rows.
      .on("broadcast", { event: "timeline_update" }, ({ payload }) => {
        setTimeline((prev) => [...prev, payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  function playNextChunk() {
    if (playingRef.current) return; // already draining the queue
    const next = audioQueueRef.current.shift();
    if (!next || !audioElRef.current) return;

    playingRef.current = true;
    audioElRef.current.src = next;
    audioElRef.current.play().catch((err) => {
      // Most likely the browser's autoplay policy — needs the "Enable
      // audio" tap below before it'll play without a fresh user gesture.
      console.warn("Ambient audio playback blocked:", err);
      playingRef.current = false;
    });
  }

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onEnded = () => {
      playingRef.current = false;
      playNextChunk();
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, []);

// A ~0-length but valid WAV file — just enough for the browser to have a
// real source to play, so play() actually settles instead of hanging in
// a pending state forever (which is what happens calling play() on an
// <audio> with no source assigned yet).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

  const enableAudio = () => {
    const el = audioElRef.current;
    if (!el) return;

    try {
      if (!el.src) el.src = SILENT_WAV; // give it something real to play
      Promise.resolve(el.play())
        .catch((err) => console.warn("Audio unlock playback rejected:", err?.name))
        .finally(() => setAudioUnlocked(true));
    } catch (err) {
      console.warn("Audio unlock threw synchronously:", err?.name);
      setAudioUnlocked(true);
    }
  };

  useEffect(() => {
    document.body.classList.toggle("is-emergency", emergency?.status === "active");
    return () => document.body.classList.remove("is-emergency");
  }, [emergency?.status]);

  if (error) return <p style={{ padding: 24, color: "var(--alarm-strong)" }}>{error}</p>;
  if (!emergency) return <p style={{ padding: 24, color: "var(--mist)" }}>Loading…</p>;

  return (
    <div>
      <header className="header rise-fade">
        <div className="wordmark">
          Suraksha <em>Shadow</em>
        </div>
        <p className="tagline">Guardian view</p>
      </header>

      <div
        className={`callout rise-fade`}
        style={{
          marginBottom: 22,
          background: emergency.status === "active" ? "var(--alarm-dim)" : "var(--safe-dim)",
          borderColor: emergency.status === "active" ? "#e8546b40" : "#6fbf8b40",
          color: emergency.status === "active" ? "var(--alarm-strong)" : "var(--safe)",
          fontWeight: 600,
        }}
      >
        {emergency.status === "active" ? "● Emergency active" : "✓ Resolved"}
      </div>

      <section className="section">
        <p className="eyebrow">Location</p>
        <div className="card">
          {emergency.lat != null ? (
            <a
              className="btn-primary"
              style={{ display: "inline-block", textDecoration: "none" }}
              href={`https://maps.google.com/?q=${emergency.lat},${emergency.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              View on map
            </a>
          ) : (
            <p style={{ fontSize: 13 }}>Waiting for the first location update…</p>
          )}
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Device</p>
        <div className="card" style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--mist-dim)" }}>Battery</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {emergency.battery_pct != null ? `${emergency.battery_pct}%` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--mist-dim)" }}>Movement</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{emergency.movement_status || "—"}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Ambient Audio</p>
        <div className="card">
          {audioActive ? (
            <p style={{ fontSize: 13, color: "var(--safe)" }}>● Live — {chunksReceived} chunk(s) received so far</p>
          ) : (
            <p style={{ fontSize: 13 }}>No ambient audio received yet (either not consented, or nothing streamed).</p>
          )}
          <button onClick={enableAudio} style={{ marginTop: 10 }} className={audioUnlocked ? "" : "btn-primary"}>
            {audioUnlocked ? "✓ Audio playback enabled" : "Tap to enable audio playback"}
          </button>
          <audio ref={audioElRef} style={{ display: "none" }} />
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Timeline</p>
        <div className="card" style={{ textAlign: "left" }}>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 13 }}>No timeline entries yet.</p>
          ) : (
            timeline.map((entry, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  padding: "8px 0",
                  borderBottom: i < timeline.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <span className="tag" style={{ marginRight: 8 }}>
                  {new Date(entry.created_at).toLocaleTimeString()}
                </span>
                {entry.details}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
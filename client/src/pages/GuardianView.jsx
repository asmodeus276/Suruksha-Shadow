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
        console.log("Ambient audio chunk received:", payload?.chunk?.slice(0, 40), "…");
        setAudioActive(true);
        setChunksReceived((n) => n + 1);
        audioQueueRef.current.push(payload.chunk);
        playNextChunk();
      })
      // Not sent yet by anything in this build — wire it up by calling
      // broadcastToGuardian(shareToken, "timeline_update", entry) from
      // sos.js the same way ping.js does, if you want live timeline rows.
      .on("broadcast", { event: "timeline_update" }, ({ payload }) => {
        setTimeline((prev) => [...prev, payload]);
      })
      .subscribe((status) => {
        console.log("Guardian realtime channel status:", status);
      });

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
    console.log("enableAudio: button clicked, ref exists?", Boolean(audioElRef.current));
    const el = audioElRef.current;
    if (!el) return;

    try {
      if (!el.src) el.src = SILENT_WAV; // give it something real to play
      const playResult = el.play();
      console.log("enableAudio: play() call returned", playResult);
      Promise.resolve(playResult)
        .then(() => console.log("enableAudio: play() resolved"))
        .catch((err) => console.log("enableAudio: play() rejected:", err?.name, err?.message))
        .finally(() => {
          console.log("enableAudio: marking unlocked");
          setAudioUnlocked(true);
        });
    } catch (err) {
      console.log("enableAudio: play() threw synchronously:", err?.name, err?.message);
      setAudioUnlocked(true);
    }
  };

  if (error) return <p>{error}</p>;
  if (!emergency) return <p>Loading…</p>;

  return (
    <div className="guardian-view">
      <h1>Live status</h1>
      <p>Status: {emergency.status}</p>

      <section>
        <h2>Location</h2>
        {emergency.lat != null ? (
          <a
            href={`https://maps.google.com/?q=${emergency.lat},${emergency.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            View on map
          </a>
        ) : (
          <p>Waiting for the first location update…</p>
        )}
      </section>

      <section>
        <h2>Device</h2>
        <p>Battery: {emergency.battery_pct != null ? `${emergency.battery_pct}%` : "—"}</p>
        <p>Movement: {emergency.movement_status || "—"}</p>
      </section>

      <section>
        <h2>Ambient Audio</h2>
        {audioActive ? (
          <p>🔊 Live — {chunksReceived} chunk(s) received so far</p>
        ) : (
          <p>No ambient audio received yet (either not consented, or nothing streamed).</p>
        )}
        <button onClick={enableAudio}>
          {audioUnlocked ? "✅ Audio playback enabled" : "Tap to enable audio playback"}
        </button>
        <audio ref={audioElRef} style={{ display: "none" }} />
      </section>

      <section>
        <h2>Timeline</h2>
        <ul>
          {timeline.map((entry, i) => (
            <li key={i}>
              {new Date(entry.created_at).toLocaleTimeString()} — {entry.details}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
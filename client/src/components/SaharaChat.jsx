import { useEffect, useRef, useState } from "react";

/**
 * FR10 — Trauma-Informed AI Chat. Rendered automatically by App.jsx the
 * moment an emergency becomes active (no user action needed to open it).
 * Fetches a reliable, hand-written opening line on mount, then hands
 * every subsequent turn to the AI under a trauma-informed system prompt
 * (see server/routes/sahara.js).
 */
export default function SaharaChat({ apiBaseUrl, eventId, messages, setMessages }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [opened, setOpened] = useState(false);
  const bottomRef = useRef(null);

  // Auto-open the moment this mounts — FR10 requires the interface (and
  // the conversation itself) to start without the user doing anything.
  useEffect(() => {
    if (opened || !eventId) return;
    setOpened(true);
    fetch(`${apiBaseUrl}/api/sahara/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages([{ role: "assistant", content: data.reply }]);
      })
      .catch((err) => {
        console.error("Failed to open Sahara chat:", err);
        setMessages([
          {
            role: "assistant",
            content: "Hey. I'm Sahara — I'm here with you. Are you somewhere safe right now?",
          },
        ]);
      });
  }, [apiBaseUrl, eventId, opened]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/sahara/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, sources: data.sources || [] },
      ]);
    } catch (err) {
      console.error("Sahara chat request failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having a little trouble right now, but I'm still here with you.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <p className="disclaimer" style={{ marginBottom: 10 }}>
        A calm space to talk, at your pace. Not a replacement for emergency services or a therapist.
      </p>

      <div className="chat-frame">
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role === "assistant" ? "from-sahara" : "from-user"} rise-fade`}>
            <div className="bubble">{m.content}</div>
            {m.sources?.length > 0 && (
              <div className="bubble-tags">
                {m.sources.map((s, j) => (
                  <span key={j} className="tag" title={s.title}>
                    {s.source}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && <div className="typing-indicator">Sahara is typing…</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="chat-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type at your own pace…"
          disabled={sending}
        />
        <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
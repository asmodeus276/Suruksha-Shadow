import { useEffect, useRef, useState } from "react";
import { SendIcon } from "./icons";

// Quick-reply chips shown after Sahara's first message. Each has a display
// label and an optional Hindi/Hinglish variant shown below it. Clicking one
// sends that text as the user's first message immediately — no typing needed.
const QUICK_REPLIES = [
  { label: "I'm safe now", sub: "मैं सुरक्षित हूँ" },
  { label: "I need legal help", sub: "मुझे कानूनी मदद चाहिए" },
  { label: "I'm still in danger", sub: "मैं अभी भी खतरे में हूँ" },
  { label: "Help me draft a complaint", sub: "शिकायत लिखने में मदद करें" },
];

/**
 * FR10 — Trauma-Informed AI Chat. Rendered automatically by App.jsx the
 * moment an emergency becomes active (no user action needed to open it).
 * Fetches a reliable, hand-written opening line on mount, then hands
 * every subsequent turn to the AI under a trauma-informed system prompt
 * (see server/routes/sahara.js).
 *
 * Streaming: the /chat endpoint returns Server-Sent Events. We read the
 * stream and update the message bubble incrementally so the user sees the
 * first words within ~300 ms instead of waiting for the full reply.
 */
export default function SaharaChat({ apiBaseUrl, eventId, messages, setMessages }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [opened, setOpened] = useState(false);
  // Hide chips once the user sends their first real message
  const [chipsVisible, setChipsVisible] = useState(false);
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
        setChipsVisible(true); // show chips after first Sahara message
      })
      .catch((err) => {
        console.error("Failed to open Sahara chat:", err);
        setMessages([
          {
            role: "assistant",
            content:
              "Hey. I'm Sahara — I'm here with you. Are you somewhere safe right now?\n\nमैं सहारा हूँ — मैं आपके साथ हूँ। क्या आप अभी सुरक्षित हैं?",
          },
        ]);
        setChipsVisible(true);
      });
  }, [apiBaseUrl, eventId, opened, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Core send function — shared by text input and quick-reply chips.
   * Uses the streaming /chat endpoint: appends a placeholder bubble
   * immediately, then fills it token-by-token as SSE chunks arrive.
   */
  const sendMessage = async (text) => {
    if (!text || sending) return;

    // Hide chips the moment user sends anything
    setChipsVisible(false);

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    // Append a streaming placeholder bubble for Sahara's reply
    const streamingBubble = { role: "assistant", content: "", streaming: true, sources: [] };
    setMessages((prev) => [...prev, streamingBubble]);

    try {
      const res = await fetch(`${apiBaseUrl}/api/sahara/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let finalSources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const parsed = JSON.parse(raw);
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              // Update the last (streaming) bubble incrementally
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: accumulated,
                  streaming: true,
                };
                return updated;
              });
            }
            if (parsed.sources) {
              finalSources = parsed.sources;
            }
          } catch {
            // malformed SSE line — skip silently
          }
        }
      }

      // Mark streaming complete, attach sources
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: accumulated ||
            "I'm having a little trouble right now, but I'm still here with you.\n\nमुझे अभी थोड़ी दिक्कत हो रही है, पर मैं आपके साथ हूँ।",
          streaming: false,
          sources: finalSources,
        };
        return updated;
      });
    } catch (err) {
      console.error("Sahara chat request failed:", err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "I'm having a little trouble right now, but I'm still here with you.\n\nमुझे अभी थोड़ी दिक्कत हो रही है, पर मैं आपके साथ हूँ।",
          streaming: false,
          sources: [],
        };
        return updated;
      });
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  const handleChip = (chipLabel) => {
    sendMessage(chipLabel);
  };

  return (
    <div>
      <p className="disclaimer mb-3">
        A calm space to talk, at your pace. Not a replacement for emergency services or a therapist.
      </p>

      <div className="chat-frame">
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role === "assistant" ? "from-sahara" : "from-user"} rise-fade`}>
            <div className={`bubble${m.streaming ? " bubble--streaming" : ""}`}>
              {m.content}
              {m.streaming && <span className="streaming-cursor" aria-hidden="true" />}
            </div>
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

        {/* Only show 3-dot indicator when we're waiting but no streaming bubble yet */}
        {sending && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="typing-indicator">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick-reply chips — shown only after Sahara's first message,
          hidden once the user has typed or tapped anything */}
      {chipsVisible && messages.length > 0 && !sending && (
        <div className="quick-replies" role="group" aria-label="Quick replies">
          {QUICK_REPLIES.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="quick-reply-chip"
              onClick={() => handleChip(chip.label)}
              disabled={sending}
            >
              <span className="chip-label">{chip.label}</span>
              <span className="chip-sub">{chip.sub}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type in English or Hindi, at your own pace…"
          disabled={sending}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={sending || !input.trim()}
          aria-label="Send"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 14px" }}
        >
          <SendIcon size={16} />
        </button>
      </form>
    </div>
  );
}

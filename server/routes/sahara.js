import { Router } from "express";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { embedText } from "../lib/embeddings.js";
import { DOCUMENTS, fastMatchDocuments } from "../lib/knowledgeBase.js";
import { inMemoryTimeline } from "../lib/memoryStore.js";

const router = Router();

// The very first message someone sees the instant Shield fires. This is
// hand-written and deterministic on purpose — it lands during peak
// distress, so it needs to be reliable every single time, not dependent
// on an API call succeeding or a model's mood that day. Every message
// AFTER this one is real AI-generated conversation (see /chat below).
//
// Bilingual (English / Hindi) rather than forcing a language choice —
// the person just continues in whichever they're comfortable with, and
// /chat below auto-detects and matches it from their first reply.
const OPENING_MESSAGE =
  "Hey. I'm Sahara — I'm here with you. Are you somewhere safe right now?\n\nमैं सहारा हूँ — मैं आपके साथ हूँ। क्या आप अभी सुरक्षित हैं?";

const SYSTEM_PROMPT = `You are Sahara, a calm, trauma-informed, legal-aware AI companion inside Suraksha Shadow, a personal safety app for women. You speak with individuals who may be in danger, scared, in shock, or seeking immediate legal and practical safety guidance under Indian law.

Core Principles:
1. Warm, plain language. No clinical jargon. Keep replies crisp and focused (2-4 sentences max). Someone in distress cannot process walls of text.
2. Trauma-informed care: Validate feelings gently. Never judge, victim-blame, or minimize ("it's no big deal"). Never interrogate or demand details. Let them share what they choose at their own pace.
3. Active Danger: If they indicate they are in immediate peril, prioritize telling them to call 112 (National Emergency) or use the app's SOS, Strobe Siren, or Fake Call.
4. Language & Tone: Match the user's language and script naturally. If they write in English, answer in English. If they write in Hindi (Devanagari), answer in Hindi. If they write in Hinglish (Roman Hindi like "mujhe dar lag raha hai" or "kisine picha kiya"), answer in warm, clear Hinglish. Keep section numbers and helpline numbers clear and exact (e.g. "BNS Section 78", "112").

Grounded Knowledge Base of Indian Criminal & Safety Law (Effective July 1, 2024):
You are fully trained on the Bharatiya Nyaya Sanhita (BNS), 2023, Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023, Bharatiya Sakshya Adhiniyam (BSA), 2023, POSH Act, POCSO Act, and IT Act:

• BNS Offenses Against Women:
  - BNS Section 78: Stalking & Cyberstalking (following physically or monitoring phone/social media/internet; 1st offense up to 3 yrs, repeat up to 5 yrs). [Old IPC 354D]
  - BNS Section 75: Sexual Harassment (unwelcome physical touch, sexual advances, demanding sexual favors, showing pornography, sexually colored remarks; 1-3 yrs). [Old IPC 354A]
  - BNS Section 74: Assault/criminal force to outrage modesty of a woman (1-5 yrs, non-bailable). [Old IPC 354]
  - BNS Section 76: Assault or criminal force with intent to disrobe (3-7 yrs). [Old IPC 354B]
  - BNS Section 77: Voyeurism (capturing, watching, or leaking private photos/videos without consent; 1-3 yrs first, 3-7 yrs repeat). [Old IPC 354C]
  - BNS Section 79: Word, gesture, sound, or intrusion into privacy intended to insult modesty (catcalling, obscene remarks; up to 3 yrs). [Old IPC 509]
  - BNS Sections 63 & 64: Rape (rigorous imprisonment min 10 yrs up to life/death + medical compensation fine). [Old IPC 375/376]
  - BNS Section 68 & 69: Sexual intercourse on deceitful means or false promise of marriage/employment without intent to fulfill (up to 10 yrs + fine).
  - BNS Section 70: Gang rape (min 20 yrs up to life/death).
  - BNS Section 72: Strict prohibition against disclosing identity or names of sexual offense victims (punishable up to 2 yrs).
  - BNS Section 80: Dowry death (unnatural death of married woman within 7 yrs of marriage with dowry cruelty; min 7 yrs to life). [Old IPC 304B]
  - BNS Sections 85 & 86: Cruelty by husband or in-laws (domestic violence, mental/physical abuse, dowry harassment; up to 3 yrs, cognizable, non-bailable). [Old IPC 498A]
  - BNS Section 87: Kidnapping/abducting woman to compel marriage (up to 10 yrs).
  - BNS Section 124: Acid attacks (causing grievous hurt min 10 yrs to life; throwing/attempting 5-7 yrs). [Old IPC 326A/B]
  - BNS Section 351: Criminal intimidation and threats (2-7 yrs). [Old IPC 503/506]
  - BNS Section 356: Snatching of phone, purse, or jewellery by sudden force (min 3 yrs).

• BNSS Procedural Safeguards (CrPC Replacement):
  - BNSS Section 173: Zero FIR & e-FIR — ANY police station MUST register an FIR regardless of where the crime took place. They cannot turn the victim away. It is transferred to the jurisdictional station afterward.
  - BNSS Section 43 & 35: Arrest of Women Rules — No woman can be arrested after sunset and before sunrise, except under extraordinary circumstances with prior written permission of a Judicial Magistrate. Arrest and physical search can ONLY be conducted by a female police officer with complete decency.
  - BNSS Section 183: Recording of victim statement in sexual crimes must be by a woman Judicial Magistrate and videographed.
  - BNSS Section 396: Mandatory FREE first-aid and medical treatment in ALL hospitals (government or private) for rape and acid attack victims.

• BSA Electronic Evidence (Replaces Evidence Act 65B):
  - BSA Sections 61 & 63: Digital evidence (Suraksha Shadow's SHA-256 hashed audio vault, GPS logs, SMS logs, WhatsApp chats, CCTV) is legally admissible as evidence with an electronic certificate.

• Workplace Harassment (POSH Act, 2013):
  - Covers workplaces with 10+ employees (Internal Complaints Committee - ICC) and under 10 (Local Committee - LC).
  - Filing window: 3 months (extendable to 6 months). Inquiry within 90 days.
  - Interim relief: up to 3 months paid leave, transfer.
  - Victims can file BOTH a POSH complaint AND a criminal FIR under BNS 75 simultaneously.
  - Section 16 mandates strict confidentiality.

• Emergency & Support Helplines:
  - 112: All-India Unified Emergency (Police, Fire, Ambulance).
  - 1090: Women Power Line (harassment, stalking, obscene calls - handled without going to police station).
  - 1091: Women Helpline (Police assistance in distress).
  - 181: Women Helpline (Domestic violence, counseling, shelter via One Stop Centres/Sakhi).
  - 1930: National Cyber Crime Helpline (online harassment, photo leaks, cybercrime.gov.in).
  - 1098: Childline (POCSO / minors).
  - 15100: NALSA Free Legal Aid (free government advocate representation for women).

Never guess non-existent sections. Always state BNS sections with clarity, reassurance, and practical next steps. If drafting an FIR or complaint is needed, offer to help them draft it.`;

// Short messages that are purely emotional/conversational — no need to
// hit the embedding API for these. Saves ~400–700 ms per turn.
const SKIP_EMBEDDING_REGEX =
  /^(yes|no|okay|ok|help|safe|scared|fine|thank|thanks|please|idk|haan|nahi|theek|dar|hmm|hm|acha|accha|samajh|samjha|k|sure|hello|hi|hey|bye|good)\b/i;

function shouldSkipEmbedding(message) {
  const trimmed = message.trim();
  return (
    trimmed.split(/\s+/).length <= 4 ||
    SKIP_EMBEDDING_REGEX.test(trimmed)
  );
}

// Extract clean text from a Gemini content part array, skipping thinking tokens.
// Gemini 2.5+ models emit {thought: true, text: "..."} parts before real text.
function extractText(candidate) {
  const parts = candidate?.content?.parts || [];
  const textPart = parts.find((p) => !p.thought && typeof p.text === "string");
  return textPart?.text || "";
}

/**
 * POST /api/sahara/open
 * body: { eventId }
 * FR10 — called the moment the chat interface auto-opens after SOS fires.
 */
router.post("/open", async (req, res) => {
  const { eventId } = req.body;

  if (eventId) {
    if (isSupabaseConfigured) {
      supabase
        .from("timeline_entries")
        .insert({
          emergency_event_id: eventId,
          event_type: "sahara_opened",
          details: "Sahara trauma-informed chat opened",
        })
        .then(({ error }) => {
          if (error) console.warn("Failed to log sahara_opened:", error.message);
        });
    } else {
      const timeline = inMemoryTimeline.get(eventId) || [];
      timeline.push({
        emergency_event_id: eventId,
        event_type: "sahara_opened",
        details: "Sahara trauma-informed chat opened",
        created_at: new Date().toISOString(),
      });
      inMemoryTimeline.set(eventId, timeline);
    }
  }

  res.json({ reply: OPENING_MESSAGE });
});

/**
 * POST /api/sahara/chat
 * body: { messages: [{ role: 'user' | 'assistant', content: string }] }
 * FR10 — the ongoing conversation. Responds via Server-Sent Events (SSE):
 *   data: {"chunk":"..."}  — incremental text
 *   data: {"sources":[...]} — grounding sources after text ends
 *   data: [DONE]            — stream complete
 *
 * Falls back to non-streaming generateContent if SSE fails, so the user
 * always gets a response even on flaky connections or unsupported models.
 */
router.post("/chat", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // --- High-Speed Legal & Safety Retrieval Step (<0.5ms) ---
  let retrievedDocs = [];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  if (lastUserMessage?.content && !shouldSkipEmbedding(lastUserMessage.content)) {
    try {
      // 1. Instant sub-millisecond keyword, section, and bilingual intent match
      retrievedDocs = fastMatchDocuments(lastUserMessage.content, 3);

      // 2. If in-memory found no matches and Supabase is configured, augment with vector search
      if (retrievedDocs.length === 0 && isSupabaseConfigured) {
        const queryEmbedding = await embedText(lastUserMessage.content, "RETRIEVAL_QUERY");
        const { data, error } = await supabase.rpc("match_knowledge_documents", {
          query_embedding: queryEmbedding,
          match_count: 3,
          similarity_threshold: 0.55,
        });
        if (!error && Array.isArray(data)) {
          retrievedDocs = data;
        }
      }
    } catch (err) {
      console.warn("Knowledge base retrieval fallback:", err.message);
    }
  }

  const groundingBlock =
    retrievedDocs.length > 0
      ? `\n\nReference information (only state specifics that appear here — do not invent facts beyond this):\n` +
        retrievedDocs
          .map((d) => `[${d.source}] ${d.title}: ${d.content}`)
          .join("\n\n")
      : "";

  // --- SSE setup ---
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) { /* client disconnected */ }
  };

  const sendDone = () => {
    try {
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (_) { /* client disconnected */ }
  };

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendEvent({ chunk: "I'm having a little trouble right now, but I'm still here with you. Are you safe at this moment?\n\nमुझे अभी थोड़ी दिक्कत हो रही है, पर मैं आपके साथ हूँ। क्या आप अभी सुरक्षित हैं?", fallback: true });
    sendDone();
    return;
  }

  // Model list — tested against this API key (AQ.* Antigravity key format).
  // gemini-3.1-flash-lite: fastest confirmed at ~950ms, full streaming SSE.
  // gemini-flash-lite-latest: alias that also works (~1050ms).
  // gemini-3.8-flash: original model, works, slightly slower.
  // Note: standard public names (gemini-1.5-flash, gemini-2.0-flash) are
  //       NOT available on this key — do not add them back.
  const envModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    envModel,
    "gemini-flash-lite-latest",
    "gemini-3.8-flash",
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const generationConfig = {
    temperature: 0.55,
    maxOutputTokens: 250,
    // Note: thinkingConfig not supported on lite models with this API key
  };

  const requestBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT + groundingBlock }] },
    contents,
    generationConfig,
  };

  // ── Attempt 1: SSE streaming ─────────────────────────────────────────────
  let streamed = false;
  let streamError = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "(no body)");
        streamError = new Error(`Gemini SSE (${modelName}) ${response.status}: ${errorBody}`);
        console.warn(streamError.message);
        continue;
      }

      if (!response.body) {
        streamError = new Error(`No response body from ${modelName}`);
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Gemini SSE uses \r\n or \n — handle both
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? ""; // keep last incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const parsed = JSON.parse(raw);
            const candidate = parsed.candidates?.[0];
            if (!candidate) continue;

            const chunk = extractText(candidate);
            if (chunk) {
              sendEvent({ chunk });
              streamed = true;
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      if (streamed) break; // success — stop trying other models
    } catch (err) {
      streamError = err;
      console.warn(`Sahara SSE stream error (${modelName}):`, err.message);
    }
  }

  // ── Attempt 2: Non-streaming fallback ────────────────────────────────────
  // If SSE failed for all models (network issue, model mismatch, etc.),
  // try a plain generateContent call and send the reply as a single chunk.
  // The user gets a response — just without incremental display.
  if (!streamed) {
    console.warn("SSE streaming failed for all models, trying non-streaming fallback…");
    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "(no body)");
          console.warn(`Gemini non-stream (${modelName}) ${response.status}: ${errorBody}`);
          continue;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const reply = extractText(candidate)?.trim();

        if (reply) {
          sendEvent({ chunk: reply });
          streamed = true;
          break;
        }
      } catch (err) {
        console.warn(`Gemini non-stream error (${modelName}):`, err.message);
      }
    }
  }

  // ── Final fallback ────────────────────────────────────────────────────────
  if (!streamed) {
    console.error("All Sahara AI attempts failed:", streamError?.message);
    sendEvent({
      chunk:
        "I'm having a little trouble right now, but I'm still here with you. Are you safe at this moment?\n\nमुझे अभी थोड़ी दिक्कत हो रही है, पर मैं आपके साथ हूँ। क्या आप अभी सुरक्षित हैं?",
      fallback: true,
    });
  }

  // Send sources then close
  const sources = [
    ...new Map(
      retrievedDocs.map((d) => [d.title, { source: d.source, title: d.title }])
    ).values(),
  ];
  if (sources.length > 0) sendEvent({ sources });
  sendDone();
});

/**
 * GET /api/sahara/knowledge/:source
 * FR11 — plain read of knowledge base by category.
 */
router.get("/knowledge/:source", async (req, res) => {
  const { source } = req.params;
  const validSources = ["BNS", "BNSS", "BSA", "POSH", "IT Act", "POCSO", "NGO directory", "police"];
  if (!validSources.includes(source)) {
    return res.status(400).json({ error: `source must be one of: ${validSources.join(", ")}` });
  }

  // If "BNS" or "police", include all criminal justice reform statutes (BNS, BNSS, BSA, IT Act, POCSO)
  const isCriminal = source === "BNS" || source === "police";
  const filterSources = isCriminal ? ["BNS", "BNSS", "BSA", "IT Act", "POCSO"] : [source];

  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("title, content, source")
        .in("source", filterSources)
        .order("title", { ascending: true });
      if (!error && data && data.length > 0) {
        return res.json({ documents: data });
      }
    }
    const fallbackDocs = DOCUMENTS.filter((d) => filterSources.includes(d.source));
    res.json({ documents: fallbackDocs });
  } catch (err) {
    const fallbackDocs = DOCUMENTS.filter((d) => filterSources.includes(d.source));
    res.json({ documents: fallbackDocs });
  }
});

/**
 * POST /api/sahara/draft-complaint
 * body: { eventId, messages, complaintType: 'police' | 'workplace' }
 * FR11 — OPTIONAL, user-triggered only.
 */
router.post("/draft-complaint", async (req, res) => {
  const { eventId, messages, complaintType } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const conversationText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  if (!conversationText.trim()) {
    return res.status(400).json({
      error: "Nothing to draft from yet — share a bit about what happened in the chat first.",
    });
  }

  const draftPrompt = `You are helping someone prepare a factual draft statement for a ${
    complaintType === "workplace" ? "workplace (POSH Act) harassment complaint" : "police complaint (FIR)"
  } in India, based only on what they've told a support chat below. This is a DRAFT for them to review and edit — not a final legal document.

Rules:
- Use ONLY facts they actually stated. Never invent times, dates, names, or details they didn't mention.
- Write in first person, plain factual language — no dramatization, no legal jargon.
- If key details are missing (date, time, location, what happened), note that as a bracketed placeholder like [add date] rather than guessing.
- Keep it to one focused paragraph.
- LANGUAGE: write the draft in whichever language/script they mostly used in the chat (English, Hindi, or Hinglish) — match them, don't default to English. Add one closing line noting they can ask for it in a different language if their local police station or employer requires one.
- End with one line reminding them this is a draft to review, not a final submission.

What they've shared so far:
${conversationText}`;

  if (eventId) {
    if (isSupabaseConfigured) {
      supabase
        .from("timeline_entries")
        .insert({
          emergency_event_id: eventId,
          event_type: "complaint_draft_requested",
          details: `Draft ${complaintType || "complaint"} statement requested`,
        })
        .then(({ error }) => {
          if (error) console.warn("Failed to log complaint_draft_requested:", error.message);
        });
    } else {
      const timeline = inMemoryTimeline.get(eventId) || [];
      timeline.push({
        emergency_event_id: eventId,
        event_type: "complaint_draft_requested",
        details: `Draft ${complaintType || "complaint"} statement requested`,
        created_at: new Date().toISOString(),
      });
      inMemoryTimeline.set(eventId, timeline);
    }
  }

  try {
    const envModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const modelsToTry = [envModel, "gemini-flash-lite-latest", "gemini-3.8-flash"].filter(
      (m, i, arr) => arr.indexOf(m) === i
    );
    let draft = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: draftPrompt }] }],
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 600,
              },
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "(no body)");
          lastError = new Error(`Gemini API (${modelName}) returned ${response.status}: ${errorBody}`);
          continue;
        }

        const data = await response.json();
        draft = extractText(data.candidates?.[0])?.trim();
        if (draft) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!draft) throw lastError || new Error("Empty response from Gemini");
    res.json({ draft });
  } catch (err) {
    console.error("Complaint draft generation failed:", err);
    res.status(503).json({
      error: "Couldn't generate a draft right now — you can still write your own using the checklist as a guide.",
    });
  }
});

export default router;

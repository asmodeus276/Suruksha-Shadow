import { Router } from "express";

const router = Router();

const PROMPT = `You generate ONE side of an ordinary, mundane phone conversation, as if a friend or family member is talking to the user. The goal is to sound completely normal to someone overhearing it — nothing about safety, emergencies, or anything unusual.

Return a JSON array of 5-8 short lines (5-15 words each) that a caller might say during a casual check-in call. Vary the pacing — some short reactions ("Oh really?", "Haha, okay"), some longer ones. Only the caller's lines, not the user's side. Do not break character or reference that this is generated.

Return ONLY the JSON array, no other text, no markdown fences.`;

/**
 * POST /api/fake-call/lines
 * FR-3 / TR-4 — generates one side of an ordinary-sounding phone call.
 */
router.post("/lines", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const modelsToTry = [
      process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    let lines = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: PROMPT }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "(couldn't read response body)");
          lastError = new Error(`Gemini API (${modelName}) returned ${response.status}: ${errorBody}`);
          continue;
        }

        const data = await response.json();
        const raw = data?.candidates?.[0]?.content?.parts?.find((p) => !p.thought)?.text;
        if (raw) {
          const cleaned = raw.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            lines = parsed;
            break;
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!lines) throw lastError || new Error("Failed to generate dialogue lines from Gemini");

    res.json({ lines });
  } catch (err) {
    console.error("Fake-call generation failed:", err);
    res.json({
      lines: [
        "Hey! What's up?",
        "Oh nice, how'd that go?",
        "Haha, no way.",
        "Yeah, I'm just heading out now.",
        "Okay, talk soon!",
      ],
    });
  }
});

/**
 * POST /api/fake-call/speak
 * body: { text: string, voice?: string }
 *
 * Uses Gemini TTS to synthesise a human-sounding voice for the fake call.
 * Returns base64-encoded audio + mimeType so the client can play it
 * directly via Web Audio API with a telephone bandpass filter applied.
 *
 * Available voices: Aoede (warm female, default) | Kore | Charon | Fenrir | Puck
 */
router.post("/speak", async (req, res) => {
  const { text, voice = "Aoede" } = req.body || {};
  if (!text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
  }

  // Model priority: lite first (faster, WAV output), then full TTS
  const ttsModels = [
    "gemini-3.8-flash-lite-tts",
    "gemini-3.8-flash-tts",
    "gemini-3.1-flash-tts-preview",
  ];

  for (const modelName of ttsModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
            },
          }),
          signal: AbortSignal.timeout(12000),
        }
      );

      if (!response.ok) {
        console.warn(`TTS model ${modelName} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (inlineData?.data) {
        return res.json({
          audio: inlineData.data,     // base64-encoded audio
          mimeType: inlineData.mimeType || "audio/wav",
          model: modelName,
        });
      }
    } catch (err) {
      console.warn(`TTS model ${modelName} error:`, err.message);
    }
  }

  // All TTS models failed — tell client to fall back to speechSynthesis
  return res.status(503).json({ error: "TTS generation failed — use fallback" });
});

export default router;

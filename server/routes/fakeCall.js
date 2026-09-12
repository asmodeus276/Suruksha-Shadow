import { Router } from "express";

const router = Router();

const PROMPT = `You generate ONE side of an ordinary, mundane phone conversation, as if a friend or family member is talking to the user. The goal is to sound completely normal to someone overhearing it — nothing about safety, emergencies, or anything unusual.

Return a JSON array of 5-8 short lines (5-15 words each) that a caller might say during a casual check-in call. Vary the pacing — some short reactions ("Oh really?", "Haha, okay"), some longer ones. Only the caller's lines, not the user's side. Do not break character or reference that this is generated.

Return ONLY the JSON array, no other text, no markdown fences.`;

/**
 * POST /api/fake-call/lines
 * FR-3 / TR-4 — generates one side of an ordinary-sounding phone call
 * for Shield's fake-call deception. Played back client-side via the
 * browser's built-in speechSynthesis (see client/src/hooks/useFakeCall.js)
 * — no paid TTS required.
 *
 * Model string below is current as of July 2026 (gemini-3.6-flash, per
 * Google's own docs) — Gemini model names have already changed THREE
 * times during this project's build (2.0 → 2.5 → 3.6), so treat this as
 * likely to go stale again. If this starts erroring, check
 * ai.google.dev/gemini-api/docs/generate-content/latest-model for the
 * current GA model name rather than guessing.
 */
router.post("/lines", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const modelsToTry = [primaryModel, "gemini-3.1-flash-lite"].filter((m, i, arr) => arr.indexOf(m) === i);
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
              generationConfig: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel: "LOW" },
              },
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "(couldn't read response body)");
          lastError = new Error(`Gemini API (${modelName}) returned ${response.status}: ${errorBody}`);
          continue;
        }

        const data = await response.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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

    if (!lines) {
      throw lastError || new Error("Failed to generate dialogue lines from Gemini");
    }

    res.json({ lines });
  } catch (err) {
    console.error("Fake-call generation failed:", err);
    // Never let this block or reveal an error mid-emergency — fall back
    // to a small built-in script instead.
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

export default router;
import { Router } from "express";

const router = Router();

const UNIVERSAL_EMERGENCY_WORDS = [
  "banana",
  "banan",
  "bana na",
  "bananas",
  "bahana",
  "banao",
  "bonanza",
  "panana",
  "help",
  "help me",
  "halp",
  "bachao",
  "bachao mujhe",
  "bchao",
  "bachaoo",
  "bachav",
  "save me",
  "save",
  "emergency",
  "danger",
  "khatra",
  "call police",
  "police",
  "suraksha",
  "madad",
  "madad karo",
  "chhoro",
  "chor",
  "chodo",
  "attack",
  "koi hai",
];

const PHONETIC_ALIASES = {
  banana: [
    "banana",
    "bananas",
    "bananaa",
    "banan",
    "bana na",
    "bananna",
    "banano",
    "banao",
    "bahana",
    "bana",
    "bonanza",
    "bonana",
    "panana",
    "vanana",
    "banna",
    "benana",
    "binana",
    "bunana",
    "panna",
    "ba na na",
    "ban naa",
    "ban nah",
    "banan a",
    "pananna",
    "by nanna",
    "bye nana",
    "buy nanna",
    "bernard",
    "panama",
    "bandana",
    "punana",
  ],
  bachao: [
    "bachao",
    "bachao mujhe",
    "bchao",
    "bachaoo",
    "banao",
    "bachav",
    "bacho",
    "bachao ji",
    "mujhe bachao",
    "bachao bachao",
    "bachaho",
    "bachyo",
    "bachha",
    "bacha",
    "bachaye",
  ],
  help: [
    "help",
    "help me",
    "halp",
    "elp",
    "please help",
    "madad",
    "madad karo",
    "save me",
    "save",
    "emergency",
    "danger",
    "khatra",
    "police",
    "suraksha",
    "chodo",
    "chhoro",
    "attack",
    "call police",
    "call 112",
  ],
};

function checkCodewordMatch(text, targetWord = "banana") {
  if (!text) return { isMatch: false, matchedWord: "", confidence: 0 };
  const cleanSpoken = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const cleanTarget = (targetWord || "banana").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();

  if (!cleanTarget || !cleanSpoken) return { isMatch: false, matchedWord: "", confidence: 0 };

  // 1. Direct substring match
  if (cleanSpoken.includes(cleanTarget)) {
    return { isMatch: true, matchedWord: cleanTarget, confidence: 0.99 };
  }

  // 2. Compressed whitespace match (e.g. "bana na" -> "banana")
  const compressedSpoken = cleanSpoken.replace(/\s+/g, "");
  const compressedTarget = cleanTarget.replace(/\s+/g, "");
  if (compressedTarget && compressedSpoken.includes(compressedTarget)) {
    return { isMatch: true, matchedWord: cleanTarget, confidence: 0.98 };
  }

  // 3. Phonetic alias match
  for (const [key, aliases] of Object.entries(PHONETIC_ALIASES)) {
    if (cleanTarget === key || cleanTarget.includes(key) || key.includes(cleanTarget)) {
      for (const alias of aliases) {
        const compAlias = alias.replace(/\s+/g, "");
        if (cleanSpoken.includes(alias) || compressedSpoken.includes(compAlias)) {
          return { isMatch: true, matchedWord: cleanTarget, confidence: 0.96 };
        }
      }
    }
  }

  // 4. Universal emergency words
  for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
    const compUniversal = universal.replace(/\s+/g, "");
    if (cleanSpoken.includes(universal) || compressedSpoken.includes(compUniversal)) {
      return { isMatch: true, matchedWord: universal, confidence: 0.95 };
    }
  }

  return { isMatch: false, matchedWord: "", confidence: 0 };
}

/**
 * Transcribe via Groq Whisper API (whisper-large-v3-turbo / distil-whisper)
 */
async function transcribeWithGroq(audioBuffer, mimeType, apiKey) {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("wav") ? "wav" : "ogg";
  const filename = `speech.${ext}`;

  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const modelPart = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);

  const fullBody = Buffer.concat([pre, audioBuffer, modelPart, post]);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq Whisper error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.text || "";
}

/**
 * Transcribe via Gemini 1.5 Flash Audio Multimodal API
 */
async function transcribeWithGemini(audioBase64, mimeType, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType || "audio/webm",
              data: audioBase64,
            },
          },
          {
            text: "Transcribe the spoken words in this short audio clip exactly. Return ONLY the transcribed text in plain text. If inaudible, return silence.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 60,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Audio error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.trim();
}

/**
 * POST /api/audio/transcribe
 * Body: { audio: "base64...", mimeType: "audio/webm", codeWord: "banana" }
 */
router.post("/transcribe", async (req, res) => {
  const { audio, mimeType = "audio/webm", codeWord = "banana" } = req.body || {};

  if (!audio) {
    return res.status(400).json({ ok: false, error: "Audio data is required (base64 string)" });
  }

  const cleanBase64 = audio.includes("base64,") ? audio.split("base64,")[1] : audio;
  const audioBuffer = Buffer.from(cleanBase64, "base64");

  let transcript = "";
  let provider = "none";

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    if (groqKey) {
      try {
        transcript = await transcribeWithGroq(audioBuffer, mimeType, groqKey);
        provider = "groq-whisper";
      } catch (err) {
        console.warn("[TRANSCRIBE] Groq Whisper failed, trying fallback:", err.message);
      }
    }

    if (!transcript && geminiKey) {
      try {
        transcript = await transcribeWithGemini(cleanBase64, mimeType, geminiKey);
        provider = "gemini-flash";
      } catch (err) {
        console.warn("[TRANSCRIBE] Gemini Audio failed, trying fallback:", err.message);
      }
    }

    if (!transcript && openaiKey) {
      try {
        transcript = await transcribeWithGroq(audioBuffer, mimeType, openaiKey);
        provider = "openai-whisper";
      } catch (err) {
        console.warn("[TRANSCRIBE] OpenAI Whisper failed:", err.message);
      }
    }

    const { isMatch, matchedWord, confidence } = checkCodewordMatch(transcript, codeWord);

    return res.json({
      ok: true,
      text: transcript,
      isMatch,
      matchedWord,
      confidence,
      provider,
    });
  } catch (err) {
    console.error("[TRANSCRIBE] Server error:", err.message);
    return res.json({
      ok: true,
      text: "",
      isMatch: false,
      error: err.message,
      provider: "fallback",
    });
  }
});

export default router;

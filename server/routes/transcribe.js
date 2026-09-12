import { Router } from "express";

const router = Router();

// Universal distress keywords in Latin & Devanagari
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
  // Hindi / Devanagari representations
  "बनाना",
  "केला",
  "बचाओ",
  "बचाओ मुझे",
  "मुझे बचाओ",
  "बचाव",
  "मदद",
  "मदद करो",
  "हेल्प",
  "हेल्प मी",
  "खतरा",
  "सुरक्षा",
  "पुलिस",
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
    "pyjama",
    "badana",
    "बनाना",
    "केला",
    "बना",
    "बनाओ",
    "बहाना",
    "बना ना",
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
    "bachha do",
    "bachaye",
    "bachayein",
    "बचाओ",
    "बचाओ मुझे",
    "मुझे बचाओ",
    "बचाव",
    "बचाओ बचाओ",
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
    "somebody help",
    "help please",
    "call police",
    "call 112",
    "हेल्प",
    "हेल्प मी",
    "मदद",
    "मदद करो",
    "सुरक्षा",
    "खतरा",
    "पुलिस",
  ],
};

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(s1, s2) {
  if (!s1 || !s2) return (s1 || "").length + (s2 || "").length;
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Normalized Fuzzy Codeword Matcher
 * 1. Strips punctuation, quotes, and control chars while keeping Unicode letters (\p{L}).
 * 2. Exact match & substring match.
 * 3. Whitespace-compressed match.
 * 4. Phonetic & regional alias table match.
 * 5. Levenshtein fuzzy distance & ratio match.
 */
function checkCodewordMatch(rawText, targetWord = "banana") {
  if (!rawText || typeof rawText !== "string") {
    return { isMatch: false, matchedWord: "", confidence: 0, normalizedText: "" };
  }

  // Normalize text: lowercase, strip punctuation/symbols, collapse whitespace
  const normalizedText = rawText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleanTarget = (targetWord || "banana")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTarget || !normalizedText) {
    return { isMatch: false, matchedWord: "", confidence: 0, normalizedText };
  }

  const compressedSpoken = normalizedText.replace(/\s+/g, "");
  const compressedTarget = cleanTarget.replace(/\s+/g, "");

  // 1. Direct Substring & Exact Match
  if (normalizedText.includes(cleanTarget) || (compressedTarget && compressedSpoken.includes(compressedTarget))) {
    return { isMatch: true, matchedWord: cleanTarget, confidence: 0.99, normalizedText, matchType: "direct-substring" };
  }

  // 2. Phonetic Alias Table Match
  for (const [key, aliases] of Object.entries(PHONETIC_ALIASES)) {
    if (cleanTarget === key || cleanTarget.includes(key) || key.includes(cleanTarget)) {
      for (const alias of aliases) {
        const compAlias = alias.replace(/\s+/g, "");
        if (
          normalizedText.includes(alias) ||
          (compAlias.length >= 3 && compressedSpoken.includes(compAlias))
        ) {
          return { isMatch: true, matchedWord: cleanTarget, confidence: 0.97, normalizedText, matchType: `alias-${alias}` };
        }
      }
    }
  }

  // 3. Universal Emergency Words Match
  for (const universal of UNIVERSAL_EMERGENCY_WORDS) {
    const compUniversal = universal.replace(/\s+/g, "");
    if (
      normalizedText.includes(universal) ||
      (compUniversal.length >= 3 && compressedSpoken.includes(compUniversal))
    ) {
      return { isMatch: true, matchedWord: universal, confidence: 0.95, normalizedText, matchType: `universal-${universal}` };
    }
  }

  // 4. Word-by-Word & N-Gram Levenshtein Fuzzy Distance Match
  const spokenWords = normalizedText.split(/\s+/).filter(Boolean);
  const targetWords = cleanTarget.split(/\s+/).filter(Boolean);

  if (targetWords.length === 1) {
    const target = targetWords[0];
    const maxAllowedDist = target.length <= 4 ? 1 : 2;

    for (const word of spokenWords) {
      if (word.length >= 3) {
        const dist = levenshteinDistance(word, target);
        const similarity = 1 - dist / Math.max(word.length, target.length);
        if (dist <= maxAllowedDist || similarity >= 0.70) {
          return {
            isMatch: true,
            matchedWord: cleanTarget,
            confidence: Math.round(similarity * 100) / 100,
            normalizedText,
            matchType: `fuzzy-word (${word} ~ ${target}, dist: ${dist})`,
          };
        }
      }
    }
  } else {
    const windowLen = targetWords.length;
    for (let i = 0; i <= spokenWords.length - windowLen; i++) {
      const slice = spokenWords.slice(i, i + windowLen).join(" ");
      const dist = levenshteinDistance(slice, cleanTarget);
      const similarity = 1 - dist / Math.max(slice.length, cleanTarget.length);
      if (dist <= Math.min(3, Math.floor(cleanTarget.length * 0.35)) || similarity >= 0.68) {
        return {
          isMatch: true,
          matchedWord: cleanTarget,
          confidence: Math.round(similarity * 100) / 100,
          normalizedText,
          matchType: `fuzzy-phrase (${slice} ~ ${cleanTarget}, dist: ${dist})`,
        };
      }
    }
  }

  return { isMatch: false, matchedWord: "", confidence: 0, normalizedText };
}

/**
 * Transcribe via Groq Whisper API (Multilingual whisper-large-v3-turbo)
 * - Uses prompt biasing for critical emergency codewords across English and Hindi.
 * - Temperature 0.0 for deterministic classification without hallucination.
 */
async function transcribeWithGroq(audioBuffer, mimeType, apiKey, codeWord = "banana") {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("webm") ? "webm" : "ogg";
  const filename = `speech.${ext}`;

  // Multi-lingual prompt biasing with emergency vocabulary in Latin & Devanagari
  const promptText = `Emergency voice distress codeword: ${codeWord}, banana, bachao, help, save me, alert, emergency, suraksha, madad, police, खतरा, बचाओ, मदद.`;

  const formParts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo`),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${promptText}`),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="temperature"\r\n\r\n0.0`),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  const fullBody = Buffer.concat(formParts);

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
 * Transcribe via OpenAI Whisper API (Multilingual whisper-1)
 */
async function transcribeWithOpenAI(audioBuffer, mimeType, apiKey, codeWord = "banana") {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const ext = mimeType.includes("wav") ? "wav" : "webm";
  const filename = `speech.${ext}`;
  const promptText = `Emergency voice distress codeword: ${codeWord}, banana, bachao, help, save me, alert, emergency, suraksha, madad.`;

  const formParts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${promptText}`),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="temperature"\r\n\r\n0.0`),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  const fullBody = Buffer.concat(formParts);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Whisper error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.text || "";
}

/**
 * Transcribe via Gemini Flash Audio Multimodal API
 */
async function transcribeWithGemini(audioBase64, mimeType, apiKey, codeWord = "banana") {
  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
  ];
  let lastError = null;

  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType || "audio/wav",
              data: audioBase64,
            },
          },
          {
            text: `Transcribe human speech in this emergency audio clip. Spoken words may include "${codeWord}", "bachao", "help", "save me", or numbers. Return ONLY the transcribed words with no commentary or formatting. If there is no human speech or only silence/static, respond with SILENCE.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 60,
    },
  };

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Gemini Audio (${model}) error ${res.status}: ${errText}`);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleaned = text.trim();
      if (/^(silence|none|no speech|inaudible|\[silence\])$/i.test(cleaned)) {
        return "";
      }
      return cleaned;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini audio models failed");
}

/**
 * POST /api/audio/transcribe
 * Body: { audio: "base64...", mimeType: "audio/wav", codeWord: "banana" }
 */
router.post("/transcribe", async (req, res) => {
  const startTime = Date.now();
  const { audio, mimeType = "audio/wav", codeWord = "banana" } = req.body || {};

  if (!audio) {
    return res.status(400).json({ ok: false, error: "Audio data is required (base64 string)" });
  }

  const cleanBase64 = audio.includes("base64,") ? audio.split("base64,")[1] : audio;
  const audioBuffer = Buffer.from(cleanBase64, "base64");

  console.log(`[WHISPER-INCOMING-REQUEST] Size: ${audioBuffer.length} bytes | Mime: ${mimeType} | Codeword: "${codeWord}"`);

  let rawTranscript = "";
  let provider = "none";
  let providerError = null;

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    // 1. Primary engine: Groq Whisper (whisper-large-v3-turbo, ~150ms latency)
    if (groqKey) {
      try {
        rawTranscript = await transcribeWithGroq(audioBuffer, mimeType, groqKey, codeWord);
        provider = "groq-whisper-large-v3-turbo";
      } catch (err) {
        providerError = err.message;
        console.warn("[TRANSCRIBE] Groq Whisper failed, trying fallback:", err.message);
      }
    }

    // 2. Secondary engine: Gemini 1.5 Flash Audio
    if (!rawTranscript && geminiKey) {
      try {
        rawTranscript = await transcribeWithGemini(cleanBase64, mimeType, geminiKey, codeWord);
        provider = "gemini-1.5-flash-audio";
      } catch (err) {
        providerError = err.message;
        console.warn("[TRANSCRIBE] Gemini Audio failed, trying fallback:", err.message);
      }
    }

    // 3. Tertiary engine: OpenAI Whisper (whisper-1)
    if (!rawTranscript && openaiKey) {
      try {
        rawTranscript = await transcribeWithOpenAI(audioBuffer, mimeType, openaiKey, codeWord);
        provider = "openai-whisper-1";
      } catch (err) {
        providerError = err.message;
        console.warn("[TRANSCRIBE] OpenAI Whisper failed:", err.message);
      }
    }

    const latencyMs = Date.now() - startTime;

    // STEP 1 LOGGING: Log the raw Whisper output BEFORE any matching logic runs
    console.log(`[WHISPER-RAW-OUTPUT] Provider: ${provider} | Latency: ${latencyMs}ms | Raw Transcript: ${JSON.stringify(rawTranscript)}`);

    // STEP 3: Normalized Fuzzy Matching
    const matchResult = checkCodewordMatch(rawTranscript, codeWord);

    console.log(`[WHISPER-MATCH-RESULT] Match: ${matchResult.isMatch} | Word: "${matchResult.matchedWord}" | Confidence: ${matchResult.confidence} | Type: ${matchResult.matchType || "none"}`);

    return res.json({
      ok: true,
      text: rawTranscript,
      rawTranscript,
      normalizedText: matchResult.normalizedText,
      isMatch: matchResult.isMatch,
      matchedWord: matchResult.matchedWord,
      confidence: matchResult.confidence,
      matchType: matchResult.matchType || "none",
      provider,
      latencyMs,
      error: providerError,
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(`[TRANSCRIBE] Fatal server error after ${latencyMs}ms:`, err.message);
    return res.json({
      ok: true,
      text: "",
      rawTranscript: "",
      isMatch: false,
      error: err.message,
      provider: "failed",
      latencyMs,
    });
  }
});

export default router;

/**
 * Thin wrapper around Gemini's embedding API (gemini-embedding-001, GA as
 * of mid-2026 — same caveat as generateContent: check
 * ai.google.dev/gemini-api/docs/embeddings if this starts erroring, model
 * names on this API move fast).
 *
 * taskType matters: documents going INTO the knowledge base use
 * RETRIEVAL_DOCUMENT, a live user question uses RETRIEVAL_QUERY. Using
 * the wrong one doesn't error, it just quietly makes retrieval worse.
 */
export async function embedText(text, taskType) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(no body)");
    throw new Error(`Gemini embedding API returned ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const values = data.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Embedding API returned no vector");
  return values;
}
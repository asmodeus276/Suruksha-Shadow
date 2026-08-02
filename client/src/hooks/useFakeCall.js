import { useCallback, useRef } from "react";

const MAX_AI_CYCLES = 2; // ~2 rounds of fresh AI dialogue, then switch to
// a local filler script — the previous version re-fetched from Gemini on
// EVERY loop iteration for as long as the fake call ran, silently
// burning the daily quota in the background during any extended test or
// demo. This caps the real API usage while keeping the call going.
const FILLER_LINES = [
  "Mm-hmm.",
  "Yeah, totally.",
  "Oh for sure.",
  "Right, right.",
  "Haha, yeah.",
  "One sec.",
  "Okay, go on.",
  "Uh-huh.",
];

/**
 * Shield's fake-call deception — FR-3 / TR-4. Plays back an
 * AI-generated, ordinary-sounding one-sided conversation through the
 * browser's built-in speechSynthesis, so it sounds like the user is on
 * a normal call. No paid TTS API, no extra setup.
 */
export function useFakeCall({ apiBaseUrl }) {
  const stopRef = useRef(false);

  const start = useCallback(async () => {
    stopRef.current = false;
    let aiCycles = 0;

    while (!stopRef.current) {
      let lines = [];

      if (aiCycles < MAX_AI_CYCLES) {
        try {
          const res = await fetch(`${apiBaseUrl}/api/fake-call/lines`, { method: "POST" });
          const data = await res.json();
          lines = data.lines || [];
          aiCycles += 1;
        } catch (_) {
          lines = ["Hey, can you hear me?", "Okay, one sec."];
        }
      } else {
        // No more API calls this session — keep the call sounding alive
        // with local filler instead of fetching indefinitely.
        lines = FILLER_LINES;
      }

      for (const line of lines) {
        if (stopRef.current) return;
        await speak(line);
        if (stopRef.current) return;
        await pause(800 + Math.random() * 1400); // natural gap between lines
      }
    }
  }, [apiBaseUrl]);

  const stop = useCallback(() => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
  }, []);

  return { start, stop };
}

function speak(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = resolve;
    utterance.onerror = resolve; // never let a TTS glitch hang the loop
    window.speechSynthesis.speak(utterance);
  });
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
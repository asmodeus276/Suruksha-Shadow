import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/consent/:userId
 * FR6 — read the Primary User's current ambient-audio consent state.
 * Independent of any active emergency; this can be checked/changed any time.
 */
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("consent_ambient_audio")
      .eq("id", userId)
      .single();

    if (error) throw error;
    res.json({ consent: Boolean(data?.consent_ambient_audio) });
  } catch (err) {
    console.error("Failed to read consent:", err);
    res.status(500).json({ error: "Failed to read consent" });
  }
});

/**
 * POST /api/consent
 * body: { userId, consent: boolean }
 * FR6 — grant or revoke ambient-audio consent. Takes effect immediately:
 * the next audio chunk POST (server/routes/audio.js) re-checks this flag
 * per TR7, so a revoke stops new audio from being relayed right away even
 * mid-emergency, without needing to touch the emergency itself.
 */
router.post("/", async (req, res) => {
  const { userId, consent } = req.body;

  if (!userId || typeof consent !== "boolean") {
    return res.status(400).json({ error: "userId and a boolean consent are required" });
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ consent_ambient_audio: consent })
      .eq("id", userId);

    if (error) throw error;
    res.json({ consent });
  } catch (err) {
    console.error("Failed to update consent:", err);
    res.status(500).json({ error: "Failed to update consent" });
  }
});

export default router;
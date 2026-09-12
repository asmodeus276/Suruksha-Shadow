import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/emergency/:eventId/checklist
 * FR11 — returns current evidence-checklist progress for this event, so
 * reopening the app (or reloading mid-crisis) doesn't lose it.
 */
router.get("/:eventId/checklist", async (req, res) => {
  const { eventId } = req.params;

  try {
    const { data, error } = await supabase
      .from("emergency_events")
      .select("evidence_checklist")
      .eq("id", eventId)
      .single();
    if (error) throw error;
    res.json({ checklist: data?.evidence_checklist || {} });
  } catch (err) {
    console.error("Failed to load checklist:", err);
    res.status(500).json({ error: "Failed to load checklist" });
  }
});

/**
 * PATCH /api/emergency/:eventId/checklist
 * body: { itemId, checked }
 * FR11 — toggles one evidence-checklist item. Reads the current jsonb
 * value, merges the one key, and writes it back — a full read-modify-
 * write rather than a partial jsonb update, since this table has no
 * concurrent-writer scenario (only the Primary User's own device ever
 * touches their own checklist) so the extra round trip is worth the
 * simplicity.
 */
router.patch("/:eventId/checklist", async (req, res) => {
  const { eventId } = req.params;
  const { itemId, checked } = req.body;

  if (!itemId || typeof checked !== "boolean") {
    return res.status(400).json({ error: "itemId and a boolean checked are required" });
  }

  try {
    const { data: current, error: readError } = await supabase
      .from("emergency_events")
      .select("evidence_checklist")
      .eq("id", eventId)
      .single();
    if (readError) throw readError;

    const nextChecklist = { ...(current?.evidence_checklist || {}), [itemId]: checked };

    const { error: writeError } = await supabase
      .from("emergency_events")
      .update({ evidence_checklist: nextChecklist })
      .eq("id", eventId);
    if (writeError) throw writeError;

    res.json({ checklist: nextChecklist });
  } catch (err) {
    console.error("Failed to update checklist:", err);
    res.status(500).json({ error: "Failed to update checklist" });
  }
});

export default router;
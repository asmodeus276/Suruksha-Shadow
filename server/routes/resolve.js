import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/emergency/:eventId/resolve
 * Marks an emergency resolved. Without this, "I'm safe" only clears
 * local React state — the row (and any open Guardian view reading it)
 * stays status: "active" forever.
 */
router.post("/:eventId/resolve", async (req, res) => {
  const { eventId } = req.params;

  try {
    const { error } = await supabase
      .from("emergency_events")
      .update({ status: "resolved", end_time: new Date().toISOString() })
      .eq("id", eventId);
    if (error) throw error;

    await supabase.from("timeline_entries").insert({
      emergency_event_id: eventId,
      event_type: "resolved",
      details: "Primary User marked themselves safe",
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to resolve emergency:", err);
    res.status(500).json({ error: "Failed to resolve emergency" });
  }
});

export default router;
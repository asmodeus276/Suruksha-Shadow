import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

// Service-role client — bypasses RLS, backend-only (same pattern as sos.js).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/contacts/:userId
 * Lists every Trusted Contact configured for a Primary User.
 */
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from("trusted_contacts")
      .select("id, name, phone, relationship, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ contacts: data });
  } catch (err) {
    console.error("Failed to list trusted contacts:", err);
    res.status(500).json({ error: "Failed to list trusted contacts" });
  }
});

/**
 * POST /api/contacts
 * body: { userId, name, phone, relationship }
 * Adds a Trusted Contact — required before Shield/Guardian can notify anyone
 * (see FRD §7 Assumptions & Constraints).
 */
router.post("/", async (req, res) => {
  const { userId, name, phone, relationship } = req.body;

  if (!userId || !name || !phone) {
    return res.status(400).json({ error: "userId, name, and phone are required" });
  }

  try {
    const { data, error } = await supabase
      .from("trusted_contacts")
      .insert({ user_id: userId, name, phone, relationship: relationship || null })
      .select()
      .single();

    if (error) throw error;
    res.json({ contact: data });
  } catch (err) {
    console.error("Failed to add trusted contact:", err);
    res.status(500).json({ error: "Failed to add trusted contact" });
  }
});

/**
 * DELETE /api/contacts/:id
 * Removes a Trusted Contact (FR6-adjacent — the Primary User should be able
 * to manage who's notified, same as they control ambient-audio consent).
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to remove trusted contact:", err);
    res.status(500).json({ error: "Failed to remove trusted contact" });
  }
});

export default router;
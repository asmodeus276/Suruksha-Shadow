import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { inMemoryContacts, getOrCreateDefaultContacts } from "../lib/memoryStore.js";

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/contacts/:userId
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
    res.json({ contacts: data && data.length > 0 ? data : getOrCreateDefaultContacts(userId) });
  } catch {
    const list = getOrCreateDefaultContacts(userId);
    res.json({ contacts: list });
  }
});

/**
 * POST /api/contacts
 */
router.post("/", async (req, res) => {
  const { userId, name, phone, relationship } = req.body;

  if (!userId || !name || !phone) {
    return res.status(400).json({ error: "userId, name, and phone are required" });
  }

  const digitsOnly = phone.replace(/[\s-]/g, "");
  if (!/^\+?\d{10,15}$/.test(digitsOnly)) {
    return res.status(400).json({
      error: "That phone number doesn't look right — include the country code, e.g. 9198xxxxxxx",
    });
  }

  const newContact = {
    id: "contact-" + Date.now(),
    user_id: userId,
    name,
    phone,
    relationship: relationship || null,
    created_at: new Date().toISOString(),
  };

  const existing = inMemoryContacts.get(userId) || [];
  inMemoryContacts.set(userId, [...existing, newContact]);

  try {
    const { data, error } = await supabase
      .from("trusted_contacts")
      .insert({ user_id: userId, name, phone, relationship: relationship || null })
      .select()
      .single();

    if (error) throw error;
    res.json({ contact: data });
  } catch {
    res.json({ contact: newContact });
  }
});

/**
 * DELETE /api/contacts/:id
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  for (const [userId, list] of inMemoryContacts.entries()) {
    inMemoryContacts.set(
      userId,
      list.filter((c) => c.id !== id)
    );
  }

  try {
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
    if (error) throw error;
  } catch {
    /* in-memory deleted */
  }

  res.json({ ok: true });
});

export default router;
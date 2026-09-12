import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { inMemoryCheckins } from "../lib/memoryStore.js";

const router = Router();

/**
 * POST /api/checkin/start
 * body: { userId, durationMinutes, destinationNote? }
 */
router.post("/start", async (req, res) => {
  const { userId, durationMinutes, destinationNote } = req.body;

  if (!userId || !durationMinutes || durationMinutes < 1) {
    return res.status(400).json({ error: "userId and a positive durationMinutes are required" });
  }

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  const checkinObj = {
    id: "checkin-" + Date.now(),
    user_id: userId,
    duration_minutes: durationMinutes,
    destination_note: destinationNote || null,
    expires_at: expiresAt,
    status: "active",
    created_at: new Date().toISOString(),
  };

  const list = inMemoryCheckins.get(userId) || [];
  inMemoryCheckins.set(userId, [...list.map((c) => ({ ...c, status: "safe" })), checkinObj]);

  try {
    await supabase
      .from("scheduled_checkins")
      .update({ status: "safe" })
      .eq("user_id", userId)
      .eq("status", "active");

    const { data, error } = await supabase
      .from("scheduled_checkins")
      .insert({
        user_id: userId,
        duration_minutes: durationMinutes,
        destination_note: destinationNote || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ checkin: data });
  } catch (err) {
    res.json({ checkin: checkinObj });
  }
});

/**
 * POST /api/checkin/safe
 * body: { userId }
 */
router.post("/safe", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const list = inMemoryCheckins.get(userId) || [];
  inMemoryCheckins.set(
    userId,
    list.map((c) => (c.status === "active" ? { ...c, status: "safe" } : c))
  );

  try {
    await supabase
      .from("scheduled_checkins")
      .update({ status: "safe" })
      .eq("user_id", userId)
      .eq("status", "active");
  } catch {
    /* in-memory updated */
  }

  res.json({ ok: true });
});

/**
 * POST /api/checkin/expire
 * body: { userId }
 */
router.post("/expire", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const list = inMemoryCheckins.get(userId) || [];
  inMemoryCheckins.set(
    userId,
    list.map((c) => (c.status === "active" ? { ...c, status: "expired" } : c))
  );

  try {
    await supabase
      .from("scheduled_checkins")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("status", "active");
  } catch {
    /* in-memory updated */
  }

  res.json({ ok: true });
});

export default router;

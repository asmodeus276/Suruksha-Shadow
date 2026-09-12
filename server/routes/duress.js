import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabase.js";
import { inMemoryPinProfiles } from "../lib/memoryStore.js";

const router = Router();

const SALT_ROUNDS = 10;

/**
 * POST /api/security/setup-pin
 * body: { userId, realPin, duressPin }
 */
router.post("/setup-pin", async (req, res) => {
  const { userId, realPin, duressPin } = req.body;

  if (!userId || !realPin || !duressPin) {
    return res.status(400).json({ error: "userId, realPin, and duressPin are required" });
  }

  const pinRegex = /^\d{4}$/;
  if (!pinRegex.test(realPin) || !pinRegex.test(duressPin)) {
    return res.status(400).json({ error: "PINs must be exactly 4 digits" });
  }

  if (realPin === duressPin) {
    return res.status(400).json({ error: "Real PIN and Duress PIN must be different" });
  }

  try {
    const realPinHash = await bcrypt.hash(realPin, SALT_ROUNDS);
    const duressPinHash = await bcrypt.hash(duressPin, SALT_ROUNDS);

    inMemoryPinProfiles.set(userId, { realPinHash, duressPinHash });

    try {
      await supabase
        .from("user_security_profiles")
        .upsert(
          {
            user_id: userId,
            real_pin_hash: realPinHash,
            duress_pin_hash: duressPinHash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    } catch {
      /* in-memory fallback active */
    }

    res.json({ status: "CONFIGURED" });
  } catch (err) {
    console.error("PIN setup failed:", err);
    res.status(500).json({ error: "Failed to configure security PINs" });
  }
});

/**
 * GET /api/security/has-pin/:userId
 */
router.get("/has-pin/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from("user_security_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    res.json({ configured: Boolean(data) || inMemoryPinProfiles.has(userId) });
  } catch {
    res.json({ configured: inMemoryPinProfiles.has(userId) });
  }
});

export default router;

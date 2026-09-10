/**
 * User Identity Manager
 * -------------------------------------------------------------
 * Manages dynamic device-bound user identification.
 * Preserves the default seeded demo ID for out-of-the-box demo data
 * while supporting dynamic UUIDs per device in production.
 */

const STORAGE_KEY = "suraksha_user_id";
export const DEFAULT_DEMO_USER_ID = "54c9353c-09f6-4688-8c9f-1a201893ceeb";

/**
 * Returns the active user ID for this browser instance.
 * Defaults to the seeded demo user ID so initial contacts and events work seamlessly.
 */
export function getUserId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = DEFAULT_DEMO_USER_ID;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return DEFAULT_DEMO_USER_ID;
  }
}

/**
 * Generates and stores a new unique UUID for this device.
 */
export function generateNewUserId() {
  const newId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "user_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

  try {
    localStorage.setItem(STORAGE_KEY, newId);
  } catch {
    /* localStorage disabled */
  }
  return newId;
}

/**
 * Explicitly sets the active user ID.
 */
export function setUserId(id) {
  if (!id) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* localStorage disabled */
  }
}

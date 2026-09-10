/**
 * Geo & Emergency Dispatch Utilities
 * -------------------------------------------------------------
 * Provides lightweight reverse geocoding (OpenStreetMap Nominatim with local caching),
 * turn-by-turn navigation URL generation, and multi-channel emergency sharing
 * (Web Share API + 1-Tap WhatsApp broadcast).
 */

const memoryCache = new Map();

/**
 * Converts lat/lng coordinates into a human-readable street/neighborhood address.
 * Uses aggressive caching to respect rate limits and minimize network requests.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} Human-readable address or formatted coordinates on failure.
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return "Location unavailable";

  const roundedLat = Number(lat).toFixed(4);
  const roundedLng = Number(lng).toFixed(4);
  const cacheKey = `geo_${roundedLat}_${roundedLng}`;

  // 1. Check in-memory cache
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 2. Check sessionStorage
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      memoryCache.set(cacheKey, cached);
      return cached;
    }
  } catch {
    /* sessionStorage unavailable in some sandboxes */
  }

  // 3. Query OpenStreetMap Nominatim with a safe timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      
      // Build a readable, clean location label: e.g. "Connaught Place, New Delhi"
      const parts = [
        addr.amenity || addr.building || addr.road || addr.neighbourhood || addr.suburb,
        addr.suburb || addr.city_district || addr.city || addr.town || addr.county,
        addr.state,
      ].filter(Boolean);

      // Remove duplicate consecutive segments
      const uniqueParts = parts.filter((p, i) => parts.indexOf(p) === i);
      const formatted = uniqueParts.slice(0, 2).join(", ") || data.display_name?.split(",").slice(0, 2).join(",") || formatCoords(lat, lng);

      memoryCache.set(cacheKey, formatted);
      try {
        sessionStorage.setItem(cacheKey, formatted);
      } catch {
        /* storage limit */
      }
      return formatted;
    }
  } catch (err) {
    // Network error or timeout — fail gracefully to clean coordinate format
    console.debug("Reverse geocoding fallback to coords:", err?.name);
  }

  const fallback = formatCoords(lat, lng);
  memoryCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Formats decimal coordinates into clean GPS string (e.g. 28.6139° N, 77.2090° E).
 */
export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return "—";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

/**
 * Returns a direct Google Maps turn-by-turn directions link.
 */
export function getDirectionsUrl(lat, lng) {
  if (lat == null || lng == null) return "https://maps.google.com";
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Generates an emergency alert message formatted for instant dispatch.
 */
export function buildEmergencyText({ shareToken, address, lat, lng, status = "CRITICAL" }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackingLink = shareToken ? `${origin}/guardian/${shareToken}` : origin;
  const navLink = lat != null && lng != null ? getDirectionsUrl(lat, lng) : "";
  const locStr = address || (lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Location updating…");

  return (
    `🚨 *SURAKSHA SHADOW — EMERGENCY ALERT*\n\n` +
    `Status: ${status} — Immediate assistance requested.\n` +
    `📍 *Location:* ${locStr}\n\n` +
    `🗺️ *Live Guardian Tracking:* ${trackingLink}\n` +
    (navLink ? `🚗 *Direct Turn-by-Turn Navigation:* ${navLink}\n` : "") +
    `\n_Sent via Suraksha Shadow Safety Platform_`
  );
}

/**
 * Generates a 1-tap WhatsApp broadcast URL with pre-filled alert text.
 */
export function getWhatsAppAlertUrl(params) {
  const message = buildEmergencyText(params);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Dispatches emergency tracking link via native Web Share API with WhatsApp fallback.
 */
export async function shareEmergencyAlert(params) {
  const text = buildEmergencyText(params);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = params.shareToken ? `${origin}/guardian/${params.shareToken}` : origin;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "EMERGENCY ALERT — Suraksha Shadow",
        text,
        url,
      });
      return { method: "native", success: true };
    } catch (err) {
      if (err.name === "AbortError") return { method: "native", cancelled: true };
      // Fallback to WhatsApp if share failed
    }
  }

  // Fallback: Open WhatsApp directly
  const waUrl = getWhatsAppAlertUrl(params);
  window.open(waUrl, "_blank", "noopener,noreferrer");
  return { method: "whatsapp", success: true };
}

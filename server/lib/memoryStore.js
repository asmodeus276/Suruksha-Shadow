import crypto from "crypto";

/**
 * Shared in-memory data store for Suraksha Shadow.
 * Ensures zero-configuration local execution and robust fallback when Supabase
 * or external services are offline or using placeholder credentials.
 */

export const inMemoryEvents = new Map();
export const inMemoryEventsByToken = new Map();
export const inMemoryTimeline = new Map(); // eventId -> Array<entry>
export const inMemoryPings = new Map(); // eventId -> Array<ping>
export const inMemoryContacts = new Map(); // userId -> Array<contact>
export const inMemoryConsent = new Map(); // userId -> boolean
export const inMemoryPinProfiles = new Map(); // userId -> { realPinHash, duressPinHash }
export const inMemoryArtifacts = [];
export const inMemoryLedger = [];
export const inMemoryCheckins = new Map(); // userId -> Array<checkin>
export const inMemoryHeartbeats = new Map(); // userId -> { lat, lng, lastPingAt, armed }

// Pre-populate default contacts for any user so arming/SOS is immediately ready
export function getOrCreateDefaultContacts(userId) {
  if (!inMemoryContacts.has(userId)) {
    inMemoryContacts.set(userId, [
      {
        id: "contact-primary",
        user_id: userId,
        name: "Primary Guardian (Direct SMS)",
        phone: "+918800948288",
        relationship: "Primary Guardian",
        created_at: new Date().toISOString(),
      },
      {
        id: "contact-2",
        user_id: userId,
        name: "Emergency Contact 2 (Sibling)",
        phone: "+919876543211",
        relationship: "Sibling",
        created_at: new Date().toISOString(),
      },
    ]);
  }
  return inMemoryContacts.get(userId);
}

export function createInMemoryEmergency(userId, triggerType, lat = null, lng = null) {
  const eventId = "sos-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
  const shareToken = "token-" + crypto.randomBytes(6).toString("hex");

  const event = {
    id: eventId,
    event_id: eventId,
    user_id: userId,
    trigger_type: triggerType,
    status: "active",
    start_time: new Date().toISOString(),
    end_time: null,
    share_token: shareToken,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    battery_pct: 85,
    movement_status: "stationary",
    last_ping_at: new Date().toISOString(),
    evidence_hash: null,
  };

  inMemoryEvents.set(eventId, event);
  inMemoryEventsByToken.set(shareToken, event);

  const initialTimeline = [
    {
      emergency_event_id: eventId,
      event_type: "triggered",
      details: `Silent trigger fired (${triggerType})`,
      created_at: new Date().toISOString(),
    },
  ];
  inMemoryTimeline.set(eventId, initialTimeline);

  inMemoryPings.set(eventId, [
    {
      emergency_event_id: eventId,
      lat: event.lat,
      lng: event.lng,
      battery_pct: event.battery_pct,
      movement_status: event.movement_status,
      created_at: new Date().toISOString(),
    },
  ]);

  return event;
}

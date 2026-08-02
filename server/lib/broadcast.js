import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Pushes a one-off Realtime Broadcast to the Guardian channel for an
 * emergency (TR-6). Guardian views subscribe to the same channel name
 * using the share_token, so this is how they get live updates without
 * needing table-level Realtime + RLS access as an anon user.
 *
 * Note: supabase-js's broadcast API has shifted across v2 minor versions —
 * verify this against the current Realtime docs (supabase.com/docs/guides/realtime)
 * if updates stop arriving client-side.
 */
export function broadcastToGuardian(shareToken, event, payload) {
  const channel = supabase.channel(`emergency-${shareToken}`);
  let settled = false;

  // Safety net: if subscribe() never reaches SUBSCRIBED (a connection
  // hiccup, a dropped socket), the channel would otherwise leak forever —
  // only the success path below ever calls removeChannel. This matters
  // most for ambient audio, which calls this every ~3s during an active
  // stream; a few dropped connections in a row could otherwise pile up
  // dangling channels for the rest of the process's life.
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    supabase.removeChannel(channel);
  }, 5000);

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED" && !settled) {
      settled = true;
      clearTimeout(timeout);
      channel.send({ type: "broadcast", event, payload }).finally(() => {
        supabase.removeChannel(channel);
      });
    }
  });
}
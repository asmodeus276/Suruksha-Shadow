import { createClient } from "@supabase/supabase-js";

// Anon/public client — safe to ship to the browser. Row Level Security
// (schema.sql) keeps everything owner-locked; the Guardian view only
// ever reaches data through the two SECURITY DEFINER functions, which
// are the sole thing granted to the anon role.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
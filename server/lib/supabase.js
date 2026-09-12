import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith("http") &&
  !supabaseUrl.includes("placeholder") &&
  !supabaseUrl.includes("your-project")
);

function createMockSupabase() {
  const result = { data: null, error: null };

  const handler = {
    get(target, prop) {
      if (prop === "then") {
        return (resolve) => resolve(result);
      }
      if (prop === "catch") {
        return (reject) => {};
      }
      return (...args) => new Proxy({}, handler);
    }
  };

  return new Proxy({}, {
    get(target, prop) {
      return (...args) => new Proxy({}, handler);
    }
  });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createMockSupabase();

export default supabase;

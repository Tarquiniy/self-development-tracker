import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ??
  "";

function getAdminConfig() {
  return {
    url: SUPABASE_URL || "http://localhost",
    key: SUPABASE_SERVICE_ROLE_KEY || "service_role_key",
  };
}

export function createAdminClient(): SupabaseClient {
  const { url, key } = getAdminConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Удобный экспорт для большинства route-handler'ов.
export const supabaseAdmin: SupabaseClient = createAdminClient();


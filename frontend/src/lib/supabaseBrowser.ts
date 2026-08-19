import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

const _url = SUPABASE_URL || "http://localhost";
const _anonKey = SUPABASE_ANON_KEY || "anon";

// Supabase client for the browser (auth session handled on client side).
export const supabaseBrowser: SupabaseClient = createClient(_url, _anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


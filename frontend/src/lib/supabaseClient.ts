import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

// Чтобы `next build` не падал при отсутствии env во время сборки, подставляем безопасные значения.
const _url = SUPABASE_URL || "http://localhost";
const _anonKey = SUPABASE_ANON_KEY || "anon";

const client: SupabaseClient = createClient(_url, _anonKey);

// Named export (в проекте встречается и так, и так).
export const supabase = client;

export default client;


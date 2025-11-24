// frontend/src/app/api/user/tables/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // конструкция только для рантайма — если переменные не заданы, вернуть 500 позже
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "server_env_missing" }, { status: 500 });
    }

    // Создаём admin-клиент (service role key)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Берём Bearer токен из заголовка Authorization
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : null;

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    // Проверяем токен через admin client => получаем user
    // supabase-js v2: supabaseAdmin.auth.getUser(token)
    const userRes = await supabaseAdmin.auth.getUser(token);
    if (userRes.error || !userRes.data?.user) {
      return NextResponse.json({ error: "invalid_token", detail: userRes.error?.message ?? null }, { status: 401 });
    }
    const user = userRes.data.user;

    // Запросим таблицы, принадлежащие user.id
    const tablesRes = await supabaseAdmin
      .from("user_tables")
      .select("id,title,owner,created_at")
      .eq("owner", user.id);

    if (tablesRes.error) {
      return NextResponse.json({ error: "db_error", detail: tablesRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: tablesRes.data });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

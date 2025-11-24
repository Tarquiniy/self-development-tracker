// frontend/src/app/api/tables/[id]/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin as importedSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/tables/[id]/entries
 *
 * Ожидает JSON тело:
 * { category_id: string, delta: number, value?: number }
 *
 * Вставляет строку в таблицу public.entries с явной передачей колонок:
 * { table_id, category_id, delta, value, created_at }
 *
 * Возвращает 200 + вставленную запись в data при успехе.
 * Возвращает полезный debug-вклад в теле ошибки (для dev).
 */

async function makeSupabaseAdmin() {
  if (importedSupabaseAdmin) return importedSupabaseAdmin;
  // fallback: создаём клиент вручную из ENV (service role)
  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin client not available and no service role key found in env");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tableId = String(params?.id ?? "");

  const debug: any = { ts: new Date().toISOString(), method: "POST", tableId };

  let supabaseAdmin;
  try {
    supabaseAdmin = await makeSupabaseAdmin();
    debug.client_created = true;
  } catch (e: any) {
    return NextResponse.json({ error: "supabase_admin_missing", detail: String(e) }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (e: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(e) }, { status: 400 });
  }
  debug.body = body ?? null;

  const category_id = body?.category_id ?? body?.categoryId;
  const deltaRaw = body?.delta ?? body?.Delta ?? body?.d;
  const valueRaw = body?.value ?? body?.val ?? null;

  // validation
  if (!category_id) {
    return NextResponse.json({ error: "missing_category_id", detail: "category_id is required" }, { status: 400 });
  }
  if (deltaRaw === undefined || deltaRaw === null || Number.isNaN(Number(deltaRaw))) {
    return NextResponse.json({ error: "missing_delta", detail: "delta is required and must be a number" }, { status: 400 });
  }

  const delta = Number(deltaRaw);
  const value = valueRaw === undefined || valueRaw === null ? null : Number(valueRaw);

  const insertObj: any = {
    table_id: tableId,
    category_id: category_id,
    delta: delta,
    // если на вашей таблице entries нет колонки "value", можно удалить следующую строку
    value: value,
    created_at: new Date().toISOString(),
  };

  debug.insert = { payload: insertObj };

  try {
    // Явная вставка в таблицу `entries`. Выбираем возвращаемые поля.
    const insertRes = await supabaseAdmin
      .from("entries")
      .insert([insertObj])
      .select()
      .limit(1)
      .maybeSingle();

    debug.insert.result = {
      status: insertRes?.status ?? null,
      error: insertRes?.error ?? null,
      data: insertRes?.data ?? null,
    };

    if (insertRes?.error) {
      return NextResponse.json(
        { error: "insert_failed", detail: insertRes.error?.message ?? insertRes.error, debug },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: insertRes?.data ?? null, debug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_exception", detail: String(e), debug }, { status: 500 });
  }
}

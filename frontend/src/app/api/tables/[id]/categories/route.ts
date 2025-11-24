// frontend/src/app/api/tables/[id]/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin as importedSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET  -> возвращает категории таблицы + текущую агрегированную сумму value (сумма delta из entries)
 * POST -> создаёт категорию (возвращаем created row). Принимается также поле `color`.
 */

async function makeSupabaseAdmin() {
  if (importedSupabaseAdmin) return importedSupabaseAdmin;
  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin client not available and no service role key found in env");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tableId = String(params?.id ?? "");
  const debug: any = { ts: new Date().toISOString(), method: "GET", tableId };

  let supabaseAdmin;
  try {
    supabaseAdmin = await makeSupabaseAdmin();
    debug.client = true;
  } catch (e: any) {
    return NextResponse.json({ error: "supabase_admin_missing", detail: String(e) }, { status: 500 });
  }

  try {
    // 1) Получаем категории
    const catRes = await supabaseAdmin
      .from("tables_categories")
      .select("*")
      .eq("table_id", tableId);

    if (catRes.error) {
      debug.catError = catRes.error;
      return NextResponse.json({ error: "categories_fetch_failed", detail: catRes.error.message ?? catRes.error, debug }, { status: 500 });
    }
    const categories = Array.isArray(catRes.data) ? catRes.data : [];

    // 2) Получаем записи entries для этой таблицы (category_id, delta)
    const entriesRes = await supabaseAdmin
      .from("entries")
      .select("category_id,delta")
      .eq("table_id", tableId);

    if (entriesRes.error) {
      debug.entriesError = entriesRes.error;
      // продолжаем — вернём категории, но value будет 0
    }
    const entries = Array.isArray(entriesRes.data) ? entriesRes.data : [];

    // 3) Агрегируем суммы delta по category_id
    const sums: Record<string, number> = {};
    for (const e of entries) {
      const cid = String(e?.category_id ?? "");
      const d = Number(e?.delta ?? 0) || 0;
      sums[cid] = (sums[cid] || 0) + d;
    }

    // 4) Приклеиваем value к каждой категории
    const categoriesWithValue = categories.map((c: any) => ({
      ...c,
      value: Number(sums[String(c.id)] ?? 0),
    }));

    debug.counts = { categories: categoriesWithValue.length, entries: entries.length };

    return NextResponse.json({ data: categoriesWithValue, debug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "categories_exception", detail: String(e), debug }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tableId = String(params?.id ?? "");
  let supabaseAdmin;
  try {
    supabaseAdmin = await makeSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: "supabase_admin_missing", detail: String(e) }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e: any) {
    return NextResponse.json({ error: "invalid_json", detail: String(e) }, { status: 400 });
  }

  const title = (body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "missing_name", detail: "title is required" }, { status: 400 });

  const insertObj: any = {
    table_id: tableId,
    title,
    description: body?.description ?? null,
    max: body?.max === null || body?.max === undefined ? null : Number(body.max),
    color: body?.color ?? null,
    created_at: new Date().toISOString(),
  };

  try {
    // Вставляем и возвращаем созданную запись
    const ins = await supabaseAdmin
      .from("tables_categories")
      .insert([insertObj])
      .select()
      .maybeSingle();

    if (ins.error) {
      return NextResponse.json({ error: "insert_failed", detail: ins.error.message ?? ins.error }, { status: 400 });
    }

    const created = ins.data ?? null;
    return NextResponse.json({ data: { ...created, value: 0 } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_exception", detail: String(e) }, { status: 500 });
  }
}

// frontend/src/app/api/tables/[id]/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/tables/:id/entries
 *
 * Body expected:
 * { category_id: string, delta: number, value?: number, date?: 'YYYY-MM-DD' }
 *
 * Behavior:
 *  - Insert a row into `entries` (or `table_entries` depending on your schema).
 *  - Then read current `tables_categories.current` for that category and increment it by delta.
 *  - Return inserted entry and the updated category current value.
 *
 * NOTE: this uses service-role credentials (SERVICE_ROLE env required).
 */

async function makeSupabaseAdmin() {
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
  const debug: any = { ts: new Date().toISOString(), tableId };

  if (!tableId) {
    return NextResponse.json({ error: "missing_table_id" }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = await makeSupabaseAdmin();
    debug.client = "created";
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
  const deltaRaw = body?.delta ?? body?.d;
  const valueRaw = body?.value ?? null;

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
    value: value,
    created_at: new Date().toISOString(),
  };

  debug.insertPayload = insertObj;

  try {
    // Insert entry
    const insertRes = await supabaseAdmin
      .from("entries")
      .insert([insertObj])
      .select()
      .maybeSingle();

    debug.insertResult = {
      status: insertRes?.status ?? null,
      error: insertRes?.error ?? null,
      data: insertRes?.data ?? null,
    };

    if (insertRes?.error) {
      return NextResponse.json({ error: "insert_failed", detail: insertRes.error?.message ?? insertRes.error, debug }, { status: 400 });
    }

    const inserted = insertRes?.data ?? null;

    // --- Now update tables_categories.current atomically-ish (read -> calc -> update) ---
    // Read current
    const catRes = await supabaseAdmin
      .from("tables_categories")
      .select("current")
      .eq("id", category_id)
      .maybeSingle();

    debug.catRead = { status: catRes?.status ?? null, error: catRes?.error ?? null, data: catRes?.data ?? null };

    if (catRes?.error) {
      // we still return success for inserted entry but include warning
      return NextResponse.json(
        { data: inserted, warning: "failed_reading_category_current", detail: catRes.error.message, debug },
        { status: 200 }
      );
    }

    const prevCurrent = (catRes?.data && typeof catRes.data.current === "number") ? catRes.data.current : Number(catRes?.data?.current ?? 0);
    const newCurrent = Math.max(0, prevCurrent + delta);

    // Update the category's current
    const patchRes = await supabaseAdmin
      .from("tables_categories")
      .update({ current: newCurrent })
      .eq("id", category_id)
      .maybeSingle();

    debug.catPatch = { status: patchRes?.status ?? null, error: patchRes?.error ?? null, data: patchRes?.data ?? null };

    if (patchRes?.error) {
      // we return inserted entry but notify that patch failed
      return NextResponse.json(
        { data: inserted, warning: "failed_updating_category_current", detail: patchRes.error.message, debug },
        { status: 200 }
      );
    }

    // success: return entry + updated category current
    return NextResponse.json({ data: inserted, updated_category_current: newCurrent, debug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_exception", detail: String(e), debug }, { status: 500 });
  }
}

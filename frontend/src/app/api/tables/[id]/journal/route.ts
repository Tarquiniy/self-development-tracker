// frontend/src/app/api/tables/[id]/journal/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Supabase admin not configured for /api/tables/[id]/journal");
}

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * GET /api/tables/:id/journal?date=YYYY-MM-DD
 * GET /api/tables/:id/journal?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * POST /api/tables/:id/journal
 * body: { date: 'YYYY-MM-DD', category_id?: string, text: string, meta?: any, points?: number }
 */

export async function GET(req: Request, ctx: any) {
  try {
    const tableId = String(ctx?.params?.id ?? "");
    if (!tableId) return NextResponse.json({ error: "missing_table_id" }, { status: 400 });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const supabase = adminClient();

    let q = supabase
      .from("journal_entries")
      .select("*")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false });

    if (date) {
      q = q.eq("date", date);
    } else if (start && end) {
      q = q.gte("date", start).lte("date", end);
    } else if (start) {
      q = q.gte("date", start);
    } else if (end) {
      q = q.lte("date", end);
    }

    const res = await q;
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({ data: res.data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: any) {
  try {
    const tableId = String(ctx?.params?.id ?? "");
    if (!tableId) return NextResponse.json({ error: "missing_table_id" }, { status: 400 });

    let body: any;
    try {
      body = await req.json();
    } catch (e: any) {
      return NextResponse.json({ error: "invalid_json", detail: String(e) }, { status: 400 });
    }

    const dateRaw = body?.date ?? null;
    const date = dateRaw ? String(dateRaw) : new Date().toISOString().slice(0, 10);
    const text = String(body?.text ?? "").trim();
    const category_id = body?.category_id ? String(body.category_id) : null;
    const points = typeof body?.points === "number" ? body.points : Number(body?.points ?? 0);
    const meta = body?.meta ?? null;

    if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });

    const supabase = adminClient();

    const payload = {
      table_id: tableId,
      date,
      text,
      category_id,
      points,
      meta,
      created_at: new Date().toISOString(),
    };

    const res = await supabase.from("journal_entries").insert([payload]).select();

    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({ data: res.data?.[0] ?? null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

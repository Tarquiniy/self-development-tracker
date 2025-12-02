// frontend/src/app/api/tables/[id]/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn("Supabase admin not configured for /api/tables/[id]/categories");
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * GET /api/tables/:id/categories?day=YYYY-MM-DD
 * POST /api/tables/:id/categories
 *
 * GET: возвращает категории + value (берёт points из category_cells для day or today)
 * POST: обновляет мета-поля категории (title, color, max, position). Тело JSON:
 *  { category_id: string, title?: string, color?: string, max?: number|null, position?: number }
 *
 * Подход: проверяем принадлежность категории table_id, затем обновляем запрошенные поля.
 */

// GET (оставляем прежнюю логику — возвращаем value из category_cells)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tableId = params?.id;
    if (!tableId) return NextResponse.json({ error: "Missing table id" }, { status: 400 });

    const url = new URL(req.url);
    const dayParam = url.searchParams.get("day");
    const day = dayParam ?? new Date().toISOString().slice(0, 10);

    const supabase = admin();

    const catRes = await supabase
      .from("tables_categories")
      .select("id, title, max, color, position")
      .eq("table_id", tableId)
      .order("position", { ascending: true });

    if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 });
    const cats = Array.isArray(catRes.data) ? catRes.data : [];
    if (cats.length === 0) return NextResponse.json({ data: [] }, { status: 200 });

    const ids = cats.map((c: any) => c.id);

    const cellsRes = await supabase
      .from("category_cells")
      .select("category_id, points")
      .eq("table_id", tableId)
      .eq("day", day)
      .in("category_id", ids);

    // ignore cellsRes.error here (we'll fall back to zeros)
    const cells = Array.isArray(cellsRes.data) ? cellsRes.data : [];
    const valuesMap = new Map<string, number>();
    for (const r of cells) {
      valuesMap.set(String(r.category_id), typeof r.points === "number" ? r.points : Number(r.points ?? 0));
    }

    const result = cats.map((c: any) => ({
      id: String(c.id),
      title: c.title ?? "",
      max: typeof c.max === "number" ? c.max : null,
      value: valuesMap.has(String(c.id)) ? valuesMap.get(String(c.id)) : 0,
      color: c.color ?? undefined,
      position: typeof c.position === "number" ? c.position : 0,
    }));

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

// POST — обновление метаданных категории
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tableId = params?.id;
    if (!tableId) return NextResponse.json({ error: "Missing table id" }, { status: 400 });

    let body: any;
    try {
      body = await req.json();
    } catch (e: any) {
      return NextResponse.json({ error: "invalid_json", detail: String(e) }, { status: 400 });
    }

    // robust category_id resolution
let category_id =
  body?.category_id ??
  body?.categoryId ??
  body?.id ??
  body?.category?.id ??
  null;

// if frontend sends whole category object
if (typeof category_id === "object" && category_id !== null && category_id.id) {
  category_id = category_id.id;
}

// final validation
if (!category_id || typeof category_id !== "string") {
  return NextResponse.json({ error: "missing_category_id", received: body }, { status: 400 });
}


    // only allow updatable fields
    const allowed: Record<string, any> = {};
    if (body.title !== undefined) allowed.title = String(body.title);
    if (body.color !== undefined) allowed.color = body.color === null ? null : String(body.color);
    if (body.max !== undefined) {
      const m = body.max === null ? null : Number(body.max);
      if (m !== null && Number.isNaN(m)) return NextResponse.json({ error: "invalid_max" }, { status: 400 });
      allowed.max = m;
    }
    if (body.position !== undefined) {
      const p = Number(body.position);
      if (Number.isNaN(p)) return NextResponse.json({ error: "invalid_position" }, { status: 400 });
      allowed.position = p;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const supabase = admin();

    // verify category belongs to this table
    const fetchRes = await supabase
      .from("tables_categories")
      .select("id,table_id")
      .eq("id", category_id)
      .maybeSingle();

    if (fetchRes.error) return NextResponse.json({ error: fetchRes.error.message }, { status: 500 });
    if (!fetchRes.data) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    if (String(fetchRes.data.table_id) !== String(tableId)) {
      return NextResponse.json({ error: "category_table_mismatch" }, { status: 403 });
    }

    // perform update
    const updRes = await supabase
      .from("tables_categories")
      .update(allowed)
      .eq("id", category_id)
      .select()
      .maybeSingle();

    if (updRes.error) return NextResponse.json({ error: updRes.error.message }, { status: 500 });

    return NextResponse.json({ data: updRes.data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

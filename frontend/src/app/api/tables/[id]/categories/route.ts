// frontend/src/app/api/tables/[id]/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn("[categories.route] Supabase admin not configured (missing env vars)");
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Try to extract tableId:
 *  - prefer params.id
 *  - fallback: parse reqUrl pathname and extract /api/tables/:id/...
 */
function extractTableId(params: any, reqUrl: string): string | null {
  try {
    const pId = String(params?.id ?? "").trim();
    if (pId && pId !== "undefined" && pId !== "null") return pId;

    // parse URL and try to find /api/tables/:id/ segment
    const url = new URL(reqUrl);
    const m = url.pathname.match(/\/api\/tables\/([^\/]+)(\/|$)/);
    if (m && m[1]) {
      const candidate = decodeURIComponent(String(m[1]));
      if (candidate && candidate !== "undefined" && candidate !== "null") return candidate;
    }
  } catch (e) {
    // ignore parsing errors
    console.warn("[categories.route] extractTableId parse failed", String(e));
  }
  return null;
}

/** Simple UUID v4-ish validator (hex groups) */
function isUuidCandidate(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
}

/**
 * GET /api/tables/:id/categories?day=YYYY-MM-DD
 * returns categories merged with daily points (from category_cells)
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tableIdRaw = extractTableId(params, req.url);
    if (!tableIdRaw) {
      return NextResponse.json({ error: "Missing table id" }, { status: 400 });
    }

    // reject obvious placeholders that come from client-side template strings
    if (tableIdRaw === "undefined" || tableIdRaw === "null" || tableIdRaw.trim() === "") {
      console.warn("[categories.route] received invalid table id (placeholder)", tableIdRaw);
      return NextResponse.json({ error: "Missing table id" }, { status: 400 });
    }

    // validate UUID format early to avoid DB errors
    if (!isUuidCandidate(tableIdRaw)) {
      console.warn("[categories.route] table id not uuid:", tableIdRaw);
      return NextResponse.json({ error: "Invalid table id format (expected uuid)" }, { status: 400 });
    }

    const url = new URL(req.url);
    const dayParam = url.searchParams.get("day");
    const day = dayParam ?? new Date().toISOString().slice(0, 10);

    const supabase = admin();

    // load categories
    const catRes = await supabase
      .from("tables_categories")
      .select("id, title, max, color, position")
      .eq("table_id", tableIdRaw)
      .order("position", { ascending: true });

    if (catRes.error) {
      console.error("[categories.route] tables_categories select error:", catRes.error);
      // don't return raw DB error to client, give friendly message
      return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
    }

    const cats = Array.isArray(catRes.data) ? catRes.data : [];
    if (cats.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const ids = cats.map((c: any) => c.id);

    // load category_cells for the day (if table has none, fall back to zeros)
    const cellsRes = await supabase
      .from("category_cells")
      .select("category_id, points")
      .eq("table_id", tableIdRaw)
      .eq("day", day)
      .in("category_id", ids);

    // If DB error on cells, log and continue (we'll fallback to zero)
    if (cellsRes.error) {
      console.warn("[categories.route] category_cells select warning:", cellsRes.error.message);
    }

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
    console.error("[categories.route] unexpected error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * POST: update category metadata
 * body: { category_id: string, title?: string, color?: string|null, max?: number|null, position?: number }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tableIdRaw = extractTableId(params, req.url);
    if (!tableIdRaw) return NextResponse.json({ error: "Missing table id" }, { status: 400 });
    if (!isUuidCandidate(tableIdRaw)) return NextResponse.json({ error: "Invalid table id format (expected uuid)" }, { status: 400 });

    let body: any;
    try {
      body = await req.json();
    } catch (e: any) {
      return NextResponse.json({ error: "invalid_json", detail: String(e) }, { status: 400 });
    }

    let category_id =
      body?.category_id ??
      body?.categoryId ??
      body?.id ??
      body?.category?.id ??
      null;

    if (typeof category_id === "object" && category_id !== null && category_id.id) {
      category_id = category_id.id;
    }

    if (!category_id || typeof category_id !== "string") {
      return NextResponse.json({ error: "missing_category_id", received: body }, { status: 400 });
    }

    if (!isUuidCandidate(category_id)) {
      return NextResponse.json({ error: "invalid_category_id_format" }, { status: 400 });
    }

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

    if (fetchRes.error) {
      console.error("[categories.route] category fetch error:", fetchRes.error);
      return NextResponse.json({ error: "Failed to verify category" }, { status: 500 });
    }
    if (!fetchRes.data) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    if (String(fetchRes.data.table_id) !== String(tableIdRaw)) {
      return NextResponse.json({ error: "category_table_mismatch" }, { status: 403 });
    }

    const updRes = await supabase
      .from("tables_categories")
      .update(allowed)
      .eq("id", category_id)
      .select()
      .maybeSingle();

    if (updRes.error) {
      console.error("[categories.route] category update error:", updRes.error);
      return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
    }

    return NextResponse.json({ data: updRes.data }, { status: 200 });
  } catch (err: any) {
    console.error("[categories.route] unexpected POST error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

// frontend/src/app/api/tables/[id]/cells/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * GET /api/tables/:id/cells?day=YYYY-MM-DD
 * Returns category_cells for that day merged with tables_categories meta
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tableId = String(params?.id ?? "");
    const day = req.nextUrl.searchParams.get("day");
    if (!tableId) return NextResponse.json({ error: "missing_table_id" }, { status: 400 });
    if (!day) return NextResponse.json({ error: "missing ?day=" }, { status: 400 });

    // fetch cells
    const cellsRes = await supabaseAdmin
      .from("category_cells")
      .select("category_id, points, actions")
      .eq("table_id", tableId)
      .eq("day", day);

    if (cellsRes.error) return NextResponse.json({ error: cellsRes.error.message }, { status: 500 });

    // fetch categories meta
    const catsRes = await supabaseAdmin
      .from("tables_categories")
      .select("id, title, max, color")
      .eq("table_id", tableId);

    if (catsRes.error) return NextResponse.json({ error: catsRes.error.message }, { status: 500 });

    const cats = Array.isArray(catsRes.data) ? catsRes.data : [];

    const merged = (Array.isArray(cellsRes.data) ? cellsRes.data : []).map((c: any) => {
      const meta = cats.find((x: any) => String(x.id) === String(c.category_id));
      return {
        category_id: String(c.category_id),
        title: meta?.title ?? "",
        color: meta?.color ?? undefined,
        max: typeof meta?.max === "number" ? meta.max : null,
        points: typeof c.points === "number" ? c.points : Number(c.points ?? 0),
        actions: c.actions ?? null,
      };
    });

    // If no merged rows but categories exist, return zero rows for each category for UI convenience
    if (merged.length === 0 && cats.length > 0) {
      const zeros = cats.map((m: any) => ({
        category_id: String(m.id),
        title: m.title ?? "",
        color: m.color ?? undefined,
        max: typeof m.max === "number" ? m.max : null,
        points: 0,
        actions: null,
      }));
      return NextResponse.json({ data: zeros }, { status: 200 });
    }

    return NextResponse.json({ data: merged }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

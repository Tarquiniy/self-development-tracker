import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Shortcut
async function sb(path: string, options: any = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tableId = params.id;
    const day = req.nextUrl.searchParams.get("day");

    if (!day) {
      return NextResponse.json({ error: "Missing ?day=" }, { status: 400 });
    }

    // 1) SNAPSHOTS
    const cellsRes = await sb(
      `category_cells?table_id=eq.${tableId}&day=eq.${day}`
    );

    if (!cellsRes.ok) {
      return NextResponse.json(
        { error: "Failed to load category_cells" },
        { status: 500 }
      );
    }

    const cells = await cellsRes.json();

    // 2) CATEGORIES META (your actual table!)
    const catRes = await sb(
      `tables_categories?table_id=eq.${tableId}`
    );

    if (!catRes.ok) {
      return NextResponse.json(
        { error: "Failed to load tables_categories" },
        { status: 500 }
      );
    }

    const categories = await catRes.json();

    const merged = cells.map((c: any) => {
      const meta = categories.find((x: any) => x.id === c.category_id);

      return {
        id: c.category_id,
        title: meta?.title ?? "Без названия",
        color: meta?.color ?? "#999",
        max: meta?.max ?? null,
        value: c.points
      };
    });

    return NextResponse.json({ data: merged }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

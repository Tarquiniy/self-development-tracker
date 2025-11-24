// frontend/src/app/api/tables/[id]/progress/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * GET /api/tables/[id]/progress
 * Возвращаем агрегированный прогресс по таблице:
 * для каждой категории — текущее суммарное значение / максимум
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tableId = params?.id ?? "";
  if (!tableId) return NextResponse.json({ error: "missing_table_id" }, { status: 400 });

  try {
    // Берём все категории таблицы
    const catRes = await supabaseAdmin
      .from("tables_categories")
      .select("id,name,max")
      .eq("table_id", tableId);

    if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 });

    const cats = catRes.data ?? [];

    // Для каждой категории считаем сумму значений в entries (можно оптимизировать SQL-агрегацией)
    const catIds = cats.map((c: any) => c.id);
    const entriesRes = await supabaseAdmin
      .from("table_entries")
      .select("category_id,value")
      .in("category_id", catIds)
      .order("created_at", { ascending: false })
      .limit(10000); // разумный cap

    if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 });

    const entries = entriesRes.data ?? [];

    const progress = cats.map((c: any) => {
      const sum = entries
        .filter((e: any) => e.category_id === c.id)
        .reduce((acc: number, cur: any) => acc + (typeof cur.value === "number" ? cur.value : 0), 0);
      return { id: c.id, name: c.name, max: c.max, sum };
    });

    return NextResponse.json({ data: progress });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// frontend/src/app/api/tables/[id]/progress/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin, createAdminClient } from "@/lib/supabaseAdmin";

/**
 * GET /api/tables/[id]/progress
 * Возвращает агрегированные данные прогресса для таблицы (например, средние по числовым колонкам за последние N записей)
 * Упрощённая реализация: даём среднее по каждой числовой колонки из последних 100 записей.
 */

export async function GET(_req: Request, context: any) {
  try {
    const params = context?.params ?? {};
    const id = String(params?.id ?? "");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const sb = supabaseAdmin ?? createAdminClient();

    // берем последние 200 записей
    const entriesRes = await sb
      .from("table_entries")
      .select("entry_values")
      .eq("table_id", id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (entriesRes.error) {
      return NextResponse.json({ error: entriesRes.error.message ?? entriesRes.error }, { status: 500 });
    }

    const rows = entriesRes.data ?? [];
    // entry_values assumed array of { column_id, value_number?, value_text? }
    const numericSums: Record<string, { sum: number; count: number }> = {};

    (rows as any[]).forEach((r) => {
      const vals = r.entry_values ?? [];
      vals.forEach((v: any) => {
        const n = typeof v.value_number === "number" ? v.value_number : NaN;
        if (!isNaN(n)) {
          if (!numericSums[v.column_id]) numericSums[v.column_id] = { sum: 0, count: 0 };
          numericSums[v.column_id].sum += n;
          numericSums[v.column_id].count += 1;
        }
      });
    });

    const averages = Object.entries(numericSums).map(([column_id, { sum, count }]) => ({
      column_id,
      average: count > 0 ? sum / count : null,
      count,
    }));

    return NextResponse.json({ data: { averages } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

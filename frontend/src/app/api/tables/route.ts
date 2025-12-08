// frontend/src/app/api/tables/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseLimitValue(v: any): number | typeof Infinity | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return Infinity;
  return Math.floor(n);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String((body?.title ?? "").trim() || "Моя таблица");
    const owner = body?.owner ?? null;

    if (!owner) {
      return NextResponse.json({ error: "missing_owner" }, { status: 400 });
    }

    // ---------- 1. User profile table limit ----------
    let profileLimit: number | typeof Infinity | null = null;

    try {
      const { data: prof, error } = await supabaseAdmin
        .from("users_userprofile")
        .select(
          "tables_limit,max_tables,allowed_tables,tables_allowed,tables_quota"
        )
        .eq("user_id", owner)
        .maybeSingle();

      if (!error && prof) {
        const candidates = [
          prof.tables_limit,
          prof.max_tables,
          prof.allowed_tables,
          prof.tables_allowed,
          prof.tables_quota,
        ];

        for (const c of candidates) {
          const parsed = parseLimitValue(c);
          if (parsed !== null) {
            profileLimit = parsed;
            break;
          }
        }
      }
    } catch {}

    if (profileLimit === null) {
      try {
        const { data: prof2, error } = await supabaseAdmin
          .from("profiles")
          .select(
            "tables_limit,max_tables,allowed_tables,tables_allowed,tables_quota"
          )
          .eq("id", owner)
          .maybeSingle();

        if (!error && prof2) {
          const candidates = [
            prof2.tables_limit,
            prof2.max_tables,
            prof2.allowed_tables,
            prof2.tables_allowed,
            prof2.tables_quota,
          ];

          for (const c of candidates) {
            const parsed = parseLimitValue(c);
            if (parsed !== null) {
              profileLimit = parsed;
              break;
            }
          }
        }
      } catch {}
    }

    const DEFAULT_LIMIT = 1;
    const allowedLimit = profileLimit === null ? DEFAULT_LIMIT : profileLimit;

    // ---------- 2. Count user tables ----------
    const tablesRes = await supabaseAdmin
      .from("user_tables")
      .select("id,title,owner,created_at")
      .eq("owner", owner);

    if (tablesRes.error) {
      return NextResponse.json(
        { error: "db_error_count_tables", detail: tablesRes.error.message },
        { status: 500 }
      );
    }

    const existingTables = tablesRes.data ?? [];
    const existingCount = existingTables.length;

    if (Number.isFinite(Number(allowedLimit)) && existingCount >= Number(allowedLimit)) {
      return NextResponse.json(
        {
          error: "user_has_table",
          existing: existingTables[0] ?? null,
          count: existingCount,
          allowed: allowedLimit,
        },
        { status: 409 }
      );
    }

    // ---------- 3. Insert new table ----------
    const now = new Date().toISOString();

    const insert = await supabaseAdmin
      .from("user_tables")
      .insert([{ title, owner, created_at: now }])
      .select("*")
      .maybeSingle();

    if (insert.error) {
      return NextResponse.json(
        { error: "db_insert_error", detail: insert.error.message },
        { status: 500 }
      );
    }

    const table = insert.data;
    const tableId = table?.id;

    if (!tableId) {
      return NextResponse.json({ error: "no_table_id_returned" }, { status: 500 });
    }

    // ---------- 4. Create default categories ----------
    const defaultCategories = [
      { table_id: tableId, title: "Обучение", max: 10, created_at: now },
      { table_id: tableId, title: "Финансы", max: 10, created_at: now },
      { table_id: tableId, title: "Спорт / Здоровье", max: 10, created_at: now },
      {
        table_id: tableId,
        title: "Семья / Духовное развитие / Личная жизнь",
        max: 10,
        created_at: now,
      },
      { table_id: tableId, title: "Проекты", max: 10, created_at: now },
    ];

    const catIns = await supabaseAdmin
      .from("tables_categories")
      .insert(defaultCategories)
      .select();

    if (catIns.error) {
      await supabaseAdmin.from("user_tables").delete().eq("id", tableId);
      return NextResponse.json(
        { error: "categories_insert_failed", detail: catIns.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: { ...table, categories: catIns.data ?? [] } },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "exception", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

// ============================
//       SECURE GET ROUTE
// ============================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return NextResponse.json(
        { error: "missing_owner", detail: "owner query parameter required" },
        { status: 400 }
      );
    }

    const list = await supabaseAdmin
      .from("user_tables")
      .select("*")
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (list.error) {
      return NextResponse.json(
        { error: "db_error", detail: list.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: list.data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: "exception", detail: String(e) },
      { status: 500 }
    );
  }
}

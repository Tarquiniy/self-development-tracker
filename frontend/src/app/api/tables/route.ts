// frontend/src/app/api/tables/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Создание таблицы с учётом лимита таблиц в профиле пользователя.
 *
 * Ожидает body: { title?: string, owner?: string }
 *
 * Логика:
 *  - Получаем лимит таблиц из users_userprofile (или profiles) по полям:
 *      tables_limit, max_tables, allowed_tables, tables_allowed, tables_quota
 *    Если поле отсутствует -> defaultLimit = 1
 *    Если значение < 0 -> трактуем как unlimited
 *  - Считаем текущее количество таблиц у owner
 *  - Если count >= limit -> возвращаем 409 { error: "user_has_table", existing: <some existing table> }
 *  - Иначе создаём таблицу и дефолтные категории (как у вас было)
 */

function parseLimitValue(v: any): number | typeof Infinity | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return Infinity; // negative => unlimited (admin can set -1 for unlimited)
  return Math.floor(n);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const title = String((body?.title ?? "").trim() || "Моя таблица");
    const owner = body?.owner ?? null;

    if (!owner) {
      return NextResponse.json({ error: "missing_owner" }, { status: 400 });
    }

    // --- 1) Try read user's tables limit from profile tables (several possible field names) ---
    let profileLimit: number | typeof Infinity | null = null;
    try {
      // try users_userprofile first (used elsewhere in code)
      const { data: profData, error: profErr } = await supabaseAdmin
        .from("users_userprofile")
        .select("tables_limit,max_tables,allowed_tables,tables_allowed,tables_quota")
        .eq("user_id", owner)
        .maybeSingle();

      if (!profErr && profData) {
        // check any known field
        const candidates = [
          profData.tables_limit,
          profData.max_tables,
          profData.allowed_tables,
          profData.tables_allowed,
          profData.tables_quota,
        ];
        for (const c of candidates) {
          const parsed = parseLimitValue(c);
          if (parsed !== null) {
            profileLimit = parsed;
            break;
          }
        }
      }
    } catch (e) {
      // ignore and fallback to next attempt
    }

    // fallback: try 'profiles' table (the simpler supabase auth profile)
    if (profileLimit === null) {
      try {
        const { data: p2, error: pe } = await supabaseAdmin
          .from("profiles")
          .select("tables_limit,max_tables,allowed_tables,tables_allowed,tables_quota")
          .eq("id", owner)
          .maybeSingle();
        if (!pe && p2) {
          const candidates = [
            p2.tables_limit,
            p2.max_tables,
            p2.allowed_tables,
            p2.tables_allowed,
            p2.tables_quota,
          ];
          for (const c of candidates) {
            const parsed = parseLimitValue(c);
            if (parsed !== null) {
              profileLimit = parsed;
              break;
            }
          }
        }
      } catch (e) {
        // ignore, we'll use default
      }
    }

    // default behavior: if no limit found -> 1 (legacy behaviour)
    const DEFAULT_LIMIT = 1;
    let allowedLimit: number | typeof Infinity = DEFAULT_LIMIT;
    if (profileLimit === null) allowedLimit = DEFAULT_LIMIT;
    else allowedLimit = profileLimit;

    // --- 2) Count current tables for this owner ---
    const tablesRes = await supabaseAdmin
      .from("user_tables")
      .select("id,title,owner,created_at")
      .eq("owner", owner);

    if (tablesRes.error) {
      return NextResponse.json({ error: "db_error_count_tables", detail: tablesRes.error.message }, { status: 500 });
    }

    const existingTables: any[] = Array.isArray(tablesRes.data) ? tablesRes.data : [];
    const existingCount = existingTables.length;

    // if allowedLimit is finite and we've reached/exceeded it -> block
    if (Number.isFinite(Number(allowedLimit)) && existingCount >= Number(allowedLimit)) {
      // return 409 with existing table to let frontend show modal (it expects error=="user_has_table")
      return NextResponse.json(
        { error: "user_has_table", existing: existingTables[0] ?? null, count: existingCount, allowed: allowedLimit },
        { status: 409 }
      );
    }

    // --- 3) Insert table (as before) ---
    const insert = await supabaseAdmin
      .from("user_tables")
      .insert([{ title, owner, created_at: new Date().toISOString() }])
      .select("*")
      .limit(1)
      .maybeSingle();

    if (insert.error) {
      return NextResponse.json({ error: "db_insert_error", detail: insert.error.message }, { status: 500 });
    }

    const table = insert.data;
    const tableId = table?.id ?? table?.ID ?? null;
    if (!tableId) {
      // try rollback just in case
      try {
        await supabaseAdmin.from("user_tables").delete().eq("id", tableId);
      } catch {}
      return NextResponse.json({ error: "no_table_id_returned" }, { status: 500 });
    }

    // --- 4) Create default categories (same default set as before) ---
    const now = new Date().toISOString();
    const defaultCategories = [
      { table_id: tableId, title: "Обучение", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Финансы", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Спорт / Здоровье", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Семья / Духовное развитие / Личная жизнь", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Проекты", description: null, max: 10, color: null, created_at: now },
    ];

    const catIns = await supabaseAdmin
      .from("tables_categories")
      .insert(defaultCategories)
      .select();

    if (catIns.error) {
      // попытка отката созданной таблицы
      try {
        await supabaseAdmin.from("user_tables").delete().eq("id", tableId);
      } catch (rollbackErr) {
        console.error("Rollback failed for user_tables", rollbackErr);
      }
      return NextResponse.json({ error: "categories_insert_failed", detail: catIns.error.message }, { status: 500 });
    }

    const categories = Array.isArray(catIns.data) ? catIns.data : [];
    return NextResponse.json({ data: { ...table, categories } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const list = await supabaseAdmin.from("user_tables").select("*").order("created_at", { ascending: false });
    if (list.error) {
      return NextResponse.json({ error: list.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: list.data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

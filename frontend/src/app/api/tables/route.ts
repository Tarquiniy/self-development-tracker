// frontend/src/app/api/tables/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Создание таблицы с учётом лимита таблиц в профиле пользователя.
 *
 * Ожидает body: { title?: string, owner?: string }
 *
 * Логика:
 *  - Если owner выглядит как UUID (supabase user id) -> читаем лимит СНАЧАЛА из profiles (supabase),
 *    затем (если не найден) пробуем users_userprofile (Django table, integer user_id).
 *  - Если owner выглядит как integer id -> читаем сначала users_userprofile, затем profiles.
 *
 *  - Если нет информации -> DEFAULT_LIMIT = 1
 *  - Значения < 0 трактуем как Infinity (неограниченно)
 */

function parseLimitValue(v: any): number | typeof Infinity | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return Infinity; // negative => unlimited (admin can set -1 for unlimited)
  return Math.floor(n);
}

function looksLikeUUID(s: any): boolean {
  if (typeof s !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const title = String((body?.title ?? "").trim() || "Моя таблица");
    const owner = body?.owner ?? null;

    if (!owner) {
      return NextResponse.json({ error: "missing_owner" }, { status: 400 });
    }

    // determine preference for where to look first
    const ownerLooksLikeUUID = looksLikeUUID(owner);

    // --- 1) Try read user's tables limit (with order depending on owner type) ---
    let profileLimit: number | typeof Infinity | null = null;

    // helper attempts
    async function tryProfilesTable(own: any) {
      try {
        const { data: p2, error: pe } = await supabaseAdmin
          .from("profiles")
          .select("tables_limit")
          .eq("id", own)
          .maybeSingle();
        if (!pe && p2) {
          const candidates = [p2.tables_limit];
          for (const c of candidates) {
            const parsed = parseLimitValue(c);
            if (parsed !== null) {
              return parsed;
            }
          }
        }
      } catch (e) {
        // ignore
      }
      return null;
    }

    async function tryUsersUserprofile(own: any) {
      try {
        const { data: profData, error: profErr } = await supabaseAdmin
          .from("users_userprofile")
          .select("tables_limit,max_tables,allowed_tables,tables_allowed,tables_quota")
          .eq("user_id", own)
          .maybeSingle();

        if (!profErr && profData) {
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
              return parsed;
            }
          }
        }
      } catch (e) {
        // ignore
      }
      return null;
    }

    // Order attempts based on owner type
    if (ownerLooksLikeUUID) {
      // owner is supabase uuid -> try profiles first, then users_userprofile
      profileLimit = await tryProfilesTable(owner);
      if (profileLimit === null) {
        profileLimit = await tryUsersUserprofile(owner);
      }
    } else {
      // owner is probably integer id -> try users_userprofile first
      profileLimit = await tryUsersUserprofile(owner);
      if (profileLimit === null) {
        profileLimit = await tryProfilesTable(owner);
      }
    }

    // default behavior: if no limit found -> 1 (legacy behaviour)
    const DEFAULT_LIMIT = 1;
    let allowedLimit: number | typeof Infinity = DEFAULT_LIMIT;
    if (profileLimit === null) allowedLimit = DEFAULT_LIMIT;
    else allowedLimit = profileLimit;

    // --- 2) Count current tables for this owner ---
    // Using count from supabase
    const tablesRes = await supabaseAdmin
      .from("user_tables")
      .select("id,title,owner,created_at", { count: "exact" })
      .eq("owner", owner);

    if (tablesRes.error) {
      return NextResponse.json({ error: "db_error_count_tables", detail: tablesRes.error.message }, { status: 500 });
    }

    const existingTables: any[] = Array.isArray(tablesRes.data) ? tablesRes.data : [];
    const existingCount = typeof tablesRes.count === "number" ? tablesRes.count : existingTables.length;

    // if allowedLimit is finite and we've reached/exceeded it -> block
    if (Number.isFinite(Number(allowedLimit)) && existingCount >= Number(allowedLimit)) {
      // return 409 with existing table to let frontend show modal (it expects error=="user_has_table")
      return NextResponse.json(
        { error: "user_has_table", existing: existingTables[0] ?? null, count: existingCount, allowed: allowedLimit },
        { status: 409 }
      );
    }

    // --- 3) Insert table (ensure user_id is set) ---
    // IMPORTANT: set user_id to owner so row is associated with user properly
    const insertPayload: any = {
      title,
      owner,
      created_at: new Date().toISOString(),
      user_id: owner, // add this to ensure front-end / other queries can find table by user_id
    };

    const insert = await supabaseAdmin
      .from("user_tables")
      .insert([insertPayload])
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

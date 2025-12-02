// frontend/src/app/api/tables/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/tables
 * - Требует Authorization: Bearer <token>
 * - Возвращает таблицы владельца (owner = user.id)
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : null;
    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    const userRes = await supabaseAdmin.auth.getUser(token);
    if (userRes.error || !userRes.data?.user) {
      return NextResponse.json({ error: "invalid_token", detail: userRes.error?.message ?? null }, { status: 401 });
    }
    const user = userRes.data.user;

    const list = await supabaseAdmin
      .from("user_tables")
      .select("*")
      .eq("owner", user.id)
      .order("created_at", { ascending: false });

    if (list.error) {
      return NextResponse.json({ error: list.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: list.data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

/**
 * POST /api/tables
 * - Требует Authorization: Bearer <token>
 * - Если у пользователя уже есть хотя бы одна таблица -> возвращает 409 + existing table
 * - Иначе создаёт таблицу (owner и user_id из токена) + предустановленные категории
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : null;
    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    const userRes = await supabaseAdmin.auth.getUser(token);
    if (userRes.error || !userRes.data?.user) {
      return NextResponse.json({ error: "invalid_token", detail: userRes.error?.message ?? null }, { status: 401 });
    }
    const user = userRes.data.user;
    const userId = String(user.id);

    const body = (await req.json()) as any;
    const title = String((body?.title ?? "").trim() || "Моя таблица");
    const now = new Date().toISOString();

    // Проверяем: есть ли уже таблица(ы) у этого пользователя
    const existingRes = await supabaseAdmin
      .from("user_tables")
      .select("*")
      .eq("owner", userId)
      .limit(1);

    if (existingRes.error) {
      return NextResponse.json({ error: "db_check_error", detail: existingRes.error.message }, { status: 500 });
    }

    if (Array.isArray(existingRes.data) && existingRes.data.length > 0) {
      // Пользователь уже имеет таблицу — возвращаем 409 и существующую запись
      return NextResponse.json(
        { error: "user_has_table", existing: existingRes.data[0] },
        { status: 409 }
      );
    }

    // Вставляем таблицу (owner и user_id из токена)
    const insert = await supabaseAdmin
      .from("user_tables")
      .insert([{ title, owner: userId, user_id: userId, created_at: now }])
      .select("*")
      .limit(1)
      .maybeSingle();

    if (insert.error) {
      return NextResponse.json({ error: "db_insert_error", detail: insert.error.message }, { status: 500 });
    }

    const table = insert.data;
    const tableId = table?.id ?? null;
    if (!tableId) {
      // откатывать ничего не будем здесь (если нет id) — возвращаем ошибку
      return NextResponse.json({ error: "no_table_id_returned" }, { status: 500 });
    }

    // создаём предустановленные категории
    const defaultCategories = [
      { table_id: tableId, title: "Обучение", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Финансы", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Спорт / Здоровье", description: null, max: 10, color: null, created_at: now },
      {
        table_id: tableId,
        title: "Семья / Духовное развитие / Личная жизнь",
        description: null,
        max: 10,
        color: null,
        created_at: now,
      },
      { table_id: tableId, title: "Проекты", description: null, max: 10, color: null, created_at: now },
    ];

    const catIns = await supabaseAdmin
      .from("tables_categories")
      .insert(defaultCategories)
      .select();

    if (catIns.error) {
      // попытка удалить созданную таблицу (best-effort)
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

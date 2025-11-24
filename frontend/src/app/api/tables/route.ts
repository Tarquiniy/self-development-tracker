// frontend/src/app/api/tables/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const title = String((body?.title ?? "").trim() || "Моя таблица");
    const owner = body?.owner ?? null;

    // 1) Вставляем саму таблицу
    const insert = await supabaseAdmin
      .from("user_tables")
      .insert([{ title, owner, created_at: new Date().toISOString() }])
      .select("*")
      .limit(1)
      .maybeSingle();

    if (insert.error) {
      return NextResponse.json(
        { error: "db_insert_error", detail: insert.error.message },
        { status: 500 }
      );
    }

    const table = insert.data;
    const tableId = table?.id ?? table?.ID ?? null;
    if (!tableId) {
      // Нечаянно не вернулся id — откатываем и ошибка
      await supabaseAdmin.from("user_tables").delete().eq("id", tableId);
      return NextResponse.json({ error: "no_table_id_returned" }, { status: 500 });
    }

    // 2) Подготавливаем предустановленные категории
    const now = new Date().toISOString();
    const defaultCategories = [
      { table_id: tableId, title: "Обучение", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Финансы", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Спорт / Здоровье", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Семья / Духовное развитие / Личная жизнь", description: null, max: 10, color: null, created_at: now },
      { table_id: tableId, title: "Проекты", description: null, max: 10, color: null, created_at: now }
    ];

    // 3) Вставляем категории; если ошибка — откат (удаляем таблицу) и возвращаем ошибку
    const catIns = await supabaseAdmin
      .from("tables_categories")
      .insert(defaultCategories)
      .select();

    if (catIns.error) {
      // попытка отката созданной таблицы
      try {
        await supabaseAdmin.from("user_tables").delete().eq("id", tableId);
      } catch (rollbackErr) {
        // если откат не удался — логируем (супер-логика в runtime), но всё равно возвращаем ошибку
        console.error("Rollback failed for user_tables", rollbackErr);
      }
      return NextResponse.json(
        { error: "categories_insert_failed", detail: catIns.error.message },
        { status: 500 }
      );
    }

    // 4) Возвращаем структуру: созданная таблица + массив созданных категорий
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

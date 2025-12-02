// frontend/src/app/api/tables/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * DELETE /api/tables/:id
 * - Требует Authorization: Bearer <token>
 * - Удаляет связанные записи (entries, categories) и саму таблицу,
 *   только если текущий пользователь является owner.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

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

    // проверяем, что таблица принадлежит пользователю
    const tableRes = await supabaseAdmin
      .from("user_tables")
      .select("id, owner")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (tableRes.error) {
      return NextResponse.json({ error: "db_error", detail: tableRes.error.message }, { status: 500 });
    }

    const table = tableRes.data;
    if (!table) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (String(table.owner) !== String(user.id)) {
      return NextResponse.json({ error: "forbidden", detail: "not table owner" }, { status: 403 });
    }

    // best-effort: удалить связанные записи (entries, categories), если такие таблицы есть
    try {
      // entries
      await supabaseAdmin.from("entries").delete().eq("table_id", id);
    } catch (e) {
      // игнорируем ошибку — возможно таблицы нет
      console.warn("Failed deleting entries for table", id, e);
    }
    try {
      await supabaseAdmin.from("tables_categories").delete().eq("table_id", id);
    } catch (e) {
      console.warn("Failed deleting categories for table", id, e);
    }

    // удалить саму таблицу
    const delRes = await supabaseAdmin.from("user_tables").delete().eq("id", id);
    if (delRes.error) {
      return NextResponse.json({ error: "delete_failed", detail: delRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { deleted: id } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

/**
 * (Опционально) GET /api/tables/:id — возвращает таблицу по id для текущего пользователя
 * Если нужен — можно раскомментировать и вернуть.
 */
// export async function GET(req: Request, { params }: { params: { id: string } }) {
//   // аналогично: проверка токена -> select * where id = params.id and owner = user.id
// }

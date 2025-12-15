// frontend/src/app/api/tables/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * DELETE /api/tables/:id
 * - Требует Authorization: Bearer <token> (попытка также прочитать токен из cookie)
 * - Удаляет связанные записи (entries, categories) и саму таблицу,
 *   только если текущий пользователь является owner.
 *
 * Этот обработчик устойчив к случаям, когда params.id отсутствует:
 *  - пытаемся извлечь id из params, затем из URL, затем из body (JSON).
 */

export async function DELETE(req: Request, { params }: { params: { id?: string } }) {
  try {
    // --- 1) try params, fallback to url path or JSON body ---
    let id = params?.id ?? "";

    // если нет — попробовать извлечь из req.url (на случай запуска в другом окружении)
    if (!id) {
      try {
        const u = new URL(req.url);
        // паттерн: /api/tables/<id>(/...) — захватим первый сегмент после /api/tables/
        const m = u.pathname.match(/\/api\/tables\/([^\/\?]+)/i);
        if (m && m[1]) {
          id = decodeURIComponent(m[1]);
        }
      } catch (e) {
        // ignore
      }
    }

    // если всё ещё нет — попробовать тело JSON { id: "..."}
    if (!id) {
      try {
        const body = await req.json().catch(() => null);
        if (body && (body.id || body.tableId || body.table_id)) {
          id = String(body.id ?? body.tableId ?? body.table_id);
        }
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    // --- 2) авторизация: Authorization header -> cookie fallback ---
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    let token = match ? match[1] : null;

    // fallback: попробовать прочитать из cookie (например, если вы храните токен в cookie)
    if (!token) {
      const cookieHeader = req.headers.get("cookie") || "";
      // ищем несколько возможных имён токена (наиболее распространённые)
      const cookieMatch =
        cookieHeader.match(/(?:sb-access-token|access_token|token|sb:token)=([^;]+)/) ||
        cookieHeader.match(/(?:sb-access-token|access_token|token|sb:token)\s*=\s*"?([^;"]+)"/);
      if (cookieMatch) {
        token = decodeURIComponent(cookieMatch[1]);
      }
    }

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    // --- 3) получить user через supabase admin ---
    const userRes = await supabaseAdmin.auth.getUser(token as string);
    if (userRes.error || !userRes.data?.user) {
      return NextResponse.json({ error: "invalid_token", detail: userRes.error?.message ?? null }, { status: 401 });
    }
    const user = userRes.data.user;

    // --- 4) проверяем, что таблица принадлежит пользователю ---
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

    // --- 5) best-effort удалить связанные записи (entries, categories), если они есть ---
    try {
      await supabaseAdmin.from("entries").delete().eq("table_id", id);
    } catch (e) {
      // игнорируем — возможно таблицы нет или нет прав — главное, продолжить
      console.warn("Failed deleting entries for table", id, e);
    }
    try {
      await supabaseAdmin.from("tables_categories").delete().eq("table_id", id);
    } catch (e) {
      console.warn("Failed deleting categories for table", id, e);
    }

    // --- 6) удалить саму таблицу ---
    const delRes = await supabaseAdmin.from("user_tables").delete().eq("id", id);
    if (delRes.error) {
      return NextResponse.json({ error: "delete_failed", detail: delRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { deleted: id } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "internal", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

// frontend/src/app/api/tables/[id]/categories/[cat]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(req: Request, ctx: any) {
  try {
    const tableId = String(ctx?.params?.id ?? "");
    const catId = String(ctx?.params?.cat ?? "");
    if (!tableId || !catId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const titleRaw = body?.title ?? body?.name ?? "";
    const title = String(titleRaw ?? "").trim();
    const description = body?.description ?? null;
    const maxRaw = body?.max ?? null;
    const max = maxRaw === null || maxRaw === undefined || maxRaw === "" ? null : Number(maxRaw);

    const payload: any = {};
    if (title) payload.title = title;
    if ("description" in body) payload.description = description;
    if ("max" in body) payload.max = max;

    if (Object.keys(payload).length === 0) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

    const supabase = adminClient();
    const r = await supabase
      .from("tables_categories")
      .update(payload)
      .eq("id", catId)
      .eq("table_id", tableId)
      .select("id,title,description,max,created_at")
      .maybeSingle();

    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ data: r.data });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: any) {
  try {
    const tableId = String(ctx?.params?.id ?? "");
    const catId = String(ctx?.params?.cat ?? "");
    if (!tableId || !catId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

    const supabase = adminClient();
    const r = await supabase.from("tables_categories").delete().eq("id", catId).eq("table_id", tableId);

    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ data: { deleted: true } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

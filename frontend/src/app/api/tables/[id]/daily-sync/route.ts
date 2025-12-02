// frontend/src/app/api/tables/[id]/daily-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toIsoDateUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "Server misconfigured: missing SUPABASE_URL or SERVICE_ROLE_KEY" }, { status: 500 });
    }
    const tableId = params?.id;
    if (!tableId) return NextResponse.json({ error: "Missing table id in path" }, { status: 400 });

    const now = new Date();
    const todayIso = toIsoDateUTC(now);
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = toIsoDateUTC(yesterday);

    // fetch today's rows
    const todayRes = await supabaseAdmin
      .from("category_cells")
      .select("category_id, points")
      .eq("table_id", tableId)
      .eq("day", todayIso);

    if (todayRes.error) return NextResponse.json({ error: todayRes.error.message }, { status: 500 });

    const todayRows = Array.isArray(todayRes.data) ? todayRes.data : [];

    // upsert each into yesterday (use array upsert or bulk upsert)
    if (todayRows.length > 0) {
      const upserts = todayRows.map((r: any) => ({
        table_id: tableId,
        category_id: r.category_id,
        day: yIso,
        points: r.points,
      }));

      // pass array and onConflict string
      const insRes = await supabaseAdmin
        .from("category_cells")
        .upsert(upserts, { onConflict: "table_id,category_id,day" })
        .select();

      if (insRes.error) {
        return NextResponse.json({ error: "Failed inserting category_cells", status: insRes.status, body: insRes.error.message }, { status: 502 });
      }
    }

    // delete today's rows (start fresh)
    const delRes = await supabaseAdmin
      .from("category_cells")
      .delete()
      .eq("table_id", tableId)
      .eq("day", todayIso);

    if (delRes.error) {
      return NextResponse.json({ error: "Failed deleting today's rows", detail: delRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, copied: todayRows.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

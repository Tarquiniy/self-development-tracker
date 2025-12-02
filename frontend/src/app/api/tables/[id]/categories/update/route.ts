import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function baseUrl() {
  return (SUPABASE_URL ?? "").replace(/\/$/, "");
}

async function restFetch(path: string, opts: RequestInit = {}) {
  const base = baseUrl();
  return fetch(`${base}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY ?? "",
      Authorization: `Bearer ${SERVICE_KEY ?? ""}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

/**
 * PATCH /api/tables/:id/categories/update
 * body: { category_id: string, current: number }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
    }

    const tableId = params.id;
    const body = await req.json();
    const categoryId = body.category_id;
    const newValue = body.current;

    if (!categoryId) {
      return NextResponse.json({ error: "Missing category_id" }, { status: 400 });
    }

    const res = await restFetch(
      `tables_categories?id=eq.${encodeURIComponent(categoryId)}&table_id=eq.${encodeURIComponent(tableId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ current: newValue }),
        headers: { Prefer: "return=representation" }
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: "Patch failed", details: t }, { status: 500 });
    }

    const rows = await res.json();
    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

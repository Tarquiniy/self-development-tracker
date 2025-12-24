// frontend/src/app/api/debug/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? null;
  const info: any = { apiUrlPresent: !!apiUrl, apiUrl: apiUrl ?? null };

  // НЕ возвращаем секреты (REVALIDATION_SECRET) — только URL
  if (apiUrl) {
    try {
      const testSlug = "qwerty";
      const testUrl = `${apiUrl.replace(/\/$/, "")}/api/blog/posts/${encodeURIComponent(testSlug)}/`;
      const res = await fetch(testUrl, { cache: "no-store" });
      const text = await res.text().catch(() => "<no-body>");
      info.fetch = {
        url: testUrl,
        status: res.status,
        ok: res.ok,
        bodyPreview: text.slice(0, 1000),
      };
    } catch (err: any) {
      info.fetchError = String(err);
    }
  } else {
    info.note = "API URL not set (API_URL or NEXT_PUBLIC_API_URL)";
  }

  return NextResponse.json(info);
}

// frontend/src/app/api/debug/client-error/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);

    // Записываем в лог (Vercel / stdout). В проде можно писать в таблицу DB или Sentry.
    // Подробности приходят в payload: { message, stack, userAgent, url, time, extra }
    // Ограничиваем размер логов.
    // eslint-disable-next-line no-console
    console.error("CLIENT ERROR REPORTED:", JSON.stringify(payload, null, 2));

    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("CLIENT ERROR ENDPOINT FAILED:", String(e));
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

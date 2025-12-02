// frontend/src/app/api/notify/duplicate-table/route.ts
import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

export async function POST(req: Request) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return NextResponse.json({ error: "telegram_not_configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));

    const {
      fio,
      phone,
      email,
      telegram,
      pages,          // теперь это количество страниц
      note,
    } = body ?? {};

    const escapeHtml = (s: any) =>
      String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const message = [
      `<b>Новая заявка на покупку дополнительных таблиц</b>`,
      `⏱ ${new Date().toLocaleString()}`,

      fio ? `<b>ФИО:</b> ${escapeHtml(fio)}` : null,
      phone ? `<b>Телефон:</b> ${escapeHtml(phone)}` : null,
      email ? `<b>Email:</b> ${escapeHtml(email)}` : null,
      telegram ? `<b>Telegram:</b> ${escapeHtml(telegram)}` : null,

      pages
        ? `<b>Количество страниц, которые хочет приобрести:</b> ${escapeHtml(pages)}`
        : null,

      note ? `<b>Комментарий:</b> ${escapeHtml(note)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({ error: "telegram_send_failed", detail: json }, { status: 502 });
    }

    return NextResponse.json({ ok: true, telegram: json });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

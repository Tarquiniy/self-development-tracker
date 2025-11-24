import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN || !SITE_ORIGIN) {
  console.error("Telegram verify route: Missing environment variables", {
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, SITE_ORIGIN
  });
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function verifyTelegramAuth(data: Record<string, any>): boolean {
  const hash = data.hash;
  if (!hash) {
    console.error("verifyTelegramAuth: missing hash in data", data);
    return false;
  }
  const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
  const sorted = Object.keys(data)
    .filter(k => k !== "hash")
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join("\n");

  const hmac = crypto.createHmac("sha256", secretKey).update(sorted).digest("hex");
  const valid = hmac === hash;
  console.log("verifyTelegramAuth:", { sorted, hmac, hash, valid });
  return valid;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Telegram verify route: received body", body);

    if (!verifyTelegramAuth(body)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    const telegramId = String(body.id);
    const email = `tg_${telegramId}@telegram.local`;
    const fullName = [body.first_name, body.last_name].filter(Boolean).join(" ") || null;

    console.log("Telegram verify route: authorised user", { telegramId, email, fullName });

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      redirect_to: SITE_ORIGIN
    } as any);

    if (linkErr) {
      console.error("Telegram verify route: Supabase generateLink error", linkErr);
      return NextResponse.json({ error: "supabase_generate_failed", detail: linkErr.message }, { status: 500 });
    }

    const action_link = (linkData as any)?.action_link;
    console.log("Telegram verify route: action_link", action_link);

    if (!action_link) {
      console.error("Telegram verify route: Missing action_link", linkData);
      return NextResponse.json({ error: "no_link" }, { status: 500 });
    }

    await supabaseAdmin.from("profiles").upsert([
      { email, full_name: fullName, telegram_id: telegramId }
    ], { onConflict: "email" });

    console.log("Telegram verify route: profile upsert done");

    return NextResponse.json({ action_link });
  } catch (err: any) {
    console.error("Telegram verify route: internal error", err);
    return NextResponse.json({ error: "internal_error", detail: err.message }, { status: 500 });
  }
}

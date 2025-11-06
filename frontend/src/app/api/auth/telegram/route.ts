// frontend/src/app/api/auth/telegram/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL: string = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY: string = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TELEGRAM_BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SITE_URL: string = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://positive-theta.vercel.app';
const EMAIL_DOMAIN: string = process.env.TELEGRAM_LOGIN_EMAIL_DOMAIN ?? 'telegram.local';

// Создаём клиент — если переменные пустые, client всё ещё создастся,
// но мы проверим переменные перед выполнением защищённых действий.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function buildDataCheckString(params: Record<string, string>) {
  return Object.keys(params)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n');
}

async function verifyTelegramPayload(payload: Record<string, any>): Promise<boolean> {
  // Минимальная валидация env
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set.');
    return false;
  }

  const hash = String(payload.hash ?? '');
  if (!hash) return false;

  // Приводим все значения к строкам
  const payloadStrings: Record<string, string> = {};
  for (const k of Object.keys(payload)) {
    payloadStrings[k] = String(payload[k]);
  }

  const dataCheckString = buildDataCheckString(payloadStrings);

  // secret_key = SHA256(bot_token) (raw bytes)
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) {
    console.warn('Telegram payload hash mismatch', { computed, received: hash });
    return false;
  }

  // Проверка freshness (24 часа)
  const now = Math.floor(Date.now() / 1000);
  const authDate = parseInt(String(payload.auth_date ?? '0'), 10);
  if (Number.isNaN(authDate) || now - authDate > 60 * 60 * 24) {
    console.warn('Telegram payload stale', { authDate, now });
    return false;
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const ok = await verifyTelegramPayload(body);
    if (!ok) return NextResponse.json({ error: 'invalid_signature_or_stale' }, { status: 400 });

    const telegramId = String(body.id);
    const email = `tg_${telegramId}@${EMAIL_DOMAIN}`;

    // Проверка Supabase env перед admin операциями
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase URL or service role key is not configured.');
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: SITE_URL + '/' },
    });

    if (linkError) {
      console.error('generateLink error', linkError);
      return NextResponse.json({ error: 'generate_link_failed' }, { status: 500 });
    }

    const action_link =
      (linkData as any)?.action_link ||
      (linkData as any)?.url ||
      (linkData as any)?.actionLink ||
      null;

    if (!action_link) {
      console.error('generateLink returned no action link', linkData);
      return NextResponse.json({ error: 'no_link' }, { status: 500 });
    }

    return NextResponse.json({ action_link });
  } catch (err) {
    console.error('POST /api/auth/telegram error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;

    const ok = await verifyTelegramPayload(params);
    if (!ok) {
      return NextResponse.redirect(`${SITE_URL}/?auth=telegram_invalid`);
    }

    const telegramId = String(params.id);
    const email = `tg_${telegramId}@${EMAIL_DOMAIN}`;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase URL or service role key is not configured.');
      return NextResponse.redirect(`${SITE_URL}/?auth=telegram_error`);
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: SITE_URL + '/' },
    });

    if (linkError) {
      console.error('generateLink error', linkError);
      return NextResponse.redirect(`${SITE_URL}/?auth=telegram_error`);
    }

    const action_link =
      (linkData as any)?.action_link ||
      (linkData as any)?.url ||
      (linkData as any)?.actionLink ||
      null;

    if (!action_link) {
      return NextResponse.redirect(`${SITE_URL}/?auth=telegram_no_link`);
    }

    return NextResponse.redirect(action_link);
  } catch (err) {
    console.error('GET /api/auth/telegram error', err);
    return NextResponse.redirect(`${SITE_URL}/?auth=telegram_error`);
  }
}

// frontend/src/app/api/auth/telegram/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const DEBUG = (process.env.DEBUG_TELEGRAM ?? 'false').toLowerCase() === 'true';

const SUPABASE_URL: string = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY: string = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TELEGRAM_BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SITE_URL: string = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://positive-theta.vercel.app';
const EMAIL_DOMAIN: string = process.env.TELEGRAM_LOGIN_EMAIL_DOMAIN ?? 'telegram.local';

if (DEBUG) {
  console.log('DEBUG /api/auth/telegram', { SUPABASE_URL: !!SUPABASE_URL, HAS_SR_KEY: !!SUPABASE_SERVICE_ROLE_KEY, SITE_URL });
}

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
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set.');
    return false;
  }

  const hash = String(payload.hash ?? '');
  if (!hash) {
    if (DEBUG) console.warn('verifyTelegramPayload: missing hash');
    return false;
  }

  const payloadStrings: Record<string, string> = {};
  for (const k of Object.keys(payload)) payloadStrings[k] = String(payload[k]);

  const dataCheckString = buildDataCheckString(payloadStrings);

  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) {
    console.warn('Telegram payload hash mismatch', { computed, received: hash });
    if (DEBUG) console.warn('dataCheckString', dataCheckString);
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const authDate = parseInt(String(payload.auth_date ?? '0'), 10);
  if (Number.isNaN(authDate) || now - authDate > 60 * 60 * 24) {
    console.warn('Telegram payload stale', { authDate, now });
    return false;
  }

  return true;
}

function extractActionLink(obj: any): string | null {
  if (!obj) return null;

  // common top-level keys
  if (typeof obj === 'string' && obj.startsWith('http')) return obj;
  if (obj.action_link && typeof obj.action_link === 'string') return obj.action_link;
  if (obj.url && typeof obj.url === 'string') return obj.url;
  if (obj.actionLink && typeof obj.actionLink === 'string') return obj.actionLink;

  // some SDK returns nested `properties.action_link`
  if (obj.properties && typeof obj.properties.action_link === 'string') return obj.properties.action_link;
  if (obj.data && typeof obj.data === 'object') {
    if (obj.data.action_link && typeof obj.data.action_link === 'string') return obj.data.action_link;
    if (obj.data.url && typeof obj.data.url === 'string') return obj.data.url;
    if (obj.data.actionLink && typeof obj.data.actionLink === 'string') return obj.data.actionLink;
    if (obj.data.properties && typeof obj.data.properties.action_link === 'string') return obj.data.properties.action_link;
  }

  // sometimes SDK returns { data: { properties: { action_link } } } directly
  if (obj?.data?.properties?.action_link) return obj.data.properties.action_link;
  if (obj?.properties?.action_link) return obj.properties.action_link;

  return null;
}

async function tryGenerateLink(email: string, redirectTo?: string) {
  const results: Array<{ type: string; raw: any; action_link: string | null; error: any }> = [];

  try {
    const resp = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: redirectTo ?? SITE_URL + '/' },
    } as any);
    const raw = resp;
    const action_link = extractActionLink(raw?.data ?? raw);
    results.push({ type: 'magiclink', raw, action_link, error: resp?.error ?? null });
  } catch (e) {
    results.push({ type: 'magiclink', raw: null, action_link: null, error: String(e) });
  }

  try {
    const resp = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: { redirectTo: redirectTo ?? SITE_URL + '/' },
    } as any);
    const raw = resp;
    const action_link = extractActionLink(raw?.data ?? raw);
    results.push({ type: 'signup', raw, action_link, error: resp?.error ?? null });
  } catch (e) {
    results.push({ type: 'signup', raw: null, action_link: null, error: String(e) });
  }

  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    if (DEBUG) console.log('/api/auth/telegram POST body:', body);

    const ok = await verifyTelegramPayload(body);
    if (!ok) return NextResponse.json({ error: 'invalid_signature_or_stale' }, { status: 400 });

    const telegramId = String(body.id);
    const email = `tg_${telegramId}@${EMAIL_DOMAIN}`;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase URL or service role key is not configured.');
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    }

    const genResults = await tryGenerateLink(email, SITE_URL + '/');

    if (DEBUG) console.log('generateLink results:', genResults);

    // return first found action_link
    for (const r of genResults) {
      if (r.action_link) {
        if (DEBUG) console.log('Found action_link in', r.type, r.action_link);
        return NextResponse.json({ action_link: r.action_link, debug: { genResults } });
      }
    }

    // try createUser explicitly then generate again
    let createResult: any = null;
    try {
      const password = crypto.randomBytes(24).toString('hex');
      const createResp = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram: {
            id: body.id,
            username: body.username ?? null,
            first_name: body.first_name ?? null,
            last_name: body.last_name ?? null,
          },
        },
      } as any);
      createResult = createResp;
      if (DEBUG) console.log('createUser result:', createResp);
    } catch (e) {
      createResult = { exception: String(e) };
      if (DEBUG) console.error('createUser threw', e);
    }

    const genAfterCreate = await tryGenerateLink(email, SITE_URL + '/');
    if (DEBUG) console.log('generateLink after createUser:', genAfterCreate);

    for (const r of genAfterCreate) {
      if (r.action_link) {
        if (DEBUG) console.log('Found action_link after createUser in', r.type, r.action_link);
        return NextResponse.json({ action_link: r.action_link, debug: { genResults, createResult, genAfterCreate } });
      }
    }

    // nothing found
    return NextResponse.json(
      {
        error: 'no_link',
        reason: 'generateLink did not return action_link',
        debug: { genResults, createResult: createResult ?? null, genAfterCreate },
      },
      { status: 500 }
    );
  } catch (err) {
    console.error('POST /api/auth/telegram error', err);
    return NextResponse.json({ error: 'internal', detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;

    if (DEBUG) console.log('/api/auth/telegram GET params:', params);

    const ok = await verifyTelegramPayload(params);
    if (!ok) return NextResponse.redirect(`${SITE_URL}/?auth=telegram_invalid`);

    const telegramId = String(params.id);
    const email = `tg_${telegramId}@${EMAIL_DOMAIN}`;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase URL or service role key is not configured.');
      return NextResponse.redirect(`${SITE_URL}/?auth=telegram_error`);
    }

    const genResults = await tryGenerateLink(email, SITE_URL + '/');
    if (DEBUG) console.log('generateLink GET results:', genResults);

    for (const r of genResults) {
      if (r.action_link) return NextResponse.redirect(r.action_link);
    }

    // try createUser then generate
    let createResult: any = null;
    try {
      const password = crypto.randomBytes(24).toString('hex');
      const createResp = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      } as any);
      createResult = createResp;
      if (DEBUG) console.log('createUser result (GET):', createResp);
    } catch (e) {
      createResult = { exception: String(e) };
      if (DEBUG) console.error('createUser threw (GET)', e);
    }

    const genAfterCreate = await tryGenerateLink(email, SITE_URL + '/');
    if (DEBUG) console.log('generateLink after createUser (GET):', genAfterCreate);

    for (const r of genAfterCreate) {
      if (r.action_link) return NextResponse.redirect(r.action_link);
    }

    if (DEBUG) {
      return NextResponse.redirect(`${SITE_URL}/?auth=telegram_no_link&debug=1`);
    }
    return NextResponse.redirect(`${SITE_URL}/?auth=telegram_no_link`);
  } catch (err) {
    console.error('GET /api/auth/telegram error', err);
    return NextResponse.redirect(`${SITE_URL}/?auth=telegram_error`);
  }
}

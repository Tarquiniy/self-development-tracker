// frontend/src/app/api/auth/telegram/callback/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://positive-theta.vercel.app';

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

function verifyTelegramPayload(payload: Record<string, string>) {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const hash = String(payload.hash ?? '');
  if (!hash) return false;

  const dataCheckString = buildDataCheckString(payload);
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) return false;

  const now = Math.floor(Date.now() / 1000);
  const authDate = parseInt(String(payload.auth_date ?? '0'), 10);
  if (Number.isNaN(authDate) || now - authDate > 60 * 60 * 24) return false;

  return true;
}

function extractActionLinkFromResp(resp: any): string | null {
  if (!resp) return null;
  if (resp.data?.properties?.action_link) return resp.data.properties.action_link;
  if (resp.data?.action_link) return resp.data.action_link;
  if (resp.action_link) return resp.action_link;
  if (resp.url) return resp.url;
  return null;
}

async function parseRequestToRecord(req: Request): Promise<Record<string, string>> {
  const headers = Object.fromEntries(req.headers.entries());
  const contentType = (headers['content-type'] ?? headers['Content-Type'] ?? '').toLowerCase();

  // GET handled separately by caller; keep generic for POST
  if (contentType.includes('application/json')) {
    const j = await req.json().catch(() => ({}));
    const out: Record<string, string> = {};
    for (const k of Object.keys(j ?? {})) out[k] = j[k] == null ? '' : String(j[k]);
    return out;
  }

  // form-encoded or multipart
  try {
    const form = await req.formData();
    const out: Record<string, string> = {};
    form.forEach((v, k) => {
      out[k] = v == null ? '' : String(v);
    });
    return out;
  } catch (e) {
    // fallback: no body
    return {};
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;
  return handlePayload(params);
}

export async function POST(req: Request) {
  const payload = await parseRequestToRecord(req);
  return handlePayload(payload);
}

async function handlePayload(payload: Record<string, string>) {
  try {
    // normalize ticket
    const ticket = String(payload['ticket'] ?? '');

    // Minimal validation: need id and hash from Telegram
    if (!payload.id || !payload.hash) {
      const html = `<html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;padding:24px">
        <h2>Неверный ответ Telegram</h2>
        <p>От Telegram не получены обязательные параметры. Попробуйте заново.</p>
      </body></html>`;
      return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
    }

    // verify signature + freshness
    const ok = verifyTelegramPayload(payload);
    if (!ok) {
      const html = `<html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;padding:24px">
        <h2>Не удалось проверить подпись Telegram</h2>
        <p>Данные подписи неверны или устарели (auth_date: ${payload.auth_date ?? 'n/a'}). Попробуйте снова.</p>
      </body></html>`;
      return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
    }

    const telegramId = String(payload.id);
    const email = `tg_${telegramId}@${process.env.TELEGRAM_LOGIN_EMAIL_DOMAIN ?? 'telegram.local'}`;

    // generate magic / signup link via Supabase Admin
    const gen1 = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: SITE_URL + '/' },
    } as any);

    let action_link = extractActionLinkFromResp(gen1?.data ?? gen1);
    if (!action_link) {
      const gen2 = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        options: { redirectTo: SITE_URL + '/' },
      } as any);
      action_link = extractActionLinkFromResp(gen2?.data ?? gen2);
    }

    if (!action_link) {
      // store debug and show page
      const debug = { gen1, note: 'no action_link produced' };
      // try to upsert at least payload and ticket for manual checking
      try {
        if (ticket) {
          await supabaseAdmin.from('telegram_sessions').upsert([{ ticket, telegram_id: telegramId, payload, updated_at: new Date().toISOString() }]);
        }
      } catch (e) {
        // ignore
      }
      const html = `<html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;padding:24px"><h2>Не удалось сгенерировать ссылку входа</h2><pre style="background:#f6f8fa;padding:12px;border-radius:8px">${JSON.stringify(debug,null,2)}</pre></body></html>`;
      return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
    }

    // save action_link into telegram_sessions (if table exists). ignore errors.
    try {
      if (ticket) {
        await supabaseAdmin
          .from('telegram_sessions')
          .upsert([{ ticket, telegram_id: telegramId, payload, action_link, updated_at: new Date().toISOString() }]);
      }
    } catch (e) {
      // ignore DB errors for robustness
      console.warn('telegram callback: upsert failed', e);
    }

    // Success: return HTML that tries to notify opener and shows a visible button
    const safeAction = action_link.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const origin = SITE_URL || '/';
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Завершение входа — Telegram</title></head>
<body style="font-family:system-ui,Segoe UI,Roboto,Arial;padding:24px;color:#0f1724">
  <h1>Готово</h1>
  <p>Мы пытаемся передать результат в основное окно. Если вход не завершился автоматически, нажмите кнопку ниже.</p>
  <p><a id="actionBtn" href="${safeAction}" class="btn" target="_blank" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#006db3;color:#fff;text-decoration:none;font-weight:700">Завершить вход</a></p>
  <p style="color:#64748b">Если кнопка не сработает, скопируйте ссылку вручную:</p>
  <pre style="background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto">${safeAction}</pre>
<script>
(function(){
  const action = ${JSON.stringify(action_link)};
  const origin = ${JSON.stringify(origin)};
  function tryPostMessage(targetOrigin){
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type:'telegram_auth', action_link: action }, targetOrigin);
        console.log('popup: postMessage sent', targetOrigin);
        return true;
      }
    } catch(e){
      console.warn('popup: postMessage error', e);
    }
    return false;
  }
  function trySetOpenerLocation(){
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.location.href = action;
        console.log('popup: set opener.location.href');
        return true;
      }
    } catch(e){
      console.warn('popup: set opener.location error', e);
    }
    return false;
  }
  const delivered = tryPostMessage(origin) || tryPostMessage('*') || trySetOpenerLocation();
  if (delivered) {
    try { setTimeout(()=>{ window.close(); }, 700); } catch(e){}
  }
})();
</script>
</body></html>`;

    return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
  } catch (err) {
    const body = `<html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;padding:24px"><h2>Internal error</h2><pre>${String(err)}</pre></body></html>`;
    return new NextResponse(body, { status: 500, headers: { 'content-type': 'text/html' } });
  }
}

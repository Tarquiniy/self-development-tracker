// frontend/src/app/api/auth/telegram/popup/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';

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

async function verify(payload: Record<string, any>) {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const hash = String(payload.hash ?? '');
  if (!hash) return false;
  const payloadStrings: Record<string, string> = {};
  for (const k of Object.keys(payload)) payloadStrings[k] = String(payload[k]);
  const dataCheckString = buildDataCheckString(payloadStrings);
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

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  let payload: Record<string, any> = {};
  if (contentType.includes('application/json')) {
    payload = await req.json();
  } else {
    const formData = await req.formData();
    formData.forEach((v, k) => { payload[k] = String(v); });
  }
  return handlePayload(payload);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;
  return handlePayload(params);
}

async function handlePayload(payload: Record<string, any>) {
  try {
    // validation
    if (!payload || typeof payload !== 'object' || !payload.id || !payload.hash) {
      const html = `<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:28px">
        <h2>Telegram: неверные данные</h2>
        <p>Неполный ответ от Telegram. Попробуйте снова или откройте страницу входа вручную.</p>
        </body></html>`;
      return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
    }

    const ok = await verify(payload);
    if (!ok) {
      const html = `<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:28px">
        <h2>Не удалось проверить подпись Telegram</h2>
        <p>Данные подписи неверны или устарели. Попробуйте снова. (auth_date: ${payload.auth_date ?? 'n/a'})</p>
        </body></html>`;
      return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
    }

    const telegramId = String(payload.id);
    const email = `tg_${telegramId}@${process.env.TELEGRAM_LOGIN_EMAIL_DOMAIN ?? 'telegram.local'}`;

    // generate magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: SITE_URL || '/' },
    } as any);

    let action_link = extractActionLinkFromResp(linkData ?? linkError ?? null);

    if (!action_link) {
      // try signup fallback
      const { data: linkData2 } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        options: { redirectTo: SITE_URL || '/' },
      } as any);
      action_link = extractActionLinkFromResp(linkData2 ?? null);
    }

    // If still no action_link, show debug
    if (!action_link) {
      const debug = { linkData, linkError };
      const html = `<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:28px">
        <h2>Не удалось сгенерировать ссылку</h2>
        <p>Пожалуйста, сообщите разработчику этот вывод.</p>
        <pre style="background:#f6f8fa;padding:12px;border-radius:8px">${JSON.stringify(debug,null,2)}</pre>
        </body></html>`;
      return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
    }

    // Success: robust delivery + visible fallback button
    const safeAction = action_link.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const origin = SITE_URL || '/';
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Завершение входа — Telegram</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:#0f1724}
    .wrap{max-width:820px;margin:0 auto}
    .btn{display:inline-block;padding:12px 18px;border-radius:10px;background:#006db3;color:#fff;text-decoration:none;font-weight:700}
    .muted{color:#475569;margin-top:12px}
    pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Завершить вход</h1>
    <p>Мы автоматически отправляем результат в основное окно. Если вход не завершился автоматически, нажмите кнопку ниже.</p>

    <p><a id="actionBtn" class="btn" href="${safeAction}" target="_blank" rel="noreferrer">Завершить вход (нажмите здесь)</a></p>

    <p class="muted">Если кнопка не сработает, скопируйте и откройте ссылку вручную:</p>
    <pre id="actionLink">${safeAction}</pre>

    <hr/>
    <h3>Диагностика (dev)</h3>
    <pre id="dbg">Отправляем данные в opener и пытаемся редиректить.</pre>
  </div>

  <script>
    (function(){
      const action = ${JSON.stringify(action_link)};
      const origin = ${JSON.stringify(origin)};

      function tryPostMessage(targetOrigin){
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type:'telegram_auth', action_link: action }, targetOrigin);
            console.log('popup: postMessage sent', targetOrigin);
            const dbg = document.getElementById('dbg');
            if (dbg) dbg.textContent += '\\npostMessage -> ' + targetOrigin;
            return true;
          } else {
            console.warn('popup: opener missing/closed');
            return false;
          }
        } catch(e) {
          console.warn('popup: postMessage error', e);
          const dbg = document.getElementById('dbg');
          if (dbg) dbg.textContent += '\\npostMessage error: ' + String(e);
          return false;
        }
      }

      function trySetOpenerLocation(){
        try {
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.location.href = action;
              console.log('popup: set opener.location.href');
              const dbg = document.getElementById('dbg');
              if (dbg) dbg.textContent += '\\nset opener.location.href';
              return true;
            } catch(e) {
              console.warn('popup: cannot set opener.location (cross-origin)');
              const dbg = document.getElementById('dbg');
              if (dbg) dbg.textContent += '\\nset opener.location error: ' + String(e);
              return false;
            }
          }
        } catch(e) { /* ignore */ }
        return false;
      }

      // try both delivery strategies
      let delivered = false;
      delivered = tryPostMessage(origin) || delivered;
      delivered = tryPostMessage('*') || delivered;
      delivered = trySetOpenerLocation() || delivered;

      // do not auto-close — user needs to click if postMessage failed.
      if (delivered) {
        // still keep the button visible for fail-safe; optionally close after short delay
        setTimeout(()=>{ try{ window.close(); }catch(e){} }, 800);
      }
    })();
  </script>
</body>
</html>`;

    return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
  } catch (err) {
    const html = `<html><body><pre>Internal error: ${String(err)}</pre></body></html>`;
    return new NextResponse(html, { headers: { 'content-type': 'text/html' } });
  }
}

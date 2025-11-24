// frontend/src/app/api/bot/webhook/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const EMAIL_DOMAIN = process.env.TELEGRAM_LOGIN_EMAIL_DOMAIN ?? 'telegram.local';

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/** Возвращает action_link если есть в любой форме ответа generateLink */
function extractActionLinkFromResp(resp: any): string | null {
  if (!resp) return null;
  // shape used by supabase-js admin.generateLink: { data: { properties: { action_link: ... }, user: {...} }, error: null }
  if (resp.data && resp.data.properties && typeof resp.data.properties.action_link === 'string') {
    return resp.data.properties.action_link;
  }
  // older/alternate shapes
  if (resp.data && typeof resp.data.action_link === 'string') return resp.data.action_link;
  if (typeof resp.action_link === 'string') return resp.action_link;
  if (resp.url && typeof resp.url === 'string') return resp.url;
  return null;
}

async function generateActionLinkForEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    // Try magiclink first
    const gen = (await (supabaseAdmin.auth as any).admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: SITE_URL + '/' },
    })) as any;
    let link = extractActionLinkFromResp(gen);
    if (link) return link;

    // fallback to signup
    const gen2 = (await (supabaseAdmin.auth as any).admin.generateLink({
      type: 'signup',
      email,
      options: { redirectTo: SITE_URL + '/' },
    })) as any;
    link = extractActionLinkFromResp(gen2);
    return link;
  } catch (e) {
    console.error('generateActionLinkForEmail error', e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const update = await req.json().catch(() => ({}));
    // We only handle message with /start <nonce>
    const message = update?.message ?? update?.edited_message;
    if (!message) return NextResponse.json({ ok: true });

    const text = typeof message.text === 'string' ? message.text : '';
    if (!text.startsWith('/start')) return NextResponse.json({ ok: true });

    // parse nonce after /start
    const parts = text.trim().split(/\s+/);
    const arg = parts.length > 1 ? parts[1] : (parts[0].includes('_') ? parts[0].split('_')[1] : null);
    const nonce = arg ? String(arg) : null;
    if (!nonce) return NextResponse.json({ ok: true });

    const telegramId = String(message.from?.id ?? message.chat?.id ?? '');

    if (!supabaseAdmin) {
      console.warn('bot webhook: supabaseAdmin not configured');
      return NextResponse.json({ ok: true });
    }

    // find session row by nonce
    const { data: row, error: rowError } = await supabaseAdmin
      .from('telegram_sessions')
      .select('*')
      .eq('nonce', nonce)
      .limit(1)
      .maybeSingle();

    // If no row, create one with nonce and telegram_id
    if (!row) {
      await supabaseAdmin.from('telegram_sessions').insert([{ nonce, telegram_id: telegramId, payload: update }]);
    } else {
      // If we found a session, generate action_link and upsert it
      const email = `tg_${telegramId}@${EMAIL_DOMAIN}`;
      const action_link = await generateActionLinkForEmail(email);

      try {
        await supabaseAdmin.from('telegram_sessions').upsert([
          {
            ticket: row.ticket,
            nonce,
            telegram_id: telegramId,
            payload: update,
            action_link,
            updated_at: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        console.warn('bot webhook: upsert failed', e);
      }

      // Optionally inform user in Telegram that flow is complete
      if (TELEGRAM_BOT_TOKEN) {
        const chatId = telegramId;
        const textReply = action_link
          ? 'Готово. Вернитесь на сайт — вход будет завершён автоматически.'
          : 'Спасибо. Мы получили ваш запрос. Если вход не завершился на сайте, попробуйте повторить.';
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: textReply }),
          });
        } catch (e) {
          console.warn('bot webhook: sendMessage failed', e);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('bot webhook error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

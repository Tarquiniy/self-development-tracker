// frontend/src/app/api/auth/telegram/start/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';
const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function genNonce(): string {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.getRandomValues) {
      const arr = new Uint8Array(12);
      (globalThis as any).crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
    }
  } catch {}
  try {
    // node fallback
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.randomBytes(12).toString('hex');
  } catch {
    return 'n-' + Date.now().toString(36);
  }
}

export async function POST() {
  const nonce = genNonce();
  const ticket = `${nonce}-${Date.now().toString(36)}`;

  // build deep link to bot
  const deepLink = BOT_USERNAME
    ? `https://t.me/${encodeURIComponent(BOT_USERNAME)}?start=${encodeURIComponent(nonce)}`
    : `https://t.me/?start=${encodeURIComponent(nonce)}`;

  // attempt insert and return debug info if fails
  let insertResult: any = null;
  let insertError: any = null;

  if (!supabaseAdmin) {
    insertError = 'supabaseAdmin not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env)';
    console.error('start route:', insertError);
    return NextResponse.json({ ticket, nonce, deepLink, inserted: false, insertError }, { status: 500 });
  }

  try {
    insertResult = await supabaseAdmin
      .from('telegram_sessions')
      .insert([{ ticket, nonce, created_at: new Date().toISOString() }])
      .select('ticket,nonce')
      .limit(1)
      .maybeSingle();
    if (insertResult.error) {
      insertError = insertResult.error?.message ?? insertResult.error;
      console.error('start route: insert error', insertError, insertResult.error);
    }
  } catch (err: any) {
    insertError = String(err);
    console.error('start route: insert threw', insertError);
  }

  const inserted = !insertError && (insertResult?.data ?? insertResult) != null;

  // return debug info so you can inspect Network response
  const resp = { ticket, nonce, deepLink, inserted, insertError, insertResult: inserted ? insertResult.data ?? insertResult : null };
  return NextResponse.json(resp);
}

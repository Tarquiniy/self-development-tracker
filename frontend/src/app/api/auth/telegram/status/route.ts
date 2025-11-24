// frontend/src/app/api/auth/telegram/status/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticket = url.searchParams.get('ticket') ?? '';
  if (!ticket) return NextResponse.json({ error: 'missing_ticket' }, { status: 400 });

  try {
    if (!supabaseAdmin) return NextResponse.json({ action_link: null });
    const { data, error } = await supabaseAdmin.from('telegram_sessions').select('action_link').eq('ticket', ticket).single();
    if (error) return NextResponse.json({ action_link: null });
    return NextResponse.json({ action_link: data?.action_link ?? null });
  } catch (err: any) {
    return NextResponse.json({ action_link: null });
  }
}

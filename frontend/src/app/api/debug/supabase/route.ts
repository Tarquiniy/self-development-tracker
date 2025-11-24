import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  const SUPABASE_ANON =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON ||
    "";

  const mask = (v?: string) =>
    v ? `${v.slice(0, 4)}...${v.slice(-4)} (len=${v.length})` : null;

  const info: any = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY_preview: mask(SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_ANON_preview: mask(SUPABASE_ANON),
    },
  };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    info.note =
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.";
    return NextResponse.json(info, { status: 200 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    info.client_created = true;
  } catch (e) {
    info.createClientError = String(e);
    return NextResponse.json(info, { status: 500 });
  }

  // Проверка RPC или версии (через try/catch)
  try {
    const rpcRes: any = await supabaseAdmin.rpc("version" as any);
    info.rpc_ok = !rpcRes?.error;
    info.rpc = rpcRes?.data ?? rpcRes ?? null;
  } catch (e) {
    info.rpc_error = String(e);
  }

  // Тестовая вставка в telegram_sessions
  const ticket = `dbg-${Date.now().toString(36)}`;
  const nonce = ticket.split("-")[1] ?? ticket;
  info.test_row = { ticket, nonce };

  try {
    const insertRes: any = await supabaseAdmin
      .from("telegram_sessions")
      .insert([{ ticket, nonce, created_at: new Date().toISOString() }])
      .select("ticket,nonce")
      .maybeSingle();

    info.insertResult = insertRes?.data ?? null;
    info.insertError = insertRes?.error
      ? {
          message: insertRes.error.message,
          code: insertRes.error.code,
          details: insertRes.error.details ?? null,
        }
      : null;

    if (!insertRes?.error && insertRes?.data) {
      try {
        const del = await supabaseAdmin
          .from("telegram_sessions")
          .delete()
          .eq("ticket", ticket);
        info.cleanup = del?.error
          ? { message: del.error.message, code: del.error.code }
          : "deleted";
      } catch (e) {
        info.cleanup = "delete_failed: " + String(e);
      }
    }
  } catch (e: any) {
    info.insertException = {
      message: e?.message ?? String(e),
      stack: e?.stack ?? null,
    };
  }

  return NextResponse.json(info, { status: 200 });
}

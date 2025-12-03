// frontend/src/app/api/profiles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function makeAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server env.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

/**
 * Defensive helper: try select single row, return { data, error } where data can be null.
 */
async function selectSingle(table: string, supabase: SupabaseClient, filter: { col: string; val: any }) {
  return supabase.from(table).select("*").eq(filter.col, filter.val).maybeSingle();
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = makeAdminClient();

    const body = await req.json().catch(() => ({}));
    const {
      supabase_uid,
      email,
      full_name,
      first_name,
      last_name,
      about,
      birthday,
      avatar_url,
      consent_given,
      consent_at,
    } = body ?? {};

    if (!email) {
      return NextResponse.json({ error: "missing_email" }, { status: 400 });
    }

    // Normalize names
    const names = (first_name || last_name)
      ? { first_name: first_name ?? "", last_name: last_name ?? "" }
      : (() => {
          const parts = String(full_name ?? "").trim().split(/\s+/).filter(Boolean);
          return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") ?? "" };
        })();

    // 1) Ensure users_customuser exists and is updated
    let userRecord: any = null;

    // Try find by supabase_uid first (if provided)
    if (supabase_uid) {
      const { data: byUidData, error: byUidErr } = await selectSingle("users_customuser", supabaseAdmin, { col: "supabase_uid", val: supabase_uid });
      if (byUidErr) {
        console.error("Error selecting users_customuser by supabase_uid:", byUidErr);
        return NextResponse.json({ error: "db_error_select_by_uid", detail: byUidErr.message }, { status: 500 });
      }
      if (byUidData) {
        userRecord = byUidData;
        // update fields if needed
        const updatePayload: any = {};
        if (email && email !== userRecord.email) updatePayload.email = email;
        if (names.first_name && names.first_name !== userRecord.first_name) updatePayload.first_name = names.first_name;
        if (names.last_name && names.last_name !== userRecord.last_name) updatePayload.last_name = names.last_name;
        if (avatar_url && avatar_url !== userRecord.avatar_url) updatePayload.avatar_url = avatar_url;
        if (Object.keys(updatePayload).length > 0) {
          const { error: updErr } = await supabaseAdmin.from("users_customuser").update(updatePayload).eq("id", userRecord.id);
          if (updErr) {
            console.error("Error updating users_customuser by id:", updErr);
            return NextResponse.json({ error: "db_error_update_user", detail: updErr.message }, { status: 500 });
          }
          // fetch fresh
          const { data: refreshed, error: refErr } = await supabaseAdmin.from("users_customuser").select("*").eq("id", userRecord.id).maybeSingle();
          if (refErr) {
            console.warn("Could not re-select users_customuser after update:", refErr);
          } else {
            userRecord = refreshed ?? userRecord;
          }
        }
      }
    }

    // If not found by uid, try find by email
    if (!userRecord) {
      const { data: byEmailData, error: byEmailErr } = await selectSingle("users_customuser", supabaseAdmin, { col: "email", val: email });
      if (byEmailErr) {
        console.error("Error selecting users_customuser by email:", byEmailErr);
        return NextResponse.json({ error: "db_error_select_by_email", detail: byEmailErr.message }, { status: 500 });
      }
      if (byEmailData) {
        userRecord = byEmailData;
        // ensure supabase_uid is set if we have it
        if (supabase_uid && userRecord.supabase_uid !== supabase_uid) {
          const { error: setUidErr } = await supabaseAdmin.from("users_customuser").update({ supabase_uid }).eq("id", userRecord.id);
          if (setUidErr) {
            console.error("Error setting supabase_uid on users_customuser:", setUidErr);
            // continue — not fatal
          } else {
            // refresh
            const { data: refreshed, error: refErr } = await supabaseAdmin.from("users_customuser").select("*").eq("id", userRecord.id).maybeSingle();
            if (!refErr && refreshed) userRecord = refreshed;
          }
        }
      }
    }

    // If still not found — create new users_customuser
    if (!userRecord) {
      const usernameCandidate = String(email).split("@")[0].slice(0, 150) || `user_${Date.now()}`;

      const insertPayload: any = {
        email,
        username: usernameCandidate,
        first_name: names.first_name ?? "",
        last_name: names.last_name ?? "",
        is_active: true,
        is_staff: false,
        is_superuser: false,
        date_joined: new Date().toISOString(),
        password: "!", // unusable placeholder
        supabase_uid: supabase_uid ?? null,
        registration_method: supabase_uid ? "supabase" : "email",
        avatar_url: avatar_url ?? null,
        bio: about ?? null,
        email_verified: false,
      };

      const { data: insData, error: insErr } = await supabaseAdmin.from("users_customuser").insert([insertPayload]).select().maybeSingle();
      if (insErr) {
        console.error("Error inserting into users_customuser:", insErr);
        return NextResponse.json({ error: "db_error_insert_user", detail: insErr.message }, { status: 500 });
      }
      userRecord = insData;
    }

    // At this point we have userRecord with at least .id
    if (!userRecord || !userRecord.id) {
      return NextResponse.json({ error: "could_not_ensure_user" }, { status: 500 });
    }

    const userId = userRecord.id;

    // 2) Ensure users_userprofile exists and is updated
    // We assume users_userprofile has a column user_id referencing users_customuser.id.
    // Adjust field names if your schema differs.
    const profilePayload: any = {
      user_id: userId,
      about: about ?? null,
      avatar_url: avatar_url ?? null,
      birthday: birthday ?? null,
      use_gravatar: false,
      consent_given: !!consent_given,
      consent_at: consent_at ?? null,
    };

    // Try find profile by user_id
    const { data: existingProfile, error: profileSelErr } = await supabaseAdmin.from("users_userprofile").select("*").eq("user_id", userId).maybeSingle();
    if (profileSelErr) {
      console.error("Error selecting users_userprofile:", profileSelErr);
      return NextResponse.json({ error: "db_error_select_profile", detail: profileSelErr.message }, { status: 500 });
    }

    let profileRecord: any = null;
    if (existingProfile) {
      // update only fields that changed
      const updateFields: any = {};
      for (const k of Object.keys(profilePayload)) {
        // skip user_id
        if (k === "user_id") continue;
        if (profilePayload[k] !== undefined && profilePayload[k] !== existingProfile[k]) {
          updateFields[k] = profilePayload[k];
        }
      }
      if (Object.keys(updateFields).length > 0) {
        const { error: profUpdErr } = await supabaseAdmin.from("users_userprofile").update(updateFields).eq("user_id", userId);
        if (profUpdErr) {
          console.error("Error updating users_userprofile:", profUpdErr);
          return NextResponse.json({ error: "db_error_update_profile", detail: profUpdErr.message }, { status: 500 });
        }
      }
      // refresh
      const { data: refreshedProfile, error: profRefErr } = await supabaseAdmin.from("users_userprofile").select("*").eq("user_id", userId).maybeSingle();
      if (!profRefErr) profileRecord = refreshedProfile;
    } else {
      // insert new profile
      const insertBody = { ...profilePayload };
      const { data: profInsData, error: profInsErr } = await supabaseAdmin.from("users_userprofile").insert([insertBody]).select().maybeSingle();
      if (profInsErr) {
        console.error("Error inserting users_userprofile:", profInsErr);
        return NextResponse.json({ error: "db_error_insert_profile", detail: profInsErr.message }, { status: 500 });
      }
      profileRecord = profInsData;
    }

    return NextResponse.json({
      success: true,
      user: userRecord,
      user_profile: profileRecord ?? null,
    }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in /api/profiles route:", err);
    return NextResponse.json({ error: "internal_server_error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}

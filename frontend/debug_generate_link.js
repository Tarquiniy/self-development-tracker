// frontend/debug_generate_link.js
// usage:
// npm i @supabase/supabase-js@^2 node-fetch@2  (если нужно)
// Then:
// SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node debug_generate_link.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hftzonhygdgdylzsqxuo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '<PUT_KEY_HERE>';
const EMAIL = process.env.TEST_EMAIL || `tg_debug_${Date.now()}@example.test`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

(async () => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('Calling generateLink for', EMAIL);
    const res = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: EMAIL,
      options: { redirectTo: 'https://positive-theta.vercel.app/' },
    });

    console.log('RESULT raw:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Exception', e);
  }
})();

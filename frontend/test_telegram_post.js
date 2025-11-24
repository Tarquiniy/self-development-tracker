// node test_telegram_post.js
// Заполните переменные:
const fetch = require('node-fetch'); // npm i node-fetch@2
const crypto = require('crypto');

const TELEGRAM_BOT_TOKEN = '8003162562:AAH2Dt4ASv44kZYzCH6wHvvDWAeSRW2tqg8';
const SITE_ORIGIN = 'https://positive-theta.vercel.app';
const ENDPOINT="https://positive-theta.vercel.app/api/auth/telegram";

// Поддельные поля как их отдаёт виджет
const payload = {
    id: '123456789',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    auth_date: Math.floor(Date.now() / 1000).toString()
};

// build data_check_string
const entries = Object.keys(payload).sort().map(k => `${k}=${payload[k]}`);
const dataCheckString = entries.join('\n');

// secret key = SHA256(bot_token)
const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

payload.hash = hmac;

(async () => {
    console.log('Sending payload to', ENDPOINT);
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
})();

// frontend/next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'cs88500-wordpress-o0a99.tw1.ru',
      'sdracker.onrender.com',
      'fjqbhcmsqypevfbpzcxj.supabase.co',
      'sdtracker.vercel.app',
    ],
  },
  // Убедитесь, что эта опция совместима с вашим хостингом
   output: 'standalone',
};

module.exports = withPWA(nextConfig);
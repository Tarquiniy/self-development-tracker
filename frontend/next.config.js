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
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.warn(
        '⚠️ NEXT_PUBLIC_API_URL не задан! Rewrites будут отключены.'
      );
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = withPWA(nextConfig);

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', 
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Self Development Tracker',
        short_name: 'SelfDev Tracker',
        description: 'Приложение для отслеживания прогресса саморазвития',
        theme_color: '#3b82f6',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://self-development-tracker.onrender.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: '../backend/staticfiles',  // Путь куда собирается статика
    emptyOutDir: true,
  }
})
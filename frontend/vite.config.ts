import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
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
      target: env.VITE_API_BASE_URL || 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('Proxy error:', err);
            });
            proxy.on('proxyReq', (_proxyReq, req, _res) => {
  console.log('Sending Request to the Target:', req.method, req.url);
});
proxy.on('proxyRes', (proxyRes, req, _res) => {
  console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
});
          },
        },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          }
        }
      },
      outDir: 'dist',
    },
    define: {
      'process.env': {},
      'global': 'globalThis',
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
  }
})
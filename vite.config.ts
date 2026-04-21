import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Aura Tracker',
        short_name: 'Aura',
        description: 'Crypto Arbitrage Profit Tracker',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/economia\.awesomeapi\.com\.br\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'exchange-rates', expiration: { maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      // Em desenvolvimento local, redireciona /api/* para o proxy Express
      // Em produção (Vercel) as Serverless Functions tratam /api/* diretamente
      '/api/bingx': { target: 'http://localhost:3001', changeOrigin: true },
      '/api/gate':  { target: 'http://localhost:3001', changeOrigin: true },
      '/api/mexc':  { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})

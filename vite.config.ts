import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Ensure these files exist in your /public folder!
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'vite.svg'],
      devOptions: {
        enabled: true, // CRITICAL: Enables PWA install on Localhost
        type: 'module',
      },
      manifest: {
        name: 'BOX-V2 Referee System',
        short_name: 'BOX-V2',
        description: 'Professional Sports Referee & Scoring Interface',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/', // Changed from /tablet/standalone to / to avoid scope errors
        scope: '/',
        orientation: 'landscape',
        icons: [
          {
            src: 'pwa-192x192.png', // Must be a PNG
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png', // Must be a PNG
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'vite.svg'],
      manifest: {
        name: 'BOX-V2 Controller',
        short_name: 'BOX-V2',
        description: 'Offline Sports Controller Unit',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',      // Removes the browser URL bar
        orientation: 'landscape',   // Forces landscape mode
        start_url: '/',
        icons: [
          {
            src: 'vite.svg',        // Placeholder icon (we can swap later)
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        // This regex tells the app to cache ALL code and styles for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
});
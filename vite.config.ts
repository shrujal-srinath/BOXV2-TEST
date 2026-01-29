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
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        // This regex tells the app to cache ALL code and styles for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Ensure large service worker files don't break the build
        maximumFileSizeToCacheInBytes: 5000000 
      }
    })
  ],
  build: {
    // FIX: Resolves the "Adjust chunk size limit" warning on Vercel
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // FIX: Implements code-splitting to keep main bundle small
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
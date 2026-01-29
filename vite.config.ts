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
        display: 'standalone',      
        orientation: 'landscape',   
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
        // Cache limit increased to 5MB for large sports assets
        maximumFileSizeToCacheInBytes: 5000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  build: {
    // FIX: Silences Vercel chunk size warnings
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // FIX: Optimized code splitting for Dashboard/Tablet pages
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ScreenCast Phone',
        short_name: 'ScreenCast',
        description: 'Share your phone screen to PC over WiFi',
        theme_color: '#080f1a',
        background_color: '#080f1a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  base: '/screencast/', // GitHub Pages repo name — update to match your repo
  build: { outDir: 'dist' },
});

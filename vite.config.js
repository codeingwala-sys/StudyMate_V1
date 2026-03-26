import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest lets us use our custom SW with workbox imports
      strategies:   'injectManifest',
      srcDir:       'src',
      filename:     'sw-custom.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions:   { enabled: true, type: 'module' },

      includeAssets: ['icons/*.png', 'icons/*.svg'],

      workbox: {
        // Files to precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },

      manifest: {
        name:             'StudyMate',
        short_name:       'StudyMate',
        description:      'AI-powered study companion — notes, timer, practice tests',
        theme_color:      '#000000',
        background_color: '#000000',
        display:          'standalone',
        orientation:      'portrait',
        scope:            '/',
        start_url:        '/',
        categories:       ['education', 'productivity'],
        icons: [
          // PNG — required by Android
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          // SVG fallbacks
          { src: '/icons/icon-72x72.svg',   sizes: '72x72',   type: 'image/svg+xml' },
          { src: '/icons/icon-96x96.svg',   sizes: '96x96',   type: 'image/svg+xml' },
          { src: '/icons/icon-128x128.svg', sizes: '128x128', type: 'image/svg+xml' },
          { src: '/icons/icon-144x144.svg', sizes: '144x144', type: 'image/svg+xml' },
          { src: '/icons/icon-152x152.svg', sizes: '152x152', type: 'image/svg+xml' },
          { src: '/icons/icon-384x384.svg', sizes: '384x384', type: 'image/svg+xml' },
          { src: '/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
        screenshots: [
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', form_factor: 'narrow' },
        ],
      },
    }),
  ],
})
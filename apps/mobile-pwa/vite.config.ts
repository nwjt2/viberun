import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base` is the public path prefix under which the PWA is served.
//   - localhost dev: '/'
//   - GitHub Pages (project site): '/<repo-name>/', set via VITE_BASE_PATH
//     env var in .github/workflows/pages.yml
// The PWA's router picks this up via import.meta.env.BASE_URL (Vite
// automatically mirrors `base` into that env var).
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Viberun',
        short_name: 'Viberun',
        description: 'Vibe code while you run.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0b0f14',
        theme_color: '#0b0f14',
        icons: [
          { src: `${base}icon-192.png`.replace(/\/+/g, '/'), sizes: '192x192', type: 'image/png' },
          { src: `${base}icon-512.png`.replace(/\/+/g, '/'), sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Dev proxy to the companion's local HTTP port. Prod deploys either
      // talk to Supabase directly (mode=supabase) or to the companion via a
      // runtime-configured absolute URL — see lib/jobs.ts `getCompanionBaseUrl`.
      '/api/companion': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/companion/, ''),
      },
    },
  },
});

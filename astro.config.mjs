// spec: 3.1 (Astro, Workers adapter, Tailwind, prefetch), P-01, intent 12.4 (WhatsApp fallback)
import { defineConfig, envField, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static', // on-demand sirf jahan `export const prerender = false`
  adapter: cloudflare({
    // Tasveerein pehle se WebP; build/runtime par processing nahin (sharp/Images binding nahin)
    imageService: 'passthrough',
  }),
  // Admin login apni signed cookie se (spec 9.2); Astro sessions/KV ki zaroorat nahin
  session: { driver: sessionDrivers.null() },
  prefetch: { prefetchAll: true, defaultStrategy: 'tap' },
  env: {
    schema: {
      // Build ke waqt ka fallback; asal number hamesha /api/settings se (intent 7.1, 12.4)
      PUBLIC_WHATSAPP_FALLBACK: envField.string({
        context: 'client',
        access: 'public',
        default: '03404905266',
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

// spec: 3.1 (Astro, Workers adapter, Tailwind, prefetch), P-01, intent 12.4 (WhatsApp fallback), F04-AC11 (Turnstile site key),
//       4.4 + P-11 (job tasveerein `img.<domain>` se: PUBLIC_IMG_BASE), F21-AC3/AC4/AC6 (site URL: sitemap, robots, OG)
import { defineConfig, envField, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// F21: canonical, OG, sitemap aur robots ke liye poora address. Asal domain Qadam 18 mein `SITE_URL` env se (Q-03).
const SITE = (process.env.SITE_URL || 'http://localhost:4321').replace(/\/+$/, '');

/** F21-AC4: build ke baad dist ki robots.txt mein "Sitemap:" line (domain build par tay hota hai) */
function robotsSitemap() {
  let clientDir;
  return {
    name: 'gvs-robots-sitemap',
    hooks: {
      'astro:config:done': ({ config }) => {
        clientDir = config.build.client;
      },
      'astro:build:done': () => {
        const file = new URL('robots.txt', clientDir);
        if (!existsSync(file)) return;
        const txt = readFileSync(file, 'utf8').replace(/^Sitemap:.*$/gm, '').trimEnd();
        writeFileSync(file, `${txt}\nSitemap: ${SITE}/sitemap.xml\n`);
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  output: 'static', // on-demand sirf jahan `export const prerender = false`
  integrations: [preact(), robotsSitemap()], // spec 3.1: Preact islands (cart, quiz, mock, track, admin)
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
      // F04-AC11: Turnstile site key public hai. Default = Cloudflare ki "hamesha pass" TEST key;
      // production build par asal key env se (Qadam 17/18).
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        default: '1x00000000000000000000AA',
      }),
      // 4.4 + P-11: R2 custom domain (maslan https://img.<domain>). Khali = job page par tasveer nahin, sirf
      // "Ishtihar dekhein" link (local/dev; koi /img route nahin — Qadam 13a faisla 2a). Qadam 18 mein asal value.
      PUBLIC_IMG_BASE: envField.string({
        context: 'client',
        access: 'public',
        default: '',
      }),
      // F23 + Q-02: GA4 Measurement ID (G-XXXX). Khali = analytics band, koi request nahin (owner ka faisla Qadam 15b:
      // account abhi nahin; Qadam 18 mein).
      PUBLIC_GA_ID: envField.string({
        context: 'client',
        access: 'public',
        default: '',
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

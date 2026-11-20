// spec: F24-AC6, SA9 (Cron Trigger har 15 min → `scheduled`; P-04), 3.1 (Astro Workers adapter ka `handle` = har request)
// Worker ka asal entry (wrangler.toml `main`). `fetch` bilkul adapter wala; `scheduled` sirf maintenance chalata hai.
// Log mein sirf ginti (naam/phone kabhi nahin, qaida 11).
import { handle } from '@astrojs/cloudflare/handler';
import { runMaintenance } from './lib/maintenance';

export default {
  fetch: handle,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runMaintenance(env, new Date(controller.scheduledTime)).then((r) => {
        console.log('maintenance', JSON.stringify(r));
      }),
    );
  },
} satisfies ExportedHandler<Cloudflare.Env>;

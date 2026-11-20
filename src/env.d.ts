// spec: 3.1 (Workers bindings), 9.2 Secrets. `cloudflare:workers` ke `env` ki types.
// Secrets sirf .dev.vars (local) / Cloudflare secret (production) mein; yahan sirf naam.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** spec 4.4: job tasveerein (E22) */
    IMAGES: R2Bucket;
    TURNSTILE_SECRET?: string;
    SESSION_SECRET?: string;
    /** F07-AC5: sirf secret (.dev.vars / Cloudflare), kam az kam 12 harf */
    ADMIN_PASSWORD?: string;
  }
}

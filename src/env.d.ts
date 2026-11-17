// spec: 3.1 (Workers bindings), 9.2 Secrets. `cloudflare:workers` ke `env` ki types.
// Secrets sirf .dev.vars (local) / Cloudflare secret (production) mein; yahan sirf naam.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TURNSTILE_SECRET?: string;
    SESSION_SECRET?: string;
  }
}

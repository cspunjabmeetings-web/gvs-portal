// spec: F04-AC11 (Turnstile order form khulne par lazy-load; home ke JS budget mein nahin), P-09
// Load ya token na mile to null: CartBar F05 ka seedha-WhatsApp rasta dikhata hai.
import { PUBLIC_TURNSTILE_SITE_KEY } from 'astro:env/client';

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi | null> | null = null;

function load(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    const timer = setTimeout(() => resolve(null), 10_000);
    s.onload = () => {
      clearTimeout(timer);
      resolve(window.turnstile ?? null);
    };
    s.onerror = () => {
      clearTimeout(timer);
      loading = null; // agli dafa dobara koshish
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Ek widget: token ka intezar, istemal ke baad reset (token ek dafa chalta hai) */
export class TurnstileWidget {
  private id: string | null = null;
  private token: string | null = null;
  private failed = false;
  private waiters: ((t: string | null) => void)[] = [];

  private el: HTMLElement | null = null;

  /** Naya element ho (form dobara bana) to purana widget hata kar naya */
  async mount(el: HTMLElement) {
    if (this.el === el) return;
    this.el = el;
    const api = await load();
    if (!api) return this.settle(null, true);
    if (this.el !== el) return;
    if (this.id) {
      try {
        api.remove(this.id);
      } catch {
        /* pehle se hata */
      }
      this.id = null;
      this.token = null;
      this.failed = false;
    }
    try {
      this.id = api.render(el, {
        sitekey: PUBLIC_TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        size: 'flexible',
        callback: (t: string) => this.settle(t),
        'error-callback': () => this.settle(null, true),
        'expired-callback': () => (this.token = null),
      });
    } catch {
      this.settle(null, true);
    }
  }

  private settle(t: string | null, failed = false) {
    this.token = t;
    this.failed = failed;
    this.waiters.splice(0).forEach((w) => w(t));
  }

  /** Token ka intezar (zyada se zyada `ms`); na mile to null */
  getToken(ms = 8000): Promise<string | null> {
    if (this.token) return Promise.resolve(this.token);
    if (this.failed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      this.waiters.push((t) => {
        clearTimeout(timer);
        resolve(t);
      });
    });
  }

  /** Token istemal ho gaya: naya lo */
  reset() {
    this.token = null;
    this.failed = false;
    if (this.id && window.turnstile) window.turnstile.reset(this.id);
  }
}

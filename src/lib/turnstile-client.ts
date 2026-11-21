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
  /** 17b: aakhri ghalti ka code (fallback paigham mein "Wajah" ke liye; koi zaati maloomat nahin) */
  private lastCode: string | null = null;
  private waiters: ((t: string | null) => void)[] = [];

  private el: HTMLElement | null = null;

  /** Naya element ho (form dobara bana) to purana widget hata kar naya */
  async mount(el: HTMLElement) {
    if (this.el === el) return;
    this.el = el;
    const api = await load();
    if (!api) {
      this.lastCode = 'load';
      return this.settle(null, true);
    }
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
        // 17b: Turnstile khud dobara koshish karta hai (retry auto) — har ghalti par haar na maano, 3 s baad dobara
        'retry-interval': 3000,
        callback: (t: string) => {
          this.lastCode = null;
          this.settle(t);
        },
        'error-callback': (code?: string) => {
          this.lastCode = String(code ?? 'error');
          // 110xxx = site key/domain ki ghalti (config): dobara koshish bekar → foran F05. Baqi: intezar jari (getToken ki had tak).
          if (/^110\d{3}$/.test(this.lastCode)) this.settle(null, true);
          return true;
        },
        'expired-callback': () => (this.token = null),
      });
    } catch {
      this.lastCode = 'render';
      this.settle(null, true);
    }
  }

  /** Token na mila to kyun: Turnstile ka code, 'load', 'render' ya 'timeout' */
  failureCode(): string {
    return this.lastCode ?? 'timeout';
  }

  private settle(t: string | null, failed = false) {
    this.token = t;
    this.failed = failed;
    this.waiters.splice(0).forEach((w) => w(t));
  }

  /** Abhi token tayyar hai? (button par "hifazati jaanch" ka paigham dikhane ke liye) */
  hasToken(): boolean {
    return !!this.token;
  }

  /**
   * Token ka intezar (zyada se zyada `ms`); na mile to null.
   * Qadam 17b: 8 s → 25 s. Phone ke network par Turnstile 8 s se zyada leta tha aur dheema hone par hi F05 rasta khul
   * jata tha (F04-AC11: F05 sirf kharabi par). Asal kharabi (`error-callback`, load fail) par ab bhi foran null.
   */
  getToken(ms = 25_000): Promise<string | null> {
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
    this.lastCode = null;
    if (this.id && window.turnstile) window.turnstile.reset(this.id);
  }
}

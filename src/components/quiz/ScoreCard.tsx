// spec: F13-AC5 (score, streak, kamzor mazmoon; share, ghalat dobara, "Kal phir aayein" + pack), design.md ScoreCard (streak amber SVG)
// Alfaz: intent 27 aur qaida 10 — bare wade wale alfaz nahin (banned-words golden test).
import type { ComponentChildren } from 'preact';

/** Catalog se (usool 7: wada wohi jo catalog mein) */
export interface Pack {
  name: string;
  /** catalog `includes` ki pehli line */
  line: string;
  price: string;
  href: string;
}

export default function ScoreCard(p: {
  score: number;
  total: number;
  streak: number;
  weakSubject: string | null;
  shareHref: string;
  onRetryWrong: (() => void) | null;
  pack: Pack | null;
  note?: ComponentChildren;
}) {
  return (
    <section class="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-center" aria-label="Nateeja" data-score-card>
      <div class="flex h-32 w-32 flex-col items-center justify-center rounded-full border-8 border-primary">
        <span class="tabular text-4xl font-bold" data-score>
          {p.score}/{p.total}
        </span>
      </div>
      {p.note}
      {p.streak > 0 && (
        <p class="flex items-center gap-2 font-semibold" data-streak>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="text-accent">
            <path fill="currentColor" d="M12 2c1 3.5-1.5 5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.3 2.2-3.2C17.6 11 19 13.4 19 16a7 7 0 0 1-14 0c0-4.6 4-7.2 7-14z" />
          </svg>
          <span>
            Aap <span class="tabular">{p.streak}</span> din se lagatar test de rahe hain
          </span>
        </p>
      )}
      {p.weakSubject && (
        <p class="text-sm" data-weak>
          Aap ka sab se kamzor mazmoon: <strong>{p.weakSubject}</strong>
        </p>
      )}
      <div class="flex w-full flex-col gap-2">
        <a href={p.shareHref} target="_blank" rel="noopener" class="flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 font-semibold text-on-primary no-underline" data-share>
          WhatsApp par share karein
        </a>
        {p.onRetryWrong && (
          <button type="button" onClick={p.onRetryWrong} class="min-h-[44px] rounded-lg border border-border px-4 font-semibold" data-retry>
            Ghalat sawal dobara karein
          </button>
        )}
      </div>
      <p class="font-semibold">Kal phir aayein — naye 10 sawal.</p>
      {p.pack && (
        <a href={p.pack.href} class="flex w-full flex-col rounded-xl bg-accent p-3 text-on-accent no-underline" data-pack>
          <span class="font-bold">{p.pack.name}</span>
          <span class="text-sm">
            {p.pack.line} · {p.pack.price}
          </span>
        </a>
      )}
    </section>
  );
}

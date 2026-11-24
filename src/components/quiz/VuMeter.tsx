// spec: F31-AC2 — tayyari meter (gol), bina rang ke bhi parha jaye (feesad + alfaz)
import type { VuReady } from '../../lib/vu-progress';

const R = 52;
const C = 2 * Math.PI * R;

export default function VuMeter(p: { ready: VuReady; title: string }) {
  const { right, total, percent, testsDone, testsLeft } = p.ready;
  const tone = percent >= 80 ? 'text-correct' : percent >= 50 ? 'text-primary' : 'text-accent';
  const line = !testsDone
    ? 'Pehla test dein, tayyari yahan nazar aaye gi.'
    : percent >= 80
      ? 'Zabardast! Tayyari mazboot hai.'
      : percent >= 50
        ? 'Acha ja rahe hain. Thori mehnat aur.'
        : 'Shuruaat ho gayi. Ghalat sawal dobara dekhein.';
  return (
    <section class="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4" aria-label={p.title} data-vu-meter={percent}>
      <div class="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" stroke-width="12" />
          {percent > 0 && <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-dasharray={`${(percent / 100) * C} ${C}`} class={tone} />}
        </svg>
        <p class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="tabular text-2xl font-bold">{percent}%</span>
          <span class="text-xs text-muted">tayyari</span>
        </p>
      </div>
      <div class="min-w-0">
        <p class="font-bold">{p.title}</p>
        <p class="tabular text-sm" data-vu-meter-line>
          {total} mein se {right} sawal sahih
        </p>
        <p class="tabular text-sm text-muted">{testsLeft === 0 ? 'Saare tests ho gaye ✓' : `${testsLeft} ${testsLeft === 1 ? 'test baqi hai' : 'tests baqi hain'}`}</p>
        <p class="mt-1 text-sm font-semibold">{line}</p>
      </div>
    </section>
  );
}

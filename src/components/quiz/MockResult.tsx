// spec: F15-AC6 (score, feesad, waqt, mazmoon-war result, har sawal ka jawab + tashreeh, kamzor mazmoon ke pack ki peshkash, share),
//       design.md 6.7 (score/feesad/waqt, mazmoon-war bars, har sawal ki tashreeh accordion, pack, share, `result` ad), intent 11.3, 27 (hosla afzai)
// Pack sirf catalog se (usool 7). Share mein koi naam/phone nahin (qaida 11).
import { useState } from 'preact/hooks';
import type { QuizMcq } from '../../lib/daily';
import { formatClock, reviewItems, scoreMock, shareText, weakestOf, type MockProgress, type ReviewStatus } from '../../lib/mock-engine';
import { slugify } from '../../lib/slug';
import type { Pack } from './ScoreCard';

const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline';
const LETTERS = 'ABCDE';
type Filter = 'all' | 'wrong' | 'skipped';
const MARK: Record<ReviewStatus, { icon: string; cls: string; label: string }> = {
  right: { icon: '✓', cls: 'text-correct', label: 'sahih' },
  wrong: { icon: '✕', cls: 'text-wrong', label: 'ghalat' },
  skipped: { icon: '–', cls: 'text-muted', label: 'chhora' },
};

export default function MockResult(p: {
  name: string;
  slug: string;
  progress: MockProgress;
  items: QuizMcq[];
  usedMs: number;
  auto: boolean;
  pack: Pack | null;
  onAgain: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const s = scoreMock(p.progress, p.items);
  const review = reviewItems(p.progress, p.items);
  const weak = weakestOf(s.bySubject);
  const counts = { all: review.length, wrong: review.filter((r) => r.status === 'wrong').length, skipped: review.filter((r) => r.status === 'skipped').length };
  const shown = filter === 'all' ? review : review.filter((r) => r.status === filter);
  const url = `${location.origin}/mock-tests/${p.slug}`;
  const cheer = s.percent >= 70 ? 'Shabash! Bohat acha nateeja.' : s.percent >= 40 ? 'Acha hai. Kamzor mazmoon par thori aur mehnat karein.' : 'Koi baat nahin. Tashreeh parh kar dobara dein.';

  const chip = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      aria-pressed={filter === f}
      class={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${filter === f ? 'bg-primary text-on-primary' : 'border border-border'}`}
      data-filter={f}
    >
      {label} ({counts[f]})
    </button>
  );

  return (
    <section class="flex flex-col gap-5" data-mock data-mock-result>
      <div class="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-center">
        <p class="font-semibold" role="status">
          {p.auto ? 'Waqt khatam. Test khud jama ho gaya.' : 'Test jama ho gaya.'}
        </p>
        <div class="flex h-32 w-32 flex-col items-center justify-center rounded-full border-8 border-primary">
          <span class="tabular text-3xl font-bold" data-mock-score>
            {s.score}/{s.total}
          </span>
          <span class="tabular text-sm text-muted" data-mock-percent>
            {s.percent}%
          </span>
        </div>
        <p class="text-sm text-muted">
          Waqt laga:{' '}
          <span class="tabular font-semibold text-text" data-mock-used>
            {formatClock(p.usedMs)}
          </span>
        </p>
        <p class="font-semibold">{cheer}</p>
      </div>

      <section class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4" aria-labelledby="subj-h">
        <h2 id="subj-h" class="text-lg">
          Mazmoon-war nateeja
        </h2>
        <ul class="flex flex-col gap-3" data-subjects>
          {Object.entries(s.bySubject).map(([name, [ok, total]]) => {
            const pct = total ? Math.round((ok / total) * 100) : 0;
            const isWeak = name === weak;
            return (
              <li key={name} class="flex flex-col gap-1" data-subject-row={name}>
                <p class="flex justify-between gap-2 text-sm">
                  <span class={isWeak ? 'font-semibold' : ''}>
                    {name}
                    {isWeak && <span class="ml-1 text-xs text-accent-text">(sab se kamzor)</span>}
                  </span>
                  <span class="tabular font-semibold">
                    {ok}/{total}
                  </span>
                </p>
                <div class="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${name}: ${ok} mein se ${total}, ${pct}%`}>
                  <div class={`h-full ${isWeak ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        {weak && (
          <a href={`/mcqs/${slugify(weak, 'mazmoon')}`} class={`${btn} border border-border`} data-weak-practice>
            {weak} ki muft practice karein
          </a>
        )}
      </section>

      {p.pack && (
        <a href={p.pack.href} class="flex flex-col rounded-xl bg-accent p-4 text-on-accent no-underline" data-pack>
          <span class="text-sm">{weak ? `${weak} aur doosre mazameen ke liye` : 'Mazeed tayyari ke liye'}</span>
          <span class="font-bold">{p.pack.name}</span>
          <span class="text-sm">
            {p.pack.line} · {p.pack.price}
          </span>
        </a>
      )}

      <div class="flex flex-col gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText(p.name, s, url))}`} target="_blank" rel="noopener" class={`${btn} bg-primary text-on-primary`} data-share>
          WhatsApp par share karein
        </a>
        <button type="button" onClick={p.onAgain} class={`${btn} border border-border`} data-mock-again>
          Dobara dein
        </button>
        <a href="/mock-tests" class={`${btn} border border-border`}>
          Doosre mock tests
        </a>
      </div>

      <section class="flex flex-col gap-3" aria-labelledby="review-h">
        <h2 id="review-h" class="text-lg">
          Har sawal ka jawab
        </h2>
        <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {chip('all', 'Sab')}
          {chip('wrong', 'Ghalat')}
          {chip('skipped', 'Chhore')}
        </div>
        {shown.length === 0 && <p class="text-muted">Is qism ka koi sawal nahin.</p>}
        <ol class="flex flex-col gap-2" data-review>
          {shown.map((r) => {
            const m = MARK[r.status];
            return (
              <li key={r.q.id} data-review-item={r.status}>
                <details class="rounded-xl border border-border bg-surface">
                  <summary class="flex min-h-[44px] cursor-pointer items-start gap-2 p-3">
                    <span class={`w-5 shrink-0 font-bold ${m.cls}`} aria-hidden="true">
                      {m.icon}
                    </span>
                    <span class="flex-1">
                      <span class="tabular text-muted">{r.n}.</span> {r.q.question}
                      <span class="sr-only"> ({m.label})</span>
                    </span>
                  </summary>
                  <div class="flex flex-col gap-2 border-t border-border p-3 text-sm">
                    <ul class="flex flex-col gap-1">
                      {r.q.options.map((o, i) => {
                        const right = i === r.q.answerIndex;
                        const mine = i === r.picked;
                        return (
                          <li key={i} class={right ? 'font-semibold text-correct' : mine ? 'font-semibold text-wrong' : ''}>
                            {LETTERS[i]}) {o}
                            {right && ' ✓ sahih jawab'}
                            {mine && !right && ' ✕ aap ka jawab'}
                          </li>
                        );
                      })}
                    </ul>
                    {r.status === 'skipped' && <p class="text-muted">Aap ne yeh sawal chhor diya tha.</p>}
                    {r.q.explanation && <p class="rounded-lg bg-surface-2 p-2">Tashreeh: {r.q.explanation}</p>}
                    <p class="text-xs text-muted">{r.q.subject}</p>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </section>
  );
}

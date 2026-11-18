// spec: S16 /mcqs/<mazmoon> (10 sawalon ka set, "Agla set", set ke baad `result` ad), F14-AC2..AC4, F13-AC3 jaisa jawab (koi network nahin),
//       F13-AC6 jaisa bookmark + "Ghalti batayen". Owner ka faisla: practice ka score history mein nahin (sirf bookmarks).
import { useEffect, useState } from 'preact/hooks';
import type { QuizMcq } from '../../lib/daily';
import { loadHistory, toggleBookmark, updateHistory, HISTORY_EVENT, type History } from '../../lib/history';
import { track } from '../../lib/analytics';
import { waLink } from '../../lib/phone';
import { cachedSettings, refreshSettings, whatsappNumber } from '../../lib/site-settings';
import QuizCard from './QuizCard';
import ProgressBar from './ProgressBar';
import type { Pack } from './ScoreCard';

export interface PracticeSet {
  items: QuizMcq[];
  hasMore: boolean;
  total: number;
  offset: number;
}

const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';

function showResultAd(show: boolean) {
  const el = document.querySelector<HTMLElement>('[data-result-ad]');
  if (el) el.hidden = !show;
}

export default function Practice(p: { subject: string; slug: string; initial: PracticeSet; pack: Pack | null }) {
  const [set, setSet] = useState<PracticeSet>(p.initial);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => p.initial.items.map(() => null));
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hist, setHist] = useState<History>(() => loadHistory());

  useEffect(() => {
    cachedSettings();
    void refreshSettings();
    const onHist = () => setHist(loadHistory());
    addEventListener(HISTORY_EVENT, onHist);
    return () => removeEventListener(HISTORY_EVENT, onHist);
  }, []);
  useEffect(() => showResultAd(done), [done]);

  const setNo = Math.floor(set.offset / 10) + 1;
  const q = set.items[idx];
  const score = set.items.filter((x, i) => picks[i] === x.answerIndex).length;

  function pick(i: number) {
    if (picks[idx] !== null) return;
    const next = picks.slice();
    next[idx] = i;
    setPicks(next);
  }

  function next() {
    if (idx + 1 < set.items.length) return setIdx(idx + 1);
    setDone(true);
    track('practice_set_complete', { subject: p.subject, set: setNo, score, questions: set.items.length });
    document.querySelector('[data-practice]')?.scrollIntoView({ block: 'start' });
  }

  /** E06 — sirf set ke darmiyan, jawab dete waqt kabhi nahin */
  async function load(offset: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/mcqs?subject=${encodeURIComponent(p.slug)}&offset=${offset}`, { signal: AbortSignal.timeout(15_000) });
      const data = (await res.json()) as { ok?: boolean } & Partial<PracticeSet>;
      if (!res.ok || !data.ok || !data.items) throw new Error();
      if (!data.items.length) {
        setSet({ ...set, hasMore: false });
        return;
      }
      setSet({ items: data.items, hasMore: !!data.hasMore, total: data.total ?? set.total, offset });
      setPicks(data.items.map(() => null));
      setIdx(0);
      setDone(false);
      document.querySelector('[data-practice]')?.scrollIntoView({ block: 'start' });
    } catch {
      setError('Agla set load nahin hua. Internet check kar ke dobara koshish karein.');
    } finally {
      setLoading(false);
    }
  }

  const reportHref = (x: QuizMcq) => waLink(whatsappNumber(), `Assalam o Alaikum GVS Academy,\nSawal #${x.id} mein ghalti lagti hai:\n"${x.question.slice(0, 120)}"\n`);

  if (!set.items.length) return <p class="rounded-xl border border-border bg-surface p-4">Is mazmoon ke sawal jald aayenge. Tab tak aaj ka muft test dein.</p>;

  if (done)
    return (
      <section class="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 text-center" data-practice data-set-result>
        <p class="text-sm text-muted">
          Set {setNo} · sawal {set.offset + 1}–{set.offset + set.items.length} / {set.total}
        </p>
        <p class="text-4xl font-bold tabular" data-set-score>
          {score}/{set.items.length}
        </p>
        <p class="font-semibold">{score >= Math.ceil(set.items.length * 0.7) ? 'Shabash! Isi tarah jari rakhein.' : 'Koi baat nahin, tashreeh parh kar agla set karein.'}</p>
        {error && (
          <p class="text-sm text-wrong" role="alert">
            {error}
          </p>
        )}
        {set.hasMore ? (
          <button type="button" disabled={loading} onClick={() => load(set.offset + set.items.length)} class={`${btn} bg-primary text-on-primary disabled:opacity-60`} data-next-set>
            {loading ? 'Load ho raha hai…' : 'Agla set'}
          </button>
        ) : (
          <p class="rounded-xl bg-surface-2 p-3" data-all-done>
            Is mazmoon ke saare sawal ho gaye. Naye sawal aate rehte hain.
          </p>
        )}
        <div class="flex flex-col gap-2">
          <a href="/daily-test" class={`${btn} flex items-center justify-center border border-border no-underline`}>
            Aaj ka muft test
          </a>
          {set.offset > 0 && (
            <button type="button" disabled={loading} onClick={() => load(0)} class={`${btn} border border-border disabled:opacity-60`}>
              Pehle set se shuru karein
            </button>
          )}
        </div>
        {p.pack && (
          <a href={p.pack.href} class="flex flex-col rounded-xl bg-accent p-3 text-on-accent no-underline" data-pack>
            <span class="font-bold">{p.pack.name}</span>
            <span class="text-sm">
              {p.pack.line} · {p.pack.price}
            </span>
          </a>
        )}
      </section>
    );

  return (
    <section class="flex flex-col gap-4" data-practice>
      <p class="text-sm text-muted">
        Set {setNo} · kul {set.total} sawal
      </p>
      <ProgressBar index={idx} total={set.items.length} score={score} />
      <QuizCard
        key={q.id}
        q={q}
        picked={picks[idx]}
        onPick={pick}
        bookmarked={hist.bookmarks.includes(q.id)}
        onBookmark={() => setHist(updateHistory((h) => toggleBookmark(h, q.id)))}
        reportHref={reportHref(q)}
      />
      <button type="button" disabled={picks[idx] === null} onClick={next} class={`${btn} bg-primary text-on-primary disabled:opacity-50`} data-next>
        {idx + 1 < set.items.length ? 'Agla sawal' : 'Set ka nateeja'}
      </button>
    </section>
  );
}

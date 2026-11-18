// spec: S17 /daily-test (teen halatein: shuru, sawal+jawab+tashreeh, score card), F13-AC1..AC9, F17-AC4, design.md (Sawal → "Agla sawal" jawab ke baad)
// Data ek dafa (E05), phir sab memory mein — jawab par koi network call nahin (F13-AC3, spec 9.1).
// Owner ka faisla: aaj ka test dobara = practice; aaj ka score/streak nahin badalte.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { QuizMcq } from '../../lib/daily';
import { currentStreak, doneToday, loadHistory, recordDaily, toggleBookmark, updateHistory, weakestSubject, HISTORY_EVENT, type History } from '../../lib/history';
import { pkDate } from '../../lib/pkdate';
import { track } from '../../lib/analytics';
import { waLink } from '../../lib/phone';
import { cachedSettings, refreshSettings, whatsappNumber } from '../../lib/site-settings';
import QuizCard from './QuizCard';
import ProgressBar from './ProgressBar';
import ScoreCard, { type Pack } from './ScoreCard';

type Phase =
  | { k: 'loading' }
  | { k: 'error' }
  | { k: 'empty' }
  | { k: 'start' }
  | { k: 'quiz'; list: QuizMcq[]; practice: boolean; idx: number; picks: (number | null)[] }
  | { k: 'score'; list: QuizMcq[]; practice: boolean; picks: (number | null)[] };

const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';

/** `result` ad sirf score card ke saath (F13-AC7) */
function showResultAd(show: boolean) {
  const el = document.querySelector<HTMLElement>('[data-result-ad]');
  if (el) el.hidden = !show;
}

export default function DailyTest(p: { pack: Pack | null }) {
  const [items, setItems] = useState<QuizMcq[]>([]);
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [hist, setHist] = useState<History>(() => loadHistory());
  const today = useMemo(() => pkDate(), []);

  async function load() {
    setPhase({ k: 'loading' });
    try {
      const res = await fetch('/api/daily-test', { signal: AbortSignal.timeout(15_000) });
      const data = (await res.json()) as { ok?: boolean; items?: QuizMcq[] };
      if (!res.ok || !data.ok || !data.items) throw new Error();
      setItems(data.items);
      setPhase(data.items.length ? { k: 'start' } : { k: 'empty' });
    } catch {
      setPhase({ k: 'error' });
    }
  }

  useEffect(() => {
    void load();
    cachedSettings();
    void refreshSettings();
    const onHist = () => setHist(loadHistory());
    addEventListener(HISTORY_EVENT, onHist);
    return () => removeEventListener(HISTORY_EVENT, onHist);
  }, []);

  useEffect(() => showResultAd(phase.k === 'score'), [phase.k]);

  const streak = currentStreak(hist, today);
  const todayEntry = hist.daily[today];

  function begin(list: QuizMcq[], practice: boolean) {
    if (!practice) track('daily_test_start', { questions: list.length });
    setPhase({ k: 'quiz', list, practice, idx: 0, picks: list.map(() => null) });
    scrollTo({ top: 0 });
  }

  function pick(i: number) {
    if (phase.k !== 'quiz' || phase.picks[phase.idx] !== null) return;
    const picks = phase.picks.slice();
    picks[phase.idx] = i;
    setPhase({ ...phase, picks });
  }

  function next() {
    if (phase.k !== 'quiz') return;
    if (phase.idx + 1 < phase.list.length) return setPhase({ ...phase, idx: phase.idx + 1 });
    // Mukammal
    const score = phase.list.filter((q, i) => phase.picks[i] === q.answerIndex).length;
    const wrong = phase.list.filter((q, i) => phase.picks[i] !== q.answerIndex);
    if (!phase.practice && !doneToday(loadHistory(), today)) {
      setHist(updateHistory((h) => recordDaily(h, today, { score, total: phase.list.length, wrongIds: wrong.map((q) => q.id), wrongSubjects: wrong.map((q) => q.subject) })));
      track('daily_test_complete', { score, questions: phase.list.length });
    }
    setPhase({ k: 'score', list: phase.list, practice: phase.practice, picks: phase.picks });
    scrollTo({ top: 0 });
  }

  const reportHref = (q: QuizMcq) => waLink(whatsappNumber(), `Assalam o Alaikum GVS Academy,\nSawal #${q.id} mein ghalti lagti hai:\n"${q.question.slice(0, 120)}"\n`);
  const shareHref = (score: number, total: number) =>
    `https://wa.me/?text=${encodeURIComponent(`Main ne GVS Academy ka aaj ka muft test diya: ${score}/${total}. Aap bhi try karein: ${location.origin}/daily-test`)}`;

  if (phase.k === 'loading') return <p class="text-muted" aria-live="polite">Aaj ke sawal aa rahe hain…</p>;
  if (phase.k === 'error')
    return (
      <div class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" role="alert">
        <p>Sawal load nahin hue. Internet check kar ke dobara koshish karein.</p>
        <button type="button" onClick={load} class={`${btn} bg-primary text-on-primary`}>
          Dobara koshish karein
        </button>
      </div>
    );
  if (phase.k === 'empty') return <p class="rounded-xl border border-border bg-surface p-4">Aaj ke sawal abhi tayyar nahin. Thori der baad dobara aayein.</p>;

  if (phase.k === 'start')
    return (
      <section class="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5" data-daily-start>
        <p class="text-lg font-semibold">
          Aaj ke <span class="tabular">{items.length}</span> sawal
        </p>
        {streak > 0 && (
          <p class="font-medium text-accent-text" data-streak>
            Aap <span class="tabular">{streak}</span> din se lagatar test de rahe hain.
          </p>
        )}
        {todayEntry ? (
          <>
            <p data-today-score>
              Aaj ka test ho chuka: <strong class="tabular">{todayEntry.score}/{todayEntry.total}</strong>. Kal naye sawal aayenge.
            </p>
            <button type="button" onClick={() => begin(items, true)} class={`${btn} border border-border`} data-practice>
              Dobara karein (practice — score nahin badle ga)
            </button>
          </>
        ) : (
          <>
            <p class="text-sm text-muted">Har sawal ka jawab foran, tashreeh ke sath. Sign up nahin.</p>
            <button type="button" onClick={() => begin(items, false)} class={`${btn} bg-primary text-on-primary`} data-begin>
              Test shuru karein
            </button>
          </>
        )}
      </section>
    );

  if (phase.k === 'quiz') {
    const q = phase.list[phase.idx];
    const answered = phase.picks[phase.idx] !== null;
    const score = phase.list.filter((x, i) => phase.picks[i] === x.answerIndex).length;
    return (
      <section class="flex flex-col gap-4" data-daily-quiz>
        {phase.practice && <p class="text-sm text-muted">Practice — aaj ka score nahin badle ga.</p>}
        <ProgressBar index={phase.idx} total={phase.list.length} score={score} />
        <QuizCard
          key={q.id}
          q={q}
          picked={phase.picks[phase.idx]}
          onPick={pick}
          bookmarked={hist.bookmarks.includes(q.id)}
          onBookmark={() => setHist(updateHistory((h) => toggleBookmark(h, q.id)))}
          reportHref={reportHref(q)}
        />
        <button type="button" disabled={!answered} onClick={next} class={`${btn} bg-primary text-on-primary disabled:opacity-50`} data-next>
          {phase.idx + 1 < phase.list.length ? 'Agla sawal' : 'Nateeja dekhein'}
        </button>
      </section>
    );
  }

  // score
  const score = phase.list.filter((q, i) => phase.picks[i] === q.answerIndex).length;
  const wrong = phase.list.filter((q, i) => phase.picks[i] !== q.answerIndex);
  return (
    <div class="flex flex-col gap-4" data-daily-score>
      <ScoreCard
        score={score}
        total={phase.list.length}
        streak={currentStreak(hist, today)}
        weakSubject={weakestSubject(hist)}
        shareHref={shareHref(score, phase.list.length)}
        onRetryWrong={wrong.length ? () => begin(wrong, true) : null}
        pack={p.pack}
        note={phase.practice ? <p class="text-sm text-muted">Practice ka nateeja (aaj ka score wahi rahe ga).</p> : undefined}
      />
      <button type="button" onClick={() => setPhase({ k: 'start' })} class={`${btn} border border-border`}>
        Shuru par wapas
      </button>
    </div>
  );
}

// spec: F16-AC4 (note ke neeche us mazmoon ke 5 MCQs ka chhota quiz), S21, design.md 6.8; F13-AC3 jaisa foran jawab (koi network nahin),
//       F13-AC6 jaisa bookmark + "Ghalti batayen". Practice jaisa: score history/streak mein nahin (Qadam 10b ka faisla), sirf bookmarks.
import { useEffect, useState } from 'preact/hooks';
import type { QuizMcq } from '../../lib/daily';
import { loadHistory, toggleBookmark, updateHistory, HISTORY_EVENT, type History } from '../../lib/history';
import { waLink } from '../../lib/phone';
import { cachedSettings, refreshSettings, whatsappNumber } from '../../lib/site-settings';
import QuizCard from './QuizCard';
import ProgressBar from './ProgressBar';

const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline';

export default function NoteQuiz(p: { subject: string; practiceHref: string | null; items: QuizMcq[] }) {
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => p.items.map(() => null));
  const [done, setDone] = useState(false);
  const [hist, setHist] = useState<History>(() => loadHistory());

  useEffect(() => {
    cachedSettings();
    void refreshSettings();
    const onHist = () => setHist(loadHistory());
    addEventListener(HISTORY_EVENT, onHist);
    return () => removeEventListener(HISTORY_EVENT, onHist);
  }, []);

  if (!p.items.length)
    return (
      <p class="rounded-xl border border-border bg-surface p-4" data-note-quiz-empty>
        Is mazmoon ke sawal jald aayenge. Tab tak <a href="/daily-test">aaj ka muft test</a> dein.
      </p>
    );

  const q = p.items[idx];
  const score = p.items.filter((x, i) => picks[i] === x.answerIndex).length;

  function pick(i: number) {
    setPicks((prev) => {
      if (prev[idx] !== null) return prev;
      const next = prev.slice();
      next[idx] = i;
      return next;
    });
  }
  function again() {
    setPicks(p.items.map(() => null));
    setIdx(0);
    setDone(false);
  }

  if (done)
    return (
      <div class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-center" data-note-quiz data-note-quiz-result>
        <p class="tabular text-4xl font-bold" data-note-quiz-score>
          {score}/{p.items.length}
        </p>
        <p class="font-semibold">{score >= Math.ceil(p.items.length * 0.7) ? 'Shabash! Note achi tarah samajh aaya.' : 'Koi baat nahin. Note dobara parh kar phir koshish karein.'}</p>
        <a href={p.practiceHref ?? '/daily-test'} class={`${btn} bg-primary text-on-primary`} data-note-practice>
          {p.practiceHref ? `${p.subject} ki aur muft practice` : 'Aaj ka muft test dein'}
        </a>
        <button type="button" onClick={again} class={`${btn} border border-border`}>
          Dobara karein
        </button>
      </div>
    );

  return (
    <div class="flex flex-col gap-4" data-note-quiz>
      <ProgressBar index={idx} total={p.items.length} score={score} />
      <QuizCard
        key={q.id}
        q={q}
        picked={picks[idx]}
        onPick={pick}
        bookmarked={hist.bookmarks.includes(q.id)}
        onBookmark={() => setHist(updateHistory((h) => toggleBookmark(h, q.id)))}
        reportHref={waLink(whatsappNumber(), `Assalam o Alaikum GVS Academy,\nSawal #${q.id} mein ghalti lagti hai:\n"${q.question.slice(0, 120)}"\n`)}
      />
      <button type="button" disabled={picks[idx] === null} onClick={() => (idx + 1 < p.items.length ? setIdx(idx + 1) : setDone(true))} class={`${btn} bg-primary text-on-primary disabled:opacity-50`} data-note-next>
        {idx + 1 < p.items.length ? 'Agla sawal' : 'Nateeja dekhein'}
      </button>
    </div>
  );
}

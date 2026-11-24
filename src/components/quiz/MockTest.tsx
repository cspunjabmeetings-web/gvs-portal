// spec: S19 /mock-tests/<slug> (shuru → sawal + palette + timer → jama), F15-AC2 (shuru screen), F15-AC3 (palette + jump), F15-AC4 (ulti ginti,
//       aakhri 5 min, waqt khatam par khud jama), F15-AC5 (jama se pehle tasdeeq), F15-AC7 (band ho to wahin se jari; owner ka faisla 1a:
//       band page par timer rukta hai; faisla 2: ek waqt mein ek adhoora mock), F15-AC8 (sab sawal page ke sath, koi network nahin),
//       F15-AC9 (chalte test mein ad nahin; `result` sirf jama ke baad), design.md 6.7, F13-AC6 (bookmark + "Ghalti batayen")
// Qadam 11b: jama ke baad MockResult (F15-AC6); nateeja history mocks[slug] mein + ghalat mazameen weakSubjects mein (owner ka faisla 1a, 2a).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { QuizMcq } from '../../lib/daily';
import { loadHistory, recordMock, setMockProgress, toggleBookmark, updateHistory, HISTORY_EVENT, type History } from '../../lib/history';
import { answer, answeredCount, formatClock, goTo, newProgress, readProgress, scoreMock, submitMessage, toggleFlag, unansweredCount, wrongSubjects, type MockProgress } from '../../lib/mock-engine';
import { track } from '../../lib/analytics';
import { waLink } from '../../lib/phone';
import { cachedSettings, refreshSettings, whatsappNumber } from '../../lib/site-settings';
import QuizCard from './QuizCard';
import Timer from './Timer';
import MockPalette, { PaletteLegend } from './MockPalette';
import MockResult from './MockResult';
import type { Pack } from './ScoreCard';

export interface MockInfo {
  slug: string;
  name: string;
  minutes: number;
  summary: string | null;
}

/** F30: VU test. Nateeja history mocks/weakSubjects mein nahin (woh /mock-tests aur /mcqs ke links bante hain); bookmark nahin */
export interface VuMode {
  onBack: () => void;
  /** F31-AC1: jama par (history mein likhne ke liye) */
  onResult: (p: MockProgress) => void;
  shareText: (s: { score: number; total: number; percent: number }) => string;
  /** F31: nateeje ke foran baad meter, pack, agla test */
  extra: (s: { percent: number }) => ComponentChildren;
}

const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline';
const SAVE_EVERY_MS = 5000;

type Phase = { k: 'start' } | { k: 'test' } | { k: 'done'; progress: MockProgress; usedMs: number; auto: boolean };

function showResultAd(show: boolean) {
  const el = document.querySelector<HTMLElement>('[data-result-ad]');
  if (el) el.hidden = !show;
}

export default function MockTest(p: { mock: MockInfo; items: QuizMcq[]; pack: Pack | null; vu?: VuMode }) {
  const { mock, items } = p;
  const totalMs = mock.minutes * 60_000;
  const [phase, setPhase] = useState<Phase>({ k: 'start' });
  const [prog, setProg] = useState<MockProgress>(() => newProgress(mock.slug, mock.minutes));
  const [remaining, setRemaining] = useState(totalMs);
  const [resume, setResume] = useState<MockProgress | null>(null);
  const [otherPending, setOtherPending] = useState(false);
  const [hist, setHist] = useState<History>(() => loadHistory());
  const palette = useRef<HTMLDialogElement>(null);
  const confirmBox = useRef<HTMLDialogElement>(null);
  // Interval aur events ke liye taza values (purane closure se bachne ke liye)
  const progRef = useRef(prog);
  const endAt = useRef(0);
  const live = useRef(false);

  useEffect(() => {
    cachedSettings();
    void refreshSettings();
    const h = loadHistory();
    const saved = readProgress(h.mockProgress, mock.slug, items, mock.minutes);
    setResume(saved);
    setOtherPending(!saved && !!h.mockProgress && (h.mockProgress as { slug?: unknown }).slug !== mock.slug);
    const onHist = () => setHist(loadHistory());
    addEventListener(HISTORY_EVENT, onHist);
    return () => removeEventListener(HISTORY_EVENT, onHist);
  }, []);
  useEffect(() => showResultAd(phase.k === 'done'), [phase.k]);
  // F30-AC4: chalte VU test mein order patti nahin (global.css)
  useEffect(() => {
    if (!p.vu || phase.k !== 'test') return;
    document.documentElement.dataset.vuTest = '';
    return () => {
      delete document.documentElement.dataset.vuTest;
    };
  }, [phase.k]);

  const left = () => Math.max(0, endAt.current - Date.now());

  function persist(next: MockProgress = progRef.current) {
    if (!live.current) return;
    const snap = { ...next, remainingMs: left(), savedAt: new Date().toISOString() };
    updateHistory((h) => setMockProgress(h, snap as unknown as Record<string, unknown>));
  }

  function change(next: MockProgress) {
    progRef.current = next;
    setProg(next);
    persist(next);
  }

  function begin(from: MockProgress) {
    progRef.current = from;
    setProg(from);
    endAt.current = Date.now() + from.remainingMs;
    setRemaining(from.remainingMs);
    live.current = true;
    persist(from);
    setPhase({ k: 'test' });
    track('mock_start', { mock: mock.slug, questions: items.length, resumed: from === resume });
    requestAnimationFrame(() => document.querySelector('[data-mock]')?.scrollIntoView({ block: 'start' }));
  }

  function submit(auto: boolean) {
    if (!live.current) return;
    const usedMs = Math.min(totalMs, totalMs - left());
    live.current = false;
    confirmBox.current?.close();
    palette.current?.close();
    const final = progRef.current;
    const s = scoreMock(final, items);
    if (p.vu) {
      updateHistory((h) => setMockProgress(h, null));
      p.vu.onResult(final);
    }
    else updateHistory((h) => recordMock(h, mock.slug, { score: s.score, total: s.total, bySubject: s.bySubject, at: new Date().toISOString(), name: mock.name }, wrongSubjects(final, items)));
    track('mock_submit', { mock: mock.slug, score: s.score, questions: s.total, auto });
    setResume(null);
    setPhase({ k: 'done', progress: final, usedMs, auto });
    requestAnimationFrame(() => document.querySelector('[data-mock]')?.scrollIntoView({ block: 'start' }));
  }

  // F15-AC4: ulti ginti (deewar ki ghari se — chhupi tab mein bhi sahih); har 5 s aur page chhorte waqt mehfooz (F15-AC7)
  useEffect(() => {
    if (phase.k !== 'test') return;
    let lastSave = Date.now();
    const t = setInterval(() => {
      const ms = left();
      setRemaining(ms);
      if (ms <= 0) return submit(true);
      if (Date.now() - lastSave >= SAVE_EVERY_MS) {
        lastSave = Date.now();
        persist();
      }
    }, 250);
    const onHide = () => persist();
    const onVis = () => document.visibilityState === 'hidden' && persist();
    addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [phase.k]);

  const reportHref = (x: QuizMcq) => waLink(whatsappNumber(), `Assalam o Alaikum GVS Academy,\n${p.vu ? `${mock.name}, VU sawal` : 'Sawal'} #${x.id} mein ghalti lagti hai:\n"${x.question.slice(0, 120)}"\n`);
  const jump = (i: number) => {
    change(goTo(progRef.current, i, items.length));
    palette.current?.close();
    document.querySelector('[data-mock]')?.scrollIntoView({ block: 'start' });
  };

  // ---------------- Shuru (F15-AC2) ----------------
  if (phase.k === 'start')
    return (
      <section class="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5" data-mock data-mock-start>
        <p class="flex flex-wrap gap-2 text-sm font-semibold">
          <span class="rounded-full bg-primary-soft px-3 py-1 text-primary" data-mock-count>
            {items.length} sawal
          </span>
          <span class="rounded-full bg-primary-soft px-3 py-1 text-primary" data-mock-minutes>
            {mock.minutes} minute
          </span>
        </p>
        <div>
          <h2 class="text-lg">Usool</h2>
          <ul class="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm" data-mock-rules>
            <li>Har sawal ka ek jawab chunein. Jama karne se pehle jawab badal sakte hain.</li>
            <li>Jawab aur tashreeh test jama karne ke baad dikhein ge.</li>
            <li>"Baad mein dekhein" se sawal par nishan lagayen; sawalon ki list mein amber ● nazar aaye ga.</li>
            <li>Ulti ginti chalti hai. Waqt khatam hote hi test khud jama ho jaye ga.</li>
            <li>Page band ho jaye to wapas aa kar wahin se jari rakhein; band rehne ke dauran waqt nahin chalta.</li>
            <li>Test ke dauran internet ki zaroorat nahin.</li>
          </ul>
        </div>
        {resume ? (
          <>
            <p class="rounded-xl bg-surface-2 p-3 text-sm" data-resume-info>
              Aap ne yeh test adhoora chhora tha: {answeredCount(resume, items)} / {items.length} hal, {formatClock(resume.remainingMs)} baqi.
            </p>
            <button type="button" onClick={() => begin(resume)} class={`${btn} bg-primary text-on-primary`} data-mock-resume>
              Jari rakhein
            </button>
            <button type="button" onClick={() => begin(newProgress(mock.slug, mock.minutes))} class={`${btn} border border-border`} data-mock-restart>
              Naye sire se shuru karein
            </button>
          </>
        ) : (
          <>
            {otherPending && (
              <p class="rounded-xl border border-warn p-3 text-sm" data-other-pending>
                Aap ka ek aur mock test adhoora hai. Yeh test shuru karne par woh adhoora test mit jaye ga.
              </p>
            )}
            <button type="button" onClick={() => begin(newProgress(mock.slug, mock.minutes))} class={`${btn} bg-primary text-on-primary`} data-mock-begin>
              {otherPending ? 'Phir bhi shuru karein' : 'Shuru karein'}
            </button>
          </>
        )}
        {p.vu && (
          <button type="button" onClick={p.vu.onBack} class={`${btn} border border-border`} data-vu-back>
            ‹ Saare tests
          </button>
        )}
      </section>
    );

  // ---------------- Result (F15-AC6, Qadam 11b) ----------------
  if (phase.k === 'done')
    return (
      <MockResult
        name={mock.name}
        slug={mock.slug}
        progress={phase.progress}
        items={items}
        usedMs={phase.usedMs}
        auto={phase.auto}
        pack={p.pack}
        vu={p.vu}
        onAgain={() => {
          setPhase({ k: 'start' });
          requestAnimationFrame(() => document.querySelector('[data-mock]')?.scrollIntoView({ block: 'start' }));
        }}
      />
    );

  // ---------------- Test (F15-AC3..AC5) ----------------
  const q = items[prog.idx];
  const flagged = prog.flagged.includes(q.id);
  const done = answeredCount(prog, items);
  const last = prog.idx === items.length - 1;
  const askSubmit = () => confirmBox.current?.showModal();

  return (
    <section class="flex flex-col gap-4" data-mock data-mock-test>
      <div class="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-2 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
        <Timer remainingMs={remaining} />
        <p class="text-sm tabular" data-mock-position>
          Sawal {prog.idx + 1} / {items.length}
          <span class="block text-xs text-muted">{done} hal</span>
        </p>
        <button type="button" onClick={askSubmit} class={`${btn} border border-primary px-3 text-sm text-primary`} data-mock-submit>
          Jama karein
        </button>
      </div>

      <QuizCard
        q={q}
        mode="select"
        picked={prog.answers[q.id] ?? null}
        onPick={(i) => change(answer(progRef.current, q.id, i))}
        bookmarked={hist.bookmarks.includes(q.id)}
        onBookmark={p.vu ? null : () => setHist(updateHistory((h) => toggleBookmark(h, q.id)))}
        reportHref={reportHref(q)}
      />

      <button
        type="button"
        aria-pressed={flagged}
        onClick={() => change(toggleFlag(progRef.current, q.id))}
        class={`${btn} self-start gap-2 border-2 ${flagged ? 'border-accent bg-accent text-on-accent' : 'border-border'}`}
        data-mock-flag
      >
        <span aria-hidden="true">{flagged ? '●' : '○'}</span>
        {flagged ? 'Baad mein dekhna hai' : 'Baad mein dekhein'}
      </button>

      <div class="grid grid-cols-3 gap-2">
        <button type="button" disabled={prog.idx === 0} onClick={() => jump(prog.idx - 1)} class={`${btn} border border-border px-2 disabled:opacity-40`} data-mock-prev>
          ‹ Pichhla
        </button>
        <button type="button" onClick={() => palette.current?.showModal()} class={`${btn} border border-border px-2 md:hidden`} aria-haspopup="dialog" data-mock-palette-open>
          Sawal list
        </button>
        <span class="hidden md:block" />
        {last ? (
          <button type="button" onClick={askSubmit} class={`${btn} bg-primary px-2 text-on-primary`} data-mock-next>
            Jama karein
          </button>
        ) : (
          <button type="button" onClick={() => jump(prog.idx + 1)} class={`${btn} bg-primary px-2 text-on-primary`} data-mock-next>
            Agla ›
          </button>
        )}
      </div>

      {/* Bari screen par palette seedha neeche; phone par drawer (design.md 6.7) */}
      <div class="hidden flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:flex">
        <PaletteLegend />
        <MockPalette qs={items} progress={prog} onJump={jump} />
      </div>

      <dialog
        ref={palette}
        aria-labelledby="palette-title"
        class="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-text backdrop:bg-black/50 md:m-auto md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.target === palette.current && palette.current?.close()}
        data-palette-sheet
      >
        <div class="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 id="palette-title" class="text-lg">
              Sawal list · {done} / {items.length} hal
            </h2>
            <button type="button" onClick={() => palette.current?.close()} class="min-h-[44px] min-w-[44px] rounded-lg hover:bg-surface-2" aria-label="Band karein">
              ✕
            </button>
          </div>
          <PaletteLegend />
          <MockPalette qs={items} progress={prog} onJump={jump} />
        </div>
      </dialog>

      <dialog
        ref={confirmBox}
        aria-labelledby="submit-title"
        class="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-surface p-5 text-text backdrop:bg-black/50"
        data-submit-dialog
      >
        <h2 id="submit-title" class="text-lg">
          Test jama karein?
        </h2>
        <p class="mt-2" data-submit-msg>
          {submitMessage(unansweredCount(prog, items))}
        </p>
        {prog.flagged.length > 0 && <p class="mt-1 text-sm text-muted">{prog.flagged.length} sawal par "baad mein dekhein" ka nishan hai.</p>}
        <div class="mt-4 flex flex-col gap-2">
          <button type="button" onClick={() => submit(false)} class={`${btn} bg-primary text-on-primary`} data-submit-yes>
            Haan, jama karein
          </button>
          <button type="button" onClick={() => confirmBox.current?.close()} class={`${btn} border border-border`} data-submit-no>
            Wapas jayen
          </button>
        </div>
      </dialog>
    </section>
  );
}

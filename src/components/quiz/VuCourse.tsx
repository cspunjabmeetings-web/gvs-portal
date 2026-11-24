// spec: F31-AC1..AC5 (progress, meter, pack, share)
// spec: F30-AC3 (Midterm/Final tabs, Test 1, 2, 3…), F30-AC4 (MockTest wala engine; test ke dauran koi request, ad ya order patti nahin)
import { useEffect, useState } from 'preact/hooks';
import type { QuizMcq } from '../../lib/daily';
import { loadHistory, updateHistory, HISTORY_EVENT, type VuEntry } from '../../lib/history';
import { waLink } from '../../lib/phone';
import { cachedSettings, refreshSettings, whatsappNumber } from '../../lib/site-settings';
import { splitTests } from '../../lib/vu-tests';
import { CHANNEL_URL, nextTest, readiness, recordVu, vuKey, vuShareText } from '../../lib/vu-progress';
import MockTest from './MockTest';
import type { Achievement } from '../../lib/achievements-rules';
import AchievementStrip from './AchievementStrip';
import RemarkCards from './RemarkCards';
import VuMeter from './VuMeter';
import VuPacks, { type VuPack } from './VuPacks';

type Term = 'mid' | 'final';
const LABEL: Record<Term, string> = { mid: 'Midterm', final: 'Final Term' };
const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline';

export default function VuCourse(p: { code: string; ids: Record<Term, number[]>; /** F32-AC3: jaanche Important Questions ki ginti */ qs: Record<Term, number>; start: Term; packs: VuPack[]; /** F33 */ strip: Achievement[] }) {
  const [term, setTerm] = useState<Term>(p.start);
  const [open, setOpen] = useState<{ n: number; items: QuizMcq[] } | null>(null);
  const [loading, setLoading] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [wa, setWa] = useState('/contact');
  const [all, setAll] = useState<Record<string, VuEntry>>({});
  const ids = p.ids[term];
  const tests = splitTests(ids.length);
  const entry = all[vuKey(p.code, term)];
  const ready = readiness(entry, ids, tests.length);
  const slugOf = (n: number) => `vu:${p.code}:${term}:${n}`;

  useEffect(() => {
    cachedSettings();
    const link = () => setWa(waLink(whatsappNumber(), `Assalam o Alaikum GVS Academy, mujhe ${p.code} ka VU mock test chahiye.`));
    link();
    void refreshSettings().then(link);
    readPending();
    const read = () => setAll(loadHistory().vu);
    read();
    addEventListener(HISTORY_EVENT, read);
    return () => removeEventListener(HISTORY_EVENT, read);
  }, []);

  function readPending() {
    const s = (loadHistory().mockProgress as { slug?: unknown } | null)?.slug;
    setPending(typeof s === 'string' ? s : '');
  }

  function choose(t: Term) {
    setTerm(t);
    setError('');
    // Link share karte waqt wohi term khule (src jaise baqi hisse wahi rahein)
    const u = new URL(location.href);
    u.searchParams.set('term', t);
    history.replaceState(null, '', u);
  }

  async function load(n: number) {
    setLoading(n);
    setError('');
    try {
      const res = await fetch(`/api/vu/test?course=${p.code.toLowerCase()}&term=${term}&n=${n}`, { signal: AbortSignal.timeout(15_000) });
      const data = (await res.json()) as { ok?: boolean; items?: QuizMcq[]; error?: { message?: string } };
      if (!res.ok || !data.ok || !data.items?.length) setError(data.error?.message || 'Test nahin khula. Dobara koshish karein.');
      else {
        setOpen({ n, items: data.items });
        requestAnimationFrame(() => document.querySelector('[data-vu-course]')?.scrollIntoView({ block: 'start' }));
      }
    } catch {
      setError('Internet ka masla. Dobara koshish karein.');
    }
    setLoading(0);
  }

  function back() {
    setOpen(null);
    readPending();
    requestAnimationFrame(() => document.querySelector('[data-vu-course]')?.scrollIntoView({ block: 'start' }));
  }

  const questions = p.qs[term] > 0 && (
    <a href={`/vu-mock/${p.code.toLowerCase()}/questions?term=${term}`} class={`${btn} min-h-[52px] border-2 border-primary text-text`} data-vu-questions>
      Important Questions ({p.qs[term]})
    </a>
  );

  if (open) {
    const t = tests[open.n - 1];
    const name = `${p.code} ${LABEL[term]}: Test ${open.n}`;
    const next = nextTest(entry, tests.length);
    return (
      <div class="flex flex-col gap-3" data-vu-course>
        <h2 class="text-xl">{name}</h2>
        <MockTest
          key={slugOf(open.n)}
          mock={{ slug: slugOf(open.n), name, minutes: t?.minutes ?? 25, summary: null }}
          items={open.items}
          pack={null}
          strip={p.strip}
          vu={{
            onBack: back,
            onResult: (prog) => updateHistory((h) => recordVu(h, vuKey(p.code, term), { n: open.n, items: open.items, answers: prog.answers, validIds: ids, at: new Date().toISOString() })),
            shareText: (s) => vuShareText(name, s, `${location.origin}/vu-mock/${p.code.toLowerCase()}?term=${term}&src=share`),
            extra: (s) => (
              <>
                <VuMeter ready={ready} title={`${p.code} ${LABEL[term]}`} />
                {next !== null && (
                  <button type="button" disabled={loading > 0} onClick={() => load(next)} class={`${btn} bg-primary text-on-primary`} data-vu-next>
                    {loading ? 'Khul raha hai…' : `Agla test dein (Test ${next})`}
                  </button>
                )}
                {error && (
                  <p class="text-sm text-wrong" role="alert">
                    {error}
                  </p>
                )}
                {questions}
                <RemarkCards items={p.strip} code={p.code} />
                <VuPacks packs={p.packs} code={p.code} term={LABEL[term]} percent={s.percent} />
                {CHANNEL_URL && (
                  <a href={CHANNEL_URL} target="_blank" rel="noopener" class={`${btn} border border-border`} data-vu-channel>
                    WhatsApp channel follow karein
                  </a>
                )}
              </>
            ),
          }}
        />
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-4" data-vu-course>
      <AchievementStrip items={p.strip} />
      <div class="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1" role="group" aria-label="Term chunein">
        {(['mid', 'final'] as const).map((t) => (
          <button key={t} type="button" aria-pressed={term === t} onClick={() => choose(t)} class={`${btn} ${term === t ? 'bg-primary text-on-primary' : ''}`} data-term={t}>
            {LABEL[t]}
          </button>
        ))}
      </div>

      {tests.length === 0 ? (
        <div class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-center" data-vu-soon>
          <p class="text-lg font-bold">
            {p.code} {LABEL[term]} {questions ? 'ke MCQs jald aa rahe hain' : 'jald aa raha hai'}
          </p>
          <p class="text-sm text-muted">Chahiye to humein bata dein, is course par pehle kaam karein ge.</p>
          {questions}
          <a href={wa} target="_blank" rel="noopener" class={`${btn} bg-primary text-on-primary`} data-vu-request>
            WhatsApp par maangein
          </a>
        </div>
      ) : (
        <>
          <VuMeter ready={ready} title={`${p.code} ${LABEL[term]}`} />
          <p class="text-sm text-muted">
            <span class="tabular font-semibold text-text">{ids.length}</span> sawal · <span class="tabular font-semibold text-text">{tests.length}</span> {tests.length === 1 ? 'test' : 'tests'}, har test mein alag sawal
          </p>
          {error && (
            <p class="rounded-xl bg-wrong-bg p-3 text-sm text-wrong" role="alert">
              {error}
            </p>
          )}
          <ol class="flex flex-col gap-3" data-vu-tests>
            {tests.map((t, i) => {
              const n = i + 1;
              const half = pending === slugOf(n);
              const res = entry?.tests[n];
              const first = nextTest(entry, tests.length) === n;
              return (
                <li key={n}>
                  <button
                    type="button"
                    disabled={loading > 0}
                    onClick={() => load(n)}
                    class={`flex min-h-[72px] w-full items-center gap-4 rounded-2xl border-2 bg-surface p-4 text-left disabled:opacity-60 ${first || half ? 'border-accent' : 'border-border hover:border-primary'}`}
                    data-vu-test={n}
                  >
                    <span class="tabular flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary" aria-hidden="true">
                      {res ? '✓' : n}
                    </span>
                    <span class="flex-1">
                      <span class="block font-bold">Test {n}</span>
                      <span class="tabular block text-sm text-muted">
                        {t.size} sawal · {t.minutes} minute
                        {res && <span class="block font-semibold text-correct" data-vu-done>Pichhla score: {res.score}/{res.total}</span>}
                      </span>
                    </span>
                    <span class="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-on-accent">{loading === n ? 'Khul raha hai…' : half ? 'Jari rakhein' : res ? 'Dobara' : 'Shuru'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {questions}
          <VuPacks packs={p.packs} code={p.code} term={LABEL[term]} percent={ready.testsDone ? ready.percent : null} />
        </>
      )}
    </div>
  );
}

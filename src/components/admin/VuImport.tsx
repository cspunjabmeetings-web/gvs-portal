// spec: F29-AC2 — VU MCQs ka paste/.txt, term, preview, 25-25 ke tukron mein save (E28)
import { useState } from 'preact/hooks';
import ContentPreview, { type DupInfo } from './ContentPreview';
import { CONTENT_MSG } from './ContentTab';
import { buildChunks, hashMcqs, UPLOAD_LIMIT, type Chunk } from '../../lib/content-chunks';
import type { ParseResult, ParsedMcq } from '../../lib/parser';
import type { AdminCourse } from '../../lib/vu-admin';
import { parseVuMcqs, TERM_LABEL, VU_TERMS, type VuTerm } from '../../lib/vu';

const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';
type Phase = { k: 'edit' } | { k: 'saving' | 'stopped'; done: number; message?: string } | { k: 'done' };
const NO_DUP: DupInfo = { existing: new Set(), repeats: new Map() };

export default function VuImport(p: { courses: AdminCourse[]; onBusy: (b: boolean) => void }) {
  const [text, setText] = useState('');
  const [fileMsg, setFileMsg] = useState('');
  const [fileOk, setFileOk] = useState(false);
  const [term, setTerm] = useState<VuTerm | ''>('');
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dup, setDup] = useState<DupInfo>(NO_DUP);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [phase, setPhase] = useState<Phase>({ k: 'edit' });
  const [saved, setSaved] = useState({ saved: 0, skipped: 0 });
  const [needTerm, setNeedTerm] = useState(false);

  // Adhoora save ho to term/tick nahin badalte (aadhe Midterm, aadhe Final na ho jayen)
  const locked = phase.k === 'saving' || phase.k === 'stopped';
  const busy = phase.k === 'saving';

  function changeText(t: string) {
    setText(t);
    setResult(null);
    setPhase({ k: 'edit' });
  }

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    setFileOk(false);
    setFileMsg('');
    if (!f) return;
    if (!/\.txt$/i.test(f.name) || (f.type && f.type !== 'text/plain')) return setFileMsg(CONTENT_MSG.notTxt);
    if (f.size > UPLOAD_LIMIT) return setFileMsg(CONTENT_MSG.tooBig);
    const t = await f.text();
    if (t.includes(String.fromCharCode(0xfffd))) return setFileMsg(CONTENT_MSG.notUtf8);
    changeText(t);
    setFileOk(true);
    setFileMsg(`"${f.name}" khul gayi. Ab "Preview dekhein" dabayen.`);
  }

  async function preview() {
    const r = parseVuMcqs(
      text,
      p.courses.map((c) => c.code),
    );
    setResult(r);
    setPhase({ k: 'edit' });
    setVerified(false);
    setSaved({ saved: 0, skipped: 0 });
    setChunks(buildChunks(r.items));
    // Ek hi sawal do mukhtalif courses mein theek hai: dohra sirf usi course ke andar
    const repeats = new Map<ParsedMcq, number>();
    for (const code of new Set((r.items as ParsedMcq[]).map((q) => q.subject))) {
      const h = await hashMcqs((r.items as ParsedMcq[]).filter((q) => q.subject === code));
      h.repeats.forEach((n, q) => repeats.set(q, n));
    }
    setDup({ existing: new Set(), repeats });
  }

  async function save(from: number) {
    if (!term) return setNeedTerm(true);
    p.onBusy(true);
    setPhase({ k: 'saving', done: from });
    for (let i = from; i < chunks.length; i++) {
      let message = 'Internet ya server ka masla.';
      try {
        const res = await fetch('/api/admin/vu/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunks[i].text, term, verified }),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 401) return location.reload();
        const data = (await res.json()) as { ok?: boolean; saved?: number; skipped?: number; error?: { message?: string; errors?: { message: string }[] } };
        if (res.ok && data.ok) {
          setSaved((s) => ({ saved: s.saved + (data.saved ?? 0), skipped: s.skipped + (data.skipped ?? 0) }));
          setPhase({ k: 'saving', done: i + 1 });
          continue;
        }
        message = [data.error?.message, ...(data.error?.errors ?? []).slice(0, 3).map((e) => e.message)].filter(Boolean).join(' ') || 'Save nahin hua.';
      } catch {
        /* paigham wahi */
      }
      setPhase({ k: 'stopped', done: i, message });
      return p.onBusy(false);
    }
    setPhase({ k: 'done' });
    p.onBusy(false);
  }

  /** F12-AC8: dohre sawal is upload se nikalo */
  function dropMcqs(list: ParsedMcq[]) {
    if (!result) return;
    const gone = new Set<unknown>(list);
    const items = result.items.filter((x) => !gone.has(x));
    setResult({ ...result, items });
    setChunks(buildChunks(items));
    setDup((d) => ({ existing: new Set([...d.existing].filter((q) => !gone.has(q))), repeats: new Map([...d.repeats].filter(([q]) => !gone.has(q))) }));
  }

  function reset() {
    setText('');
    setResult(null);
    setFileMsg('');
    setTerm('');
    setVerified(false);
    setPhase({ k: 'edit' });
  }

  const line = `${saved.saved} sawal save ho gaye${saved.skipped ? `, ${saved.skipped} pehle se the (chhor diye)` : ''}.`;
  const done = phase.k === 'saving' || phase.k === 'stopped' ? phase.done : 0;

  return (
    <div class="flex flex-col gap-4" data-vu-import>
      <section class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 class="text-lg">VU MCQs daalein</h2>
        <p class="text-sm text-muted">
          Wahi <code># MCQ</code> format; <code>Mazmoon:</code> mein course code. Ek dafa mein ek hi term.
        </p>
        {p.courses.length === 0 && <p class="text-sm text-warn">Pehle "Courses" mein course daalein.</p>}
        <label for="vu-text" class="text-sm font-medium">
          Text
        </label>
        <textarea
          id="vu-text"
          rows={9}
          value={text}
          disabled={locked}
          onInput={(e) => changeText((e.target as HTMLTextAreaElement).value)}
          placeholder={'# MCQ\nMazmoon: CS101\nSawal: Which of the following is an input device?\nA) Keyboard*\nB) Monitor\nC) Printer\n---'}
          class="rounded-lg border border-border bg-surface p-2 font-mono text-sm"
          spellcheck={false}
        />
        <div class="flex flex-col gap-2 sm:flex-row">
          <label class={`${btn} inline-flex cursor-pointer items-center justify-center border border-border ${locked ? 'pointer-events-none opacity-60' : ''}`}>
            .txt file chunein
            <input type="file" accept=".txt,text/plain" onChange={onFile} class="sr-only" disabled={locked} data-vu-upload />
          </label>
          <button type="button" onClick={preview} disabled={locked || !text.trim()} class={`${btn} flex-1 bg-primary text-on-primary disabled:opacity-60`} data-vu-preview>
            Preview dekhein
          </button>
        </div>
        {fileMsg && (
          <p class={`text-sm ${fileOk ? 'text-correct' : 'text-wrong'}`} role={fileOk ? 'status' : 'alert'}>
            {fileMsg}
          </p>
        )}
      </section>

      {result && (
        <ContentPreview result={result} dup={dup} onDrop={phase.k === 'edit' ? dropMcqs : null}>
          <section class="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-4" data-vu-save-box>
            {chunks.length === 0 ? (
              <p class="text-sm text-muted">Save karne ke liye koi sahih sawal nahin.</p>
            ) : phase.k === 'done' ? (
              <>
                <p class="font-semibold text-correct" role="status" data-vu-done>
                  ✓ {term && TERM_LABEL[term]}: {line}
                </p>
                {!verified && <p class="text-sm text-muted">Sawal "na jaanche" hain; "Sawal" mein ja kar Dikhayen dabayen.</p>}
                <button type="button" onClick={reset} class={`${btn} border border-border`}>
                  Naya paste
                </button>
              </>
            ) : (
              <>
                <fieldset disabled={locked} class="flex flex-col gap-2">
                  <legend class="mb-2 text-sm font-medium">Yeh sawal kis term ke hain?</legend>
                  <div class="grid grid-cols-2 gap-2">
                    {VU_TERMS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={term === t}
                        onClick={() => {
                          setTerm(t);
                          setNeedTerm(false);
                        }}
                        class={`${btn} ${term === t ? 'bg-primary text-on-primary' : 'border border-border'}`}
                        data-vu-term={t}
                      >
                        {TERM_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {needTerm && (
                  <p class="text-sm text-wrong" role="alert">
                    Pehle Midterm ya Final Term chunein.
                  </p>
                )}
                <label for="vu-verified" class="flex min-h-[44px] items-center gap-3">
                  <input id="vu-verified" type="checkbox" checked={verified} disabled={locked} onChange={(e) => setVerified((e.target as HTMLInputElement).checked)} class="h-6 w-6 accent-[var(--primary)]" />
                  <span class="font-medium">Main ne yeh sawal jaanch liye hain</span>
                </label>
                {locked && (
                  <p class="tabular text-sm" aria-live="polite">
                    {done}/{chunks.length} hisse · {line}
                  </p>
                )}
                {phase.k === 'stopped' && (
                  <p class="text-sm text-wrong" role="alert">
                    Hissa {phase.done + 1} save nahin hua: {phase.message} Jo save ho chuke woh mehfooz hain.
                  </p>
                )}
                <button type="button" disabled={busy} onClick={() => save(done)} class={`${btn} bg-primary text-on-primary disabled:opacity-60`} data-vu-save>
                  {busy ? 'Save ho raha hai…' : phase.k === 'stopped' ? 'Baqi dobara bhejein' : 'Sahih hisse save karein'}
                </button>
              </>
            )}
          </section>
        </ContentPreview>
      )}
    </div>
  );
}

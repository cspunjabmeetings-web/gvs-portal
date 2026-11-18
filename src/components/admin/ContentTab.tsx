// spec: A05 Content (paste/.txt upload), A06 preview, F11-AC1..AC10, P-02 (preview browser mein), 8.7 (tukron mein import + progress bar)
// 9c: andar 4 chhote tabs — Naya content | Sawal | Mock | Notes (F12 lists, E18–E20).
import { useEffect, useState } from 'preact/hooks';
import { parseContent, type ParseResult, type ParsedMcq } from '../../lib/parser';
import { allMcqs, buildChunks, hashMcqs, IMPORT_BODY_LIMIT, UPLOAD_LIMIT, type Chunk } from '../../lib/content-chunks';
import ContentPreview, { type DupInfo } from './ContentPreview';
import McqList from './McqList';
import MockList from './MockList';
import NoteList from './NoteList';

type Sub = 'new' | 'mcqs' | 'mocks' | 'notes';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'new', label: 'Naya content' },
  { id: 'mcqs', label: 'Sawal' },
  { id: 'mocks', label: 'Mock' },
  { id: 'notes', label: 'Notes' },
];

const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';
const HASH_BATCH = 100;

interface Saved {
  MCQ: number;
  MOCK: number;
  NOTE: number;
}
type Phase =
  | { k: 'edit' }
  | { k: 'saving'; done: number; total: number }
  | { k: 'stopped'; done: number; total: number; message: string }
  | { k: 'done'; total: number };

export const CONTENT_MSG = {
  notTxt: 'Sirf .txt file (PDF ya Word nahin). Word se "Save as → Plain text (.txt)" karein.',
  tooBig: 'File 512 KB se bari hai. Hisson mein bantein.',
  notUtf8: 'File UTF-8 mein nahin lagti (ajeeb nishan). Notepad mein "Save as → Encoding: UTF-8" karein.',
  noSubjects: 'Mazameen ki list nahin khuli. Dobara koshish karein.',
} as const;

class SizeError extends Error {
  constructor() {
    super('Yeh hissa 600 KB se bara hai; chhota karein.');
  }
}

export default function ContentTab() {
  const [text, setText] = useState('');
  const [fileMsg, setFileMsg] = useState('');
  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [sub, setSub] = useState<Sub>('new');
  const [mockFilter, setMockFilter] = useState<{ id: number; name: string } | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dup, setDup] = useState<DupInfo>({ existing: new Set(), repeats: new Map() });
  const [dupNote, setDupNote] = useState('');
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [phase, setPhase] = useState<Phase>({ k: 'edit' });
  const [saved, setSaved] = useState<Saved>({ MCQ: 0, MOCK: 0, NOTE: 0 });

  // Mazameen Settings se (F10-AC4) — parser inhi se jaanchta hai
  async function loadSubjects() {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (res.status === 401) return location.reload();
      const data = (await res.json()) as { ok?: boolean; settings?: { subjects?: string[] } };
      if (res.ok && data.ok && data.settings?.subjects) setSubjects(data.settings.subjects);
      else setFileMsg(CONTENT_MSG.noSubjects);
    } catch {
      setFileMsg(CONTENT_MSG.noSubjects);
    }
  }
  useEffect(() => {
    void loadSubjects();
  }, []);

  const busy = phase.k === 'saving';

  function changeText(t: string) {
    setText(t);
    // Text badla to purana preview baasi
    if (result && phase.k !== 'saving') {
      setResult(null);
      setPhase({ k: 'edit' });
    }
  }

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    setFileMsg('');
    if (!f) return;
    if (!/\.txt$/i.test(f.name) || (f.type && f.type !== 'text/plain')) return setFileMsg(CONTENT_MSG.notTxt);
    if (f.size > UPLOAD_LIMIT) return setFileMsg(CONTENT_MSG.tooBig);
    const t = await f.text();
    if (t.includes('�')) return setFileMsg(CONTENT_MSG.notUtf8);
    changeText(t);
    setFileMsg(`"${f.name}" khul gayi. Ab "Preview dekhein" dabayen.`);
  }

  async function preview() {
    if (!subjects) return;
    const r = parseContent(text, { subjects });
    setResult(r);
    setPhase({ k: 'edit' });
    // F11-AC6: naya preview = nayi tasdeeq
    setVerified(false);
    setSaved({ MCQ: 0, MOCK: 0, NOTE: 0 });
    setChunks(buildChunks(r.items));
    setDupNote('');
    // F11-AC7: paste ke andar + database mein ek jaise sawal
    setChecking(true);
    try {
      const { hashes, repeats } = await hashMcqs(r.items);
      const list = allMcqs(r.items);
      const existing = new Set<ParsedMcq>();
      const unique = [...new Set(hashes.values())];
      const found = new Set<string>();
      for (let i = 0; i < unique.length; i += HASH_BATCH) {
        const res = await fetch(`/api/admin/mcqs?hashes=${unique.slice(i, i + HASH_BATCH).join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
        if (res.status === 401) return location.reload();
        const data = (await res.json()) as { ok?: boolean; existing?: string[] };
        if (!res.ok || !data.ok) throw new Error();
        for (const h of data.existing ?? []) found.add(h);
      }
      for (const q of list) if (found.has(hashes.get(q)!)) existing.add(q);
      setDup({ existing, repeats });
    } catch {
      setDup({ existing: new Set(), repeats: new Map() });
      setDupNote('Database mein ek jaise sawal ki jaanch nahin ho saki (internet). Baqi preview theek hai.');
    } finally {
      setChecking(false);
    }
  }

  /** Tukre ek ek kar ke; masla ho to wahin ruko — jo save ho chuke woh dobara nahin jate */
  async function save(from: number) {
    const total = chunks.length;
    setPhase({ k: 'saving', done: from, total });
    for (let i = from; i < total; i++) {
      const c = chunks[i];
      let message = '';
      try {
        const body = JSON.stringify({ text: c.text, verified });
        if (new TextEncoder().encode(body).length > IMPORT_BODY_LIMIT) throw new SizeError();
        const res = await fetch('/api/admin/content/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30_000) });
        if (res.status === 401) return location.reload();
        const data = (await res.json()) as { ok?: boolean; saved?: Saved; error?: { message?: string; errors?: { message: string }[] } };
        if (!res.ok || !data.ok || !data.saved) {
          message = [data.error?.message, ...(data.error?.errors ?? []).slice(0, 3).map((e) => e.message)].filter(Boolean).join(' ') || 'Save nahin hua.';
        } else {
          const s = data.saved;
          setSaved((p) => ({ MCQ: p.MCQ + s.MCQ, MOCK: p.MOCK + s.MOCK, NOTE: p.NOTE + s.NOTE }));
          setPhase({ k: 'saving', done: i + 1, total });
          continue;
        }
      } catch (e) {
        // Browser ke English paigham ("Failed to fetch") nahin; sirf apna
        message = e instanceof SizeError ? e.message : 'Internet ya server ka masla.';
      }
      setPhase({ k: 'stopped', done: i, total, message });
      return;
    }
    setPhase({ k: 'done', total });
  }

  function reset() {
    setText('');
    setResult(null);
    setChunks([]);
    setPhase({ k: 'edit' });
    setSaved({ MCQ: 0, MOCK: 0, NOTE: 0 });
    setFileMsg('');
    // F11-AC6: har naye paste ki tasdeeq alag — pichhla tick saath na jaye
    setVerified(false);
  }

  const savedLine = `${saved.MCQ} sawal, ${saved.MOCK} mock, ${saved.NOTE} notes save ho gaye.`;
  const pct = phase.k === 'saving' || phase.k === 'stopped' ? Math.round((phase.done / Math.max(1, phase.total)) * 100) : 100;

  const subNav = (
    <nav aria-label="Content ke hisse" class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul class="flex gap-2">
        {SUBS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => {
                setSub(t.id);
                if (t.id !== 'mcqs') setMockFilter(null);
              }}
              aria-pressed={sub === t.id}
              disabled={busy}
              class={`min-h-[44px] whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${sub === t.id ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'border border-border'}`}
              data-sub={t.id}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (sub !== 'new')
    return (
      <div class="flex flex-col gap-4" data-content>
        {subNav}
        {!subjects ? (
          <p class="text-muted">Load ho raha hai…</p>
        ) : sub === 'mcqs' ? (
          <McqList subjects={subjects} mock={mockFilter} onClearMock={() => setMockFilter(null)} />
        ) : sub === 'mocks' ? (
          <MockList
            onShowQuestions={(m) => {
              setMockFilter(m);
              setSub('mcqs');
            }}
          />
        ) : (
          <NoteList subjects={subjects} />
        )}
      </div>
    );

  return (
    <div class="flex flex-col gap-4" data-content>
      {subNav}
      <section class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 class="text-lg">Naya content daalein</h2>
        <p class="text-sm text-muted">
          <code># MCQ</code>, <code># MOCK</code> … <code># END MOCK</code>, <code># NOTE</code> format mein text paste karein, ya <code>.txt</code> file chunein (512 KB tak).
        </p>
        <label for="content-text" class="text-sm font-medium">
          Text
        </label>
        <textarea
          id="content-text"
          rows={10}
          value={text}
          disabled={busy}
          onInput={(e) => changeText((e.target as HTMLTextAreaElement).value)}
          placeholder={'# MCQ\nMazmoon: Pakistan Studies\nSawal: Qarardad-e-Pakistan kis saal manzoor hui?\nA) 1930\nB) 1940*\nC) 1947\n---'}
          class="rounded-lg border border-border bg-surface p-2 font-mono text-sm"
          spellcheck={false}
        />
        <div class="flex flex-col gap-2 sm:flex-row">
          <label class={`${btn} inline-flex justify-center cursor-pointer items-center border border-border ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            .txt file chunein
            <input type="file" accept=".txt,text/plain" onChange={onFile} class="sr-only" disabled={busy} data-upload />
          </label>
          <button type="button" onClick={preview} disabled={busy || !text.trim() || !subjects || checking} class={`${btn} flex-1 bg-primary text-on-primary disabled:opacity-60`} data-preview-btn>
            {checking ? 'Jaanch ho rahi hai…' : 'Preview dekhein'}
          </button>
        </div>
        {fileMsg && (
          <p class={`text-sm ${fileMsg.includes('khul gayi') ? 'text-correct' : 'text-wrong'}`} role={fileMsg.includes('khul gayi') ? 'status' : 'alert'} data-file-msg>
            {fileMsg}
          </p>
        )}
      </section>

      {result && (
        <>
          <ContentPreview result={result} dup={dup}>
          {dupNote && <p class="text-sm text-muted">{dupNote}</p>}

          <section class="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-4" data-save-box>
            {chunks.length === 0 ? (
              <p class="text-sm text-muted">Save karne ke liye koi sahih cheez nahin.</p>
            ) : phase.k === 'done' ? (
              <>
                <p class="font-semibold text-correct" role="status" data-import-done>
                  ✓ {savedLine}
                </p>
                {!verified && saved.MCQ > 0 && <p class="text-sm text-muted">Sawal "na jaanche" hain; visitors ko tab dikhenge jab aap inhein verified karein (Qadam 9c ki list).</p>}
                <button type="button" onClick={reset} class={`${btn} border border-border`}>
                  Naya paste
                </button>
              </>
            ) : (
              <>
                <label for="content-verified" class="flex min-h-[44px] items-center gap-3">
                  <input id="content-verified" type="checkbox" checked={verified} disabled={busy || phase.k === 'stopped'} onChange={(e) => setVerified((e.target as HTMLInputElement).checked)} class="h-6 w-6 accent-[var(--primary)]" />
                  <span class="font-medium">Main ne yeh sawal jaanch liye hain</span>
                </label>
                {!verified && <p class="text-xs text-muted">Tick na ho to sawal (aur is ke mock) visitors ko nahin dikhenge.</p>}
                {(phase.k === 'saving' || phase.k === 'stopped') && (
                  <div>
                    <div class="h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Save ho raha hai">
                      <div class="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p class="mt-1 text-sm tabular" aria-live="polite">
                      {phase.done}/{phase.total} hisse · {savedLine}
                    </p>
                  </div>
                )}
                {phase.k === 'stopped' && (
                  <p class="text-sm text-wrong" role="alert" data-import-stopped>
                    Hissa {phase.done + 1} save nahin hua: {phase.message} Jo save ho chuke woh mehfooz hain.
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(phase.k === 'stopped' ? phase.done : 0)}
                  class={`${btn} bg-primary text-on-primary disabled:opacity-60`}
                  data-save-content
                >
                  {busy ? 'Save ho raha hai…' : phase.k === 'stopped' ? 'Baqi dobara bhejein' : 'Sahih hisse save karein'}
                </button>
              </>
            )}
          </section>
          </ContentPreview>
        </>
      )}
    </div>
  );
}

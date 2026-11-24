// spec: F32-AC1 — VU Important Questions: upload (E35), list, badalna, dikhana/chhupana, mitana (E34)
import { useEffect, useRef, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import { UPLOAD_LIMIT } from '../../lib/content-chunks';
import { parseSawal, SAWAL_LIMITS, type ParsedSawal } from '../../lib/vu-sawal';
import { normalizeCode, TERM_LABEL, VU_TERMS, type VuTerm } from '../../lib/vu';
import type { AdminCourse } from '../../lib/vu-admin';
import type { VuQuestion } from '../../lib/vu-questions';
import { CONTENT_MSG } from './ContentTab';

const btn = 'min-h-[44px] rounded-lg px-4 text-sm font-semibold';
const input = 'min-h-[44px] rounded-lg border border-border bg-surface px-3';
type Parsed = { items: ParsedSawal[]; errors: { line: number; message: string }[] };

function Upload(p: { courses: AdminCourse[]; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [term, setTerm] = useState<VuTerm | ''>('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function change(t: string) {
    setText(t);
    setParsed(null);
    setMsg(null);
    setVerified(false);
  }
  async function onFile(e: Event) {
    const el = e.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    const bad = (t: string) => setMsg({ ok: false, text: t });
    if (!/\.txt$/i.test(f.name)) return bad(CONTENT_MSG.notTxt);
    if (f.size > UPLOAD_LIMIT) return bad(CONTENT_MSG.tooBig);
    const t = await f.text();
    if (t.includes(String.fromCharCode(0xfffd))) return bad(CONTENT_MSG.notUtf8);
    change(t);
    setMsg({ ok: true, text: `"${f.name}" khul gayi. Ab "Preview dekhein" dabayen.` });
  }
  async function save() {
    if (!parsed) return;
    if (!term) return setMsg({ ok: false, text: 'Pehle Midterm ya Final Term chunein.' });
    setBusy(true);
    let saved = 0;
    let skipped = 0;
    for (let i = 0; i < parsed.items.length; i += SAWAL_LIMITS.chunk) {
      const chunk = parsed.items.slice(i, i + SAWAL_LIMITS.chunk);
      const r = await adminJson<{ saved: number; skipped: number }>('/api/admin/vu/questions/import', { body: { text: chunk.map((x) => x.source).join('\n'), term, verified } });
      if (!r.ok) {
        setBusy(false);
        // Dobara bhejna mehfooz: jo save ho chuke woh server khud chhor deta hai
        return setMsg({ ok: false, text: `${r.message} ${saved} save ho chuke; Save dobara dabayen.` });
      }
      saved += r.data.saved;
      skipped += r.data.skipped;
    }
    setBusy(false);
    setText('');
    setParsed(null);
    setTerm('');
    setVerified(false);
    setMsg({ ok: true, text: `✓ ${TERM_LABEL[term]}: ${saved} sawal save ho gaye${skipped ? `, ${skipped} pehle se the (chhor diye)` : ''}.` });
    p.onSaved();
  }

  return (
    <section class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 class="text-lg">Important Questions daalein</h2>
      <label for="vuq-text" class="text-sm text-muted">
        <code># SAWAL</code> format, ek dafa mein ek hi term, {SAWAL_LIMITS.perPaste} sawal tak. Jawab nahin likhte.
      </label>
      <textarea
        id="vuq-text"
        rows={7}
        value={text}
        disabled={busy}
        onInput={(e) => change((e.target as HTMLTextAreaElement).value)}
        placeholder={'# SAWAL\nCourse: CS101\nSawal: Differentiate between RAM and ROM.\nMarks: 5\n---'}
        class="rounded-lg border border-border bg-surface p-2 font-mono text-sm"
        spellcheck={false}
      />
      <div class="flex flex-col gap-2 sm:flex-row">
        <label class={`${btn} inline-flex cursor-pointer items-center justify-center border border-border`}>
          .txt file chunein
          <input type="file" accept=".txt,text/plain" onChange={onFile} class="sr-only" disabled={busy} />
        </label>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => {
            setMsg(null);
            setParsed(
              parseSawal(
                text,
                p.courses.map((c) => c.code),
              ),
            );
          }}
          class={`${btn} flex-1 bg-primary text-on-primary disabled:opacity-60`}
          data-vuq-preview
        >
          Preview dekhein
        </button>
      </div>
      {msg && (
        <p class={`text-sm font-medium ${msg.ok ? 'text-correct' : 'text-wrong'}`} role={msg.ok ? 'status' : 'alert'} data-vuq-msg>
          {msg.text}
        </p>
      )}
      {parsed && (
        <>
          {parsed.errors.length > 0 && (
            <ul class="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg bg-wrong-bg p-3 text-sm text-wrong" role="alert" data-vuq-errors>
              {parsed.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
          <p class="text-sm" data-vuq-found>
            <span class="tabular font-semibold">{parsed.items.length}</span> sahih sawal
            {parsed.errors.length > 0 && ' (ghalat wale save nahin hon ge)'}
          </p>
          {parsed.items.length > 0 && parsed.items.length <= SAWAL_LIMITS.perPaste && (
            <div class="flex flex-col gap-3 rounded-xl border-2 border-primary p-3">
              <ol class="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
                {parsed.items.map((x) => (
                  <li key={x.line} class="break-words rounded-lg bg-surface-2 p-2">
                    <span class="text-muted">
                      {x.course}
                      {x.marks && ` · ${x.marks} marks`}
                    </span>
                    <span class="block">{x.question}</span>
                  </li>
                ))}
              </ol>
              <div class="grid grid-cols-2 gap-2" role="group" aria-label="Term">
                {VU_TERMS.map((t) => (
                  <button key={t} type="button" disabled={busy} aria-pressed={term === t} onClick={() => setTerm(t)} class={`${btn} ${term === t ? 'bg-primary text-on-primary' : 'border border-border'}`} data-vuq-term={t}>
                    {TERM_LABEL[t]}
                  </button>
                ))}
              </div>
              <label for="vuq-ver" class="flex min-h-[44px] items-center gap-3">
                <input id="vuq-ver" type="checkbox" checked={verified} disabled={busy} onChange={(e) => setVerified((e.target as HTMLInputElement).checked)} class="h-6 w-6 accent-[var(--primary)]" />
                <span class="font-medium">Main ne yeh sawal jaanch liye hain</span>
              </label>
              <button type="button" disabled={busy} onClick={save} class={`${btn} bg-primary text-on-primary disabled:opacity-60`} data-vuq-save>
                {busy ? 'Save ho raha hai…' : 'Sahih sawal save karein'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function VuQuestions(p: { courses: AdminCourse[]; course: string; onCourse: (c: string) => void; onChange: () => void }) {
  const [typed, setTyped] = useState(p.course);
  const [term, setTerm] = useState<VuTerm | ''>('');
  const [ver, setVer] = useState<'' | '0' | '1'>('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<VuQuestion[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<{ id: number; question: string; marks: string } | null>(null);
  const [tick, setTick] = useState(0);
  const req = useRef(0);
  const current = p.courses.find((c) => c.code === p.course);

  async function load(offset = 0) {
    const n = ++req.current;
    if (!p.course) return setItems([]);
    const params = new URLSearchParams({ course: p.course, offset: String(offset) });
    if (term) params.set('term', term);
    if (ver) params.set('verified', ver);
    if (q.trim()) params.set('q', q.trim());
    const r = await adminJson<{ items: VuQuestion[]; hasMore: boolean }>(`/api/admin/vu/questions?${params}`);
    if (n !== req.current) return;
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
  }
  useEffect(() => {
    const t = setTimeout(() => void load(0), 300);
    return () => clearTimeout(t);
  }, [p.course, term, ver, q, tick]);

  async function act(url: string, init: { method?: string; body?: unknown }, done: string) {
    const r = await adminJson(url, init);
    setNote(r.ok ? { ok: true, text: done } : { ok: false, text: r.message });
    if (r.ok) {
      setEdit(null);
      setTick((t) => t + 1);
      p.onChange();
    }
  }
  const chip = (on: boolean, label: string, set: () => void) => (
    <button type="button" onClick={set} aria-pressed={on} class={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${on ? 'bg-primary text-on-primary' : 'border border-border'}`}>
      {label}
    </button>
  );

  return (
    <div class="flex flex-col gap-4" data-vuq>
      <Upload
        courses={p.courses}
        onSaved={() => {
          setTick((t) => t + 1);
          p.onChange();
        }}
      />
      <section class="flex flex-col gap-3">
        <h2 class="text-lg">Save shuda sawal</h2>
        <label for="vuq-pick" class="text-sm font-medium">
          Course code
        </label>
        <input
          id="vuq-pick"
          list="vuq-codes"
          value={typed}
          placeholder="Maslan CS101"
          autocomplete="off"
          class={input}
          onInput={(e) => {
            const t = (e.target as HTMLInputElement).value;
            setTyped(t);
            setEdit(null);
            const code = normalizeCode(t);
            p.onCourse(code && p.courses.some((c) => c.code === code) ? code : '');
          }}
        />
        <datalist id="vuq-codes">
          {p.courses.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </datalist>
        {!current ? (
          <p class="text-muted">{typed.trim() ? 'Is code ka course nahin mila.' : 'Course ka code likhein ya list se chunein.'}</p>
        ) : (
          <>
            <p class="font-semibold" data-vuq-count>
              {current.code}: Midterm {current.qMidOk}/{current.qMidAll} · Final {current.qFinalOk}/{current.qFinalAll} <span class="font-normal text-muted">jaanche</span>
            </p>
            <label for="vuq-q" class="sr-only">
              Sawal dhoondein
            </label>
            <input id="vuq-q" type="search" placeholder="Sawal ke alfaz se dhoondein" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} class={input} />
            <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
              {chip(term === '', 'Dono terms', () => setTerm(''))}
              {chip(term === 'mid', 'Midterm', () => setTerm('mid'))}
              {chip(term === 'final', 'Final', () => setTerm('final'))}
            </div>
            <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
              {chip(ver === '', 'Sab', () => setVer(''))}
              {chip(ver === '0', 'Na jaanche', () => setVer('0'))}
              {chip(ver === '1', 'Jaanche hue', () => setVer('1'))}
            </div>
          </>
        )}
        {note && (
          <p class={`text-sm font-medium ${note.ok ? 'text-correct' : 'text-wrong'}`} role={note.ok ? 'status' : 'alert'}>
            {note.text}
          </p>
        )}
        {current && items.length === 0 && <p class="text-muted">Koi sawal nahin mila.</p>}
        {current && (
          <ul class="flex flex-col gap-3">
            {items.map((m) => (
              <li key={m.id} class={`flex flex-col gap-2 rounded-xl border bg-surface p-3 ${m.verified ? 'border-border' : 'border-warn'}`} data-vuq-item={m.id}>
                {edit?.id === m.id ? (
                  <>
                    <label for="vuq-edit" class="text-sm font-medium">
                      Sawal
                    </label>
                    <textarea id="vuq-edit" rows={3} maxLength={SAWAL_LIMITS.question} value={edit.question} onInput={(e) => setEdit({ ...edit, question: (e.target as HTMLTextAreaElement).value })} class="rounded-lg border border-border bg-surface p-2" />
                    <label for="vuq-marks" class="text-sm font-medium">
                      Marks (ikhtiyari)
                    </label>
                    <input id="vuq-marks" inputMode="numeric" maxLength={3} value={edit.marks} onInput={(e) => setEdit({ ...edit, marks: (e.target as HTMLInputElement).value })} class={input} />
                    <div class="flex gap-2">
                      <button
                        type="button"
                        onClick={() => act('/api/admin/vu/questions', { body: { action: 'save', id: m.id, question: edit.question, marks: edit.marks.trim() ? Number(edit.marks) : null } }, 'Sawal badal diya.')}
                        class={`${btn} flex-1 bg-primary text-on-primary`}
                        data-vuq-save-edit
                      >
                        Save karein
                      </button>
                      <button type="button" onClick={() => setEdit(null)} class={`${btn} border border-border`}>
                        Wapas
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p class="text-xs text-muted">
                      #{m.id} · {TERM_LABEL[m.term]}
                      {m.marks && ` · ${m.marks} marks`}
                    </p>
                    <p class={`text-xs font-semibold ${m.verified ? 'text-correct' : 'text-warn'}`}>{m.verified ? '✓ Students ko dikhta hai' : '● Chhupa (na jaancha)'}</p>
                    <p class="break-words">{m.question}</p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => act('/api/admin/vu/questions', { body: { action: 'verify', id: m.id, verified: !m.verified } }, m.verified ? 'Sawal chhupa diya.' : 'Sawal students ko dikhe ga.')}
                        class={`${btn} ${m.verified ? 'border border-border' : 'bg-primary text-on-primary'}`}
                        data-toggle
                      >
                        {m.verified ? 'Chhupayen' : 'Dikhayen'}
                      </button>
                      <button type="button" onClick={() => setEdit({ id: m.id, question: m.question, marks: m.marks ? String(m.marks) : '' })} class={`${btn} border border-border`} data-edit>
                        Badlein
                      </button>
                      <button type="button" onClick={() => confirm('Yeh sawal hamesha ke liye mitayen?') && act(`/api/admin/vu/questions/${m.id}`, { method: 'DELETE' }, 'Sawal mita diya.')} class={`${btn} border border-border text-wrong`} data-delete>
                        Mitayen
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {current && hasMore && (
          <button type="button" onClick={() => load(items.length)} class={`${btn} border border-border`}>
            Aur dikhayen
          </button>
        )}
      </section>
    </div>
  );
}

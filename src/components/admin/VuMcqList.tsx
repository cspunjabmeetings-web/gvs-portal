// spec: F29-AC3 — ek course ke sawal: term, jaancha, search, badalna, dikhana/chhupana, mitana (E27)
import { useEffect, useRef, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminCourse, VuMcq } from '../../lib/vu-admin';
import { normalizeCode, TERM_LABEL, type VuTerm } from '../../lib/vu';
import McqForm from './McqForm';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const LETTERS = 'ABCDE';
type Ver = '' | '1' | '0';

export default function VuMcqList(p: { courses: AdminCourse[]; course: string; onCourse: (code: string) => void }) {
  const [typed, setTyped] = useState(p.course);
  const [term, setTerm] = useState<VuTerm | ''>('');
  const [ver, setVer] = useState<Ver>('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<VuMcq[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const req = useRef(0);
  const current = p.courses.find((c) => c.code === p.course);

  async function load(offset = 0) {
    const n = ++req.current;
    if (!p.course) return setItems([]);
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ course: p.course, offset: String(offset) });
    if (term) params.set('term', term);
    if (ver) params.set('verified', ver);
    if (q.trim()) params.set('q', q.trim());
    const r = await adminJson<{ items: VuMcq[]; hasMore: boolean }>(`/api/admin/vu/mcqs?${params}`);
    if (n !== req.current) return;
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
  }
  useEffect(() => {
    const t = setTimeout(() => void load(0), 300);
    return () => clearTimeout(t);
  }, [p.course, term, ver, q]);

  async function toggle(m: VuMcq) {
    setBusyId(m.id);
    const r = await adminJson('/api/admin/vu/mcqs', { body: { action: 'verify', id: m.id, verified: !m.verified } });
    setBusyId(null);
    if (!r.ok) return setError(r.message);
    setItems((list) => list.map((x) => (x.id === m.id ? { ...x, verified: !m.verified } : x)));
    setNotice(m.verified ? 'Sawal chhupa diya.' : 'Sawal jaancha hua, students ko dikhe ga.');
  }
  async function remove(m: VuMcq) {
    if (!confirm(`Yeh sawal hamesha ke liye mitayen?\n\n"${m.question.slice(0, 80)}"`)) return;
    setBusyId(m.id);
    const r = await adminJson(`/api/admin/vu/mcqs/${m.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!r.ok) return setError(r.message);
    setItems((list) => list.filter((x) => x.id !== m.id));
    setNotice('Sawal mita diya.');
  }

  const chip = (on: boolean, label: string, set: () => void) => (
    <button type="button" onClick={set} aria-pressed={on} class={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${on ? 'bg-primary text-on-primary' : 'border border-border'}`}>
      {label}
    </button>
  );

  return (
    <div class="flex flex-col gap-3" data-vu-list>
      <label for="vu-pick" class="text-sm font-medium">
        Course code
      </label>
      <input
        id="vu-pick"
        list="vu-codes"
        value={typed}
        placeholder="Maslan CS101"
        onInput={(e) => {
          const t = (e.target as HTMLInputElement).value;
          setTyped(t);
          const code = normalizeCode(t);
          setEditing(null);
          p.onCourse(code && p.courses.some((c) => c.code === code) ? code : '');
        }}
        class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
        autocomplete="off"
      />
      <datalist id="vu-codes">
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
          <p class="font-semibold">
            {current.code} <span class="font-normal text-muted">{current.name}</span>
          </p>
          <label for="vu-q" class="sr-only">
            Sawal dhoondein
          </label>
          <input id="vu-q" type="search" placeholder="Sawal ke alfaz se dhoondein" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} class="min-h-[44px] rounded-lg border border-border bg-surface px-3" />
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
      {notice && (
        <p class="text-sm font-medium text-correct" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      {current && !loading && !error && items.length === 0 && <p class="text-muted">Koi sawal nahin mila.</p>}
      {current && (
        <ul class="flex flex-col gap-3">
          {items.map((m) => (
            <li key={m.id} data-vu-mcq={m.id}>
              {editing === m.id ? (
                <McqForm
                  mcq={m}
                  subjects={[m.subject]}
                  endpoint="/api/admin/vu/mcqs"
                  onCancel={() => setEditing(null)}
                  onDone={() => {
                    setEditing(null);
                    setNotice('Sawal badal diya.');
                    void load(0);
                  }}
                />
              ) : (
                <article class={`flex flex-col gap-2 rounded-xl border bg-surface p-3 ${m.verified ? 'border-border' : 'border-warn'}`}>
                  <p class="text-xs text-muted">
                    #{m.id} · {TERM_LABEL[m.term]}
                    {m.difficulty && ` · ${m.difficulty}`}
                  </p>
                  <p class={`text-xs font-semibold ${m.verified ? 'text-correct' : 'text-warn'}`}>{m.verified ? '✓ Jaancha hua' : '● Chhupa (na jaancha)'}</p>
                  <p class="break-words font-semibold">{m.question}</p>
                  <ol class="flex flex-col gap-1 text-sm">
                    {m.options.map((o, i) => (
                      <li key={i} class={i === m.answerIndex ? 'font-semibold text-correct' : ''}>
                        {LETTERS[i]}) {o}
                        {i === m.answerIndex && ' ✓'}
                      </li>
                    ))}
                  </ol>
                  {m.explanation && <p class="text-sm text-muted">Tashreeh: {m.explanation}</p>}
                  <div class="flex flex-wrap gap-2">
                    <button type="button" disabled={busyId === m.id} onClick={() => toggle(m)} class={`${btn} ${m.verified ? 'border border-border' : 'bg-primary text-on-primary'}`} data-toggle>
                      {m.verified ? 'Chhupayen' : 'Dikhayen'}
                    </button>
                    <button type="button" onClick={() => setEditing(m.id)} class={`${btn} border border-border`} data-edit>
                      Badlein
                    </button>
                    <button type="button" disabled={busyId === m.id} onClick={() => remove(m)} class={`${btn} border border-border text-wrong`} data-delete>
                      Mitayen
                    </button>
                  </div>
                </article>
              )}
            </li>
          ))}
        </ul>
      )}
      {loading && <p class="text-muted">Load ho raha hai…</p>}
      {current && hasMore && !loading && (
        <button type="button" onClick={() => load(items.length)} class={`${btn} border border-border`}>
          Aur dikhayen
        </button>
      )}
    </div>
  );
}

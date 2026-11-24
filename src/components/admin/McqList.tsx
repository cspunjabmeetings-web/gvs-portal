// spec: A05 (MCQs ki list: search, filter, edit, chhupana, mitana, verified), F12-AC1, AC2, AC6, E18
import { useEffect, useRef, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminMcq } from '../../lib/admin-content';
import DupMcqs from './DupMcqs';
import McqForm from './McqForm';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const LETTERS = 'ABCDE';
type Ver = 'all' | '1' | '0';
interface ListResp {
  items: AdminMcq[];
  hasMore: boolean;
  summary: { total: number; unverified: number };
}

export default function McqList(p: { subjects: string[]; mock: { id: number; name: string } | null; onClearMock: () => void }) {
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [ver, setVer] = useState<Ver>('all');
  const [items, setItems] = useState<AdminMcq[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState<ListResp['summary'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [dups, setDups] = useState(false);
  const req = useRef(0);

  async function load(offset = 0) {
    const n = ++req.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ offset: String(offset) });
    if (q.trim()) params.set('q', q.trim());
    if (subject) params.set('subject', subject);
    if (ver !== 'all') params.set('verified', ver);
    if (p.mock) params.set('mock', String(p.mock.id));
    const r = await adminJson<ListResp>(`/api/admin/mcqs?${params}`);
    if (n !== req.current) return;
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
    setSummary(r.data.summary);
  }

  // Search 300 ms ruk kar; filters foran
  useEffect(() => {
    const t = setTimeout(() => void load(0), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    void load(0);
  }, [subject, ver, p.mock?.id]);

  async function toggle(m: AdminMcq) {
    setBusyId(m.id);
    const r = await adminJson<{ verified: boolean }>('/api/admin/mcqs', { body: { action: 'verify', id: m.id, verified: !m.verified } });
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setItems((list) => list.map((x) => (x.id === m.id ? { ...x, verified: r.data.verified } : x)));
    setSummary((s) => (s ? { ...s, unverified: s.unverified + (r.data.verified ? -1 : 1) } : s));
    setNotice(r.data.verified ? 'Sawal visitors ko dikhe ga.' : 'Sawal visitors se chhupa diya.');
  }

  async function remove(m: AdminMcq) {
    if (!confirm(`Yeh sawal hamesha ke liye mitayen?\n\n"${m.question.slice(0, 80)}"`)) return;
    setBusyId(m.id);
    const r = await adminJson(`/api/admin/mcqs/${m.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setItems((list) => list.filter((x) => x.id !== m.id));
    setSummary((s) => (s ? { total: s.total - 1, unverified: s.unverified - (m.verified ? 0 : 1) } : s));
    setNotice('Sawal mita diya.');
  }

  const chip = (v: Ver, label: string) => (
    <button
      type="button"
      onClick={() => setVer(v)}
      aria-pressed={ver === v}
      class={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${ver === v ? 'bg-primary text-on-primary' : 'border border-border'}`}
    >
      {label}
    </button>
  );

  return (
    <div class="flex flex-col gap-3" data-mcq-list>
      {summary && (
        <p class="text-sm text-muted" data-mcq-summary>
          Kul <span class="tabular font-semibold text-text">{summary.total}</span> sawal · na jaanche (chhupe){' '}
          <span class="tabular font-semibold text-text">{summary.unverified}</span>
        </p>
      )}
      {dups ? (
        <DupMcqs
          onClose={() => {
            setDups(false);
            void load(0);
          }}
        />
      ) : (
        <button type="button" onClick={() => setDups(true)} class={`${btn} self-start border border-border`} data-dup-open>
          Dohre sawal dhoondein
        </button>
      )}
      {p.mock && (
        <p class="flex items-center justify-between gap-2 rounded-lg bg-primary-soft px-3 text-sm" data-mock-filter>
          <span>Mock: {p.mock.name}</span>
          <button type="button" onClick={p.onClearMock} class={`${btn}`}>
            ✕ Sab sawal
          </button>
        </p>
      )}
      <label for="mcq-search" class="sr-only">
        Sawal dhoondein
      </label>
      <input id="mcq-search" type="search" placeholder="Sawal ke alfaz se dhoondein" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} class="min-h-[44px] rounded-lg border border-border bg-surface px-3" />
      <div class="flex gap-2">
        <label for="mcq-subject" class="sr-only">
          Mazmoon
        </label>
        <select id="mcq-subject" value={subject} onChange={(e) => setSubject((e.target as HTMLSelectElement).value)} class="min-h-[44px] min-w-0 flex-1 rounded-lg border border-border bg-surface px-3">
          <option value="">Sab mazameen</option>
          {p.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setEditing('new')} class={`${btn} bg-primary text-on-primary`} data-mcq-new>
          + Naya sawal
        </button>
      </div>
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {chip('all', 'Sab')}
        {chip('0', 'Na jaanche')}
        {chip('1', 'Jaanche hue')}
      </div>

      {notice && (
        <p class="text-sm font-medium text-correct" role="status">
          {notice}
        </p>
      )}
      {editing === 'new' && (
        <McqForm
          subjects={p.subjects}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            setNotice('Naya sawal save ho gaya.');
            void load(0);
          }}
        />
      )}
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && <p class="text-muted">Koi sawal nahin mila.</p>}

      <ul class="flex flex-col gap-3">
        {items.map((m) => (
          <li key={m.id} data-mcq={m.id}>
            {editing === m.id ? (
              <McqForm
                mcq={m}
                subjects={p.subjects}
                onCancel={() => setEditing(null)}
                onDone={() => {
                  setEditing(null);
                  setNotice('Sawal badal diya.');
                  void load(0);
                }}
              />
            ) : (
              <article class={`flex flex-col gap-2 rounded-xl border bg-surface p-3 ${m.verified ? 'border-border' : 'border-warn'}`}>
                <p class="flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>#{m.id}</span>
                  <span>· {m.subject}</span>
                  {m.difficulty && <span>· {m.difficulty}</span>}
                  {m.asOfDate && <span>· {m.asOfDate}</span>}
                  {m.mockName && <span>· Mock: {m.mockName}</span>}
                </p>
                <p class={`text-xs font-semibold ${m.verified ? 'text-correct' : 'text-warn'}`} data-verified={m.verified ? '1' : '0'}>
                  {m.verified ? '✓ Visitors ko dikhta hai' : '● Chhupa (na jaancha)'}
                </p>
                <p class="font-semibold">{m.question}</p>
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
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => toggle(m)}
                    class={`${btn} ${m.verified ? 'border border-border' : 'bg-primary text-on-primary'} disabled:opacity-60`}
                    data-toggle
                  >
                    {m.verified ? 'Chhupayen' : 'Dikhayen'}
                  </button>
                  <button type="button" onClick={() => setEditing(m.id)} class={`${btn} border border-border`} data-edit>
                    Badlein
                  </button>
                  <button type="button" disabled={busyId === m.id} onClick={() => remove(m)} class={`${btn} border border-border text-wrong disabled:opacity-60`} data-delete>
                    Mitayen
                  </button>
                </div>
              </article>
            )}
          </li>
        ))}
      </ul>
      {loading && <p class="text-muted">Load ho raha hai…</p>}
      {hasMore && !loading && (
        <button type="button" onClick={() => load(items.length)} class={`${btn} border border-border`} data-more>
          Aur dikhayen
        </button>
      )}
    </div>
  );
}

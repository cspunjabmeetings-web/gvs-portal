// spec: A05 (Notes: edit, chhupana, mitana), E20, F12-AC2, AC4 (slug nahin badalta), AC5
import { useEffect, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import { PARSER_LIMITS } from '../../lib/parser';
import type { AdminNoteRow } from '../../lib/admin-content';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const input = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3';

interface FullNote {
  id: number;
  slug: string;
  title: string;
  subject: string;
  summary: string | null;
  body: string;
}

function NoteForm(p: { note: FullNote; subjects: string[]; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(p.note.title);
  const [subject, setSubject] = useState(p.note.subject);
  const [summary, setSummary] = useState(p.note.summary ?? '');
  const [body, setBody] = useState(p.note.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pre = `note-${p.note.id}`;

  async function save() {
    setBusy(true);
    setError('');
    const r = await adminJson('/api/admin/notes', { body: { action: 'save', id: p.note.id, title, subject, summary, body } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    p.onDone();
  }

  return (
    <div class="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-3" data-note-form>
      <h3 class="text-lg">Note badlein</h3>
      <p class="text-xs text-muted">URL wahi rahe ga: /notes/{p.note.slug}</p>
      <label for={`${pre}-title`} class="text-sm font-medium">
        Unwan
      </label>
      <input id={`${pre}-title`} type="text" maxLength={PARSER_LIMITS.shortText} value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} class={input} />
      <label for={`${pre}-subject`} class="text-sm font-medium">
        Mazmoon
      </label>
      <select id={`${pre}-subject`} value={subject} onChange={(e) => setSubject((e.target as HTMLSelectElement).value)} class={input}>
        {!p.subjects.includes(subject) && <option value={subject}>{subject} (list mein nahin)</option>}
        {p.subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <label for={`${pre}-summary`} class="text-sm font-medium">
        Khulasa (Google description) — {[...summary].length}/{PARSER_LIMITS.noteSummary}
      </label>
      <textarea id={`${pre}-summary`} rows={2} maxLength={PARSER_LIMITS.noteSummary} value={summary} onInput={(e) => setSummary((e.target as HTMLTextAreaElement).value)} class="rounded-lg border border-border bg-surface p-2" />
      <label for={`${pre}-body`} class="text-sm font-medium">
        Matn (## heading, - list, **mota**)
      </label>
      <textarea id={`${pre}-body`} rows={12} maxLength={PARSER_LIMITS.noteBody} value={body} onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)} class="rounded-lg border border-border bg-surface p-2 font-mono text-sm" spellcheck={false} />
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      <div class="flex gap-2">
        <button type="button" disabled={busy} onClick={save} class={`${btn} flex-1 bg-primary text-on-primary disabled:opacity-60`} data-note-save>
          {busy ? 'Save ho raha hai…' : 'Save karein'}
        </button>
        <button type="button" onClick={p.onCancel} class={`${btn} border border-border`}>
          Wapas
        </button>
      </div>
    </div>
  );
}

export default function NoteList(p: { subjects: string[] }) {
  const [items, setItems] = useState<AdminNoteRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<FullNote | null>(null);

  async function load(offset = 0) {
    setLoading(true);
    const r = await adminJson<{ items: AdminNoteRow[]; hasMore: boolean }>(`/api/admin/notes?offset=${offset}`);
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setError('');
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
  }
  useEffect(() => {
    void load(0);
  }, []);

  async function edit(n: AdminNoteRow) {
    setBusyId(n.id);
    const r = await adminJson<{ note: FullNote }>(`/api/admin/notes?id=${n.id}`);
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setEditing(r.data.note);
  }

  async function toggle(n: AdminNoteRow) {
    setBusyId(n.id);
    const r = await adminJson<{ visible: boolean }>('/api/admin/notes', { body: { action: 'visible', id: n.id, visible: !n.visible } });
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, visible: r.data.visible } : x)));
    setNotice(r.data.visible ? 'Note visitors ko dikhe ga.' : 'Note chhupa diya.');
  }

  async function remove(n: AdminNoteRow) {
    if (!confirm(`Note "${n.title}" mitayen?\n\nIs ka URL band ho jaye ga.`)) return;
    setBusyId(n.id);
    const r = await adminJson(`/api/admin/notes/${n.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setItems((list) => list.filter((x) => x.id !== n.id));
    setNotice('Note mita diya.');
  }

  return (
    <div class="flex flex-col gap-3" data-note-list>
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
      {!loading && !error && items.length === 0 && <p class="text-muted">Abhi koi note nahin. "Naya content" se # NOTE paste karein.</p>}
      <ul class="flex flex-col gap-3">
        {items.map((n) => (
          <li key={n.id} data-note={n.id}>
            {editing?.id === n.id ? (
              <NoteForm
                note={editing}
                subjects={p.subjects}
                onCancel={() => setEditing(null)}
                onDone={() => {
                  setEditing(null);
                  setNotice('Note badal diya.');
                  void load(0);
                }}
              />
            ) : (
              <article class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
                <p class="text-xs text-muted">{n.subject}</p>
                <h3 class="text-lg">{n.title}</h3>
                <p class={`text-xs font-semibold ${n.visible ? 'text-correct' : 'text-warn'}`} data-visible={n.visible ? '1' : '0'}>
                  {n.visible ? '✓ Visitors ko dikhta hai' : '● Chhupa'}
                </p>
                {n.summary && <p class="text-sm text-muted">{n.summary}</p>}
                <p class="break-all text-xs text-muted">/notes/{n.slug}</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === n.id} onClick={() => toggle(n)} class={`${btn} ${n.visible ? 'border border-border' : 'bg-primary text-on-primary'} disabled:opacity-60`} data-toggle>
                    {n.visible ? 'Chhupayen' : 'Dikhayen'}
                  </button>
                  <button type="button" disabled={busyId === n.id} onClick={() => edit(n)} class={`${btn} border border-border disabled:opacity-60`} data-edit>
                    Badlein
                  </button>
                  <button type="button" disabled={busyId === n.id} onClick={() => remove(n)} class={`${btn} border border-border text-wrong disabled:opacity-60`} data-delete>
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
        <button type="button" onClick={() => load(items.length)} class={`${btn} border border-border`}>
          Aur dikhayen
        </button>
      )}
    </div>
  );
}

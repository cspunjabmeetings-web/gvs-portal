// spec: F33-AC1, AC2 — admin VU → Achievements: banana, badalna, tarteeb, chhupana, mitana (E37); tasdeeq ka dabba lazmi
import { useEffect, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminAchievement } from '../../lib/achievements';
import { ACH_LIMITS, achTag, checkAchievement, midtermCgpa, PLACE_LABEL, type AchForm, type Place } from '../../lib/achievements-rules';

const btn = 'min-h-[44px] rounded-lg px-4 text-sm font-semibold';
const input = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3';
const EMPTY: AchForm = { kind: 'achievement', body: '', person: '', course: '', semester: '', rating: null, place: 'vu', confirm: false };
const URL = '/api/admin/achievements';

export default function VuAchievements() {
  const [items, setItems] = useState<AdminAchievement[] | null>(null);
  const [form, setForm] = useState<AchForm>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (x: Partial<AchForm>) => setForm((f) => ({ ...f, ...x }));

  async function load() {
    const r = await adminJson<{ items: AdminAchievement[] }>(URL);
    if (r.ok) setItems(r.data.items);
    else setMsg({ ok: false, text: r.message });
  }
  useEffect(() => {
    void load();
  }, []);

  async function act(url: string, init: { method?: string; body?: unknown }, done: string): Promise<boolean> {
    setBusy(true);
    const r = await adminJson(url, init);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.message });
    if (r.ok) await load();
    return r.ok;
  }
  async function save() {
    const c = checkAchievement(form);
    if (!c.ok) return setMsg({ ok: false, text: c.message });
    if (await act(URL, { body: { action: 'save', ...(editing !== null ? { id: editing } : {}), ...form } }, editing !== null ? 'Entry badal di.' : 'Entry save ho gayi.')) {
      setForm({ ...EMPTY, kind: form.kind, place: form.place });
      setEditing(null);
    }
  }
  function edit(a: AdminAchievement) {
    setEditing(a.id);
    // Har tabdeeli ki tasdeeq nayi
    setForm({ kind: a.kind, body: a.body, person: a.person ?? '', course: a.course ?? '', semester: a.semester ?? '', rating: a.rating, place: a.place, confirm: false });
    setMsg(null);
    document.querySelector('[data-ach-form]')?.scrollIntoView({ block: 'start' });
  }
  const text = (key: 'person' | 'course' | 'semester', label: string, max: number, ph: string) => (
    <div class="flex flex-col gap-1">
      <label for={`ach-${key}`} class="text-sm font-medium">
        {label}
      </label>
      <input id={`ach-${key}`} maxLength={max} placeholder={ph} value={form[key]} onInput={(e) => set({ [key]: (e.target as HTMLInputElement).value })} class={input} autocomplete="off" />
    </div>
  );
  const pick = <T extends string>(val: T, cur: T, label: string, on: () => void) => (
    <button key={val} type="button" aria-pressed={cur === val} onClick={on} class={`${btn} ${cur === val ? 'bg-primary text-on-primary' : 'border border-border'}`} data-pick={val}>
      {label}
    </button>
  );

  return (
    <div class="flex flex-col gap-4" data-ach>
      <section class="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-border bg-surface p-4" data-ach-form>
        <h2 class="text-lg">{editing !== null ? 'Entry badlein' : 'Nayi achievement ya remark'}</h2>
        <div class="grid grid-cols-2 gap-2" role="group" aria-label="Qism">
          {pick('achievement', form.kind, 'Achievement', () => set({ kind: 'achievement' }))}
          {pick('remark', form.kind, 'Remark', () => set({ kind: 'remark' }))}
        </div>
        <label for="ach-body" class="text-sm font-medium">
          Matn ({[...form.body.trim()].length}/{ACH_LIMITS.body})
        </label>
        <textarea
          id="ach-body"
          rows={3}
          maxLength={ACH_LIMITS.body}
          value={form.body}
          onInput={(e) => set({ body: (e.target as HTMLTextAreaElement).value })}
          placeholder={form.kind === 'remark' ? 'Student ke apne alfaz' : 'Asal nateeja, ginti ke sath'}
          class="rounded-lg border border-border bg-surface p-2"
        />
        {midtermCgpa(form) && (
          <p class="rounded-lg bg-surface-2 p-2 text-sm font-medium text-accent-text" role="status" data-ach-warn>
            ⚠ Midterm par CGPA/GPA nahin hota. Number likhein (maslan 18/20).
          </p>
        )}
        <div class="grid gap-3 sm:grid-cols-3">
          {text('person', 'Naam (ikhtiyari)', ACH_LIMITS.person, 'Ali R., BSCS')}
          {text('course', 'Course (ikhtiyari)', 8, 'CS101')}
          {text('semester', 'Semester (ikhtiyari)', ACH_LIMITS.semester, 'Fall 2025')}
        </div>
        {form.kind === 'remark' && (
          <div class="flex flex-col gap-1">
            <label for="ach-rating" class="text-sm font-medium">
              Rating (ikhtiyari)
            </label>
            <select id="ach-rating" value={form.rating ?? ''} onChange={(e) => set({ rating: Number((e.target as HTMLSelectElement).value) || null })} class={input}>
              <option value="">—</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)}
                </option>
              ))}
            </select>
          </div>
        )}
        <p class="text-sm font-medium">Kahan dikhe</p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Kahan dikhe">
          {(Object.keys(PLACE_LABEL) as Place[]).map((k) => pick(k, form.place, PLACE_LABEL[k], () => set({ place: k })))}
        </div>
        <label for="ach-ok" class="flex min-h-[44px] items-start gap-3 rounded-lg border-2 border-primary p-3">
          <input id="ach-ok" type="checkbox" checked={form.confirm} onChange={(e) => set({ confirm: (e.target as HTMLInputElement).checked })} class="mt-0.5 h-6 w-6 shrink-0 accent-[var(--primary)]" />
          <span class="font-medium">Yeh sach hai, saboot mere paas hai aur student ki ijazat hai</span>
        </label>
        {msg && (
          <p class={`text-sm font-medium ${msg.ok ? 'text-correct' : 'text-wrong'}`} role={msg.ok ? 'status' : 'alert'} data-ach-msg>
            {msg.text}
          </p>
        )}
        <div class="flex gap-2">
          <button type="button" disabled={busy} onClick={save} class={`${btn} flex-1 bg-primary text-on-primary disabled:opacity-60`} data-ach-save>
            {busy ? 'Save ho raha hai…' : 'Save karein'}
          </button>
          {editing !== null && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
              class={`${btn} border border-border`}
            >
              Wapas
            </button>
          )}
        </div>
      </section>

      {!items ? (
        <p class="text-muted">Load ho raha hai…</p>
      ) : items.length === 0 ? (
        <p class="text-muted" data-ach-empty>
          Abhi koi entry nahin; patti students ko nazar nahin aati.
        </p>
      ) : (
        <ul class="flex flex-col gap-3">
          {items.map((a, i) => (
            <li key={a.id} class={`flex flex-col gap-2 rounded-xl border bg-surface p-3 ${a.visible ? 'border-border' : 'border-warn'}`} data-ach-item={a.id}>
              <p class="text-xs text-muted">
                {a.kind === 'remark' ? 'Remark' : 'Achievement'} · {PLACE_LABEL[a.place]}
                {achTag(a) && ` · ${achTag(a)}`}
                {a.rating && ` · ${'★'.repeat(a.rating)}`}
              </p>
              {!a.visible && <p class="text-xs font-semibold text-warn">● Chhupi hui</p>}
              <p class="break-words">{a.body}</p>
              {a.person && <p class="text-sm text-muted">{a.person}</p>}
              <div class="flex flex-wrap gap-2">
                <button type="button" disabled={busy || i === 0} aria-label="Upar karein" onClick={() => act(URL, { body: { action: 'move', id: a.id, dir: 'up' } }, 'Tarteeb badal di.')} class={`${btn} border border-border disabled:opacity-40`} data-up>
                  ↑
                </button>
                <button type="button" disabled={busy || i === items.length - 1} aria-label="Neeche karein" onClick={() => act(URL, { body: { action: 'move', id: a.id, dir: 'down' } }, 'Tarteeb badal di.')} class={`${btn} border border-border disabled:opacity-40`}>
                  ↓
                </button>
                <button type="button" disabled={busy} onClick={() => act(URL, { body: { action: 'visible', id: a.id, visible: !a.visible } }, a.visible ? 'Chhupa di.' : 'Students ko dikhe gi.')} class={`${btn} border border-border`} data-toggle>
                  {a.visible ? 'Chhupayen' : 'Dikhayen'}
                </button>
                <button type="button" onClick={() => edit(a)} class={`${btn} border border-border`} data-edit>
                  Badlein
                </button>
                <button type="button" disabled={busy} onClick={() => confirm('Yeh entry hamesha ke liye mitayen?') && act(`${URL}/${a.id}`, { method: 'DELETE' }, 'Entry mita di.')} class={`${btn} border border-border text-wrong`} data-delete>
                  Mitayen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

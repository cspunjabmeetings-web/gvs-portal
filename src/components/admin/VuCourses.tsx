// spec: F29-AC1 — courses ki list paste, search, naam badalna, chhupana, mitana (E26)
import { useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminCourse } from '../../lib/vu-admin';
import { parseCourseList } from '../../lib/vu';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const PAGE = 50;
const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');

export default function VuCourses(p: { courses: AdminCourse[]; onChange: () => Promise<void>; onShow: (code: string) => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');

  const k = squash(q);
  const list = k ? p.courses.filter((c) => squash(c.code + c.name).includes(k)) : p.courses;

  async function add() {
    setNotice('');
    const r = parseCourseList(text);
    if (r.errors.length) return setErrors(r.errors.map((e) => e.message));
    setErrors([]);
    setBusy(true);
    const res = await adminJson<{ added: number; existing: string[] }>('/api/admin/vu/courses', { body: { action: 'add', text } });
    setBusy(false);
    if (!res.ok) return setErrors([res.message]);
    const old = res.data.existing;
    setNotice(`${res.data.added} course save ho gaye.${old.length ? ` ${old.length} pehle se the: ${old.slice(0, 10).join(', ')}${old.length > 10 ? '…' : ''}` : ''}`);
    setText('');
    await p.onChange();
  }

  async function act(url: string, init: { method?: string; body?: unknown }, done: string) {
    setBusy(true);
    const r = await adminJson(url, init);
    setBusy(false);
    setNotice(r.ok ? done : '');
    setErrors(r.ok ? [] : [r.message]);
    if (r.ok) {
      setEditing(null);
      await p.onChange();
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <section class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 class="text-lg">Courses daalein</h2>
        <label for="vu-list" class="text-sm text-muted">
          Har line par ek course: code, phir naam. Ek dafa mein 500 tak.
        </label>
        <textarea
          id="vu-list"
          rows={5}
          value={text}
          disabled={busy}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          placeholder={'CS101 Introduction to Computing\nMTH101 Calculus and Analytical Geometry'}
          class="rounded-lg border border-border bg-surface p-2 font-mono text-sm"
          spellcheck={false}
        />
        <button type="button" onClick={add} disabled={busy || !text.trim()} class={`${btn} bg-primary text-on-primary disabled:opacity-60`} data-vu-add>
          {busy ? 'Save ho raha hai…' : 'Courses save karein'}
        </button>
        {notice && (
          <p class="text-sm font-medium text-correct" role="status" data-vu-notice>
            {notice}
          </p>
        )}
        {errors.length > 0 && (
          <ul class="flex flex-col gap-1 rounded-lg bg-wrong-bg p-3 text-sm text-wrong" role="alert" data-vu-errors>
            {errors.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {errors.length > 20 && <li>… aur {errors.length - 20} ghaltiyan</li>}
          </ul>
        )}
      </section>

      <label for="vu-course-search" class="sr-only">
        Course dhoondein
      </label>
      <input
        id="vu-course-search"
        type="search"
        placeholder="Code ya naam se dhoondein"
        value={q}
        onInput={(e) => {
          setQ((e.target as HTMLInputElement).value);
          setShown(PAGE);
        }}
        class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
      />
      <p class="text-sm text-muted" data-vu-count>
        <span class="tabular font-semibold text-text">{list.length}</span> course{k ? ' mile' : ''}
      </p>
      <ul class="flex flex-col gap-3">
        {list.slice(0, shown).map((c) => (
          <li key={c.code} class={`flex flex-col gap-2 rounded-xl border bg-surface p-3 ${c.visible ? 'border-border' : 'border-warn'}`} data-course={c.code}>
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-lg">{c.code}</h3>
              {!c.visible && <span class="text-xs font-semibold text-warn">● Chhupa</span>}
            </div>
            {editing === c.code ? (
              <div class="flex flex-col gap-2">
                <label for={`vu-name-${c.code}`} class="text-sm font-medium">
                  {c.code} ka naam (code nahin badalta)
                </label>
                <input
                  id={`vu-name-${c.code}`}
                  value={name}
                  maxLength={80}
                  onInput={(e) => setName((e.target as HTMLInputElement).value)}
                  class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
                />
                <div class="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => act('/api/admin/vu/courses', { body: { action: 'rename', code: c.code, name } }, `${c.code} ka naam badal diya.`)} class={`${btn} flex-1 bg-primary text-on-primary`}>
                    Save karein
                  </button>
                  <button type="button" onClick={() => setEditing(null)} class={`${btn} border border-border`}>
                    Wapas
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p class="break-words text-sm">{c.name}</p>
                <dl class="grid grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      ['Midterm', c.midOk, c.midAll],
                      ['Final', c.finalOk, c.finalAll],
                    ] as const
                  ).map(([label, okN, all]) => (
                    <div key={label} class="rounded-lg bg-surface-2 px-3 py-2">
                      <dt class="text-xs text-muted">{label}</dt>
                      <dd class="tabular font-semibold">
                        {okN} / {all} <span class="font-normal text-muted">jaanche</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div class="flex flex-wrap gap-2">
                  <button type="button" onClick={() => p.onShow(c.code)} class={`${btn} border border-border`}>
                    Sawal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c.code);
                      setName(c.name);
                    }}
                    class={`${btn} border border-border`}
                  >
                    Naam badlein
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act('/api/admin/vu/courses', { body: { action: 'visible', code: c.code, visible: !c.visible } }, c.visible ? `${c.code} chhupa diya.` : `${c.code} dikhe ga.`)}
                    class={`${btn} border border-border`}
                  >
                    {c.visible ? 'Chhupayen' : 'Dikhayen'}
                  </button>
                  {c.midAll + c.finalAll === 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirm(`${c.code} mitayen?`) && act(`/api/admin/vu/courses/${c.code}`, { method: 'DELETE' }, `${c.code} mita diya.`)}
                      class={`${btn} border border-border text-wrong`}
                    >
                      Mitayen
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {list.length === 0 && <p class="text-muted">{k ? 'Koi course nahin mila.' : 'Abhi koi course nahin. Upar list paste karein.'}</p>}
      {list.length > shown && (
        <button type="button" onClick={() => setShown(shown + PAGE)} class={`${btn} border border-border`}>
          Aur dikhayen ({list.length - shown})
        </button>
      )}
    </div>
  );
}

// spec: A07 Jobs (text/form se job, khuli jobs ki list, "Purani jobs": Mitayen, Sab purani mita dein), E21, F19-AC1 (paste = form:
//       dono `# JOB` text ban kar wahi parser), F19-AC2, AC3, AC5, F18-AC5 (tareekh barhayen → wapas Khuli), design.md 6.10 (360px).
// Tasveer lagana Qadam 13c mein.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { adminJson } from '../../lib/admin-fetch';
import { parseContent, type ParsedJob } from '../../lib/parser';
import { EMPTY_JOB_FORM, JOB_FORM_MSG, daysLeftLabel, formFromJob, hasBreaker, jobText, type JobForm } from '../../lib/job-form';
import type { AdminJobFull, AdminJobRow } from '../../lib/admin-jobs';
import JobPreview from './JobPreview';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const input = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3';
type Sub = 'new' | 'open' | 'old';
interface Meta {
  defaultFee: number;
  today: string;
  counts: { open: number; old: number };
}
type Preview = { ok: true; jobs: ParsedJob[] } | { ok: false; errors: string[] };

/** Browser mein wahi parser (server dobara jaanchta hai) */
function preview(text: string): Preview {
  const r = parseContent(text, { subjects: [] });
  if (r.errors.length) return { ok: false, errors: r.errors.map((e) => e.message) };
  if (!r.items.length) return { ok: false, errors: ['Koi job nahin mili. Text "# JOB" se shuru karein aur aakhir mein "---" likhein.'] };
  if (r.items.some((x) => x.kind !== 'JOB')) return { ok: false, errors: ['Jobs tab mein sirf "# JOB" wali cheezein. Sawal, mock aur notes Content tab mein daalein.'] };
  return { ok: true, jobs: r.items as ParsedJob[] };
}

function Field(p: { id: string; label: string; hint?: string; children: ComponentChildren }) {
  return (
    <div class="flex flex-col gap-1">
      <label for={p.id} class="text-sm font-medium">
        {p.label}
      </label>
      {p.children}
      {p.hint && <p class="text-xs text-muted">{p.hint}</p>}
    </div>
  );
}

function JobEditor(p: { id?: number; initial?: JobForm; meta: Meta; onSaved: (msg: string) => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<'form' | 'paste'>('form');
  const [f, setF] = useState<JobForm>(p.initial ?? EMPTY_JOB_FORM);
  const [paste, setPaste] = useState('');
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pre = `job-${p.id ?? 'new'}`;

  const set = <K extends keyof JobForm>(k: K, val: JobForm[K]) => {
    setF((old) => ({ ...old, [k]: val }));
    setPv(null);
  };
  const text = () => (mode === 'form' ? jobText(f) : paste);

  function show() {
    setError('');
    if (mode === 'form' && hasBreaker(f)) return setPv({ ok: false, errors: [JOB_FORM_MSG.breaker] });
    const r = preview(text());
    if (r.ok && p.id !== undefined && r.jobs.length !== 1) return setPv({ ok: false, errors: ['Badalte waqt sirf ek job ka text ho.'] });
    setPv(r);
  }

  async function save() {
    setBusy(true);
    setError('');
    const r = await adminJson<{ ids: number[] }>('/api/admin/jobs', { body: { action: 'save', ...(p.id !== undefined ? { id: p.id } : {}), text: text() } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    const n = r.data.ids.length;
    setF(EMPTY_JOB_FORM);
    setPaste('');
    setPv(null);
    p.onSaved(p.id !== undefined ? 'Job badal di gayi.' : `${n} job${n > 1 ? 's' : ''} save ho gayi.`);
  }

  const tf = (k: 'org' | 'post' | 'city' | 'education' | 'officialUrl' | 'adUrl', label: string, hint?: string, type = 'text') => (
    <Field id={`${pre}-${k}`} label={label} hint={hint}>
      <input id={`${pre}-${k}`} type={type} inputMode={type === 'url' ? 'url' : undefined} maxLength={k.endsWith('Url') ? 500 : 150} value={f[k]} onInput={(e) => set(k, (e.target as HTMLInputElement).value)} class={input} data-job-field={k} />
    </Field>
  );

  return (
    <div class="flex flex-col gap-3" data-job-editor={p.id ?? 'new'}>
      {p.id === undefined && (
        <div class="flex gap-2" role="group" aria-label="Job kaise daalein">
          {(['form', 'paste'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setPv(null);
              }}
              class={`${btn} flex-1 ${mode === m ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'border border-border'}`}
              data-job-mode={m}
            >
              {m === 'form' ? 'Khane bharein' : 'Text paste karein'}
            </button>
          ))}
        </div>
      )}

      {mode === 'paste' ? (
        <Field id={`${pre}-paste`} label='Job ka text ("# JOB" … "---"; kai jobs ek sath bhi)'>
          <textarea
            id={`${pre}-paste`}
            rows={14}
            value={paste}
            onInput={(e) => {
              setPaste((e.target as HTMLTextAreaElement).value);
              setPv(null);
            }}
            class="rounded-lg border border-border bg-surface p-2 font-mono text-sm"
            spellcheck={false}
            data-job-paste
          />
        </Field>
      ) : (
        <div class="flex flex-col gap-3">
          {tf('org', 'Idara *', 'Maslan PPSC, FPSC, NTS')}
          {tf('post', 'Post *', 'Maslan Educator (BPS-14)')}
          {tf('city', 'Shehar')}
          {tf('education', 'Taleem')}
          <Field id={`${pre}-lastDate`} label="Akhri tareekh *" hint="Is din raat 11:59 tak job khuli rahe gi (Pakistan waqt).">
            <input id={`${pre}-lastDate`} type="date" value={f.lastDate} onInput={(e) => set('lastDate', (e.target as HTMLInputElement).value)} class={input} data-job-field="lastDate" />
          </Field>
          {tf('officialUrl', 'Official link *', 'https:// se shuru', 'url')}
          {tf('adUrl', 'Ishtihar link', 'https:// (PPSC site, Google Drive…)', 'url')}
          <div class="grid grid-cols-2 gap-3">
            <Field id={`${pre}-govtFee`} label="Sarkari fee (Rs.)">
              <input id={`${pre}-govtFee`} type="text" inputMode="numeric" maxLength={9} value={f.govtFee} onInput={(e) => set('govtFee', (e.target as HTMLInputElement).value)} class={input} data-job-field="govtFee" />
            </Field>
            <Field id={`${pre}-ourFee`} label="Hamari fee (Rs.)" hint={`Khali = ${p.meta.defaultFee} (Settings)`}>
              <input id={`${pre}-ourFee`} type="text" inputMode="numeric" maxLength={9} value={f.ourFee} placeholder={String(p.meta.defaultFee)} onInput={(e) => set('ourFee', (e.target as HTMLInputElement).value)} class={input} data-job-field="ourFee" />
            </Field>
          </div>
          <label class="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" checked={f.applyService} onChange={(e) => set('applyService', (e.target as HTMLInputElement).checked)} class="h-5 w-5" data-job-field="applyService" />
            <span>"Hum apply kar dein" ka button dikhayen</span>
          </label>
          <Field id={`${pre}-documents`} label="Documents (har line par ek)">
            <textarea id={`${pre}-documents`} rows={4} value={f.documents} onInput={(e) => set('documents', (e.target as HTMLTextAreaElement).value)} class="rounded-lg border border-border bg-surface p-2" data-job-field="documents" />
          </Field>
          <Field id={`${pre}-steps`} label="Tareeqa (har line par ek qadam)">
            <textarea id={`${pre}-steps`} rows={4} value={f.steps} onInput={(e) => set('steps', (e.target as HTMLTextAreaElement).value)} class="rounded-lg border border-border bg-surface p-2" data-job-field="steps" />
          </Field>
        </div>
      )}

      <div class="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={show} class={`${btn} border border-border`} data-job-preview-btn>
          Preview dekhein
        </button>
        {p.onCancel && (
          <button type="button" onClick={p.onCancel} class={`${btn} border border-border`}>
            Wapas
          </button>
        )}
      </div>

      {pv && !pv.ok && (
        <div class="rounded-xl border border-wrong bg-wrong-bg p-3" role="alert" data-job-errors>
          <ul class="flex flex-col gap-1 text-sm text-wrong">
            {pv.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {pv && pv.ok && (
        <div class="flex flex-col gap-3">
          <p class="font-semibold" data-job-count>
            {pv.jobs.length} job{pv.jobs.length > 1 ? 's' : ''} mili. Visitor ko aisi dikhe gi:
          </p>
          <button type="button" disabled={busy} onClick={save} class={`${btn} bg-primary text-on-primary disabled:opacity-60`} data-job-save>
            {busy ? 'Save ho raha hai…' : p.id !== undefined ? 'Tabdeeli save karein' : 'Save karein'}
          </button>
          {pv.jobs.map((j) => (
            <JobPreview key={j.line} job={j} defaultFee={p.meta.defaultFee} today={p.meta.today} />
          ))}
        </div>
      )}
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function JobList(p: { tab: 'open' | 'old'; meta: Meta; onMeta: (m: Meta) => void; onEdit: (j: AdminJobFull) => void }) {
  const [items, setItems] = useState<AdminJobRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(offset = 0) {
    setLoading(true);
    const r = await adminJson<{ items: AdminJobRow[]; hasMore: boolean } & Meta>(`/api/admin/jobs?tab=${p.tab}&offset=${offset}`);
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setError('');
    setItems((old) => (offset ? [...old, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
    p.onMeta({ defaultFee: r.data.defaultFee, today: r.data.today, counts: r.data.counts });
  }
  useEffect(() => {
    void load();
  }, [p.tab]);

  async function act(j: AdminJobRow, kind: 'visible' | 'delete' | 'edit') {
    setNotice('');
    if (kind === 'delete' && !confirm(`"${j.org}: ${j.post}" mita dein? Is ka page "hata diya gaya" dikhaye ga.`)) return;
    setBusyId(j.id);
    const r =
      kind === 'edit'
        ? await adminJson<{ job: AdminJobFull }>(`/api/admin/jobs?id=${j.id}`)
        : kind === 'delete'
          ? await adminJson(`/api/admin/jobs/${j.id}`, { method: 'DELETE' })
          : await adminJson('/api/admin/jobs', { body: { action: 'visible', id: j.id, visible: !j.visible } });
    setBusyId(null);
    if (!r.ok) return setError(r.message);
    if (kind === 'edit') return p.onEdit((r.data as { job: AdminJobFull }).job);
    setNotice(kind === 'delete' ? 'Job mita di gayi.' : j.visible ? 'Job chhupa di gayi.' : 'Job dobara dikhne lagi.');
    void load();
  }

  async function deleteOld() {
    const n = p.meta.counts.old;
    if (!confirm(`Saari ${n} purani jobs mita dein? In ke pages "hata diya gaya" dikhayenge. Yeh wapas nahin hoga.`)) return;
    setBusyId(-1);
    const r = await adminJson<{ deleted: number }>('/api/admin/jobs/delete-old', { body: { confirm: true } });
    setBusyId(null);
    if (!r.ok) return setError(r.message);
    setNotice(`${r.data.deleted} purani jobs mita di gayin.`);
    void load();
  }

  return (
    <div class="flex flex-col gap-3" data-job-list={p.tab}>
      {p.tab === 'old' && p.meta.counts.old > 0 && (
        <button type="button" disabled={busyId !== null} onClick={deleteOld} class={`${btn} self-start border border-border text-wrong disabled:opacity-60`} data-delete-old>
          Sab purani mita dein ({p.meta.counts.old})
        </button>
      )}
      {notice && (
        <p class="rounded-lg bg-primary-soft p-2 text-sm text-primary" role="status" data-job-notice>
          {notice}
        </p>
      )}
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      {loading && !items.length ? (
        <p class="text-muted">Load ho raha hai…</p>
      ) : !items.length ? (
        <p class="rounded-xl bg-surface-2 p-4" data-job-empty>
          {p.tab === 'open' ? 'Abhi koi khuli job nahin. "Nayi job" se daalein.' : 'Koi purani job nahin.'}
        </p>
      ) : (
        <ul class="flex flex-col gap-2">
          {items.map((j) => (
            <li key={j.id} class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3" data-job={j.id}>
              <p class="text-xs font-semibold text-primary">{j.org}</p>
              <p class="font-semibold">{j.post}</p>
              <p class="flex flex-wrap gap-x-3 text-sm text-muted">
                <span class="tabular">{j.lastDate}</span>
                <span class={j.lastDate < p.meta.today ? 'text-wrong' : 'text-text'} data-days-left>
                  {daysLeftLabel(j.lastDate, p.meta.today)}
                </span>
                {!j.visible && (
                  <span class="font-semibold text-warn" data-hidden-badge>
                    Chhupi hui
                  </span>
                )}
                {!j.applyService && <span>Apply service nahin</span>}
              </p>
              <p class="break-all text-xs text-muted">/jobs/{j.slug}</p>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" disabled={busyId === j.id} onClick={() => act(j, 'edit')} class={`${btn} border border-border disabled:opacity-60`} data-edit>
                  Badlein
                </button>
                <button type="button" disabled={busyId === j.id} onClick={() => act(j, 'visible')} class={`${btn} border border-border disabled:opacity-60`} data-toggle>
                  {j.visible ? 'Chhupayen' : 'Dikhayen'}
                </button>
                <button type="button" disabled={busyId === j.id} onClick={() => act(j, 'delete')} class={`${btn} border border-border text-wrong disabled:opacity-60`} data-delete>
                  Mitayen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <button type="button" disabled={loading} onClick={() => load(items.length)} class={`${btn} border border-border`}>
          Aur dikhayen
        </button>
      )}
    </div>
  );
}

export default function JobsTab() {
  const [sub, setSub] = useState<Sub>('new');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [editing, setEditing] = useState<AdminJobFull | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function refreshMeta() {
    const r = await adminJson<Meta>('/api/admin/jobs?tab=open&offset=0');
    if (!r.ok) return setError(r.message);
    setMeta({ defaultFee: r.data.defaultFee, today: r.data.today, counts: r.data.counts });
  }
  useEffect(() => {
    void refreshMeta();
  }, []);

  if (error) return <p class="text-wrong" role="alert">{error}</p>;
  if (!meta) return <p class="text-muted">Load ho raha hai…</p>;

  const SUBS: { id: Sub; label: string }[] = [
    { id: 'new', label: 'Nayi job' },
    { id: 'open', label: `Khuli (${meta.counts.open})` },
    { id: 'old', label: `Purani (${meta.counts.old})` },
  ];

  return (
    <div class="flex flex-col gap-4" data-jobs-tab>
      <nav aria-label="Jobs ke hisse" class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul class="flex gap-2">
          {SUBS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSub(t.id);
                  setEditing(null);
                  setNotice('');
                }}
                aria-pressed={sub === t.id}
                class={`min-h-[44px] whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${sub === t.id ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'border border-border'}`}
                data-job-sub={t.id}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {notice && (
        <p class="rounded-lg bg-primary-soft p-2 text-sm text-primary" role="status" data-job-saved>
          {notice}
        </p>
      )}

      {editing ? (
        <section class="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-3" aria-label="Job badlein">
          <h2 class="text-lg">Job badlein</h2>
          <p class="text-xs text-muted">URL wahi rahe ga: /jobs/{editing.slug}</p>
          <JobEditor
            key={editing.id}
            id={editing.id}
            initial={formFromJob(editing)}
            meta={meta}
            onCancel={() => setEditing(null)}
            onSaved={(m) => {
              setEditing(null);
              setNotice(m);
              void refreshMeta();
            }}
          />
        </section>
      ) : sub === 'new' ? (
        <JobEditor
          meta={meta}
          onSaved={(m) => {
            setNotice(m);
            void refreshMeta();
          }}
        />
      ) : (
        <JobList key={sub} tab={sub} meta={meta} onMeta={setMeta} onEdit={setEditing} />
      )}
    </div>
  );
}

// spec: 6.3 A08 Settings (F10-AC1..AC7), E24, intent 9.9, design.md ("sections ke hisab se form, har field ka label + example")
// Har section ka apna "Save" — sirf us section ki badli hui keys jati hain. Jaanch pehle browser mein (settings-rules.ts),
// aakhri faisla server par. Save ke baad apne browser ka settings cache khatam (F10-AC7: admin ke paas foran).
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { LIMITS, validateSettingsPatch, type EditableKey, type EditableSettings } from '../../lib/settings-rules';
import { clearSettingsCache } from '../../lib/site-settings';

interface Product {
  id: string;
  name: string;
  deliveryMinutes: number;
}
interface LoadResponse {
  ok?: boolean;
  settings?: EditableSettings;
  agent_enabled?: boolean;
  products?: Product[];
  error?: { message?: string; field?: string };
}

type SectionId = 'contact' | 'payment' | 'time' | 'announce' | 'subjects';
const SECTION_KEYS: Record<SectionId, EditableKey[]> = {
  contact: ['whatsapp_number'],
  payment: ['jazzcash_number', 'jazzcash_title', 'easypaisa_number', 'easypaisa_title'],
  time: ['work_start', 'work_end', 'default_delivery_minutes', 'auto_cancel_hours', 'delivery_overrides'],
  announce: ['announcement_text', 'announcement_on', 'orders_open'],
  subjects: ['subjects'],
};

/** Form ki string values (number khane string rehte hain taake adhoora likha mita na jaye) */
interface Draft {
  whatsapp_number: string;
  jazzcash_number: string;
  jazzcash_title: string;
  easypaisa_number: string;
  easypaisa_title: string;
  work_start: string;
  work_end: string;
  default_delivery_minutes: string;
  auto_cancel_hours: string;
  overrides: Record<string, string>;
  announcement_text: string;
  announcement_on: boolean;
  orders_open: boolean;
  subjects: string[];
}

function toDraft(s: EditableSettings): Draft {
  return {
    whatsapp_number: s.whatsapp_number,
    jazzcash_number: s.jazzcash_number,
    jazzcash_title: s.jazzcash_title,
    easypaisa_number: s.easypaisa_number,
    easypaisa_title: s.easypaisa_title,
    work_start: s.work_start,
    work_end: s.work_end,
    default_delivery_minutes: String(s.default_delivery_minutes),
    auto_cancel_hours: String(s.auto_cancel_hours),
    overrides: Object.fromEntries(Object.entries(s.delivery_overrides).map(([k, v]) => [k, String(v)])),
    announcement_text: s.announcement_text,
    announcement_on: s.announcement_on,
    orders_open: s.orders_open,
    subjects: [...s.subjects],
  };
}

/** "" → NaN taake jaanch paigham de; warna number */
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim()));

function fromDraft(d: Draft, key: EditableKey): unknown {
  switch (key) {
    case 'default_delivery_minutes':
    case 'auto_cancel_hours':
      return num(d[key]);
    case 'delivery_overrides': {
      const out: Record<string, number> = {};
      for (const [id, v] of Object.entries(d.overrides)) if (v.trim() !== '') out[id] = num(v);
      return out;
    }
    default:
      return d[key];
  }
}

/** In keys ka apna khana hai, ghalti us ke neeche dikhti hai; baqi section ke neeche */
const FIELD_INPUTS = new Set<string>(['whatsapp_number', 'jazzcash_number', 'jazzcash_title', 'easypaisa_number', 'easypaisa_title', 'work_start', 'work_end', 'default_delivery_minutes', 'auto_cancel_hours', 'delivery_overrides', 'announcement_text']);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const input = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3';
const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';

function Field(p: { id: string; label: string; hint?: string; error?: string; children: ComponentChildren }) {
  return (
    <div class="flex flex-col gap-1">
      <label for={p.id} class="text-sm font-medium">
        {p.label}
      </label>
      {p.children}
      {p.hint && (
        <p id={`${p.id}-hint`} class="text-xs text-muted">
          {p.hint}
        </p>
      )}
      {p.error && (
        <p class="text-sm text-wrong" role="alert">
          {p.error}
        </p>
      )}
    </div>
  );
}

function Switch(p: { id: string; label: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label for={p.id} class={`flex min-h-[44px] items-center gap-3 ${p.disabled ? 'opacity-60' : ''}`}>
      <input
        id={p.id}
        type="checkbox"
        role="switch"
        checked={p.checked}
        disabled={p.disabled}
        onChange={(e) => p.onChange?.((e.target as HTMLInputElement).checked)}
        class="h-6 w-6 accent-[var(--primary)]"
      />
      <span class="font-medium">{p.label}</span>
    </label>
  );
}

export default function SettingsTab() {
  const [saved, setSaved] = useState<EditableSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [agentOn, setAgentOn] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<SectionId | null>(null);
  const [msg, setMsg] = useState<{ section: SectionId; ok: boolean; text: string; field?: string } | null>(null);
  const [newSubject, setNewSubject] = useState('');

  function take(data: LoadResponse) {
    if (!data.settings) return;
    setSaved(data.settings);
    setDraft(toDraft(data.settings));
    setProducts(data.products ?? []);
    setAgentOn(!!data.agent_enabled);
  }

  async function load() {
    setLoadError('');
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (res.status === 401) return location.reload();
      const data = (await res.json()) as LoadResponse;
      if (!res.ok || !data.ok) throw new Error(data.error?.message);
      take(data);
    } catch (e) {
      setLoadError((e as Error).message || 'Settings nahin khulin. Dobara koshish karein.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const productIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setMsg(null);
  }

  /** Is section ki sirf badli hui keys */
  function patchFor(section: SectionId): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!draft || !saved) return out;
    for (const k of SECTION_KEYS[section]) {
      const v = fromDraft(draft, k);
      if (!same(v, saved[k])) out[k] = v;
    }
    return out;
  }

  async function save(section: SectionId) {
    if (!saved || !draft) return;
    const patch = patchFor(section);
    if (!Object.keys(patch).length) return setMsg({ section, ok: true, text: 'Koi tabdeeli nahin.' });
    const check = validateSettingsPatch(patch, saved, productIds);
    if (!check.ok) return setMsg({ section, ok: false, text: check.message, field: check.field });

    setBusy(section);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: patch }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) return location.reload();
      const data = (await res.json()) as LoadResponse;
      if (!res.ok || !data.ok || !data.settings) {
        return setMsg({ section, ok: false, text: data.error?.message || 'Save nahin hua. Dobara koshish karein.', field: data.error?.field });
      }
      // Sirf is section ki keys server ke jawab se; baqi sections ka adhoora likha hua na mitaye
      const fresh = toDraft(data.settings);
      setSaved(data.settings);
      setDraft((d) => {
        if (!d) return fresh;
        const next = { ...d };
        for (const k of SECTION_KEYS[section]) {
          if (k === 'delivery_overrides') next.overrides = fresh.overrides;
          else (next as unknown as Record<string, unknown>)[k] = (fresh as unknown as Record<string, unknown>)[k];
        }
        return next;
      });
      clearSettingsCache();
      setMsg({ section, ok: true, text: 'Mehfooz ho gaya. Site par 1-5 minute mein har jagah nazar aaye ga.' });
    } catch {
      setMsg({ section, ok: false, text: 'Internet ya server ka masla. Save nahin hua, dobara koshish karein.' });
    } finally {
      setBusy(null);
    }
  }

  if (loadError)
    return (
      <section class="rounded-xl border border-border bg-surface p-4" role="alert">
        <p class="text-wrong">{loadError}</p>
        <button type="button" onClick={load} class={`${btn} mt-3 border border-border`}>
          Dobara koshish karein
        </button>
      </section>
    );
  if (!draft || !saved) return <p class="text-muted">Settings khul rahi hain…</p>;

  const errFor = (section: SectionId, field: string) => (msg && !msg.ok && msg.section === section && msg.field === field ? msg.text : undefined);

  // Sirf function (component nahin): har render par naya component type inputs ka focus kho deta
  function Section(p: { id: SectionId; title: string; children: ComponentChildren }) {
    const dirty = Object.keys(patchFor(p.id)).length > 0;
    const m = msg?.section === p.id ? msg : null;
    // Jo ghalti kisi khas khane ki nahin, woh section ke neeche
    const showHere = m && (m.ok || !m.field || !FIELD_INPUTS.has(m.field.split('.')[0]) || m.field === 'delivery_overrides');
    return (
      <section class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4" data-section={p.id}>
        <h2 class="text-lg">{p.title}</h2>
        {p.children}
        {showHere && (
          <p class={`text-sm ${m.ok ? 'text-correct' : 'text-wrong'}`} role={m.ok ? 'status' : 'alert'}>
            {m.text}
          </p>
        )}
        <button
          type="button"
          onClick={() => save(p.id)}
          disabled={busy !== null}
          class={`${btn} ${dirty ? 'bg-primary text-on-primary' : 'border border-border'} disabled:opacity-60`}
          data-save={p.id}
        >
          {busy === p.id ? 'Save ho raha hai…' : 'Save karein'}
        </button>
      </section>
    );
  }

  const textInput = (section: SectionId, key: 'whatsapp_number' | 'jazzcash_number' | 'jazzcash_title' | 'easypaisa_number' | 'easypaisa_title', o: { label: string; hint: string; tel?: boolean; max?: number }) => (
    <Field id={`set-${key}`} label={o.label} hint={o.hint} error={errFor(section, key)}>
      <input
        id={`set-${key}`}
        type={o.tel ? 'tel' : 'text'}
        inputMode={o.tel ? 'numeric' : undefined}
        autoComplete="off"
        maxLength={o.max ?? 20}
        value={draft[key]}
        onInput={(e) => set(key, (e.target as HTMLInputElement).value)}
        aria-describedby={`set-${key}-hint`}
        class={input}
      />
    </Field>
  );

  const numInput = (key: 'default_delivery_minutes' | 'auto_cancel_hours', o: { label: string; hint: string; min: number; max: number }) => (
    <Field id={`set-${key}`} label={o.label} hint={o.hint} error={errFor('time', key)}>
      <input
        id={`set-${key}`}
        type="number"
        inputMode="numeric"
        min={o.min}
        max={o.max}
        step={1}
        value={draft[key]}
        onInput={(e) => set(key, (e.target as HTMLInputElement).value)}
        aria-describedby={`set-${key}-hint`}
        class={input}
      />
    </Field>
  );

  const annLen = [...draft.announcement_text].length;

  return (
    <div class="flex flex-col gap-4" data-settings>
      {Section({ id: 'contact', title: 'WhatsApp number', children: (<>
        {textInput('contact', 'whatsapp_number', { label: 'WhatsApp number *', hint: 'Maslan 03404905266. Poori site par yahi number dikhe ga.', tel: true })}
      </>) })}

      {Section({ id: 'payment', title: 'Payment ke accounts', children: (<>
        {textInput('payment', 'jazzcash_number', { label: 'JazzCash number', hint: 'Maslan 03001234567. Khali = customer ko "WhatsApp par bataya jaye ga".', tel: true })}
        {textInput('payment', 'jazzcash_title', { label: 'JazzCash account title', hint: 'Maslan "Muhammad Ali". 60 harf tak.', max: LIMITS.titleMax })}
        {textInput('payment', 'easypaisa_number', { label: 'Easypaisa number', hint: 'Maslan 03451234567. Khali chhor sakte hain.', tel: true })}
        {textInput('payment', 'easypaisa_title', { label: 'Easypaisa account title', hint: 'Maslan "Muhammad Ali". 60 harf tak.', max: LIMITS.titleMax })}
      </>) })}

      {Section({ id: 'time', title: 'Kaam ka waqt aur delivery', children: (<>
        <div class="grid grid-cols-2 gap-3">
          <Field id="set-work_start" label="Kaam shuru" hint="Maslan 09:00" error={errFor('time', 'work_start')}>
            <input id="set-work_start" type="time" value={draft.work_start} onInput={(e) => set('work_start', (e.target as HTMLInputElement).value)} class={input} />
          </Field>
          <Field id="set-work_end" label="Kaam khatam" hint="Maslan 22:00" error={errFor('time', 'work_end')}>
            <input id="set-work_end" type="time" value={draft.work_end} onInput={(e) => set('work_end', (e.target as HTMLInputElement).value)} class={input} />
          </Field>
        </div>
        {numInput('default_delivery_minutes', { label: 'Default delivery (minute)', hint: `${LIMITS.minutesMin} se ${LIMITS.minutesMax} tak. Maslan 120 = 2 ghante (kaam ke auqaat mein).`, min: LIMITS.minutesMin, max: LIMITS.minutesMax })}
        {numInput('auto_cancel_hours', { label: 'Bina payment order khud cancel (ghante)', hint: `${LIMITS.cancelMin} se ${LIMITS.cancelMax} tak. Maslan 48.`, min: LIMITS.cancelMin, max: LIMITS.cancelMax })}
        <details class="rounded-lg border border-border p-3" open={msg?.field?.startsWith('delivery_overrides.') || undefined}>
          <summary class="min-h-[44px] cursor-pointer content-center font-medium">Har product ka waqt (ikhtiyari)</summary>
          <p class="mb-3 text-xs text-muted">Khali = catalog ka waqt (khane mein halka likha hua). {LIMITS.minutesMin} se {LIMITS.minutesMax} minute.</p>
          <ul class="flex flex-col gap-3">
            {products.map((p) => (
              <li key={p.id}>
                <Field id={`set-delivery_overrides-${p.id}`} label={p.name} error={errFor('time', `delivery_overrides.${p.id}`)}>
                  <input
                    id={`set-delivery_overrides-${p.id}`}
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.minutesMin}
                    max={LIMITS.minutesMax}
                    step={1}
                    placeholder={String(p.deliveryMinutes)}
                    value={draft.overrides[p.id] ?? ''}
                    onInput={(e) => set('overrides', { ...draft.overrides, [p.id]: (e.target as HTMLInputElement).value })}
                    class={input}
                  />
                </Field>
              </li>
            ))}
          </ul>
        </details>
      </>) })}

      {Section({ id: 'announce', title: 'Elaan aur orders', children: (<>
        <Field id="set-announcement_text" label="Elaan ki patti (site ke sab se upar)" hint={`Maslan "Eid par 3 din order band". ${annLen}/${LIMITS.announcementMax} harf.`} error={errFor('announce', 'announcement_text')}>
          <textarea
            id="set-announcement_text"
            rows={2}
            maxLength={LIMITS.announcementMax}
            value={draft.announcement_text}
            onInput={(e) => set('announcement_text', (e.target as HTMLTextAreaElement).value)}
            aria-describedby="set-announcement_text-hint"
            class="rounded-lg border border-border bg-surface p-2"
          />
        </Field>
        <Switch id="set-announcement_on" label="Elaan dikhayen" checked={draft.announcement_on} onChange={(v) => set('announcement_on', v)} />
        <Switch id="set-orders_open" label="Orders le rahe hain" checked={draft.orders_open} onChange={(v) => set('orders_open', v)} />
        {!draft.orders_open && <p class="rounded-lg bg-surface-2 p-3 text-sm">Band hone par customer order nahin bhej sake ga; us ki order list mehfooz rahe gi.</p>}
      </>) })}

      {Section({ id: 'subjects', title: 'Mazameen ki list', children: (<>
        <p class="text-xs text-muted">MCQs aur mock tests inhi mazameen mein hon ge. 1 se {LIMITS.subjectsMax} tak, har ek {LIMITS.subjectMax} harf tak.</p>
        <ul class="flex flex-col gap-2" data-subjects>
          {draft.subjects.map((s, i) => (
            <li key={`${s}-${i}`} class="flex items-center justify-between gap-2 rounded-lg border border-border px-3">
              <span>{s}</span>
              <button
                type="button"
                aria-label={`${s} hatayen`}
                onClick={() => set('subjects', draft.subjects.filter((_, j) => j !== i))}
                class="min-h-[44px] min-w-[44px] text-wrong"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div class="flex gap-2">
          <label for="set-new-subject" class="sr-only">
            Naya mazmoon
          </label>
          <input
            id="set-new-subject"
            type="text"
            maxLength={LIMITS.subjectMax}
            placeholder="Maslan Physics"
            value={newSubject}
            onInput={(e) => setNewSubject((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newSubject.trim()) {
                set('subjects', [...draft.subjects, newSubject.trim()]);
                setNewSubject('');
              }
            }}
            class={`${input} flex-1`}
          />
          <button
            type="button"
            disabled={!newSubject.trim()}
            onClick={() => {
              set('subjects', [...draft.subjects, newSubject.trim()]);
              setNewSubject('');
            }}
            class={`${btn} border border-border disabled:opacity-60`}
          >
            Jodein
          </button>
        </div>
      </>) })}

      {/* F10-AC5: sirf likha hua tareeqa, koi endpoint nahin */}
      <section class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4" data-section="password">
        <h2 class="text-lg">Admin password kaise badlein</h2>
        <p class="text-sm">Password code mein nahin, Cloudflare ke secret <code>ADMIN_PASSWORD</code> mein hai. Yahan se nahin badalta.</p>
        <ol class="list-decimal space-y-1 pl-5 text-sm">
          <li>Cloudflare dashboard → Workers &amp; Pages → GVS ka worker → Settings → Variables and Secrets.</li>
          <li>
            <code>ADMIN_PASSWORD</code> par Edit → naya password (kam se kam 12 harf, kisi ko na batayen) → Deploy.
          </li>
          <li>
            Ya computer par: <code>npx wrangler secret put ADMIN_PASSWORD</code>
          </li>
          <li>
            Pehle se login phones 7 din tak login rehte hain. Sab ko foran bahar karna ho to <code>SESSION_SECRET</code> bhi naya lamba random rakhein.
          </li>
        </ol>
      </section>

      {/* F10-AC6: Version 2, dikhe lekin band */}
      <section class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4" data-section="agent">
        <h2 class="text-lg">Agent (Version 2)</h2>
        <p class="text-sm text-muted">Yeh Version 2 mein chalu hoga. Abhi band hai.</p>
        <Switch id="set-agent_enabled" label="Agent chalu" checked={agentOn} disabled />
        <button type="button" disabled class={`${btn} border border-border opacity-60`}>
          API key banayein
        </button>
      </section>
    </div>
  );
}


// spec: A09 Daily pins (P-03), E23 GET/POST/DELETE /api/admin/daily-pins (GET spec v0.3.5), F13-AC2 (owner kisi din ke 10 pin kare), SA8
import { useEffect, useRef, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminMcq } from '../../lib/admin-content';
import type { DailyPin } from '../../lib/daily-pins';
import { addDays } from '../../lib/pkdate';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const COUNT = 10;

interface PinsResp {
  today: string;
  maxDate: string;
  pins: DailyPin[];
}
interface ListResp {
  items: AdminMcq[];
  hasMore: boolean;
}
type Picked = { id: number; subject: string; question: string };

function dayLabel(date: string, today: string) {
  const d = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return date === today ? `Aaj (${d})` : date === addDays(today, 1) ? `Kal (${d})` : d;
}

export default function DailyPins(p: { subjects: string[] }) {
  const [info, setInfo] = useState<PinsResp | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [date, setDate] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [saving, setSaving] = useState(false);
  // Sawal chunne ki list (sirf jaanche hue)
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [items, setItems] = useState<AdminMcq[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const req = useRef(0);

  async function loadPins() {
    const r = await adminJson<PinsResp>('/api/admin/daily-pins');
    if (!r.ok) return setError(r.message);
    setError('');
    setInfo(r.data);
    setDate((d) => d || addDays(r.data.today, 1));
  }
  useEffect(() => {
    void loadPins();
  }, []);

  async function loadMcqs(offset = 0) {
    const n = ++req.current;
    setLoading(true);
    const params = new URLSearchParams({ verified: '1', offset: String(offset) });
    if (q.trim()) params.set('q', q.trim());
    if (subject) params.set('subject', subject);
    const r = await adminJson<ListResp>(`/api/admin/mcqs?${params}`);
    if (n !== req.current) return;
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
  }
  useEffect(() => {
    const t = setTimeout(() => void loadMcqs(0), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    void loadMcqs(0);
  }, [subject]);

  const existing = info?.pins.find((x) => x.date === date) ?? null;
  const isPicked = (id: number) => picked.some((x) => x.id === id);

  function toggle(m: { id: number; subject: string; question: string }) {
    setNotice('');
    setPicked((list) => (list.some((x) => x.id === m.id) ? list.filter((x) => x.id !== m.id) : list.length >= COUNT ? list : [...list, { id: m.id, subject: m.subject, question: m.question }]));
  }

  function editPin(pin: DailyPin) {
    setDate(pin.date);
    setPicked(pin.items.filter((x) => x.ok).map((x) => ({ id: x.id, subject: x.subject, question: x.question })));
    setNotice('');
    document.getElementById('pin-editor')?.scrollIntoView({ block: 'start' });
  }

  async function save() {
    if (picked.length !== COUNT || !date) return;
    if (date === info?.today && !confirm('Aaj ka test kuch log de chuke hon ge. Phir bhi aaj ke sawal badlein?')) return;
    setSaving(true);
    const r = await adminJson('/api/admin/daily-pins', { body: { date, ids: picked.map((x) => x.id) } });
    setSaving(false);
    if (!r.ok) return setNotice(r.message);
    setNotice(`${info ? dayLabel(date, info.today) : date} ke 10 sawal pin ho gaye.`);
    setPicked([]);
    void loadPins();
  }

  async function remove(pin: DailyPin) {
    const what = pin.source === 'pin' ? 'Yeh pin hatayen? Us din sawal khud chune jayenge.' : 'Khud chune sawal hatayen? Us din naye sawal khud chune jayenge.';
    if (!confirm(what)) return;
    const r = await adminJson(`/api/admin/daily-pins/${pin.date}`, { method: 'DELETE' });
    if (!r.ok) return setNotice(r.message);
    setNotice('Pin hata diya.');
    void loadPins();
  }

  return (
    <div class="flex flex-col gap-4" data-daily-pins>
      <p class="text-sm text-muted">
        Kisi din ke 10 sawal khud chunein. Pin na ho to us din ke sawal khud chune jate hain (pichhle 15 din ke nahin). Sirf jaanche hue sawal pin hote hain.
      </p>
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p class="text-sm font-medium text-correct" role="status" data-pin-notice>
          {notice}
        </p>
      )}

      <section class="flex flex-col gap-2" aria-labelledby="pins-h">
        <h3 id="pins-h" class="font-bold">
          Aage ke din
        </h3>
        {!info ? (
          !error && <p class="text-muted">Load ho raha hai…</p>
        ) : info.pins.length === 0 ? (
          <p class="text-muted" data-pins-empty>
            Abhi koi din tay nahin. Sawal khud chune jayenge.
          </p>
        ) : (
          <ul class="flex flex-col gap-2">
            {info.pins.map((pin) => (
              <li key={pin.date} class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3" data-pin={pin.date}>
                <p class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-semibold">{dayLabel(pin.date, info.today)}</span>
                  <span class={`rounded-full px-2 py-0.5 text-xs font-semibold ${pin.source === 'pin' ? 'bg-primary-soft text-primary' : 'border border-border text-muted'}`} data-source={pin.source}>
                    {pin.source === 'pin' ? 'Aap ka pin' : 'Khud chune'}
                  </span>
                </p>
                {pin.items.some((x) => !x.ok) && <p class="text-xs text-warn">{pin.items.filter((x) => !x.ok).length} sawal ab chhupe/mite hain — visitors ko kam sawal milenge.</p>}
                <details>
                  <summary class="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-semibold text-primary">Sawal dekhein ({pin.items.length})</summary>
                  <ol class="flex list-decimal flex-col gap-1 pl-5 text-sm">
                    {pin.items.map((x) => (
                      <li key={x.id} class={x.ok ? '' : 'text-muted line-through'}>
                        #{x.id} · {x.subject} — {x.question}
                      </li>
                    ))}
                  </ol>
                </details>
                <div class="flex flex-wrap gap-2">
                  <button type="button" onClick={() => editPin(pin)} class={`${btn} border border-border`} data-pin-edit>
                    Badlein
                  </button>
                  <button type="button" onClick={() => remove(pin)} class={`${btn} border border-border text-wrong`} data-pin-delete>
                    Pin hatayen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="pin-editor" class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-labelledby="pin-new-h">
        <h3 id="pin-new-h" class="font-bold">
          Din ke sawal chunein
        </h3>
        <label class="flex flex-col gap-1 text-sm font-semibold" for="pin-date">
          Tareekh (Pakistan)
          <input
            id="pin-date"
            type="date"
            value={date}
            min={info?.today}
            max={info?.maxDate}
            onInput={(e) => setDate((e.target as HTMLInputElement).value)}
            class="min-h-[44px] rounded-lg border border-border bg-bg px-3 font-normal"
          />
        </label>
        {existing && info && (
          <p class="text-sm text-warn" data-pin-replace>
            {dayLabel(date, info.today)} ke sawal pehle se {existing.source === 'pin' ? 'pin hain' : 'khud chune ja chuke hain'}. Save karne par badal jayenge.
          </p>
        )}
        <p class="text-sm font-semibold" aria-live="polite" data-picked-count>
          Chune hue: <span class="tabular">{picked.length}</span> / {COUNT}
        </p>
        {picked.length > 0 && (
          <ol class="flex list-decimal flex-col gap-1 pl-5 text-sm" data-picked>
            {picked.map((x) => (
              <li key={x.id}>
                <span class="flex items-start justify-between gap-2">
                  <span>
                    #{x.id} · {x.subject} — {x.question}
                  </span>
                  <button type="button" onClick={() => toggle(x)} class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-wrong" aria-label={`Sawal ${x.id} hatayen`}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div class="flex flex-wrap gap-2">
          <button type="button" disabled={picked.length !== COUNT || !date || saving} onClick={save} class={`${btn} bg-primary text-on-primary disabled:opacity-50`} data-pin-save>
            {saving ? 'Save ho raha hai…' : 'Pin save karein'}
          </button>
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])} class={`${btn} border border-border`}>
              Sab hatayen
            </button>
          )}
        </div>

        <hr class="border-border" />
        <label for="pin-search" class="sr-only">
          Sawal dhoondein
        </label>
        <input id="pin-search" type="search" placeholder="Jaanche hue sawal dhoondein" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} class="min-h-[44px] rounded-lg border border-border bg-bg px-3" />
        <label for="pin-subject" class="sr-only">
          Mazmoon
        </label>
        <select id="pin-subject" value={subject} onChange={(e) => setSubject((e.target as HTMLSelectElement).value)} class="min-h-[44px] rounded-lg border border-border bg-bg px-3">
          <option value="">Sab mazameen</option>
          {p.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {!loading && items.length === 0 && <p class="text-muted">Koi jaancha hua sawal nahin mila.</p>}
        <ul class="flex flex-col gap-2">
          {items.map((m) => {
            const on = isPicked(m.id);
            return (
              <li key={m.id} class={`flex items-start justify-between gap-2 rounded-lg border p-2 ${on ? 'border-primary bg-primary-soft' : 'border-border'}`} data-pick={m.id}>
                <span class="text-sm">
                  <span class="text-xs text-muted">
                    #{m.id} · {m.subject}
                  </span>
                  <br />
                  {m.question}
                </span>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && picked.length >= COUNT}
                  onClick={() => toggle(m)}
                  class={`${btn} shrink-0 ${on ? 'bg-primary text-on-primary' : 'border border-border'} disabled:opacity-50`}
                >
                  {on ? '✓ Chuna' : 'Chunein'}
                </button>
              </li>
            );
          })}
        </ul>
        {loading && <p class="text-muted">Load ho raha hai…</p>}
        {hasMore && !loading && (
          <button type="button" onClick={() => loadMcqs(items.length)} class={`${btn} border border-border`}>
            Aur dikhayen
          </button>
        )}
      </section>
    </div>
  );
}

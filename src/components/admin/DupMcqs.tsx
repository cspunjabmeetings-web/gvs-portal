// spec: F12-AC7 — dohre sawal groups mein; "Rahe ga" chunein, baqi ek tap par hatayen
import { useEffect, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { DupGroup } from '../../lib/admin-dups';

const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';
const MAX = 100;
/** "Sab" ek dafa mein itne chakkar (har chakkar 30 groups); us se zyada ho to dobara dabayen */
const MAX_ROUNDS = 20;

export default function DupMcqs(p: { onClose: () => void }) {
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [keep, setKeep] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(): Promise<DupGroup[] | null> {
    const r = await adminJson<{ groups: DupGroup[]; total: number }>('/api/admin/mcqs/duplicates');
    if (!r.ok) {
      setError(r.message);
      return null;
    }
    setError('');
    setGroups(r.data.groups);
    setTotal(r.data.total);
    setKeep(Object.fromEntries(r.data.groups.map((g) => [g.hash, g.items[0].id])));
    return r.data.groups;
  }
  useEffect(() => {
    void load();
  }, []);

  const goes = (g: DupGroup) => g.items.filter((m) => m.id !== keep[g.hash] && !m.locked);
  const ids = (groups ?? []).flatMap(goes).map((m) => m.id);

  /** 100-100 ke tukron mein; kitne hate (masla ho to -1) */
  async function send(list: number[]): Promise<number> {
    let n = 0;
    for (let i = 0; i < list.length; i += MAX) {
      const r = await adminJson<{ deleted: number; refused: number }>('/api/admin/mcqs/duplicates', { body: { ids: list.slice(i, i + MAX) } });
      if (!r.ok) {
        setError(r.message);
        return -1;
      }
      n += r.data.deleted;
    }
    return n;
  }

  async function removeOne(id: number) {
    if (!confirm(`Sawal #${id} hamesha ke liye hatayen?`)) return;
    setBusy(true);
    const n = await send([id]);
    if (n >= 0) {
      setMsg(n ? `Sawal #${id} hata diya.` : `Sawal #${id} nahin hata (mehfooz ya pehle hi badal chuka).`);
      // Baqi groups mein aap ka chunao wahi rahe
      setGroups((gs) => (gs ?? []).map((g) => ({ ...g, items: n ? g.items.filter((m) => m.id !== id) : g.items })).filter((g) => g.items.length > 1));
      if (n) setTotal((t) => t - ((groups ?? []).some((g) => g.items.length === 2 && g.items.some((m) => m.id === id)) ? 1 : 0));
    }
    setBusy(false);
  }

  /** Pehle screen wale groups (aap ke chunao ke sath), phir baqi groups default chunao se, jab tak kuch hatta rahe */
  async function removeAll() {
    if (!confirm(`Saare dohre sawal hamesha ke liye hatayen (${total} sawal dohraye gaye)? Har sawal ki ek copy bachi rahe gi.`)) return;
    setBusy(true);
    let sum = 0;
    let list = ids;
    for (let round = 0; round < MAX_ROUNDS && list.length; round++) {
      const n = await send(list);
      if (n < 0) break;
      sum += n;
      const next = await load();
      if (!next || n === 0) break;
      list = next.flatMap((g) => g.items.filter((m, i) => i > 0 && !m.locked)).map((m) => m.id);
    }
    setBusy(false);
    setMsg(`${sum} dohre sawal hata diye.`);
  }

  return (
    <section class="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-3" data-dups>
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-lg">Dohre sawal</h3>
        <button type="button" onClick={p.onClose} class={`${btn} border border-border`}>
          Band karein
        </button>
      </div>
      {msg && (
        <p class="text-sm font-medium text-correct" role="status" data-dup-msg>
          {msg}
        </p>
      )}
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      {!groups ? (
        !error && <p class="text-muted">Dhoond rahe hain…</p>
      ) : groups.length === 0 ? (
        <p data-dup-none>Koi dohra sawal nahin. ✓</p>
      ) : (
        <>
          <p class="text-sm text-muted">
            {total} sawal dohraye gaye hain{total > groups.length ? ` (pehle ${groups.length} dikh rahe hain)` : ''}. Har ek mein jo rakhna ho us par gola lagayen. Mock ya rozana test wale nahin hatte.
          </p>
          {ids.length > 0 ? (
            <button type="button" disabled={busy} onClick={removeAll} class={`${btn} bg-primary text-on-primary disabled:opacity-60`} data-dup-remove>
              {busy ? 'Hata rahe hain…' : `Sab dohre hatayen (${ids.length}${total > groups.length ? '+' : ''})`}
            </button>
          ) : (
            <p class="text-sm text-muted">Yeh sab mehfooz hain, hatane ko kuch nahin.</p>
          )}
          <ul class="flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.hash} class="rounded-lg border border-border p-3" data-dup-group>
                <fieldset class="flex flex-col gap-2">
                  <legend class="break-words font-semibold">{g.items[0].question}</legend>
                  {g.items.map((m) => {
                    const kept = keep[g.hash] === m.id;
                    return (
                      <div key={m.id} class="flex flex-col gap-1">
                      <label class={`flex min-h-[44px] items-start gap-3 rounded-lg p-2 ${kept || m.locked ? 'bg-correct-bg' : 'bg-wrong-bg'}`} data-dup-item={m.id}>
                        <input type="radio" name={`dup-${g.hash}`} checked={kept} disabled={busy} onChange={() => setKeep((k) => ({ ...k, [g.hash]: m.id }))} class="mt-1 h-6 w-6 shrink-0 accent-[var(--primary)]" />
                        <span class="min-w-0 text-sm">
                          <span class={`font-semibold ${kept || m.locked ? 'text-correct' : 'text-wrong'}`}>{kept || m.locked ? '✓ Rahe ga' : '✕ Hatega'}</span> · #{m.id} · {m.subject} · {m.verified ? 'jaancha' : 'na jaancha'}
                          {m.mockName ? ` · Mock: ${m.mockName}` : m.locked ? ' · Rozana test mein' : ''}
                          <span class="block break-words text-muted">
                            {m.options.map((o, i) => (i === m.answerIndex ? `${o} ✓` : o)).join(' | ')}
                          </span>
                        </span>
                      </label>
                      {!kept && !m.locked && (
                        <button type="button" disabled={busy} onClick={() => removeOne(m.id)} class={`${btn} self-end border border-border text-sm text-wrong`} data-dup-one={m.id}>
                          Sirf yeh hatayen
                        </button>
                      )}
                      </div>
                    );
                  })}
                </fieldset>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

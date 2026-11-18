// spec: A05 (Mocks: chhupana, mitana), E19, F12-AC2, AC3 (mitane par sawal bank mein), AC5
import { useEffect, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminMock } from '../../lib/admin-content';

const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';

export default function MockList(p: { onShowQuestions: (m: { id: number; name: string }) => void }) {
  const [items, setItems] = useState<AdminMock[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(offset = 0) {
    setLoading(true);
    const r = await adminJson<{ items: AdminMock[]; hasMore: boolean }>(`/api/admin/mocks?offset=${offset}`);
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setError('');
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
  }
  useEffect(() => {
    void load(0);
  }, []);

  async function toggle(m: AdminMock) {
    setBusyId(m.id);
    const r = await adminJson<{ visible: boolean }>('/api/admin/mocks', { body: { id: m.id, visible: !m.visible } });
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setItems((list) => list.map((x) => (x.id === m.id ? { ...x, visible: r.data.visible } : x)));
    setNotice(r.data.visible ? 'Mock visitors ko dikhe ga.' : 'Mock chhupa diya.');
  }

  async function remove(m: AdminMock) {
    if (!confirm(`Mock "${m.name}" mitayen?\n\nIs ke ${m.questions} sawal bank mein rahenge (practice mein).`)) return;
    setBusyId(m.id);
    const r = await adminJson(`/api/admin/mocks/${m.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!r.ok) return setNotice(r.message);
    setItems((list) => list.filter((x) => x.id !== m.id));
    setNotice('Mock mita diya; sawal bank mein hain.');
  }

  return (
    <div class="flex flex-col gap-3" data-mock-list>
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
      {!loading && !error && items.length === 0 && <p class="text-muted">Abhi koi mock nahin. "Naya content" se # MOCK paste karein.</p>}
      <ul class="flex flex-col gap-3">
        {items.map((m) => (
          <li key={m.id} data-mock={m.id}>
            <article class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <h3 class="text-lg">{m.name}</h3>
              <p class="text-sm">
                <span class="tabular">{m.minutes}</span> minute · <span class="tabular">{m.questions}</span> sawal
                {m.unverified > 0 && (
                  <span class="text-warn">
                    {' '}
                    · <span class="tabular">{m.unverified}</span> na jaanche
                  </span>
                )}
              </p>
              <p class={`text-xs font-semibold ${m.visible ? 'text-correct' : 'text-warn'}`} data-visible={m.visible ? '1' : '0'}>
                {m.visible ? '✓ Visitors ko dikhta hai' : '● Chhupa'}
              </p>
              {m.summary && <p class="text-sm text-muted">{m.summary}</p>}
              <p class="text-xs text-muted">/mock-tests/{m.slug}</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" disabled={busyId === m.id} onClick={() => toggle(m)} class={`${btn} ${m.visible ? 'border border-border' : 'bg-primary text-on-primary'} disabled:opacity-60`} data-toggle>
                  {m.visible ? 'Chhupayen' : 'Dikhayen'}
                </button>
                <button type="button" onClick={() => p.onShowQuestions({ id: m.id, name: m.name })} class={`${btn} border border-border`} data-questions>
                  Sawal dekhein
                </button>
                <button type="button" disabled={busyId === m.id} onClick={() => remove(m)} class={`${btn} border border-border text-wrong disabled:opacity-60`} data-delete>
                  Mitayen
                </button>
              </div>
            </article>
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

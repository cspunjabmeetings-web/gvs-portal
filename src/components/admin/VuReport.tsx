// spec: F34-AC3 (7/30/90 din, marhale, feesad, sab se zyada chhorna, source), F34-AC5 (maang hai magar tayyari nahin) — E39
import { useEffect, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import { funnel, SOURCE_LABEL, type FunnelStep, type VuReport as Report } from '../../lib/vu-source';

const LABEL: Record<FunnelStep['key'], string> = { view: 'Page khola', start: 'Test shuru', done: 'Test mukammal', pack: 'Pack list mein', order: 'Order' };
const TERM = { mid: 'Midterm', final: 'Final' } as const;
const PAGE = 30;
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export default function VuReport() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    void adminJson<{ report: Report }>(`/api/admin/vu/report?days=${days}`).then((r) => {
      if (!live) return;
      if (r.ok) setData(r.data.report);
      else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, [days]);

  const chips = (
    <div class="flex gap-2" role="group" aria-label="Muddat">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} class={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${days === d ? 'bg-primary text-on-primary' : 'border border-border'}`} data-days={d}>
          {d} din
        </button>
      ))}
    </div>
  );
  if (error || !data)
    return (
      <div class="flex flex-col gap-4">
        {chips}
        <p class={error ? 'text-sm text-wrong' : 'text-muted'} role={error ? 'alert' : undefined}>
          {error || 'Load ho raha hai…'}
        </p>
      </div>
    );

  const f = funnel(data.total);
  const max = Math.max(1, data.total.view);
  const k = squash(q);
  const list = data.courses.filter((c) => !k || squash(c.code).includes(k));
  const wanted = data.courses.filter((c) => !c.ready && c.view > 0).sort((a, b) => b.view - a.view);

  return (
    <div class="flex flex-col gap-4" data-vu-report>
      {chips}
      <p class="text-sm text-muted">
        {data.from} se {data.to}. Yeh ginti hai, kisi student ki pehchan nahin.
      </p>
      {data.total.view + data.total.questions + data.total.order === 0 ? (
        <p class="rounded-xl bg-surface-2 p-4" data-report-empty>
          Is muddat mein abhi koi ginti nahin.
        </p>
      ) : (
        <>
          <section class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-labelledby="fun-h">
            <h2 id="fun-h" class="text-lg">
              Kul safar
            </h2>
            <ol class="flex flex-col gap-3" data-funnel>
              {f.steps.map((s) => (
                <li key={s.key} data-step={s.key}>
                  <p class="flex justify-between gap-2 text-sm">
                    <span class={f.worst === s.key ? 'font-semibold' : ''}>
                      {LABEL[s.key]}
                      {f.worst === s.key && <span class="ml-1 text-xs text-accent-text">(yahan sab se zyada ruk jate hain)</span>}
                    </span>
                    <span class="tabular whitespace-nowrap font-semibold">
                      {s.n}
                      {s.pct !== null && <span class="ml-1 font-normal text-muted">{s.pct}%</span>}
                    </span>
                  </p>
                  <div class="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <div class={`h-full ${f.worst === s.key ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${Math.min(100, (s.n / max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
            <p class="text-sm">
              Important Questions khole: <span class="tabular font-semibold">{data.total.questions}</span>
            </p>
          </section>

          <section class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4" aria-labelledby="src-h">
            <h2 id="src-h" class="text-lg">
              Kahan se aaye
            </h2>
            <ul class="flex flex-col gap-1 text-sm" data-sources>
              {data.sources.map((s) => (
                <li key={s.source} class="flex justify-between gap-2">
                  <span>{SOURCE_LABEL[s.source]}</span>
                  <span class="tabular">
                    {s.view} aaye · <strong>{s.order}</strong> order
                  </span>
                </li>
              ))}
            </ul>
            <p class="break-words text-xs text-muted">
              Link ke aakhir mein lagayen: <code>&src=channel</code>, <code>&src=group</code> ya <code>&src=status</code>. Student ka share khud <code>share</code> ginta hai.
            </p>
          </section>

          {wanted.length > 0 && (
            <section class="flex flex-col gap-2 rounded-xl border border-warn bg-surface p-4" aria-labelledby="want-h" data-wanted>
              <h2 id="want-h" class="text-lg">
                Maang hai, tayyari nahin
              </h2>
              <ul class="flex flex-col gap-1 text-sm">
                {wanted.slice(0, 20).map((c) => (
                  <li key={c.code + c.term} class="flex justify-between gap-2">
                    <span>
                      {c.code} {TERM[c.term]}
                    </span>
                    <span class="tabular">{c.view} dafa khola</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section class="flex flex-col gap-3" aria-labelledby="crs-h">
            <h2 id="crs-h" class="text-lg">
              Course-war
            </h2>
            <label for="rep-q" class="sr-only">
              Course dhoondein
            </label>
            <input id="rep-q" type="search" placeholder="Maslan CS101" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} class="min-h-[44px] rounded-lg border border-border bg-surface px-3" />
            <ul class="flex flex-col gap-2" data-report-courses>
              {list.slice(0, shown).map((c) => (
                <li key={c.code + c.term} class="rounded-xl border border-border bg-surface p-3">
                  <p class="font-semibold">
                    {c.code} {TERM[c.term]}
                  </p>
                  <dl class="mt-1 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
                    {(
                      [
                        ['Khola', c.view],
                        ['Shuru', c.start],
                        ['Mukammal', c.done],
                        ['Imp. Q', c.questions],
                        ['Pack', c.pack],
                        ['Order', c.order],
                      ] as const
                    ).map(([l, n]) => (
                      <div key={l}>
                        <dt class="text-xs text-muted">{l}</dt>
                        <dd class="tabular font-semibold">{n}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            {list.length === 0 && <p class="text-muted">Koi course nahin mila.</p>}
            {list.length > shown && (
              <button type="button" onClick={() => setShown(shown + PAGE)} class="min-h-[44px] rounded-lg border border-border px-4 font-semibold">
                Aur dikhayen ({list.length - shown})
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

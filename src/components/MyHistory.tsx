// spec: S28 /my-history, F17-AC1 (scores, streak, mock results (naam + feesad, Qadam 11b faisla 2a), bookmarks, "Mere orders" + status link), F17-AC2 (sirf browser),
//       F17-AC4 (localStorage band/khali par bhi chale), intent 11.4. Server ko kuch nahin bhejta.
import { useEffect, useState } from 'preact/hooks';
import { clearHistory, currentStreak, doneToday, historyStorageOk, loadHistory, weakestSubject, HISTORY_EVENT, type History } from '../lib/history';
import { pkDate } from '../lib/pkdate';

const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline';
const SHOW_DAYS = 30;

const fmtDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtAt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fmtDate(pkDate(d));
};

export default function MyHistory() {
  const [h, setH] = useState<History | null>(null);
  const [stored, setStored] = useState(true);
  const [allDays, setAllDays] = useState(false);

  useEffect(() => {
    const read = () => setH(loadHistory());
    read();
    setStored(historyStorageOk());
    addEventListener(HISTORY_EVENT, read);
    addEventListener('storage', read);
    return () => {
      removeEventListener(HISTORY_EVENT, read);
      removeEventListener('storage', read);
    };
  }, []);

  if (!h) return <p class="text-muted">Load ho raha hai…</p>;

  const today = pkDate();
  const streak = currentStreak(h, today);
  const days = Object.entries(h.daily).sort((a, b) => b[0].localeCompare(a[0]));
  const mocks = Object.entries(h.mocks).sort((a, b) => b[1].at.localeCompare(a[1].at));
  const weak = weakestSubject(h);
  const vu = Object.entries(h.vu).sort((a, b) => b[1].at.localeCompare(a[1].at));
  const empty = !days.length && !mocks.length && !vu.length && !h.bookmarks.length && !h.orders.length;

  function wipe() {
    if (!confirm('Is browser se saari history (scores, streak, bookmarks, orders ki list) mita dein? Yeh wapas nahin aaye gi.')) return;
    setH(clearHistory());
  }

  return (
    <div class="flex flex-col gap-6" data-my-history>
      {!stored && (
        <p class="rounded-xl border border-warn bg-surface p-4 text-sm" role="status" data-storage-off>
          Is browser mein history save nahin ho rahi (private/incognito mode ya storage band). Test aur order phir bhi chalte hain.
        </p>
      )}

      <section class="grid grid-cols-2 gap-3" aria-label="Khulasa">
        <div class="rounded-xl bg-accent p-4 text-on-accent" data-streak>
          <p class="text-sm">Streak</p>
          <p class="tabular text-2xl font-bold">{streak} din</p>
        </div>
        <div class="rounded-xl border border-border bg-surface p-4">
          <p class="text-sm text-muted">Aaj ka test</p>
          <p class="font-bold" data-today>
            {doneToday(h, today) ? `${h.daily[today].score} / ${h.daily[today].total}` : 'Baqi hai'}
          </p>
        </div>
      </section>

      {!doneToday(h, today) && (
        <a href="/daily-test" class={`${btn} bg-primary text-on-primary`}>
          Aaj ka test dein
        </a>
      )}
      {weak && (
        <p class="text-sm" data-weak>
          Sab se kamzor mazmoon: <strong>{weak}</strong>.{' '}
          <a href="/mcqs" class="font-semibold">
            Mazmoon-war practice karein
          </a>
        </p>
      )}

      {empty && (
        <p class="rounded-xl bg-surface-2 p-4" data-history-empty>
          Abhi yahan kuch nahin. Rozana test dein ya order karein, sab yahan nazar aaye ga.
        </p>
      )}

      <section aria-labelledby="days-h" class="flex flex-col gap-2">
        <h2 id="days-h" class="text-xl">Rozana test ke scores</h2>
        {days.length === 0 ? (
          <p class="text-muted">Abhi koi rozana test nahin diya.</p>
        ) : (
          <ul class="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface" data-days>
            {(allDays ? days : days.slice(0, SHOW_DAYS)).map(([d, e]) => (
              <li key={d} class="flex items-center justify-between px-4 py-3">
                <span>{d === today ? 'Aaj' : fmtDate(d)}</span>
                <span class="tabular font-semibold">
                  {e.score} / {e.total}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!allDays && days.length > SHOW_DAYS && (
          <button type="button" onClick={() => setAllDays(true)} class={`${btn} border border-border`}>
            Saare din dikhayen ({days.length})
          </button>
        )}
      </section>

      <section aria-labelledby="mocks-h" class="flex flex-col gap-2">
        <h2 id="mocks-h" class="text-xl">Mock test ke nateeje</h2>
        {mocks.length === 0 ? (
          <p class="text-muted" data-mocks-empty>
            Abhi koi mock test nahin diya.
          </p>
        ) : (
          <ul class="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface" data-mocks>
            {mocks.map(([slug, m]) => (
              <li key={slug} class="flex items-center justify-between gap-2 px-4 py-3">
                <span class="min-w-0 break-words">
                  <a href={`/mock-tests/${slug}`}>{m.name || slug.replace(/-/g, ' ')}</a>
                  <span class="block text-xs text-muted">{fmtAt(m.at)}</span>
                </span>
                <span class="tabular whitespace-nowrap text-right font-semibold">
                  {m.score} / {m.total}
                  <span class="block text-xs font-normal text-muted">{m.total ? Math.round((m.score / m.total) * 100) : 0}%</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {vu.length > 0 && (
        <section aria-labelledby="vu-h" class="flex flex-col gap-2">
          <h2 id="vu-h" class="text-xl">VU ki tayyari</h2>
          <ul class="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface" data-vu-history>
            {vu.map(([key, e]) => {
              const [code, term] = key.split(':');
              return (
                <li key={key} class="flex items-center justify-between gap-2 px-4 py-3">
                  <span class="min-w-0 break-words">
                    <a href={`/vu-mock/${code.toLowerCase()}?term=${term}`}>
                      {code} {term === 'mid' ? 'Midterm' : 'Final Term'}
                    </a>
                    <span class="block text-xs text-muted">{fmtAt(e.at)}</span>
                  </span>
                  <span class="tabular whitespace-nowrap text-right font-semibold">
                    {e.right.length} / {e.total}
                    <span class="block text-xs font-normal text-muted">{e.total ? Math.round((e.right.length / e.total) * 100) : 0}% tayyari</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="bm-h" class="flex flex-col gap-2">
        <h2 id="bm-h" class="text-xl">Bookmarks</h2>
        <p data-bookmarks>
          {h.bookmarks.length ? (
            <>
              Aap ne <strong class="tabular">{h.bookmarks.length}</strong> sawal par ☆ nishan lagaya hai.
            </>
          ) : (
            <span class="text-muted">Abhi koi bookmark nahin. Test mein ☆ daba kar sawal yaad rakhein.</span>
          )}
        </p>
      </section>

      <section aria-labelledby="orders-h" class="flex flex-col gap-2">
        <h2 id="orders-h" class="text-xl">Mere orders</h2>
        {h.orders.length === 0 ? (
          <p class="text-muted">Is browser se abhi koi order nahin hua.</p>
        ) : (
          <ul class="flex flex-col gap-2" data-orders>
            {h.orders.map((o) => (
              <li key={o.id} class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2">
                <span>
                  <span class="tabular font-semibold">{o.id}</span>
                  <span class="block text-xs text-muted">
                    {fmtAt(o.at)} · number ke aakhri 4: <span class="tabular">{o.last4}</span>
                  </span>
                </span>
                <a href={`/track?id=${encodeURIComponent(o.id)}`} class={`${btn} border border-border`}>
                  Darja dekhein
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!empty && (
        <button type="button" onClick={wipe} class={`${btn} self-start border border-border text-wrong`} data-wipe>
          Sab history mitayen
        </button>
      )}
    </div>
  );
}

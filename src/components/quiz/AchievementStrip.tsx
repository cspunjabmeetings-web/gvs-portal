// spec: F33-AC3 (har 6 s agli; "Rokein" button; reduced-motion par ruki, haath se "Agla"), F33-AC5 (khali = kuch nahin; CLS 0: saari lines ek hi
//       grid khane mein, is liye unchai sab se lambi wali jitni aur badalne par kuch nahin hilta). Koi request nahin: data props se.
import { useEffect, useState } from 'preact/hooks';
import { ACH_LIMITS, achTag, type Achievement } from '../../lib/achievements-rules';

export const STRIP_MS = 6000;

export default function AchievementStrip(p: { items: Achievement[] }) {
  const items = p.items.slice(0, ACH_LIMITS.strip);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setStill(true);
  }, []);
  useEffect(() => {
    if (paused || still || items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), STRIP_MS);
    return () => clearInterval(t);
  }, [paused, still, items.length]);

  if (!items.length) return null;
  return (
    <aside class="flex items-center gap-2 rounded-xl bg-primary py-1 pl-3 pr-1 text-on-primary" aria-label="Hamare students" data-strip>
      <span aria-hidden="true">🏆</span>
      <div class="grid min-w-0 flex-1">
        {items.map((a, i) => (
          <p
            key={a.id}
            class={`col-start-1 row-start-1 self-center break-words py-1 text-sm font-medium leading-snug transition-opacity duration-300 ${i === idx ? 'opacity-100' : 'invisible opacity-0'}`}
            aria-hidden={i !== idx}
            data-strip-item={a.id}
            data-on={i === idx ? '' : undefined}
          >
            {achTag(a) && <span class="font-bold">{achTag(a)}: </span>}
            {a.kind === 'remark' ? `"${a.body}"` : a.body}
            {a.person && <span> ({a.person})</span>}
            {a.rating && (
              <span class="whitespace-nowrap">
                {' '}
                <span aria-hidden="true">{'★'.repeat(a.rating)}</span>
                <span class="sr-only">5 mein se {a.rating} sitare</span>
              </span>
            )}
          </p>
        ))}
      </div>
      {items.length > 1 && (
        <button
          type="button"
          onClick={() => (still ? setIdx((i) => (i + 1) % items.length) : setPaused((x) => !x))}
          class="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-sm"
          aria-label={still ? 'Agla' : paused ? 'Chalayen' : 'Rokein'}
          data-strip-btn
        >
          <span aria-hidden="true">{still ? '›' : paused ? '▶' : '❚❚'}</span>
        </button>
      )}
    </aside>
  );
}

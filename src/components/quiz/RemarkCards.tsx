// spec: F33-AC4 — VU nateeje par remarks, pack ke bilkul upar (3 tak; isi course ke pehle). Khali = kuch nahin.
import { achTag, remarksFor, type Achievement } from '../../lib/achievements-rules';

export default function RemarkCards(p: { items: Achievement[]; code: string }) {
  const list = remarksFor(p.items, p.code);
  if (!list.length) return null;
  return (
    <section class="flex flex-col gap-3" aria-labelledby="remarks-h" data-remarks>
      <h2 id="remarks-h" class="text-xl">
        Students kya kehte hain
      </h2>
      <ul class="flex flex-col gap-3">
        {list.map((a) => (
          <li key={a.id} class="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4" data-remark={a.id}>
            {a.rating && (
              <p class="text-lg text-accent-text">
                <span aria-hidden="true">
                  {'★'.repeat(a.rating)}
                  {'☆'.repeat(5 - a.rating)}
                </span>
                <span class="sr-only">5 mein se {a.rating} sitare</span>
              </p>
            )}
            <p class="break-words">"{a.body}"</p>
            <p class="text-sm text-muted">{[a.person, achTag(a)].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

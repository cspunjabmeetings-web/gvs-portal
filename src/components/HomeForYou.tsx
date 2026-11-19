// spec: S01 (streak ki yaad dihani), F01-AC3 ("Aaj ka test baqi hai, streak na toden"), F17-AC5 ("Aap ke liye": kamzor mazmoon, history se),
//       intent 11.5. History khali ya localStorage band ho to kuch nahin dikhata (F17-AC4).
import { useEffect, useState } from 'preact/hooks';
import { homeHints, loadHistory, HISTORY_EVENT } from '../lib/history';
import { pkDate } from '../lib/pkdate';

type Hints = ReturnType<typeof homeHints>;
const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline whitespace-nowrap';

export default function HomeForYou() {
  const [hints, setHints] = useState<Hints | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setHints(homeHints(loadHistory(), pkDate()));
      } catch {
        setHints(null);
      }
    };
    read();
    addEventListener(HISTORY_EVENT, read);
    return () => removeEventListener(HISTORY_EVENT, read);
  }, []);

  if (!hints || (!hints.remindStreak && !hints.weak)) return null;

  return (
    <div class="mt-4 flex flex-col gap-3" data-for-you>
      {hints.remindStreak && (
        <p class="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-accent bg-surface p-4" role="status" data-streak-reminder>
          <span>
            <strong>Aaj ka test baqi hai, streak na toden.</strong>
            <span class="block text-sm text-muted">Aap ki streak: {hints.remindStreak} din</span>
          </span>
          <a href="/daily-test" class={`${btn} bg-accent text-on-accent`}>
            Test dein
          </a>
        </p>
      )}
      {hints.weak && (
        <section class="rounded-xl border border-border bg-surface p-4" aria-labelledby="for-you-h" data-weak-card>
          <h2 id="for-you-h" class="text-lg">
            Aap ke liye
          </h2>
          <p class="mt-1 text-sm">
            <strong>{hints.weak.subject}</strong> mein aap ke {hints.weak.wrong} sawal ghalat hue. Isi mazmoon ki practice karein.
          </p>
          <a href={`/mcqs/${hints.weak.slug}`} class={`${btn} mt-3 bg-primary text-on-primary`}>
            {hints.weak.subject} ke sawal
          </a>
        </section>
      )}
    </div>
  );
}

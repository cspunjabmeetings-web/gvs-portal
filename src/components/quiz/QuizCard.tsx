// spec: F13-AC3 (bare option cards ≥ 44px; dabate hi hara ✓ / surkh ✕ + sahih hara; tashreeh narmi se; koi network nahin, < 100 ms),
//       F13-AC6 (bookmark ☆ + "Ghalti batayen" WhatsApp link sawal #id ke sath), F14-AC3, design.md QuizCard + hosla afzai;
//       mode 'select' = mock test (design.md 6.7: jawab foran nahin dikhta, sirf chuna jata hai, badal sakte hain)
import type { QuizMcq } from '../../lib/daily';

const LETTERS = 'ABCDE';

export default function QuizCard(p: {
  q: QuizMcq;
  picked: number | null;
  onPick: (i: number) => void;
  bookmarked: boolean;
  onBookmark: () => void;
  reportHref: string;
  mode?: 'instant' | 'select';
}) {
  const { q, picked } = p;
  const select = p.mode === 'select';
  const answered = !select && picked !== null;
  const right = answered && picked === q.answerIndex;

  return (
    <article class="flex flex-col gap-3" data-quiz-card data-qid={q.id}>
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs text-muted">{q.subject}</p>
        <button
          type="button"
          onClick={p.onBookmark}
          aria-pressed={p.bookmarked}
          aria-label={p.bookmarked ? 'Bookmark hatayen' : 'Bookmark karein'}
          class={`-mt-2 min-h-[44px] min-w-[44px] rounded-lg text-xl ${p.bookmarked ? 'text-accent' : 'text-muted'}`}
          data-bookmark
        >
          {p.bookmarked ? '★' : '☆'}
        </button>
      </div>
      <h2 class="text-lg font-semibold leading-snug">{q.question}</h2>

      <ul class="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const isAnswer = i === q.answerIndex;
          const isPicked = i === picked;
          const tone = select
            ? isPicked
              ? 'border-primary bg-primary-soft font-semibold'
              : 'border-border bg-surface hover:border-primary'
            : !answered
            ? 'border-border bg-surface hover:border-primary'
            : isAnswer
              ? `border-correct bg-correct-bg text-correct font-semibold ${isPicked ? 'anim-pop' : ''}`
              : isPicked
                ? 'border-wrong bg-wrong-bg text-wrong font-semibold'
                : 'border-border bg-surface opacity-70';
          return (
            <li key={i}>
              <button
                type="button"
                disabled={answered}
                onClick={() => p.onPick(i)}
                aria-pressed={select ? isPicked : undefined}
                class={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left disabled:cursor-default ${tone}`}
                data-option={i}
              >
                <span class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${select && isPicked ? 'border-primary bg-primary text-on-primary' : answered && (isAnswer || isPicked) ? 'border-current' : 'border-border'}`} aria-hidden="true">
                  {answered && isAnswer ? '✓' : answered && isPicked ? '✕' : LETTERS[i]}
                </span>
                <span class="flex-1">{o}</span>
                {answered && isAnswer && <span class="sr-only">(sahih jawab)</span>}
                {answered && isPicked && !isAnswer && <span class="sr-only">(aap ka jawab, ghalat)</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div class="anim-reveal flex flex-col gap-1 rounded-xl bg-surface-2 p-3" role="status" data-feedback>
          <p class={`font-semibold ${right ? 'text-correct' : 'text-wrong'}`}>{right ? 'Shabash! Sahih jawab.' : 'Koi baat nahin, tashreeh parhein.'}</p>
          {q.explanation && <p class="text-sm">{q.explanation}</p>}
        </div>
      )}

      <a href={p.reportHref} target="_blank" rel="noopener" class="inline-flex min-h-[44px] items-center self-start text-sm text-muted" data-report>
        Ghalti batayen (WhatsApp)
      </a>
    </article>
  );
}

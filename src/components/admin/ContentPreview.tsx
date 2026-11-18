// spec: A06 Content preview, design.md ImportPreview ("ginti chips, har cheez visitor wale rup mein, ghaltiyan --wrong list mein"),
//       F11-AC2 (ginti, visitor jaisa rup, ghaltiyan line ke sath), F11-AC7 (ek jaisa sawal ki khabardari)
// Note ka matn abhi saada (markdown ka asal design Qadam 12 mein — owner ka faisla).
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { ParseResult, ParsedItem, ParsedMcq } from '../../lib/parser';

export interface DupInfo {
  /** Database mein pehle se */
  existing: Set<ParsedMcq>;
  /** Isi paste mein pehle sawal ka number */
  repeats: Map<ParsedMcq, number>;
}

const PAGE = 30;
const LETTERS = 'ABCDE';

function Chip(p: { label: string; n: number; tone?: 'wrong' | 'muted' }) {
  const cls = p.tone === 'wrong' ? 'bg-wrong-bg text-wrong' : p.tone === 'muted' ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary';
  return (
    <li class={`rounded-full px-3 py-1 text-sm font-semibold ${cls}`}>
      {p.label}: <span class="tabular">{p.n}</span>
    </li>
  );
}

export function McqCard(p: { q: ParsedMcq; dup: DupInfo }) {
  const { q } = p;
  const inDb = p.dup.existing.has(q);
  const rep = p.dup.repeats.get(q);
  return (
    <article class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3" data-preview="mcq">
      <p class="flex flex-wrap gap-2 text-xs text-muted">
        <span>Sawal {q.number}</span>
        <span>· {q.subject}</span>
        {q.difficulty && <span>· {q.difficulty}</span>}
        {q.asOfDate && <span>· {q.asOfDate}</span>}
      </p>
      <p class="font-semibold">{q.question}</p>
      <ol class="flex flex-col gap-1">
        {q.options.map((o, i) => (
          <li key={i} class={`rounded-lg border px-3 py-2 text-sm ${i === q.answerIndex ? 'border-correct bg-correct-bg font-semibold text-correct' : 'border-border'}`}>
            {LETTERS[i]}) {o}
            {i === q.answerIndex && <span class="sr-only"> (sahih jawab)</span>}
            {i === q.answerIndex && ' ✓'}
          </li>
        ))}
      </ol>
      {q.explanation && <p class="text-sm text-muted">Tashreeh: {q.explanation}</p>}
      {(inDb || rep) && (
        <p class="rounded-lg bg-surface-2 p-2 text-sm font-medium text-accent-text" data-dup>
          ⚠ {[inDb && 'Yeh sawal pehle se database mein hai.', rep && `Yeh sawal isi paste ke sawal ${rep} jaisa hai.`].filter(Boolean).join(' ')}
        </p>
      )}
    </article>
  );
}

function ItemCard(p: { item: ParsedItem; dup: DupInfo }) {
  const it = p.item;
  if (it.kind === 'MCQ') return <McqCard q={it} dup={p.dup} />;
  if (it.kind === 'MOCK')
    return (
      <article class="flex flex-col gap-2 rounded-xl border-2 border-primary bg-surface p-3" data-preview="mock">
        <p class="text-xs font-semibold text-primary">Mock test</p>
        <h3 class="text-lg">{it.name}</h3>
        <p class="text-sm">
          <span class="tabular">{it.minutes}</span> minute · <span class="tabular">{it.mcqs.length}</span> sawal
        </p>
        {it.summary && <p class="text-sm text-muted">{it.summary}</p>}
        <details>
          <summary class="min-h-[44px] cursor-pointer content-center font-medium">Sawal dekhein</summary>
          <div class="mt-2 flex flex-col gap-2">
            {it.mcqs.map((q) => (
              <McqCard key={q.line} q={q} dup={p.dup} />
            ))}
          </div>
        </details>
      </article>
    );
  if (it.kind === 'NOTE')
    return (
      <article class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3" data-preview="note">
        <p class="text-xs text-muted">Note · {it.subject}</p>
        <h3 class="text-lg">{it.title}</h3>
        <p class="text-sm text-muted">{it.summary}</p>
        <details>
          <summary class="min-h-[44px] cursor-pointer content-center font-medium">Matn dekhein</summary>
          <p class="text-xs text-muted">Saada shakal; headings aur list ka asal design Qadam 12 mein.</p>
          <pre class="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{it.body}</pre>
        </details>
      </article>
    );
  return (
    <article class="rounded-xl border border-border bg-surface-2 p-3" data-preview="job">
      <p class="font-semibold">
        Job: {it.org} — {it.post}
      </p>
      <p class="text-sm text-accent-text">Yeh job hai; yahan save nahin hogi. Jobs tab (Qadam 13) mein daalein.</p>
    </article>
  );
}

/** `children` = save ka dabba: ginti/ghaltiyon ke foran baad, cards se pehle (phone par lambi list ke neeche na chhupe) */
export default function ContentPreview(p: { result: ParseResult; dup: DupInfo; children?: ComponentChildren }) {
  const { result } = p;
  const [shown, setShown] = useState(PAGE);
  const mockMcqs = result.items.reduce((n, it) => n + (it.kind === 'MOCK' ? it.mcqs.length : 0), 0);
  const ok = {
    MCQ: result.items.filter((x) => x.kind === 'MCQ').length,
    MOCK: result.items.filter((x) => x.kind === 'MOCK').length,
    NOTE: result.items.filter((x) => x.kind === 'NOTE').length,
    JOB: result.items.filter((x) => x.kind === 'JOB').length,
  };
  const dupCount = p.dup.existing.size + [...p.dup.repeats.keys()].filter((q) => !p.dup.existing.has(q)).length;

  return (
    <section class="flex flex-col gap-3" aria-label="Preview" data-preview-root>
      <h2 class="text-lg">Preview</h2>
      <ul class="flex flex-wrap gap-2" data-counts>
        <Chip label="Sawal" n={ok.MCQ + mockMcqs} />
        <Chip label="Mock" n={ok.MOCK} />
        <Chip label="Notes" n={ok.NOTE} />
        {ok.JOB > 0 && <Chip label="Jobs (yahan nahin)" n={ok.JOB} tone="muted" />}
        {result.errors.length > 0 && <Chip label="Ghaltiyan" n={result.errors.length} tone="wrong" />}
        {dupCount > 0 && <Chip label="Ek jaise sawal" n={dupCount} tone="muted" />}
      </ul>

      {result.errors.length > 0 && (
        <div class="rounded-xl border border-wrong bg-wrong-bg p-3" role="alert" data-errors>
          <p class="mb-2 font-semibold text-wrong">Yeh hisse save nahin honge (text theek kar ke dobara preview karein):</p>
          <ul class="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm text-wrong">
            {result.errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {p.children}

      <div class="flex flex-col gap-3">
        {result.items.slice(0, shown).map((it) => (
          <ItemCard key={`${it.kind}-${it.line}`} item={it} dup={p.dup} />
        ))}
      </div>
      {result.items.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} class="min-h-[44px] rounded-lg border border-border px-4 font-semibold">
          Aur dikhayen ({result.items.length - shown} baqi)
        </button>
      )}
    </section>
  );
}

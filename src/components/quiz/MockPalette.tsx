// spec: F15-AC3 (hal shuda, baqi, "baad mein dekhein" alag rang AUR nishan; kisi number par jump),
//       design.md MockPalette (40px squares: hal shuda = primary bg, baqi = border, "baad mein" = amber + ● nishan, current = focus ring)
import { cellOf, type MockProgress, type MockQ } from '../../lib/mock-engine';

const CELL = {
  answered: 'bg-primary text-on-primary border-primary',
  flagged: 'bg-accent text-on-accent border-accent',
  empty: 'bg-surface text-text border-border',
} as const;
const LABEL = { answered: 'hal shuda', flagged: 'baad mein dekhein', empty: 'baqi' } as const;

export function PaletteLegend() {
  return (
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Rangon ka matlab">
      <li class="flex items-center gap-1">
        <span class={`inline-flex h-4 w-4 rounded border ${CELL.answered}`} aria-hidden="true" /> Hal shuda
      </li>
      <li class="flex items-center gap-1">
        <span class={`inline-flex h-4 w-4 items-center justify-center rounded border text-[8px] ${CELL.flagged}`} aria-hidden="true">●</span> Baad mein dekhein
      </li>
      <li class="flex items-center gap-1">
        <span class={`inline-flex h-4 w-4 rounded border ${CELL.empty}`} aria-hidden="true" /> Baqi
      </li>
    </ul>
  );
}

export default function MockPalette(p: { qs: readonly MockQ[]; progress: MockProgress; onJump: (idx: number) => void }) {
  return (
    <ol class="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-2" data-palette>
      {p.qs.map((q, i) => {
        const c = cellOf(p.progress, q.id);
        const current = i === p.progress.idx;
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => p.onJump(i)}
              aria-current={current ? 'step' : undefined}
              aria-label={`Sawal ${i + 1}, ${LABEL[c]}`}
              class={`relative flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-semibold tabular ${CELL[c]} ${current ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
              data-cell={c}
              data-cell-index={i}
            >
              {i + 1}
              {c === 'flagged' && (
                <span class="absolute -right-1 -top-1 text-[10px] leading-none" aria-hidden="true">
                  ●
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// spec: F15-AC4 (ulti ginti; aakhri 5 minute mein rang badle), design.md Timer (tabular; aakhri 5 minute --warn rang + ⏱ nishan)
import { formatClock, isWarn } from '../../lib/mock-engine';

export default function Timer(p: { remainingMs: number }) {
  const warn = isWarn(p.remainingMs);
  return (
    <p class={`tabular flex items-center gap-1 text-lg font-bold ${warn ? 'text-warn' : 'text-text'}`} data-timer data-warn={warn ? '1' : '0'}>
      <span aria-hidden="true">{warn ? '⏱' : '◷'}</span>
      <span class="sr-only">Baqi waqt:</span>
      {formatClock(p.remainingMs)}
      {warn && <span class="sr-only">(aakhri 5 minute)</span>}
    </p>
  );
}

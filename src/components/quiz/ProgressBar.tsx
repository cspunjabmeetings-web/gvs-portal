// spec: F13-AC4 ("Sawal 4 / 10" + chalta score), design.md ProgressBar (6px bar --primary, score right)
export default function ProgressBar(p: { index: number; total: number; score: number }) {
  const pct = Math.round((p.index / Math.max(1, p.total)) * 100);
  return (
    <div class="flex flex-col gap-1" data-progress>
      <div class="flex justify-between text-sm font-semibold">
        <span class="tabular">
          Sawal {Math.min(p.index + 1, p.total)} / {p.total}
        </span>
        <span class="tabular text-primary">Score: {p.score}</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.index} aria-label="Test ki progress">
        <div class="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

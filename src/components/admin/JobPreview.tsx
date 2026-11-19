// spec: A07 (save se pehle visitor jaisa preview), design.md 6.9 (taleem, documents ✓, tareeqa numbered, akhri tareekh, official link ↗,
//       "Hum apply kar dein" ya band), F19-AC2 (khali fee = default). Sab matn Preact se escape.
import type { ParsedJob } from '../../lib/parser';
import { daysLeftLabel } from '../../lib/job-form';
import { formatPrice } from '../../lib/catalog';

export default function JobPreview(p: { job: Omit<ParsedJob, 'kind' | 'line' | 'source'>; defaultFee: number; today: string }) {
  const j = p.job;
  const fee = j.ourFee ?? p.defaultFee;
  const open = j.lastDate >= p.today;
  return (
    <article class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-sm" data-job-preview>
      <p class="text-xs font-semibold text-primary">{j.org}</p>
      <h3 class="text-lg">{j.post}</h3>
      <p class="flex flex-wrap gap-x-3 text-muted">
        {j.city && <span>{j.city}</span>}
        <span>
          Akhri tareekh: <span class="tabular font-semibold text-text">{j.lastDate}</span> ({daysLeftLabel(j.lastDate, p.today)})
        </span>
      </p>
      {j.education && <p>Taleem: {j.education}</p>}
      {j.documents.length > 0 && (
        <div>
          <p class="font-semibold">Documents</p>
          <ul class="flex flex-col gap-1">
            {j.documents.map((d, i) => (
              <li key={i}>
                <span class="text-correct" aria-hidden="true">
                  ✓{' '}
                </span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
      {j.steps.length > 0 && (
        <div>
          <p class="font-semibold">Tareeqa</p>
          <ol class="flex list-decimal flex-col gap-1 pl-5">
            {j.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      <p class="break-all">
        Official link: <span class="text-primary">{j.officialUrl}</span> ↗
      </p>
      {j.adUrl && <p class="break-all">Ishtihar: {j.adUrl}</p>}
      <p>
        {j.govtFee !== null ? `Sarkari fee ${formatPrice(j.govtFee)} (alag, official challan par)` : 'Sarkari fee: likhi nahin'} ·{' '}
        {j.applyService ? (
          <span data-job-fee>
            Hamari fee {formatPrice(fee)}
            {j.ourFee === null && ' (default)'}
          </span>
        ) : (
          <span data-job-noapply>Apply service: Nahin (button nahin hoga)</span>
        )}
      </p>
      {!open && <p class="font-semibold text-wrong">Akhri tareekh guzar chuki: yeh "Purani" mein jaye gi.</p>}
    </article>
  );
}

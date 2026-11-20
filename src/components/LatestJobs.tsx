// spec: F01-AC4 (Home par taza jobs: 3 tak, sirf khuli, naye pehle; data E07 GET /api/jobs/latest), S01. Koi job na ho / ghalti → kuch nahin dikhta.
import { useEffect, useState } from 'preact/hooks';
import { pkDate } from '../lib/pkdate';
import { daysLeftLabel } from '../lib/job-form';

interface Card {
  slug: string;
  org: string;
  post: string;
  city: string | null;
  lastDate: string;
}

export default function LatestJobs() {
  const [jobs, setJobs] = useState<Card[] | null>(null);
  useEffect(() => {
    fetch('/api/jobs/latest', { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ jobs?: Card[] }>) : null))
      .then((d: { jobs?: Card[] } | null) => setJobs(Array.isArray(d?.jobs) ? d!.jobs : []))
      .catch(() => setJobs([]));
  }, []);
  if (!jobs || !jobs.length) return null;
  const today = pkDate();
  return (
    <section class="flex flex-col gap-3" aria-labelledby="latest-jobs-h" data-latest-jobs>
      <h2 id="latest-jobs-h">Taza jobs</h2>
      <ul class="grid gap-3 md:grid-cols-3">
        {jobs.map((j) => (
          <li key={j.slug}>
            <a href={`/jobs/${j.slug}`} class="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 no-underline" data-latest-job={j.slug}>
              <span class="text-xs font-semibold text-primary">{j.org}</span>
              <span class="font-semibold text-text">{j.post}</span>
              {j.city && <span class="text-sm text-muted">{j.city}</span>}
              <span class="text-sm font-semibold text-accent-text">{daysLeftLabel(j.lastDate, today)}</span>
            </a>
          </li>
        ))}
      </ul>
      <a href="/jobs" class="inline-flex min-h-[44px] items-center self-start font-semibold">
        Saari jobs dekhein
      </a>
    </section>
  );
}

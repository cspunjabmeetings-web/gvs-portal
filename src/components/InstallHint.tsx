// spec: F26-AC1 ("Home screen par rakhein" ka option: Footer + rozana test ka score card — owner ka faisla Qadam 15c: 2b),
//       F26-AC2 (service worker nahin), intent 11.5 (pop-up nahin; sirf visitor ke dabane par), design.md (44px).
// Bina JS bhi <details> ka tareeqa khulta hai (SSR). Button sirf jab browser ijazat de (Chrome/Edge).
import { useEffect, useState } from 'preact/hooks';
import { INSTALL_EVENT, canInstall, isStandalone, promptInstall } from '../lib/install';

export default function InstallHint(p: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    const sync = () => setReady(canInstall());
    sync();
    addEventListener(INSTALL_EVENT, sync);
    return () => removeEventListener(INSTALL_EVENT, sync);
  }, []);

  if (standalone) return null; // pehle se app ki tarah khula hai

  return (
    <div class={p.compact ? 'flex flex-col gap-2' : 'flex flex-col gap-2 max-w-md'} data-install-hint>
      {ready && !done && (
        <button
          type="button"
          onClick={async () => setDone(await promptInstall())}
          class="min-h-[44px] rounded-lg border border-primary px-4 font-semibold text-primary"
          data-install-btn
        >
          Home screen par rakhein
        </button>
      )}
      {done && (
        <p class="text-sm text-correct" role="status">
          ✓ GVS ab aap ki home screen par hai.
        </p>
      )}
      <details class="text-sm" data-install-steps>
        <summary class="flex min-h-[44px] cursor-pointer items-center font-semibold">{ready ? 'Ya khud rakhein' : 'Home screen par kaise rakhein?'}</summary>
        <ul class="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted">
          <li>
            <strong>Android (Chrome):</strong> upar ⋮ menu → "Add to Home screen" ya "Install app".
          </li>
          <li>
            <strong>iPhone (Safari):</strong> neeche Share ↑ → "Add to Home Screen".
          </li>
          <li>Phir GVS ka icon dabate hi rozana test, MCQs aur jobs seedhe khulenge.</li>
        </ul>
      </details>
    </div>
  );
}

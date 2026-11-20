// spec: F26-AC1 ("Home screen par rakhein" ka option), F26-AC2 (service worker NAHIN), intent 11.5 (zabardasti ka pop-up nahin).
// Browser mein chalta hai. Chrome/Edge jab ijazat dein to `beforeinstallprompt` aata hai — use rok kar (browser ka apna mini-banner
// nahin) yaad rakhte hain, aur sirf visitor ke button dabane par dikhate hain.

export const INSTALL_EVENT = 'gvs:install';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let saved: InstallPromptEvent | null = null;
let captured = false;

/** Base.astro se ek dafa (har page) */
export function captureInstall(): void {
  if (captured || typeof window === 'undefined') return;
  captured = true;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    saved = e as InstallPromptEvent;
    dispatchEvent(new Event(INSTALL_EVENT));
  });
  addEventListener('appinstalled', () => {
    saved = null;
    dispatchEvent(new Event(INSTALL_EVENT));
  });
}

export const canInstall = () => saved !== null;

/** Pehle se home screen se khula hua (app ki tarah) */
export function isStandalone(): boolean {
  try {
    return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Browser ka apna "install" sawal; true = visitor ne "haan" kaha */
export async function promptInstall(): Promise<boolean> {
  const e = saved;
  if (!e) return false;
  saved = null; // ek event sirf ek dafa chalta hai
  try {
    await e.prompt();
    const r = await e.userChoice;
    return r.outcome === 'accepted';
  } catch {
    return false;
  } finally {
    dispatchEvent(new Event(INSTALL_EVENT));
  }
}

// spec: F08-AC11 (naye order par halki awaz aur, ijazat ho to, browser notification), FU-02 (service worker/push nahin)
// Sirf browser. Koi audio file nahin: Web Audio ki chhoti "ting".

type AC = typeof AudioContext;
let ctx: AudioContext | null = null;

/** Browser awaz sirf user ke tap ke baad chalne deta hai: pehle tap par AudioContext tayyar */
export function unlockAudio(): void {
  try {
    const C: AC | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
    if (!C) return;
    ctx ??= new C();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* awaz nahin to koi baat nahin */
  }
}

/** Halki do-surr ting (~0.5 s, dheemi awaz) */
export function chime(): boolean {
  try {
    if (!ctx || ctx.state !== 'running') return false;
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const s = t + i * 0.16;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
      o.connect(g).connect(ctx!.destination);
      o.start(s);
      o.stop(s + 0.4);
    });
    return true;
  } catch {
    return false;
  }
}

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifyPermission(): NotifyPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function askNotifyPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyPermission();
  }
}

/** Ijazat ho to browser notification. Kuch mobile browsers service worker ke baghair nahin dikhate — tab chupchap kuch nahin. */
export function showBrowserNotification(title: string, body: string, tag: string): boolean {
  if (notifyPermission() !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag, icon: '/images/logo.svg' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Shell aur tabs ke beech events */
export const ADMIN_EVENTS = {
  /** detail: AdminNotification[] (naye aaye) */
  incoming: 'gvs:admin-notifs',
  /** detail: number (na-parhi ginti) */
  unread: 'gvs:admin-unread',
} as const;

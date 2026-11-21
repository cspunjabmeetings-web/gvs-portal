// spec: 6.1 AnnouncementBar (announcement_text agar on, sab se upar; admin par nahin), F10-AC3, F10-AC7, design.md (amber patti),
//       intent 20 / F21 (CLS < 0.1)
// Qadam 17b (Lighthouse): patti ka dhancha Base.astro mein server HTML ke andar (`[data-announcement]`, hidden) aur us ke
// foran baad ek inline script sessionStorage ke cache se paint se pehle matn bhar deta hai — is liye dusre page se aage
// page nahin hilta. Yeh island sirf taza Settings aane par usi patti ka matn badalta/chhupata hai (khud kuch render nahin karta).
// Saath mein static pages par likha WhatsApp number (Footer, TrustStrip) taza number se badalta hai (F10-AC7).
import { useEffect } from 'preact/hooks';
import { applyNumberLinks, cachedSettings, refreshSettings, type ClientSettings } from '../lib/site-settings';

/** Patti ko diye gaye matn ke mutabiq dikhao/chhupao (khali = chhupi). Sirf textContent — HTML kabhi nahin. */
export function showAnnouncement(bar: HTMLElement | null, text: string) {
  const p = bar?.firstElementChild;
  if (!bar || !p) return;
  if (text) {
    if (p.textContent !== text) p.textContent = text;
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

export default function AnnouncementBar() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-announcement]');
    const use = (s: ClientSettings | null) => {
      if (!s) return;
      showAnnouncement(bar, s.announcement_text);
      applyNumberLinks(s.whatsapp_number);
    };
    use(cachedSettings());
    refreshSettings().then(use);
  }, []);

  return null;
}

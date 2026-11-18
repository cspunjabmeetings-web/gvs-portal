// spec: 6.1 AnnouncementBar (announcement_text agar on, sab se upar; admin par nahin), F10-AC3, F10-AC7, design.md (amber patti)
// Saath mein static pages par likha WhatsApp number (Footer, TrustStrip) taza number se badalta hai (F10-AC7).
import { useEffect, useState } from 'preact/hooks';
import { applyNumberLinks, cachedSettings, refreshSettings, type ClientSettings } from '../lib/site-settings';

export default function AnnouncementBar() {
  const [text, setText] = useState('');

  useEffect(() => {
    const use = (s: ClientSettings | null) => {
      if (!s) return;
      setText(s.announcement_text);
      applyNumberLinks(s.whatsapp_number);
    };
    use(cachedSettings());
    refreshSettings().then(use);
  }, []);

  if (!text) return null;
  return (
    <div role="note" aria-label="Elaan" class="bg-accent text-on-accent" data-announcement>
      <p class="container-page py-2 text-center text-sm font-semibold">{text}</p>
    </div>
  );
}

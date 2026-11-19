// spec: F16-AC2 (`Matn` ke `##`, `-`, `**` mehfooz HTML; baqi sab escape), 3.1 (apna chhota markdown, zero dependency), 9.2 (output sirf
//       h2, h3, p, ul, li, strong, em, a; links sirf https:// + rel="noopener nofollow"), design.md 6.8 (inline ad teesre hisse ke baad)
// Browser (admin preview) + server (note page) dono. `dangerouslySetInnerHTML` / `set:html` SIRF is ke natije par.
//
// Qawaid (owner ke liye aasan):
//   `## x` → h2 (naya hissa), `### x` → h3, `- x` → list, `**x**` → mota, `*x*` → tircha, `[matn](https://...)` → link.
//   Har saada line apna paragraph (owner line-war likhta hai). Khali line sirf faasla.
//   Link https:// ke ilawa (javascript:, http:, data:, /andar) → sirf matn, link nahin.

export const ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'li', 'strong', 'em', 'a'] as const;

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

// URL mein ek darje ke qausain chalte hain (maslan wikipedia ke links)
const LINK = /\[([^\]\n]{1,200})\]\(((?:[^()\s]|\([^()\s]*\)){1,500})\)/g;
const SAFE_URL = /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i;

/** `**mota**`, `*tircha*` — pehle se escape shuda matn par */
function emphasis(s: string): string {
  return s.replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(\S(?:[^*]*?\S)?)\*(?!\*)/g, '$1<em>$2</em>');
}

/** Ek line ka andar ka matn: escape → links alag → baqi par mota/tircha */
export function inline(raw: string): string {
  let out = '';
  let last = 0;
  for (const m of raw.matchAll(LINK)) {
    out += emphasis(escapeHtml(raw.slice(last, m.index)));
    const label = emphasis(escapeHtml(m[1]));
    out += SAFE_URL.test(m[2]) ? `<a href="${escapeHtml(m[2])}" rel="noopener nofollow" target="_blank">${label}</a>` : label;
    last = m.index! + m[0].length;
  }
  return out + emphasis(escapeHtml(raw.slice(last)));
}

export interface Rendered {
  /** Poora HTML */
  html: string;
  /** `##` se shuru hone wale hisse (pehle `##` se upar ka matn alag hissa); inline ad teesre ke baad */
  sections: string[];
}

/**
 * design.md 6.8: inline ad `after`-wen `##` hisse ke baad. Wapas: kitne `sections` ad se pehle aayen.
 * Shuru ka (bina `##`) matn hissa nahin ginta. Kam hisse hon → saare (ad matn ke baad).
 */
export function adCut(sections: string[], after = 3): number {
  const h2 = sections.flatMap((s, i) => (s.startsWith('<h2>') ? [i] : []));
  return h2.length >= after ? h2[after - 1] + 1 : sections.length;
}

export function renderMarkdown(md: string): Rendered {
  const sections: string[][] = [[]];
  let list: string[] | null = null;
  const cur = () => sections[sections.length - 1];
  const closeList = () => {
    if (list) cur().push(`<ul>${list.join('')}</ul>`);
    list = null;
  };

  // trim() BOM bhi hata deta hai
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    let m: RegExpMatchArray | null;
    if (!t) {
      closeList();
    } else if ((m = t.match(/^-\s+(.+)$/))) {
      (list ??= []).push(`<li>${inline(m[1])}</li>`);
    } else if ((m = t.match(/^###\s+(.+)$/))) {
      closeList();
      cur().push(`<h3>${inline(m[1])}</h3>`);
    } else if ((m = t.match(/^##\s+(.+)$/))) {
      closeList();
      if (cur().length) sections.push([]);
      cur().push(`<h2>${inline(m[1])}</h2>`);
    } else {
      closeList();
      cur().push(`<p>${inline(t)}</p>`);
    }
  }
  closeList();
  const parts = sections.filter((s) => s.length).map((s) => s.join(''));
  return { html: parts.join(''), sections: parts };
}

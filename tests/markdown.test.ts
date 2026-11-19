// spec: 12 markdown.test (script/HTML escape; sirf ijazat wale tags; javascript: link rad), F16-AC2, 9.2, design.md 6.8 (hisse)
import { describe, it, expect } from 'vitest';
import { renderMarkdown, inline, adCut, ALLOWED_TAGS } from '../src/lib/markdown';

const html = (md: string) => renderMarkdown(md).html;
const tagsOf = (h: string) => [...h.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1].toLowerCase());

describe('markdown: ijazat wali shakal (F16-AC2)', () => {
  it('intent 10.5 ki misal: ## heading, - list, **mota**', () => {
    const md = '## 1956 ka Aain\n- 23 March 1956 ko **nafiz** hua\n- Pehla aain\n## 1962 ka Aain\nAyub Khan ke daur mein.';
    expect(html(md)).toBe('<h2>1956 ka Aain</h2><ul><li>23 March 1956 ko <strong>nafiz</strong> hua</li><li>Pehla aain</li></ul><h2>1962 ka Aain</h2><p>Ayub Khan ke daur mein.</p>');
  });
  it('### chhoti heading, *tircha*, har saada line apna paragraph, khali line list band karti', () => {
    expect(html('### Ahem\nPehli line\nDoosri *line*\n- a\n\n- b')).toBe('<h3>Ahem</h3><p>Pehli line</p><p>Doosri <em>line</em></p><ul><li>a</li></ul><ul><li>b</li></ul>');
  });
  it('https link: rel="noopener nofollow", naya tab; & sahih escape', () => {
    expect(inline('Dekhein [PPSC](https://ppsc.gop.pk/jobs?a=1&b=2) site')).toBe(
      'Dekhein <a href="https://ppsc.gop.pk/jobs?a=1&amp;b=2" rel="noopener nofollow" target="_blank">PPSC</a> site',
    );
    expect(inline('[Wiki](https://en.wikipedia.org/wiki/Pakistan_(x))')).toContain('href="https://en.wikipedia.org/wiki/Pakistan_(x)"');
  });
  it('2 * 3 * 4 tircha nahin; akela ** waisa hi', () => {
    expect(inline('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(inline('a ** b')).toBe('a ** b');
  });
  it('BOM aur \\r\\n', () => {
    expect(html(String.fromCharCode(0xfeff) + '## A\r\n- b\r\n')).toBe('<h2>A</h2><ul><li>b</li></ul>');
  });
});

describe('markdown: hifazat (9.2)', () => {
  it('<script>, HTML tags, attributes sab escape', () => {
    const h = html('<script>alert(1)</script>\n## <img src=x onerror=alert(1)>\n- <b>x</b> "q" \'s\'');
    expect(h).not.toMatch(/<script|<img|<b>/i);
    expect(h).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(h).toContain('&quot;q&quot; &#39;s&#39;');
  });
  it('javascript:, data:, http:, andar ka /path, JAVASCRIPT: — link nahin, sirf matn', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'http://x.com', '/admin', '//evil.com', 'https:alert(1)', 'https://']) {
      const h = inline(`[dabayen](${url})`);
      expect(h, url).toBe('dabayen');
    }
  });
  it('link ke andar quote se attribute nahin toot sakta', () => {
    const h = inline('[x](https://a.com/"onmouseover="alert(1))');
    expect(h).not.toMatch(/"\s*onmouseover=/);
    expect(tagsOf(h).every((t) => (ALLOWED_TAGS as readonly string[]).includes(t))).toBe(true);
  });
  it('mili-juli bad input: sirf ijazat wale tags, har < escape ya ijazat wala', () => {
    const evil = [
      '## <svg/onload=alert(1)>',
      '- **<iframe src=javascript:alert(1)>**',
      '[<script>](https://ok.com) [**mota**](javascript:x)',
      '<a href="javascript:alert(1)">x</a>',
      '*<style>body{}</style>*',
      '### &lt;already&gt; & raw',
      '<!-- comment --> <![CDATA[x]]>',
    ].join('\n');
    const h = html(evil);
    const tags = tagsOf(h);
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(ALLOWED_TAGS as readonly string[], t).toContain(t);
    expect(h).not.toMatch(/<(?!\/?(h2|h3|p|ul|li|strong|em|a)[\s>])/);
    expect(h).not.toMatch(/href="(?!https:\/\/)/);
    expect(h).toContain('&amp;lt;already&amp;gt; &amp; raw');
  });
});

describe('markdown: hisse (inline ad teesre hisse ke baad, design.md 6.8)', () => {
  it('## se naya hissa; pehle ## se upar ka matn alag hissa', () => {
    const r = renderMarkdown('Shuru\n## A\nx\n## B\n- y\n## C\n## D\nz');
    expect(r.sections).toEqual(['<p>Shuru</p>', '<h2>A</h2><p>x</p>', '<h2>B</h2><ul><li>y</li></ul>', '<h2>C</h2>', '<h2>D</h2><p>z</p>']);
    expect(r.sections.join('')).toBe(r.html);
  });
  it('adCut: teesre ## hisse ke baad (shuru ka matn nahin ginta); kam hisse → aakhir mein', () => {
    const r = renderMarkdown('Shuru\n## A\nx\n## B\n## C\n## D');
    expect(adCut(r.sections)).toBe(4);
    expect(r.sections.slice(0, 4).filter((s) => s.startsWith('<h2>'))).toHaveLength(3);
    expect(adCut(renderMarkdown('## A\n## B\n## C').sections)).toBe(3);
    expect(adCut(renderMarkdown('## A\n## B').sections)).toBe(2);
    expect(adCut(renderMarkdown('sirf matn').sections)).toBe(1);
  });
  it('bina ## ek hi hissa; ### naya hissa nahin', () => {
    expect(renderMarkdown('a\n### b\nc').sections).toHaveLength(1);
    expect(renderMarkdown('## A\nx').sections).toEqual(['<h2>A</h2><p>x</p>']);
  });
});

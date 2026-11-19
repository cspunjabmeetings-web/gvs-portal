// spec: S20, S21, F16-AC1 (mazmoon-war list), F16-AC4 (5 MCQs tay shuda — owner ka faisla 2a, mutalliqa notes), F16-AC5 (JSON-LD),
//       F12-AC5 + P-06 (mitaya 410, chhupa 404)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET } from './helpers/admin';
import { importChunk } from '../src/lib/content-import';
import { publicNotes, notePage, noteQuiz, NOTE_QUIZ_SIZE, type NotePage } from '../src/lib/notes';
import { articleSchema, breadcrumbSchema, jsonLd } from '../src/lib/schema-ld';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-19T10:00:00Z');

async function imp(text: string, verified = true) {
  const r = await importChunk(await adminReq('/api/admin/content/import', { body: { text, verified } }), env(), { now: () => NOW });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
}
const note = (title: string, subject = 'Pakistan Studies', body = '## A\n- x') => `# NOTE\nUnwan: ${title}\nMazmoon: ${subject}\nKhulasa: ${title} ka khulasa\nMatn:\n${body}\n---`;
const mcqs = (subject: string, n: number, tag = subject) =>
  Array.from({ length: n }, (_, i) => `# MCQ\nMazmoon: ${subject}\nSawal: ${tag} sawal ${i + 1}?\nA) a\nB) b*\nC) c\n---`).join('\n');
const page = async (slug: string) => (await notePage(d1.db, slug)) as NotePage;

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('S20 publicNotes (F16-AC1)', () => {
  it('Settings ki tarteeb mein mazmoon-war, group mein naye upar; chhupa/mitaya nahin; list se bahar ka mazmoon aakhir mein bina practice link', async () => {
    await imp([note('Aain', 'Pakistan Studies'), note('GK Ek', 'General Knowledge'), note('Aain Doosra', 'Pakistan Studies'), note('Chhupa'), note('Mitaya')].join('\n'));
    await d1.db.prepare("UPDATE notes SET visible = 0 WHERE slug = 'chhupa'").run();
    await d1.db.prepare("UPDATE notes SET deleted_at = 'x', visible = 0 WHERE slug = 'mitaya'").run();
    await d1.db.prepare("INSERT INTO notes (slug, title, subject, summary, body_md, created_at, updated_at) VALUES ('purana', 'Purana', 'Law', NULL, 'x', 'a', 'a')").run();
    const g = await publicNotes(d1.db);
    expect(g.map((x) => [x.subject, x.practiceHref, x.notes.map((n) => n.slug)])).toEqual([
      ['General Knowledge', '/mcqs/general-knowledge', ['gk-ek']],
      ['Pakistan Studies', '/mcqs/pakistan-studies', ['aain-doosra', 'aain']],
      ['Law', null, ['purana']],
    ]);
    expect(g[0].notes[0]).toEqual({ slug: 'gk-ek', title: 'GK Ek', subject: 'General Knowledge', summary: 'GK Ek ka khulasa' });
  });
  it('koi note nahin → khali', async () => {
    expect(await publicNotes(d1.db)).toEqual([]);
  });
});

describe('S21 notePage (F16-AC1, AC4, F12-AC5)', () => {
  it('note ka matn, khulasa, mazmoon ka practice link', async () => {
    await imp(note('Pakistan ke Aain ki Tareekh (1956, 1962, 1973)', 'Pakistan Studies', '## 1956\n- **23 March**'));
    const p = await page('Pakistan-ke-Aain-ki-Tareekh-1956-1962-1973');
    expect(p.note).toMatchObject({ slug: 'pakistan-ke-aain-ki-tareekh-1956-1962-1973', subject: 'Pakistan Studies', summary: 'Pakistan ke Aain ki Tareekh (1956, 1962, 1973) ka khulasa', body: '## 1956\n- **23 March**' });
    expect(p.note.createdAt).toBe(NOW.toISOString());
    expect(p.practiceHref).toBe('/mcqs/pakistan-studies');
  });

  it('5 sawal: sirf usi mazmoon ke, sirf jaanche, har dafa wohi 5 (owner 2a); doosre note ke alag ho sakte', async () => {
    await imp(mcqs('Pakistan Studies', 20));
    await imp(mcqs('English', 5));
    await imp(mcqs('Pakistan Studies', 5, 'Na jaancha'), false);
    await imp([note('Pehla Note'), note('Doosra Note')].join('\n'));
    const a = await page('pehla-note');
    expect(a.quiz).toHaveLength(NOTE_QUIZ_SIZE);
    expect(a.quiz.every((q) => q.subject === 'Pakistan Studies' && !q.question.startsWith('Na jaancha'))).toBe(true);
    expect(new Set(a.quiz.map((q) => q.id)).size).toBe(5);
    expect(a.quiz[0]).toMatchObject({ options: ['a', 'b', 'c'], answerIndex: 1 });
    expect((await page('pehla-note')).quiz.map((q) => q.id)).toEqual(a.quiz.map((q) => q.id));
    const seeds = await Promise.all(['x', 'y', 'z', 'w'].map((s) => noteQuiz(d1.db, 'Pakistan Studies', s)));
    expect(new Set(seeds.map((q) => q.map((x) => x.id).join(','))).size).toBeGreaterThan(1);
  });

  it('kam sawal → jitne hain; koi nahin → khali quiz (page phir bhi chale)', async () => {
    await imp(mcqs('Islamiat', 3));
    await imp([note('Islamiat Note', 'Islamiat'), note('Urdu Note', 'Urdu')].join('\n'));
    expect((await page('islamiat-note')).quiz).toHaveLength(3);
    expect((await page('urdu-note')).quiz).toEqual([]);
  });

  it('mutalliqa: wohi mazmoon, khud nahin, chhupe/mitaye nahin, naye pehle, ≤ 3', async () => {
    await imp([1, 2, 3, 4, 5].map((i) => note(`PS ${i}`)).join('\n'));
    await imp(note('GK Note', 'General Knowledge'));
    await d1.db.prepare("UPDATE notes SET visible = 0 WHERE slug = 'ps-4'").run();
    const p = await page('ps-1');
    expect(p.related.map((n) => n.slug)).toEqual(['ps-5', 'ps-3', 'ps-2']);
    expect((await page('gk-note')).related).toEqual([]);
  });

  it('chhupa / na mila / ghalat slug → null (404); mitaya → gone (410)', async () => {
    await imp([note('Chhupa Note'), note('Mitaya Note')].join('\n'));
    await d1.db.prepare("UPDATE notes SET visible = 0 WHERE slug = 'chhupa-note'").run();
    await d1.db.prepare("UPDATE notes SET deleted_at = 'x', visible = 0 WHERE slug = 'mitaya-note'").run();
    for (const s of ['chhupa-note', 'nahin-hai', '../x', "a' OR 1=1 --", '']) expect(await notePage(d1.db, s), s).toBeNull();
    expect(await notePage(d1.db, 'mitaya-note')).toBe('gone');
    expect(await notePage(d1.db, 'MITAYA-NOTE')).toBe('gone');
  });
});

describe('F16-AC5 JSON-LD', () => {
  const art = articleSchema({ title: 'Aain', description: 'Khulasa', url: 'https://gvs.test/notes/aain', datePublished: '2026-11-19T10:00:00.000Z', dateModified: '2026-11-19T11:00:00.000Z', section: 'Pakistan Studies', logo: 'https://gvs.test/images/logo.svg' });
  it('Article + BreadcrumbList sahih shakal', () => {
    expect(art).toMatchObject({ '@context': 'https://schema.org', '@type': 'Article', headline: 'Aain', description: 'Khulasa', mainEntityOfPage: { '@id': 'https://gvs.test/notes/aain' }, publisher: { name: 'GVS Academy' } });
    const bc = breadcrumbSchema([
      { name: 'Home', url: 'https://gvs.test/' },
      { name: 'Notes', url: 'https://gvs.test/notes' },
    ]);
    expect(bc.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gvs.test/' },
      { '@type': 'ListItem', position: 2, name: 'Notes', item: 'https://gvs.test/notes' },
    ]);
  });
  it('jsonLd: </script> se bahar nahin nikal sakta, phir bhi wohi JSON', () => {
    const data = { headline: '</script><script>alert(1)</script> & ' + String.fromCharCode(0x2028) };
    const s = jsonLd(data);
    expect(s).not.toMatch(new RegExp('[<>&' + String.fromCharCode(0x2028) + ']'));
    expect(JSON.parse(s)).toEqual(data);
  });
});

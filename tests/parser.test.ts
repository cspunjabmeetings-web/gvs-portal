// spec: 10.1 parser.test (har format; har ghalti line number ke sath; hadein 9.4), SA12, 8.7, F11-AC2..AC5, AC7, AC8, AC9; intent 10.2–10.6
import { describe, it, expect } from 'vitest';
import { parseContent, qHash, normalizeQuestion, PARSER_LIMITS, type ParsedMcq, type ParsedMock, type ParsedNote, type ParsedJob } from '../src/lib/parser';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

const opts = { subjects: DEFAULT_SETTINGS.subjects };
const parse = (t: string) => parseContent(t, opts);
const msgs = (t: string) => parse(t).errors.map((e) => e.message);

const mcq = (o: { subject?: string; q?: string; opts?: string[]; extra?: string } = {}) =>
  [
    '# MCQ',
    `Mazmoon: ${o.subject ?? 'Pakistan Studies'}`,
    `Sawal: ${o.q ?? 'Qarardad-e-Pakistan kis saal manzoor hui?'}`,
    ...(o.opts ?? ['A) 1930', 'B) 1940*', 'C) 1947', 'D) 1956']),
    ...(o.extra ? [o.extra] : []),
    '---',
  ].join('\n');

// ---------- intent ki misalen bilkul waisi ----------

const INTENT_MCQ = `# MCQ
Mazmoon: Pakistan Studies
Sawal: Qarardad-e-Pakistan kis saal manzoor hui?
A) 1930
B) 1940*
C) 1947
D) 1956
Tashreeh: 23 March 1940 ko Lahore mein manzoor hui.
Mushkil: Aasan
---`;

const INTENT_NOTE = `# NOTE
Unwan: Pakistan ke Aain ki Tareekh (1956, 1962, 1973)
Mazmoon: Pakistan Studies
Khulasa: Teeno aain kab bane, kis ne banaye, aur in ki ahem baatein. PPSC aur FPSC ke liye.
Matn:
## 1956 ka Aain
- 23 March 1956 ko nafiz hua
- Pakistan Islami Jamhuriya bana
## 1962 ka Aain
**Ayub Khan** ke daur mein: Sadarti nizam.
---`;

const INTENT_JOB = `# JOB
Idara: PPSC
Post: Educator (BPS-14)
Shehar: Punjab bhar
Taleem: BA / BSc, 2nd division
Akhri tareekh: 2026-12-05
Official link: https://ppsc.gop.pk/jobs
Ishtihar link: https://drive.google.com/file/abc
Sarkari fee: 700
Hamari fee: 300
Apply service: Haan
Documents:
- CNIC dono taraf ki tasveer
- Matric aur Inter ki degree
- Domicile
- Passport size tasveer
Tareeqa:
1. ppsc.gop.pk par account banayen
2. Online form bharein
3. Challan jama karwayen
---`;

const mockText = (n: number, header = 'Naam: PPSC Educator Mock Test 1\nWaqt: 30 minute\nKhulasa: PPSC Educator ke pattern par sawal.') =>
  ['# MOCK', header, '---', ...Array.from({ length: n }, (_, i) => mcq({ q: `Mock sawal number ${i + 1}?` })), '# END MOCK'].join('\n');

describe('intent 10.3–10.6 ki misalen', () => {
  it('MCQ (10.3)', () => {
    const r = parse(INTENT_MCQ);
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
    const q = r.items[0] as ParsedMcq;
    expect(q).toMatchObject({
      kind: 'MCQ',
      line: 1,
      subject: 'Pakistan Studies',
      question: 'Qarardad-e-Pakistan kis saal manzoor hui?',
      options: ['1930', '1940', '1947', '1956'],
      answerIndex: 1,
      explanation: '23 March 1940 ko Lahore mein manzoor hui.',
      difficulty: 'Aasan',
      asOfDate: null,
    });
    expect(q.source).toBe(INTENT_MCQ);
  });

  it('MOCK + END MOCK (10.4); sawal mock ke andar (F11-AC8)', () => {
    const r = parse(mockText(3));
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
    const m = r.items[0] as ParsedMock;
    expect(m).toMatchObject({ kind: 'MOCK', name: 'PPSC Educator Mock Test 1', minutes: 30, summary: 'PPSC Educator ke pattern par sawal.' });
    expect(m.mcqs.map((q) => q.question)).toEqual(['Mock sawal number 1?', 'Mock sawal number 2?', 'Mock sawal number 3?']);
    expect(m.source.startsWith('# MOCK')).toBe(true);
    expect(m.source.endsWith('# END MOCK')).toBe(true);
    expect(r.counts).toEqual({ MCQ: 3, MOCK: 1, NOTE: 0, JOB: 0 });
  });

  it('NOTE (10.5): Matn kai lines, markdown waisa hi', () => {
    const r = parse(INTENT_NOTE);
    expect(r.errors).toEqual([]);
    const n = r.items[0] as ParsedNote;
    expect(n).toMatchObject({ kind: 'NOTE', title: 'Pakistan ke Aain ki Tareekh (1956, 1962, 1973)', subject: 'Pakistan Studies' });
    expect(n.body).toBe('## 1956 ka Aain\n- 23 March 1956 ko nafiz hua\n- Pakistan Islami Jamhuriya bana\n## 1962 ka Aain\n**Ayub Khan** ke daur mein: Sadarti nizam.');
  });

  it('JOB (10.6): documents aur tareeqa ki list', () => {
    const r = parse(INTENT_JOB);
    expect(r.errors).toEqual([]);
    expect(r.items[0] as ParsedJob).toMatchObject({
      kind: 'JOB',
      org: 'PPSC',
      post: 'Educator (BPS-14)',
      city: 'Punjab bhar',
      education: 'BA / BSc, 2nd division',
      lastDate: '2026-12-05',
      officialUrl: 'https://ppsc.gop.pk/jobs',
      adUrl: 'https://drive.google.com/file/abc',
      govtFee: 700,
      ourFee: 300,
      applyService: true,
      documents: ['CNIC dono taraf ki tasveer', 'Matric aur Inter ki degree', 'Domicile', 'Passport size tasveer'],
      steps: ['ppsc.gop.pk par account banayen', 'Online form bharein', 'Challan jama karwayen'],
    });
  });

  it('sab ek paste mein (10.2: kai cheezein)', () => {
    const r = parse([INTENT_MCQ, mockText(2), INTENT_NOTE, INTENT_JOB].join('\n\n'));
    expect(r.errors).toEqual([]);
    expect(r.items.map((x) => x.kind)).toEqual(['MCQ', 'MOCK', 'NOTE', 'JOB']);
  });
});

describe('aam usool (F11-AC4, 10.2)', () => {
  it('chhote/bare harf, khali lines, \\r\\n aur BOM ki parwah nahin', () => {
    const t = '﻿\r\n\r\n#  mcq\r\nMAZMOON: pakistan studies\r\n\r\nsawal:   Kaun?\r\na) Ek\r\nb. Do*\r\n---\r\n';
    const r = parse(t);
    expect(r.errors).toEqual([]);
    expect(r.items[0]).toMatchObject({ subject: 'Pakistan Studies', question: 'Kaun?', options: ['Ek', 'Do'], answerIndex: 1 });
  });

  it('agla header bhi pichhli cheez khatam karta hai (--- bhool jaye to)', () => {
    const r = parse(mcq().replace('\n---', '') + '\n' + mcq({ q: 'Doosra?' }));
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(2);
  });

  it('lamba sawal agli line tak (option se pehle)', () => {
    const r = parse('# MCQ\nMazmoon: English\nSawal: Choose the correct\nspelling of the word:\nA) Recieve\nB) Receive*\n---');
    expect((r.items[0] as ParsedMcq).question).toBe('Choose the correct spelling of the word:');
  });

  it('ghalat likha khana (1-2 alfaz + colon) sawal mein nahin milta, ghalti deta hai', () => {
    expect(msgs('# MCQ\nMazmoon: English\nSawal: Kaun?\nTashreh: galat spelling\nA) a\nB) b*\n---')[0]).toBe('Line 4: "Tashreh" khana pehchana nahin gaya.');
  });

  it('kisi block ke bahar ki line, anjaan khana, khali paste', () => {
    expect(msgs('Assalam o alaikum\n' + mcq())).toEqual(['Line 1: yeh line kisi "# MCQ", "# MOCK", "# NOTE" ya "# JOB" ke andar nahin.']);
    expect(msgs(mcq({ extra: 'Jawab: B' }))[0]).toBe('Line 8: "Jawab" khana pehchana nahin gaya.');
    expect(parse('   \n\n').errors).toEqual([]);
    expect(msgs('# QUIZ\nkuch')).toHaveLength(2);
  });

  it('do dafa likha khana', () => {
    expect(msgs('# MCQ\nMazmoon: English\nMazmoon: Urdu\nSawal: x?\nA) a\nB) b*\n---')[0]).toBe('Line 3: "Mazmoon" do dafa likha hai.');
  });

  it('ghalat cheez baqi sahih ko nahin rokti (F11-AC3); ghaltiyan line ki tarteeb mein', () => {
    const t = [mcq(), mcq({ opts: ['A) 1', 'B) 2'] }), mcq({ q: 'Teesra?' })].join('\n');
    const r = parse(t);
    expect(r.items).toHaveLength(2);
    expect(r.errors).toEqual([{ line: 12, message: 'Line 12: sawal 2 mein sahih jawab par * nahin laga.' }]);
    expect(r.counts.MCQ).toBe(3);
  });
});

describe('MCQ ki jaanch (F11-AC5, 9.4)', () => {
  it('spec ki misal ki shakal: "Line N: sawal 3 mein sahih jawab par * nahin laga" (N = pehle option ki line)', () => {
    // mcq 1: lines 1-8; mcq 2 (2 options): 9-14; mcq 3: header 15, Mazmoon 16, Sawal 17, A) 18
    const t = [mcq(), mcq({ q: 'Do?', opts: ['A) x', 'B) y*'] }), '# MCQ\nMazmoon: Urdu\nSawal: Teen?\nA) a\nB) b\n---'].join('\n');
    expect(msgs(t)).toEqual(['Line 18: sawal 3 mein sahih jawab par * nahin laga.']);
  });

  it('2 se 5 options; 1 aur 6 rad; tarteeb A, B, C', () => {
    expect(parse(mcq({ opts: ['A) a', 'B) b*'] })).errors).toEqual([]);
    expect(parse(mcq({ opts: ['A) a', 'B) b', 'C) c', 'D) d', 'E) e*'] })).errors).toEqual([]);
    expect(msgs(mcq({ opts: ['A) a*'] }))[0]).toMatch(/2 se 5 options hone chahiye \(abhi 1\)/);
    expect(msgs(mcq({ opts: ['A) a*', 'B) b', 'C) c', 'D) d', 'E) e', 'E) f'] }))[0]).toMatch(/abhi 6/);
    expect(msgs(mcq({ opts: ['A) a*', 'C) c'] }))[0]).toMatch(/tarteeb/);
  });

  it('do * rad; khali option; ek jaise options', () => {
    expect(msgs(mcq({ opts: ['A) a*', 'B) b*'] }))[0]).toMatch(/ek se zyada jawab par \*/);
    expect(msgs(mcq({ opts: ['A) a*', 'B) '] }))[0]).toMatch(/option B khali/);
    expect(msgs(mcq({ opts: ['A) Lahore*', 'B) lahore'] }))[0]).toMatch(/ek jaise/);
  });

  it('mazmoon list mein se (Settings), ya nahin likha', () => {
    expect(msgs(mcq({ subject: 'Physics' }))[0]).toBe('Line 2: sawal 1 mein mazmoon "Physics" list mein nahin (Settings → Mazameen dekhein).');
    expect(parseContent(mcq({ subject: 'physics' }), { subjects: ['Physics'] }).errors).toEqual([]);
    expect(msgs('# MCQ\nSawal: x?\nA) a\nB) b*\n---')[0]).toMatch(/"Mazmoon:" nahin likha/);
  });

  it('hadein: sawal 500, option 200, tashreeh 1000 (Unicode harf gine)', () => {
    expect(parse(mcq({ q: 'ق'.repeat(500) })).errors).toEqual([]);
    expect(msgs(mcq({ q: 'x'.repeat(501) }))[0]).toMatch(/500 harf/);
    expect(msgs(mcq({ opts: ['A) ' + 'x'.repeat(201), 'B) b*'] }))[0]).toMatch(/option A 200 harf/);
    expect(parse(mcq({ extra: 'Tashreeh: ' + 'x'.repeat(1000) })).errors).toEqual([]);
    expect(msgs(mcq({ extra: 'Tashreeh: ' + 'x'.repeat(1001) }))[0]).toMatch(/tashreeh 1000/);
  });

  it('Mushkil sirf teen; Current Affairs par Tareekh zaroori aur sahih', () => {
    expect(msgs(mcq({ extra: 'Mushkil: bohat' }))[0]).toMatch(/Aasan, Darmiyana ya Mushkil/);
    expect((parse(mcq({ extra: 'Mushkil: darmiyana' })).items[0] as ParsedMcq).difficulty).toBe('Darmiyana');
    expect(msgs(mcq({ subject: 'Current Affairs' }))[0]).toBe('Line 1: sawal 1 mein Current Affairs ke sawal par "Tareekh:" zaroori hai.');
    expect(msgs(mcq({ subject: 'Current Affairs', extra: 'Tareekh: 2026-02-30' }))[0]).toMatch(/YYYY-MM-DD/);
    expect((parse(mcq({ subject: 'Current Affairs', extra: 'Tareekh: 2026-11-16' })).items[0] as ParsedMcq).asOfDate).toBe('2026-11-16');
  });
});

describe('MOCK ki jaanch (F11-AC8, 9.4)', () => {
  it('Waqt 1–300 ("30", "30 minute", "45 min")', () => {
    for (const w of ['30', '30 minute', '45 min', '300 Minutes']) expect(parse(mockText(1, `Naam: M\nWaqt: ${w}`)).errors).toEqual([]);
    expect(msgs(mockText(1, 'Naam: M\nWaqt: 0'))[0]).toMatch(/1 se 300 minute/);
    expect(msgs(mockText(1, 'Naam: M\nWaqt: 301 minute'))[0]).toMatch(/1 se 300 minute/);
    expect(msgs(mockText(1, 'Naam: M\nWaqt: aadha ghanta'))[0]).toMatch(/1 se 300 minute/);
  });

  it('Naam/Waqt zaroori; khulasa 300 tak', () => {
    expect(msgs(mockText(1, 'Waqt: 30'))[0]).toMatch(/"Naam:" nahin/);
    expect(msgs(mockText(1, 'Naam: M'))[0]).toMatch(/"Waqt:" nahin/);
    expect(msgs(mockText(1, `Naam: M\nWaqt: 30\nKhulasa: ${'x'.repeat(301)}`))[0]).toMatch(/khulasa 300/);
  });

  it('100 sawal theek, 101 rad; khali mock rad', () => {
    expect(parse(mockText(100)).errors).toEqual([]);
    expect(msgs(mockText(101))).toEqual([expect.stringMatching(/100 se zyada sawal hain \(abhi 101\)/)]);
    expect(parse(mockText(101)).items).toEqual([]);
    expect(msgs(mockText(0))[0]).toMatch(/koi sawal nahin/);
  });

  it('andar ek ghalat sawal → poora mock save nahin, dono ghaltiyan', () => {
    const t = mockText(2).replace('B) 1940*', 'B) 1940');
    const r = parse(t);
    expect(r.items).toEqual([]);
    expect(r.errors.map((e) => e.message)).toEqual([expect.stringMatching(/^Line 1: mock .* ghaltiyan hain/), expect.stringMatching(/sawal 1 mein sahih jawab par \* nahin laga/)]);
  });

  it('END MOCK ke baghair, END MOCK bina MOCK ke, mock ke andar NOTE', () => {
    expect(msgs(mockText(1).replace('# END MOCK', ''))[0]).toMatch(/"# END MOCK" nahin likha/);
    expect(msgs('# END MOCK')[0]).toMatch(/se pehle "# MOCK" nahin/);
    const t = mockText(1).replace('# END MOCK', INTENT_NOTE + '\n# END MOCK');
    const r = parse(t);
    expect(r.errors.some((e) => /mock ke andar sirf "# MCQ"/.test(e.message))).toBe(true);
    expect(r.items.map((x) => x.kind)).toEqual(['NOTE']);
  });

  it('mock ke baad aam MCQ mock se bahar', () => {
    const r = parse(mockText(2) + '\n' + mcq({ q: 'Bahar?' }));
    expect(r.items.map((x) => x.kind)).toEqual(['MOCK', 'MCQ']);
    expect((r.items[1] as ParsedMcq).number).toBe(3);
  });
});

describe('NOTE ki jaanch (9.4)', () => {
  const note = (o: { summary?: string; body?: string; subject?: string; title?: string } = {}) =>
    `# NOTE\nUnwan: ${o.title ?? 'Aain'}\nMazmoon: ${o.subject ?? 'Pakistan Studies'}\nKhulasa: ${o.summary ?? 'Mukhtasar'}\nMatn:\n${o.body ?? '## Heading\n- point'}\n---`;
  it('khulasa 155 tak (meta description), matn 20,000 tak', () => {
    expect(parse(note({ summary: 'x'.repeat(155) })).errors).toEqual([]);
    expect(msgs(note({ summary: 'x'.repeat(156) }))[0]).toMatch(/khulasa 155 harf tak ho \(abhi 156\)/);
    expect(parse(note({ body: 'x'.repeat(20_000) })).errors).toEqual([]);
    expect(msgs(note({ body: 'x'.repeat(20_001) }))[0]).toMatch(/20,000/);
  });
  it('zaroori khane; Matn ki pehli line par bhi matn', () => {
    expect(msgs(note({ title: '' }))[0]).toMatch(/"Unwan:" nahin/);
    expect(msgs(note({ subject: 'Physics' }))[0]).toMatch(/list mein nahin/);
    expect(msgs(note({ body: '' }))[0]).toMatch(/"Matn:" nahin likha ya khali/);
    const r = parse('# NOTE\nUnwan: A\nMazmoon: Urdu\nKhulasa: B\nMatn: Pehli line\nDoosri line: colon ke sath\n---');
    expect(r.errors).toEqual([]);
    expect((r.items[0] as ParsedNote).body).toBe('Pehli line\nDoosri line: colon ke sath');
  });
});

describe('JOB ki jaanch (9.4)', () => {
  const job = (extra: string, base = 'Idara: PPSC\nPost: Lecturer\nAkhri tareekh: 2026-12-05\nOfficial link: https://ppsc.gop.pk') => `# JOB\n${base}\n${extra}\n---`;
  it('zaroori: Idara, Post, Akhri tareekh, Official link; baqi ikhtiyari', () => {
    const r = parse(job(''));
    expect(r.errors).toEqual([]);
    expect(r.items[0]).toMatchObject({ city: null, adUrl: null, govtFee: null, ourFee: null, applyService: true, documents: [], steps: [] });
    expect(msgs(job('', 'Post: x\nAkhri tareekh: 2026-12-05\nOfficial link: https://a.pk'))[0]).toMatch(/"Idara:" nahin/);
  });
  it('links sirf https; tareekh sahih; fee raqam; Apply service Haan/Nahin', () => {
    expect(msgs(job('', 'Idara: A\nPost: B\nAkhri tareekh: 2026-12-05\nOfficial link: http://ppsc.gop.pk'))[0]).toMatch(/https/);
    expect(msgs(job('Ishtihar link: javascript:alert(1)'))[0]).toMatch(/ishtihar link https/);
    expect(msgs(job('', 'Idara: A\nPost: B\nAkhri tareekh: 5-12-2026\nOfficial link: https://a.pk'))[0]).toMatch(/YYYY-MM-DD/);
    expect(parse(job('Sarkari fee: Rs. 1,500')).items[0]).toMatchObject({ govtFee: 1500 });
    expect(msgs(job('Hamari fee: teen sau'))[0]).toMatch(/hamari fee sirf raqam/);
    expect(parse(job('Apply service: nahin')).items[0]).toMatchObject({ applyService: false });
    expect(msgs(job('Apply service: shayad'))[0]).toMatch(/Haan ya Nahin/);
  });
  it('Documents aur Tareeqa 20 tak', () => {
    const list = (n: number, p: (i: number) => string) => Array.from({ length: n }, (_, i) => p(i)).join('\n');
    expect(parse(job(`Documents:\n${list(20, (i) => `- Doc ${i}`)}`)).errors).toEqual([]);
    expect(msgs(job(`Documents:\n${list(21, (i) => `- Doc ${i}`)}`))[0]).toMatch(/Documents 20 se zyada hain \(abhi 21\)/);
    expect(msgs(job(`Tareeqa:\n${list(21, (i) => `${i + 1}. Qadam`)}`))[0]).toMatch(/20 se zyada/);
  });
});

describe('500 cheezon ki hadd (F11-AC4, AC9)', () => {
  it('500 theek; 501 par ek hi paigham aur kuch nahin', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => mcq({ q: `Sawal ${i}?`, opts: ['A) a', 'B) b*'] })).join('\n');
    const ok = parse(many(PARSER_LIMITS.maxItems));
    expect(ok.errors).toEqual([]);
    expect(ok.items).toHaveLength(500);
    const r = parse(many(501));
    expect(r.items).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, message: '500 se zyada cheezein (501); hisson mein bhejein.' }]);
  });
  it('mock ke sawal bhi gine jate hain', () => {
    const t = [mockText(100), mockText(100), mockText(100), mockText(100), mockText(97)].join('\n');
    expect(parse(t).errors[0].message).toMatch(/502/);
  });
});

describe('F11-AC7: q_hash (ek jaisa sawal)', () => {
  it('chhote/bare harf, nishanat aur spaces ka farq nahin; Urdu harf bachte hain', async () => {
    expect(normalizeQuestion('  Qarardad-e-Pakistan  kis saal?  ')).toBe('qarardad e pakistan kis saal');
    expect(normalizeQuestion('پاکستان کب بنا؟')).toBe('پاکستان کب بنا');
    const a = await qHash('Qarardad-e-Pakistan kis saal manzoor hui?');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await qHash('qarardad e pakistan KIS saal manzoor hui')).toBe(a);
    expect(await qHash('Qarardad-e-Lahore kis saal manzoor hui?')).not.toBe(a);
  });
});

describe('server ki dobara jaanch: source se wohi nateeja', () => {
  it('har cheez ka source dobara parse ho to wohi cheez', () => {
    const r = parse([INTENT_MCQ, mockText(2), INTENT_NOTE, INTENT_JOB].join('\n\n'));
    for (const item of r.items) {
      const again = parse(item.source);
      expect(again.errors).toEqual([]);
      const strip = (x: unknown) => JSON.parse(JSON.stringify(x, (k, v) => (['line', 'number', 'source'].includes(k) ? undefined : v)));
      expect(strip(again.items[0])).toEqual(strip(item));
    }
  });
});

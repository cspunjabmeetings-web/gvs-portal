// spec: E18 POST (banana/badalna), F12-AC2, F11-AC5 (2–5 options, ek sahih, mazmoon list se, Current Affairs par tareekh), F11-AC6
// Jaanch aakhir mein server par parser.ts se (form = content text); yahan sirf aasani ke liye.
import { useState } from 'preact/hooks';
import { DIFFICULTIES, PARSER_LIMITS } from '../../lib/parser';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminMcq } from '../../lib/admin-content';

const input = 'min-h-[44px] w-full rounded-lg border border-border bg-surface px-3';
const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';
const LETTERS = 'ABCDE';

export default function McqForm(p: { mcq?: AdminMcq; subjects: string[]; onDone: (id: number) => void; onCancel: () => void }) {
  const m = p.mcq;
  const [subject, setSubject] = useState(m?.subject ?? p.subjects[0] ?? '');
  const [question, setQuestion] = useState(m?.question ?? '');
  const [options, setOptions] = useState<string[]>(m?.options ?? ['', '', '', '']);
  const [answer, setAnswer] = useState(m?.answerIndex ?? -1);
  const [explanation, setExplanation] = useState(m?.explanation ?? '');
  const [difficulty, setDifficulty] = useState(m?.difficulty ?? '');
  const [asOfDate, setAsOfDate] = useState(m?.asOfDate ?? '');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pre = `mcq-${m?.id ?? 'new'}`;

  async function save() {
    setBusy(true);
    setError('');
    const r = await adminJson<{ id: number }>('/api/admin/mcqs', {
      body: {
        action: 'save',
        ...(m ? { id: m.id } : { verified }),
        subject,
        question,
        options,
        answerIndex: answer,
        explanation: explanation || null,
        difficulty: difficulty || null,
        asOfDate: asOfDate || null,
      },
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    p.onDone(r.data.id);
  }

  return (
    <div class="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-3" data-mcq-form>
      <h3 class="text-lg">{m ? `Sawal badlein` : 'Naya sawal'}</h3>
      <label for={`${pre}-subject`} class="text-sm font-medium">
        Mazmoon
      </label>
      <select id={`${pre}-subject`} value={subject} onChange={(e) => setSubject((e.target as HTMLSelectElement).value)} class={input}>
        {!p.subjects.includes(subject) && subject && <option value={subject}>{subject} (list mein nahin)</option>}
        {p.subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <label for={`${pre}-q`} class="text-sm font-medium">
        Sawal ({PARSER_LIMITS.question} harf tak)
      </label>
      <textarea id={`${pre}-q`} rows={3} maxLength={PARSER_LIMITS.question} value={question} onInput={(e) => setQuestion((e.target as HTMLTextAreaElement).value)} class="rounded-lg border border-border bg-surface p-2" />

      <fieldset class="flex flex-col gap-2">
        <legend class="text-sm font-medium">Options (sahih jawab ka gola chunein)</legend>
        {options.map((o, i) => (
          <div key={i} class="flex items-center gap-2">
            <input
              type="radio"
              name={`${pre}-ans`}
              id={`${pre}-ans-${i}`}
              checked={answer === i}
              onChange={() => setAnswer(i)}
              class="h-6 w-6 shrink-0 accent-[var(--primary)]"
              aria-label={`${LETTERS[i]} sahih jawab`}
            />
            <label for={`${pre}-opt-${i}`} class="w-5 shrink-0 font-semibold">
              {LETTERS[i]}
            </label>
            <input
              id={`${pre}-opt-${i}`}
              type="text"
              maxLength={PARSER_LIMITS.option}
              value={o}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                // Hamesha taza list par (jaldi jaldi bharne/autofill par purani value na likhe)
                setOptions((prev) => prev.map((x, j) => (j === i ? val : x)));
              }}
              class={`${input} min-w-0 flex-1`}
            />
            {options.length > PARSER_LIMITS.minOptions && (
              <button
                type="button"
                aria-label={`Option ${LETTERS[i]} hatayen`}
                onClick={() => {
                  setOptions((prev) => prev.filter((_, j) => j !== i));
                  setAnswer((a) => (a === i ? -1 : a > i ? a - 1 : a));
                }}
                class="min-h-[44px] min-w-[44px] shrink-0 text-wrong"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < PARSER_LIMITS.maxOptions && (
          <button type="button" onClick={() => setOptions((prev) => [...prev, ''])} class={`${btn} border border-border`}>
            + Option
          </button>
        )}
      </fieldset>

      <label for={`${pre}-ex`} class="text-sm font-medium">
        Tashreeh (ikhtiyari, {PARSER_LIMITS.explanation} harf tak)
      </label>
      <textarea id={`${pre}-ex`} rows={2} maxLength={PARSER_LIMITS.explanation} value={explanation} onInput={(e) => setExplanation((e.target as HTMLTextAreaElement).value)} class="rounded-lg border border-border bg-surface p-2" />
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <label for={`${pre}-diff`} class="text-sm font-medium">
            Mushkil
          </label>
          <select id={`${pre}-diff`} value={difficulty} onChange={(e) => setDifficulty((e.target as HTMLSelectElement).value)} class={input}>
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for={`${pre}-date`} class="text-sm font-medium">
            Tareekh{subject === 'Current Affairs' ? ' *' : ''}
          </label>
          <input id={`${pre}-date`} type="date" value={asOfDate} onInput={(e) => setAsOfDate((e.target as HTMLInputElement).value)} class={input} />
        </div>
      </div>
      {!m && (
        <label for={`${pre}-ver`} class="flex min-h-[44px] items-center gap-3">
          <input id={`${pre}-ver`} type="checkbox" checked={verified} onChange={(e) => setVerified((e.target as HTMLInputElement).checked)} class="h-6 w-6 accent-[var(--primary)]" />
          <span class="font-medium">Main ne yeh sawal jaanch liya hai</span>
        </label>
      )}
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      <div class="flex gap-2">
        <button type="button" disabled={busy} onClick={save} class={`${btn} flex-1 bg-primary text-on-primary disabled:opacity-60`} data-mcq-save>
          {busy ? 'Save ho raha hai…' : 'Save karein'}
        </button>
        <button type="button" onClick={p.onCancel} class={`${btn} border border-border`}>
          Wapas
        </button>
      </div>
    </div>
  );
}

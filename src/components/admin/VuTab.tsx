// spec: F29-AC1..AC3 — admin "VU" tab: Courses | MCQs daalein | Sawal (E26-E28)
import { useEffect, useState } from 'preact/hooks';
import { adminJson } from '../../lib/admin-fetch';
import type { AdminCourse } from '../../lib/vu-admin';
import VuAchievements from './VuAchievements';
import VuCourses from './VuCourses';
import VuImport from './VuImport';
import VuQuestions from './VuQuestions';
import VuReport from './VuReport';
import VuMcqList from './VuMcqList';

type Sub = 'courses' | 'import' | 'mcqs' | 'questions' | 'ach' | 'report';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'courses', label: 'Courses' },
  { id: 'import', label: 'MCQs daalein' },
  { id: 'mcqs', label: 'Sawal' },
  { id: 'questions', label: 'Important Questions' },
  { id: 'ach', label: 'Achievements' },
  { id: 'report', label: 'Report' },
];

export default function VuTab() {
  const [sub, setSub] = useState<Sub>('courses');
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [course, setCourse] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await adminJson<{ items: AdminCourse[] }>('/api/admin/vu/courses');
    if (!r.ok) return setError(r.message);
    setError('');
    setCourses(r.data.items);
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div class="flex flex-col gap-4" data-vu>
      <nav aria-label="VU ke hisse" class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul class="flex gap-2">
          {SUBS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSub(t.id);
                  void load();
                }}
                aria-pressed={sub === t.id}
                disabled={busy}
                class={`min-h-[44px] whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${sub === t.id ? 'bg-primary text-on-primary' : 'border border-border'}`}
                data-vu-sub={t.id}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {error && (
        <p class="text-sm text-wrong" role="alert">
          {error}
        </p>
      )}
      {!courses ? (
        !error && <p class="text-muted">Load ho raha hai…</p>
      ) : sub === 'courses' ? (
        <VuCourses
          courses={courses}
          onChange={load}
          onShow={(code) => {
            setCourse(code);
            setSub('mcqs');
          }}
        />
      ) : sub === 'report' ? (
        <VuReport />
      ) : sub === 'ach' ? (
        <VuAchievements />
      ) : sub === 'questions' ? (
        <VuQuestions courses={courses} course={course} onCourse={setCourse} onChange={load} />
      ) : sub === 'import' ? (
        <VuImport courses={courses} onBusy={setBusy} />
      ) : (
        <VuMcqList courses={courses} course={course} onCourse={setCourse} />
      )}
    </div>
  );
}

-- spec: F29 (VU Mock, v0.4), VU-1: courses aur VU ke sawal, maujooda mcqs/mocks se bilkul alag (F29-AC4)
CREATE TABLE vu_courses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  mid_ok INTEGER NOT NULL DEFAULT 0,
  mid_all INTEGER NOT NULL DEFAULT 0,
  final_ok INTEGER NOT NULL DEFAULT 0,
  final_all INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE vu_mcqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES vu_courses(code),
  term TEXT NOT NULL CHECK (term IN ('mid', 'final')),
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_index INTEGER NOT NULL CHECK (answer_index BETWEEN 0 AND 4),
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('Aasan', 'Darmiyana', 'Mushkil')),
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  q_hash TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_vu_mcqs_hash ON vu_mcqs(course_code, term, q_hash);
CREATE INDEX idx_vu_mcqs_test ON vu_mcqs(course_code, term, verified, verified_at);

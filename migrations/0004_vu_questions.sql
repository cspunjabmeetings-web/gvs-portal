-- spec: F32 (VU Important Questions, v0.4.3). Jawab jaan boojh kar yahan nahin (owner ka faisla 1a)
CREATE TABLE vu_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES vu_courses(code),
  term TEXT NOT NULL CHECK (term IN ('mid', 'final')),
  question TEXT NOT NULL,
  marks INTEGER CHECK (marks IS NULL OR marks BETWEEN 1 AND 100),
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  q_hash TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_vu_questions_hash ON vu_questions(course_code, term, q_hash);
CREATE INDEX idx_vu_questions_list ON vu_questions(course_code, term, verified, verified_at);

ALTER TABLE vu_courses ADD COLUMN q_mid_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vu_courses ADD COLUMN q_mid_all INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vu_courses ADD COLUMN q_final_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vu_courses ADD COLUMN q_final_all INTEGER NOT NULL DEFAULT 0;

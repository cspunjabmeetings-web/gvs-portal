-- spec: F33 (achievement patti + remarks, v0.4.4). confirmed_at = owner ki tasdeeq (sach, saboot, student ki ijazat)
CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('achievement', 'remark')),
  body TEXT NOT NULL,
  person TEXT,
  course_code TEXT,
  semester TEXT,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  place TEXT NOT NULL CHECK (place IN ('vu', 'job', 'both')),
  visible INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL,
  confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

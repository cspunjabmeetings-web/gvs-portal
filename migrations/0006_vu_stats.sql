-- spec: F34 (VU funnel, v0.4.5). Sirf ginti: naam, phone, IP, cookie ya kisi shakhs ki pehchan ka koi khana nahin
CREATE TABLE vu_stats (
  day TEXT NOT NULL,
  course_code TEXT NOT NULL,
  term TEXT NOT NULL CHECK (term IN ('mid', 'final')),
  source TEXT NOT NULL CHECK (source IN ('channel', 'group', 'share', 'status', 'direct')),
  event TEXT NOT NULL CHECK (event IN ('view', 'start', 'done', 'questions', 'pack', 'order')),
  n INTEGER NOT NULL,
  PRIMARY KEY (day, course_code, term, source, event)
);

ALTER TABLE orders ADD COLUMN source TEXT;

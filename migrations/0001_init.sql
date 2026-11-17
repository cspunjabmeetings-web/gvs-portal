-- spec: 7.2 (tables), 7.3 (indexes), 7.4 D1-D4 (manzoor: P-03, P-06, P-07, P-12), 7.6 (seed intent 12.4)
-- Lagoo hone ke baad yeh file KABHI edit nahin hoti; tabdeeli nayi file 0002_...sql mein.
-- Tamam waqt TEXT ISO-8601 UTC.

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_last4 TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'pending', 'complete', 'cancelled')),
  due_at TEXT,
  whatsapp_opened_at TEXT,
  contacted INTEGER NOT NULL DEFAULT 0,
  public_note TEXT,
  admin_note TEXT,
  cancel_reason TEXT,
  completed_by TEXT CHECK (completed_by IN ('admin', 'agent')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  "by" TEXT NOT NULL CHECK ("by" IN ('admin', 'system', 'agent')),
  at TEXT NOT NULL
);

CREATE TABLE order_counter (
  month TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('order_new', 'whatsapp_opened', 'status_changed', 'auto_cancelled', 'low_mcq_bank')),
  order_id TEXT REFERENCES orders(id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE mocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 300),
  summary TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE mcqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_index INTEGER NOT NULL CHECK (answer_index BETWEEN 0 AND 4),
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('Aasan', 'Darmiyana', 'Mushkil')),
  as_of_date TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  mock_id INTEGER REFERENCES mocks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  q_hash TEXT
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  summary TEXT CHECK (summary IS NULL OR length(summary) <= 155),
  body_md TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  org TEXT NOT NULL,
  post TEXT NOT NULL,
  city TEXT,
  education TEXT,
  last_date TEXT NOT NULL,
  official_url TEXT NOT NULL,
  ad_url TEXT,
  image_key TEXT,
  govt_fee INTEGER,
  our_fee INTEGER,
  apply_service INTEGER NOT NULL DEFAULT 1,
  documents_json TEXT NOT NULL DEFAULT '[]',
  steps_json TEXT NOT NULL DEFAULT '[]',
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE daily_pins (
  date TEXT PRIMARY KEY,
  mcq_ids_json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'pin' CHECK (source IN ('pin', 'auto'))
);

CREATE TABLE agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  at TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL
);

-- 7.3 intent ke indexes
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
CREATE INDEX idx_orders_phone ON orders(phone);
CREATE INDEX idx_mcqs_subject_verified ON mcqs(subject, verified);
CREATE INDEX idx_jobs_last_date ON jobs(last_date);
CREATE INDEX idx_notifications_read_created ON notifications(read_at, created_at);
-- 7.4 D3, D4 (unique slug upar UNIQUE se)
CREATE INDEX idx_order_events_order ON order_events(order_id);
CREATE INDEX idx_mcqs_mock ON mcqs(mock_id);
CREATE INDEX idx_mcqs_q_hash ON mcqs(q_hash);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Seed: intent 12.4. Text wali settings seedhi (settings.golden ki shakal), number/bool/list/object JSON mein.
-- Har key ki type src/lib/settings.ts mein tay hai. "tay hona baqi" = khali string.
INSERT INTO settings (key, value) VALUES
  ('whatsapp_number', '03404905266'),
  ('jazzcash_number', ''),
  ('jazzcash_title', ''),
  ('easypaisa_number', ''),
  ('easypaisa_title', ''),
  ('work_start', '09:00'),
  ('work_end', '22:00'),
  ('default_delivery_minutes', '120'),
  ('delivery_overrides', '{}'),
  ('auto_cancel_hours', '48'),
  ('default_job_fee', '300'),
  ('job_image_keep_days', '30'),
  ('subjects', '["General Knowledge","Pakistan Studies","Islamiat","English","Everyday Science","Current Affairs","Computer","Urdu","Maths"]'),
  ('announcement_text', ''),
  ('announcement_on', 'false'),
  ('orders_open', 'true'),
  ('ads_provider', 'house'),
  ('agent_enabled', 'false');

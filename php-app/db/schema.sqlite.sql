CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  color TEXT NOT NULL DEFAULT '#007bff',
  notify_before_mins INTEGER NOT NULL DEFAULT 60,
  browser_notifications INTEGER NOT NULL DEFAULT 0,
  auto_generate INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#007bff',
  created_at TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category_id INTEGER,
  recurrence TEXT NOT NULL DEFAULT 'weekdays',
  weekdays TEXT NOT NULL DEFAULT '1,2,3,4,5',
  month_days TEXT NOT NULL DEFAULT '1',
  due_time TEXT,
  month TEXT NOT NULL,
  estimated_mins INTEGER NOT NULL DEFAULT 30,
  priority TEXT NOT NULL DEFAULT 'medium',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER,
  category_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT NOT NULL,
  due_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  time_spent_mins INTEGER NOT NULL DEFAULT 0,
  snooze_until TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_user_plan_due_idx ON tasks (user_id, plan_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON tasks (user_id, due_date);

CREATE TABLE IF NOT EXISTS work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  content TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'user',
  active TINYINT(1) NOT NULL DEFAULT 1,
  color VARCHAR(16) NOT NULL DEFAULT '#007bff',
  notify_before_mins INT NOT NULL DEFAULT 60,
  browser_notifications TINYINT(1) NOT NULL DEFAULT 0,
  auto_generate TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_uq (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#007bff',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY categories_user_name_uq (user_id, name),
  CONSTRAINT categories_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  category_id INT UNSIGNED NULL,
  recurrence VARCHAR(16) NOT NULL DEFAULT 'weekdays',
  weekdays VARCHAR(32) NOT NULL DEFAULT '1,2,3,4,5',
  month_days VARCHAR(96) NOT NULL DEFAULT '1',
  due_time VARCHAR(5) NULL,
  month VARCHAR(7) NOT NULL,
  estimated_mins INT NOT NULL DEFAULT 30,
  priority VARCHAR(12) NOT NULL DEFAULT 'medium',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY plans_user_month_idx (user_id, month),
  CONSTRAINT plans_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  priority VARCHAR(12) NOT NULL DEFAULT 'medium',
  due_date DATE NOT NULL,
  due_time VARCHAR(5) NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  source VARCHAR(8) NOT NULL DEFAULT 'manual',
  notes TEXT NULL,
  time_spent_mins INT NOT NULL DEFAULT 0,
  snooze_until DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY tasks_user_plan_due_uq (user_id, plan_id, due_date),
  KEY tasks_user_due_idx (user_id, due_date),
  CONSTRAINT tasks_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  content TEXT NOT NULL,
  minutes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY work_logs_user_date_idx (user_id, log_date),
  CONSTRAINT work_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

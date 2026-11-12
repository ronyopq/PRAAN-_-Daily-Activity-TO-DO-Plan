-- PRAAN Daily Activity / To-Do Plan — PostgreSQL schema
--
-- The app creates all of this automatically on first request (see
-- src/db/bootstrap.ts), so running this by hand is optional. Do it when the
-- database user is not allowed to create schemas or tables itself, e.g. a
-- locked-down Supabase role — paste the statements in the Supabase SQL editor.

create schema if not exists "praantodo";

create table if not exists "praantodo"."users" (
  id serial primary key,
  name varchar(80) not null,
  email varchar(190) not null unique,
  password_hash text not null,
  role varchar(16) not null default 'user',
  active boolean not null default true,
  color varchar(16) not null default '#007bff',
  notify_before_mins integer not null default 60,
  browser_notifications boolean not null default false,
  auto_generate boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists "praantodo"."sessions" (
  id serial primary key,
  token_hash varchar(80) not null unique,
  user_id integer not null references "praantodo"."users"(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists sessions_token_idx on "praantodo"."sessions" (token_hash);

create table if not exists "praantodo"."categories" (
  id serial primary key,
  user_id integer not null references "praantodo"."users"(id) on delete cascade,
  name varchar(60) not null,
  color varchar(16) not null default '#007bff',
  created_at timestamptz not null default now()
);
create unique index if not exists categories_user_name_idx on "praantodo"."categories" (user_id, name);

create table if not exists "praantodo"."plans" (
  id serial primary key,
  user_id integer not null references "praantodo"."users"(id) on delete cascade,
  title varchar(160) not null,
  description text,
  category_id integer references "praantodo"."categories"(id) on delete set null,
  recurrence varchar(16) not null default 'weekdays',
  weekdays varchar(32) not null default '1,2,3,4,5',
  month_days varchar(96) not null default '1',
  due_time varchar(5),
  month varchar(7) not null,
  estimated_mins integer not null default 30,
  priority varchar(12) not null default 'medium',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists "praantodo"."tasks" (
  id serial primary key,
  user_id integer not null references "praantodo"."users"(id) on delete cascade,
  plan_id integer references "praantodo"."plans"(id) on delete cascade,
  category_id integer references "praantodo"."categories"(id) on delete set null,
  title varchar(200) not null,
  description text,
  priority varchar(12) not null default 'medium',
  due_date date not null,
  due_time varchar(5),
  status varchar(12) not null default 'pending',
  source varchar(8) not null default 'manual',
  notes text,
  time_spent_mins integer not null default 0,
  snooze_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tasks_user_plan_due_idx on "praantodo"."tasks" (user_id, plan_id, due_date);

create table if not exists "praantodo"."work_logs" (
  id serial primary key,
  user_id integer not null references "praantodo"."users"(id) on delete cascade,
  log_date date not null,
  content text not null,
  minutes integer not null default 0,
  created_at timestamptz not null default now()
);

-- If the app connects as a dedicated role (e.g. praantodo_app), grant it access:
--   grant usage on schema "praantodo" to praantodo_app;
--   grant select, insert, update, delete on all tables in schema "praantodo" to praantodo_app;
--   grant usage, select on all sequences in schema "praantodo" to praantodo_app;

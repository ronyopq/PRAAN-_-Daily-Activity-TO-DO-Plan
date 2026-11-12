<?php
declare(strict_types=1);

/* ----------------------------- categories -------------------------------- */

function default_categories(int $userId): void
{
    $defaults = [
        ['অফিসের কাজ', '#007bff'], ['পার্সোনাল', '#28a745'], ['পড়াশোনা', '#6f42c1'],
        ['ঘরের কাজ', '#fd7e14'], ['স্বাস্থ্য', '#17a2b8'],
    ];
    foreach ($defaults as [$name, $color]) {
        if (one('SELECT id FROM categories WHERE user_id = :u AND name = :n', ['u' => $userId, 'n' => $name])) {
            continue;
        }
        try {
            db_insert('categories', ['user_id' => $userId, 'name' => $name, 'color' => $color, 'created_at' => now()]);
        } catch (Throwable $e) {
            if (!is_unique_error($e)) {
                error_log('category: ' . $e->getMessage());
            }
        }
    }
}

function user_categories(int $userId): array
{
    return all('SELECT * FROM categories WHERE user_id = :u ORDER BY name', ['u' => $userId]);
}

/* --------------------------------- tasks --------------------------------- */

function fetch_tasks(int $userId, array $filters = []): array
{
    $sql = 'SELECT t.*, c.name AS category_name, c.color AS category_color
            FROM tasks t LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = :uid';
    $params = ['uid' => $userId];
    $todayDate = $filters['today'] ?? today();

    if (!empty($filters['date'])) {
        $sql .= ' AND t.due_date = :date';
        $params['date'] = $filters['date'];
    }
    if (!empty($filters['month'])) {
        $sql .= ' AND ' . sql_month('t.due_date') . ' = :month';
        $params['month'] = $filters['month'];
    }
    $openOnly = " AND t.status IN ('pending','progress')";
    switch ($filters['view'] ?? '') {
        case 'open':
            $sql .= $openOnly;
            break;
        case 'overdue':
            $sql .= $openOnly . ' AND t.due_date < :today';
            $params['today'] = $todayDate;
            break;
        case 'today':
            $sql .= ' AND t.due_date = :today';
            $params['today'] = $todayDate;
            break;
        case 'upcoming':
            $sql .= $openOnly . ' AND t.due_date BETWEEN :from_date AND :to_date';
            $params['from_date'] = add_days($todayDate, 1);
            $params['to_date'] = add_days($todayDate, 14);
            break;
    }
    if (!empty($filters['status']) && $filters['status'] !== 'all') {
        $sql .= ' AND t.status = :status';
        $params['status'] = $filters['status'];
    }
    if (!empty($filters['priority']) && $filters['priority'] !== 'all') {
        $sql .= ' AND t.priority = :priority';
        $params['priority'] = $filters['priority'];
    }
    if (!empty($filters['category_id']) && $filters['category_id'] !== 'all') {
        $sql .= ' AND t.category_id = :cat';
        $params['cat'] = (int) $filters['category_id'];
    }
    if (!empty($filters['q'])) {
        $sql .= " AND (LOWER(t.title) LIKE :q_title OR LOWER(COALESCE(t.description, '')) LIKE :q_desc)";
        $needle = '%' . mb_strtolower((string) $filters['q']) . '%';
        $params['q_title'] = $needle;
        $params['q_desc'] = $needle;
    }
    $sql .= ' ORDER BY t.due_date ASC, CASE WHEN t.due_time IS NULL THEN 1 ELSE 0 END ASC, t.due_time ASC, t.id ASC';
    if (!empty($filters['limit'])) {
        $sql .= ' LIMIT ' . (int) $filters['limit'];
    }
    return all($sql, $params);
}

function fetch_task(int $userId, int $id): ?array
{
    return one('SELECT * FROM tasks WHERE id = :id AND user_id = :u', ['id' => $id, 'u' => $userId]);
}

function day_stats(int $userId, string $month): array
{
    $rows = all(
        "SELECT due_date AS d,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
                COALESCE(SUM(time_spent_mins), 0) AS minutes
         FROM tasks WHERE user_id = :u AND " . sql_month('due_date') . " = :m
         GROUP BY due_date ORDER BY due_date",
        ['u' => $userId, 'm' => $month]
    );
    $out = [];
    foreach ($rows as $row) {
        $out[(string) $row['d']] = [
            'date' => (string) $row['d'],
            'total' => (int) $row['total'],
            'done' => (int) $row['done'],
            'skipped' => (int) $row['skipped'],
            'minutes' => (int) $row['minutes'],
        ];
    }
    return $out;
}

/** মাসিক প্ল্যান থেকে নির্দিষ্ট তারিখ-রেঞ্জে কাজ তৈরি (ডুপ্লিকেট নিরাপদে এড়িয়ে) */
function generate_tasks(int $userId, string $from, string $to): array
{
    $plans = all('SELECT * FROM plans WHERE user_id = :u AND active = 1', ['u' => $userId]);
    $existing = all(
        'SELECT plan_id, due_date FROM tasks WHERE user_id = :u AND plan_id IS NOT NULL AND due_date BETWEEN :f AND :t',
        ['u' => $userId, 'f' => $from, 't' => $to]
    );
    $seen = [];
    foreach ($existing as $row) {
        $seen[$row['plan_id'] . '|' . $row['due_date']] = true;
    }

    $created = 0;
    $cursor = $from;
    $guard = 0;
    while ($cursor <= $to && $guard < 400) {
        foreach ($plans as $plan) {
            if ($plan['month'] !== month_of($cursor) || !plan_matches_date($plan, $cursor)) {
                continue;
            }
            $key = $plan['id'] . '|' . $cursor;
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            try {
                db_insert('tasks', [
                    'user_id' => $userId,
                    'plan_id' => (int) $plan['id'],
                    'category_id' => $plan['category_id'] !== null ? (int) $plan['category_id'] : null,
                    'title' => $plan['title'],
                    'description' => $plan['description'],
                    'priority' => $plan['priority'],
                    'due_date' => $cursor,
                    'due_time' => $plan['due_time'],
                    'status' => 'pending',
                    'source' => 'plan',
                    'notes' => null,
                    'time_spent_mins' => 0,
                    'snooze_until' => null,
                    'completed_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $created++;
            } catch (Throwable $e) {
                if (!is_unique_error($e)) {
                    error_log('generate: ' . $e->getMessage());
                }
            }
        }
        $cursor = add_days($cursor, 1);
        $guard++;
    }
    return ['created' => $created];
}

/* --------------------------------- plans --------------------------------- */

function fetch_plans(int $userId, string $month): array
{
    return all(
        'SELECT p.*, c.name AS category_name, c.color AS category_color
         FROM plans p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.user_id = :u AND p.month = :m ORDER BY p.id DESC',
        ['u' => $userId, 'm' => $month]
    );
}

function fetch_plan(int $userId, int $id): ?array
{
    return one('SELECT * FROM plans WHERE id = :id AND user_id = :u', ['id' => $id, 'u' => $userId]);
}

function plan_done_counts(int $userId, string $month): array
{
    $rows = all(
        "SELECT plan_id, COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
         FROM tasks WHERE user_id = :u AND plan_id IS NOT NULL AND " . sql_month('due_date') . " = :m
         GROUP BY plan_id",
        ['u' => $userId, 'm' => $month]
    );
    $out = [];
    foreach ($rows as $row) {
        $out[(int) $row['plan_id']] = ['total' => (int) $row['total'], 'done' => (int) $row['done']];
    }
    return $out;
}

/* ---------------------------------- logs --------------------------------- */

function fetch_logs(int $userId, array $filters = []): array
{
    $sql = 'SELECT * FROM work_logs WHERE user_id = :u';
    $params = ['u' => $userId];
    if (!empty($filters['date'])) {
        $sql .= ' AND log_date = :d';
        $params['d'] = $filters['date'];
    }
    if (!empty($filters['month'])) {
        $sql .= ' AND ' . sql_month('log_date') . ' = :m';
        $params['m'] = $filters['month'];
    }
    $sql .= ' ORDER BY log_date DESC, id DESC';
    if (!empty($filters['limit'])) {
        $sql .= ' LIMIT ' . (int) $filters['limit'];
    }
    return all($sql, $params);
}

/* --------------------------------- reports ------------------------------- */

function month_report(int $userId, string $month): array
{
    $tasks = fetch_tasks($userId, ['month' => $month]);
    $logs = fetch_logs($userId, ['month' => $month]);
    $dates = month_dates($month);
    $stats = day_stats($userId, $month);

    $perDay = [];
    foreach ($dates as $date) {
        $s = $stats[$date] ?? ['total' => 0, 'done' => 0, 'skipped' => 0, 'minutes' => 0];
        $perDay[] = [
            'date' => $date,
            'total' => $s['total'],
            'done' => $s['done'],
            'skipped' => $s['skipped'],
            'minutes' => $s['minutes'],
        ];
    }

    $byCat = [];
    foreach ($tasks as $t) {
        $key = (string) ($t['category_id'] ?? '0');
        $byCat[$key] ??= [
            'name' => $t['category_name'] ?: 'শ্রেণিবিহীন',
            'color' => $t['category_color'] ?: '#6c757d',
            'total' => 0,
            'done' => 0,
            'minutes' => 0,
        ];
        $byCat[$key]['total']++;
        if ($t['status'] === 'done') {
            $byCat[$key]['done']++;
        }
        $byCat[$key]['minutes'] += (int) $t['time_spent_mins'];
    }
    usort($byCat, static fn ($a, $b) => $b['total'] <=> $a['total']);

    $total = count($tasks);
    $done = count(array_filter($tasks, static fn ($t) => $t['status'] === 'done'));
    $skipped = count(array_filter($tasks, static fn ($t) => $t['status'] === 'skipped'));

    return [
        'month' => $month,
        'tasks' => $tasks,
        'logs' => $logs,
        'perDay' => $perDay,
        'perCategory' => $byCat,
        'totals' => [
            'total' => $total,
            'done' => $done,
            'skipped' => $skipped,
            'pending' => $total - $done - $skipped,
            'minutes' => array_sum(array_map(static fn ($t) => (int) $t['time_spent_mins'], $tasks)),
            'logEntries' => count($logs),
            'logMinutes' => array_sum(array_map(static fn ($l) => (int) $l['minutes'], $logs)),
            'rate' => $total > 0 ? (int) round(($done / $total) * 100) : 0,
        ],
    ];
}

/* ---------------------------------- users -------------------------------- */

function user_count(): int
{
    return (int) (one('SELECT COUNT(*) AS c FROM users')['c'] ?? 0);
}

function user_total_stats(int $userId): array
{
    $row = one(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
         FROM tasks WHERE user_id = :u",
        ['u' => $userId]
    );
    return ['total' => (int) ($row['total'] ?? 0), 'done' => (int) ($row['done'] ?? 0)];
}

function team_today_stats(string $date): array
{
    $rows = all(
        "SELECT u.id, u.name, u.color,
                COUNT(t.id) AS total,
                SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
                COALESCE(SUM(t.time_spent_mins), 0) AS minutes
         FROM users u LEFT JOIN tasks t ON t.user_id = u.id AND t.due_date = :d
         WHERE u.active = 1
         GROUP BY u.id, u.name, u.color ORDER BY u.name",
        ['d' => $date]
    );
    return array_map(static fn ($r) => [
        'id' => (int) $r['id'],
        'name' => (string) $r['name'],
        'color' => (string) $r['color'],
        'total' => (int) $r['total'],
        'done' => (int) $r['done'],
        'minutes' => (int) $r['minutes'],
    ], $rows);
}

/* -------------------------------- database ------------------------------- */

function database_info(): array
{
    $driver = db_driver();
    $size = '—';
    $file = '';
    if ($driver === 'sqlite') {
        $path = (string) cfg('sqlite_path', dirname(__DIR__) . '/data/app.sqlite');
        $file = $path;
        $bytes = is_file($path) ? (int) filesize($path) : 0;
        $size = $bytes > 1048576 ? round($bytes / 1048576, 2) . ' MB' : round($bytes / 1024, 1) . ' KB';
    } else {
        $m = cfg('mysql', []);
        $file = ($m['host'] ?? '') . ':' . ($m['port'] ?? 3306) . '/' . ($m['database'] ?? '');
        $row = one("SELECT ROUND(SUM(data_length + index_length) / 1024, 1) AS kb FROM information_schema.tables WHERE table_schema = DATABASE()");
        if ($row && $row['kb'] !== null) {
            $kb = (float) $row['kb'];
            $size = $kb > 1024 ? round($kb / 1024, 2) . ' MB' : $kb . ' KB';
        }
    }
    $counts = [];
    foreach (['users', 'categories', 'plans', 'tasks', 'work_logs'] as $table) {
        $counts[$table] = (int) (one('SELECT COUNT(*) AS c FROM ' . $table)['c'] ?? 0);
    }
    return [
        'driver' => $driver,
        'engine' => $driver === 'sqlite' ? 'SQLite (PDO sqlite)' : 'MySQL / MariaDB (PDO mysql)',
        'location' => $file,
        'size' => $size,
        'version' => $driver === 'sqlite' ? 'SQLite ' . (one('SELECT sqlite_version() AS v')['v'] ?? '') : (one('SELECT VERSION() AS v')['v'] ?? ''),
        'counts' => $counts,
        'php' => PHP_VERSION,
    ];
}

/** ইনস্টলারের জন্য নিরাপদ ইউজার-কাউন্ট (ডেটাবেস না থাকলেও ক্র্যাশ করবে না) */
function user_count_safe(): int
{
    try {
        return user_count();
    } catch (Throwable $e) {
        return 0;
    }
}

<?php
declare(strict_types=1);

function handle_action(string $action, ?array $user): void
{
    $uid = (int) ($user['id'] ?? 0);

    /* -------------------------------- installer ----------------------------- */
    if ($action === 'install.run') {
        $driver = post('driver') === 'sqlite' ? 'sqlite' : 'mysql';
        $host = post('host');
        $port = safe_int(post('port'), 3306);
        $database = post('database');
        $username = post('username');
        $password = post('password');
        $name = post('name');
        $email = mb_strtolower(post('email'));
        $adminPassword = post('admin_password');
        $errors = [];

        if ($driver === 'mysql') {
            if ($host === '' || $database === '' || $username === '') {
                $errors[] = 'MySQL হোস্ট, ডেটাবেসের নাম ও ইউজারনেম দরকার';
            }
        } elseif (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
            $errors[] = 'এই হোস্টিং-এ SQLite নেই — MySQL বেছে নিন';
        }

        // ১) কানেকশন পরীক্ষা
        $pdo = null;
        if (!$errors) {
            try {
                if ($driver === 'mysql') {
                    $pdo = new PDO(
                        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $database),
                        $username,
                        $password,
                        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
                    );
                } else {
                    $path = (string) (config()['sqlite_path'] ?? (dirname(__DIR__) . '/data/app.sqlite'));
                    @mkdir(dirname($path), 0775, true);
                    $pdo = new PDO('sqlite:' . $path, null, null, [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    ]);
                    $pdo->exec('PRAGMA foreign_keys = ON');
                }
            } catch (Throwable $e) {
                $errors[] = 'সংযোগ ব্যর্থ: ' . $e->getMessage();
            }
        }

        // ২) টেবিল তৈরি
        if (!$errors && $pdo instanceof PDO) {
            $schemaFile = dirname(__DIR__) . '/db/schema.' . $driver . '.sql';
            $schema = is_file($schemaFile) ? (string) file_get_contents($schemaFile) : '';
            foreach (preg_split('/;\s*\n/', $schema) ?: [] as $statement) {
                $statement = trim($statement);
                if ($statement === '' || str_starts_with($statement, '--')) {
                    continue;
                }
                try {
                    $pdo->exec($statement);
                } catch (Throwable $e) {
                    if (!str_contains($e->getMessage(), 'already exists')) {
                        $errors[] = 'টেবিল তৈরি: ' . $e->getMessage();
                        break;
                    }
                }
            }
        }

        // ৩) অ্যাডমিন অ্যাকাউন্ট
        if (!$errors && $pdo instanceof PDO) {
            $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            if ($count === 0) {
                if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($adminPassword) < 6) {
                    $errors[] = 'অ্যাডমিনের নাম, সঠিক ইমেইল ও ৬+ অক্ষরের পাসওয়ার্ড দিন';
                } else {
                    $stmt = $pdo->prepare(
                        'INSERT INTO users (name, email, password_hash, role, active, color, notify_before_mins, browser_notifications, auto_generate, created_at)
                         VALUES (?, ?, ?, ?, 1, ?, 60, 0, 1, ?)'
                    );
                    $stmt->execute([$name, $email, password_hash($adminPassword, PASSWORD_DEFAULT), 'admin', '#007bff', date('Y-m-d H:i:s')]);
                    $newId = (int) $pdo->lastInsertId();
                    $defaults = [['অফিসের কাজ', '#007bff'], ['পার্সোনাল', '#28a745'], ['পড়াশোনা', '#6f42c1'], ['ঘরের কাজ', '#fd7e14'], ['স্বাস্থ্য', '#17a2b8']];
                    $catStmt = $pdo->prepare('INSERT INTO categories (user_id, name, color, created_at) VALUES (?, ?, ?, ?)');
                    foreach ($defaults as [$catName, $catColor]) {
                        $catStmt->execute([$newId, $catName, $catColor, date('Y-m-d H:i:s')]);
                    }
                }
            }
        }

        // ৪) config.php লেখা
        if (!$errors) {
            $configCode = "<?php\nreturn [\n"
                . "    'app_name'   => " . var_export((string) (config()['app_name'] ?? 'কাজের হিসাব'), true) . ",\n"
                . "    'driver'     => " . var_export($driver, true) . ",\n"
                . "    'mysql' => [\n"
                . "        'host'     => " . var_export($host, true) . ",\n"
                . "        'port'     => " . $port . ",\n"
                . "        'database' => " . var_export($database, true) . ",\n"
                . "        'username' => " . var_export($username, true) . ",\n"
                . "        'password' => " . var_export($password, true) . ",\n"
                . "        'charset'  => 'utf8mb4',\n"
                . "    ],\n"
                . "    'sqlite_path' => __DIR__ . '/data/app.sqlite',\n"
                . "    'timezone'     => 'Asia/Dhaka',\n"
                . "    'session_name' => 'KAJERHISAB',\n"
                . "    'debug'        => false,\n"
                . "];\n";
            $target = dirname(__DIR__) . '/config.php';
            $written = @file_put_contents($target, $configCode) !== false;
            if (!$written) {
                $_SESSION['install_msg'] = [
                    'tone' => 'warning',
                    'text' => 'ডেটাবেস তৈরি হয়েছে, কিন্তু config.php লেখা যায়নি। নিচের কোডটি কপি করে config.php নামে সেভ করুন: '
                        . $configCode,
                ];
            }
            @file_put_contents(dirname(__DIR__) . '/data/.installed-' . $driver, date('c'));
        }

        if ($errors) {
            $_SESSION['install_msg'] = ['tone' => 'danger', 'text' => implode(' | ', array_unique($errors))];
            redirect('?p=install');
        }
        flash('ইনস্টলেশন সফল হয়েছে — এখন লগইন করুন', 'success');
        redirect('?p=login');
    }

    /* --------------------------------- auth -------------------------------- */
    switch ($action) {
        case 'register': {
            $name = post('name');
            $email = mb_strtolower(post('email'));
            $password = post('password');
            $confirm = post('confirm');
            if ($name === '' || $email === '' || $password === '') {
                flash('নাম, ইমেইল ও পাসওয়ার্ড — সব পূরণ করুন', 'danger');
                redirect('?p=register');
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                flash('সঠিক ইমেইল দিন', 'danger');
                redirect('?p=register');
            }
            if (strlen($password) < 6) {
                flash('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'danger');
                redirect('?p=register');
            }
            if ($password !== $confirm) {
                flash('দুটো পাসওয়ার্ড মিলছে না', 'danger');
                redirect('?p=register');
            }
            if (one('SELECT id FROM users WHERE email = :e', ['e' => $email])) {
                flash('এই ইমেইলে আগেই অ্যাকাউন্ট আছে', 'danger');
                redirect('?p=register');
            }
            $count = user_count();
            $palette = ['#007bff', '#28a745', '#dc3545', '#17a2b8', '#6f42c1'];
            $id = db_insert('users', [
                'name' => $name,
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role' => $count === 0 ? 'admin' : 'user',
                'active' => 1,
                'color' => $palette[$count % count($palette)],
                'notify_before_mins' => 60,
                'browser_notifications' => 0,
                'auto_generate' => 1,
                'created_at' => now(),
            ]);
            default_categories($id);
            $_SESSION['uid'] = $id;
            flash($count === 0 ? 'অ্যাকাউন্ট তৈরি হয়েছে — আপনি অ্যাডমিন' : 'অ্যাকাউন্ট তৈরি হয়েছে — স্বাগতম', 'success');
            redirect('?p=dashboard');
        }

        case 'login': {
            $email = mb_strtolower(post('email'));
            $password = post('password');
            $found = one('SELECT * FROM users WHERE email = :e', ['e' => $email]);
            if (!$found || !password_verify($password, (string) $found['password_hash'])) {
                flash('ইমেইল বা পাসওয়ার্ড ভুল হয়েছে', 'danger');
                redirect('?p=login');
            }
            if ((int) $found['active'] !== 1) {
                flash('আপনার অ্যাকাউন্ট বন্ধ আছে — অ্যাডমিনকে জানান', 'danger');
                redirect('?p=login');
            }
            login_user($found);
            flash('স্বাগতম ' . $found['name'], 'success');
            $next = get('next');
            redirect($next !== '' && str_starts_with($next, '?') ? $next : '?p=dashboard');
        }

        case 'logout': {
            logout_user();
            redirect('?p=login');
        }
    }

    if ($uid === 0) {
        redirect('?p=login');
    }

    switch ($action) {
        /* -------------------------------- tasks ------------------------------ */
        case 'task.save': {
            $id = safe_int(post('id'));
            $title = post('title');
            if ($title === '') {
                flash('কাজের নাম লিখুন', 'danger');
                redirect(back_url());
            }
            $status = array_key_exists(post('status'), STATUS_LABEL) ? post('status') : 'pending';
            $fields = [
                'title' => $title,
                'description' => post('description') !== '' ? post('description') : null,
                'priority' => array_key_exists(post('priority'), PRIORITY_LABEL) ? post('priority') : 'medium',
                'due_date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', post('due_date')) ? post('due_date') : today(),
                'due_time' => preg_match('/^\d{2}:\d{2}$/', post('due_time')) ? post('due_time') : null,
                'category_id' => post('category_id') !== '' ? safe_int(post('category_id')) : null,
                'status' => $status,
                'notes' => post('notes') !== '' ? post('notes') : null,
                'time_spent_mins' => max(0, safe_int(post('time_spent_mins'))),
                'completed_at' => $status === 'done' ? now() : null,
            ];
            if ($id > 0) {
                if (!fetch_task($uid, $id)) {
                    flash('কাজটি খুঁজে পাওয়া যায়নি', 'danger');
                    redirect(back_url());
                }
                $fields['updated_at'] = now();
                db_update('tasks', $fields, 'id = :id AND user_id = :uid', ['id' => $id, 'uid' => $uid]);
                flash('কাজ আপডেট হয়েছে', 'success');
            } else {
                $fields['user_id'] = $uid;
                $fields['source'] = 'manual';
                $fields['snooze_until'] = null;
                $fields['created_at'] = now();
                $fields['updated_at'] = now();
                db_insert('tasks', $fields);
                flash('নতুন কাজ যোগ হয়েছে', 'success');
            }
            redirect(back_url());
        }

        case 'task.complete': {
            $id = safe_int(post('id'));
            $status = array_key_exists(post('status'), STATUS_LABEL) ? post('status') : 'done';
            $task = fetch_task($uid, $id);
            if (!$task) {
                flash('কাজটি খুঁজে পাওয়া যায়নি', 'danger');
                redirect(back_url());
            }
            $minutes = post('time_spent_mins') !== '' ? max(0, safe_int(post('time_spent_mins'))) : (int) $task['time_spent_mins'];
            db_update('tasks', [
                'status' => $status,
                'completed_at' => $status === 'done' ? now() : null,
                'time_spent_mins' => $minutes,
                'notes' => post('notes') !== '' ? post('notes') : $task['notes'],
                'updated_at' => now(),
            ], 'id = :id AND user_id = :uid', ['id' => $id, 'uid' => $uid]);

            if ($status === 'done') {
                $note = post('notes');
                db_insert('work_logs', [
                    'user_id' => $uid,
                    'log_date' => $task['due_date'],
                    'content' => $task['title'] . ($note !== '' ? ' — ' . $note : ''),
                    'minutes' => $minutes,
                    'created_at' => now(),
                ]);
                flash('"' . $task['title'] . '" সম্পন্ন — লগে যোগ হয়েছে', 'success');
            } else {
                flash('আবার পেন্ডিং করে দেওয়া হয়েছে', 'info');
            }
            redirect(back_url());
        }

        case 'task.postpone': {
            $id = safe_int(post('id'));
            $days = safe_int(post('days'), 1);
            $task = fetch_task($uid, $id);
            if ($task) {
                db_update('tasks', [
                    'due_date' => add_days((string) $task['due_date'], $days),
                    'snooze_until' => null,
                    'updated_at' => now(),
                ], 'id = :id AND user_id = :uid', ['id' => $id, 'uid' => $uid]);
                flash(abs($days) . ' দিন পিছিয়ে দেওয়া হয়েছে', 'info');
            }
            redirect(back_url());
        }

        case 'task.delete': {
            db_delete('tasks', 'id = :id AND user_id = :u', ['id' => safe_int(post('id')), 'u' => $uid]);
            flash('কাজটি মুছে ফেলা হয়েছে', 'info');
            redirect(back_url());
        }

        case 'task.bulk': {
            $ids = array_values(array_unique(array_filter(array_map('intval', (array) ($_POST['items'] ?? [])), static fn ($v) => $v > 0)));
            if (!$ids) {
                flash('কোনো কাজ সিলেক্ট করা হয়নি — তালিকার বাঁ দিকের চেকবক্সে টিক দিন', 'warning');
                redirect(back_url());
            }
            $what = post('bulk_action', 'done');
            $moved = 0;
            foreach ($ids as $id) {
                $task = fetch_task($uid, $id);
                if (!$task) {
                    continue;
                }
                if ($what === 'delete') {
                    db_delete('tasks', 'id = :id AND user_id = :u', ['id' => $id, 'u' => $uid]);
                } elseif ($what === 'done') {
                    db_update('tasks', ['status' => 'done', 'completed_at' => now(), 'updated_at' => now()], 'id = :id AND user_id = :u', ['id' => $id, 'u' => $uid]);
                } elseif ($what === 'reopen') {
                    db_update('tasks', ['status' => 'pending', 'completed_at' => null, 'updated_at' => now()], 'id = :id AND user_id = :u', ['id' => $id, 'u' => $uid]);
                } else {
                    $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', post('to_date')) ? post('to_date') : add_days(today(), 1);
                    try {
                        db_update('tasks', ['due_date' => $to, 'snooze_until' => null, 'updated_at' => now()], 'id = :id AND user_id = :u', ['id' => $id, 'u' => $uid]);
                    } catch (Throwable $e) {
                        if (!is_unique_error($e)) {
                            throw $e;
                        }
                        continue;
                    }
                }
                $moved++;
            }
            flash($moved . ' টি কাজে বাল্ক অ্যাকশন সম্পন্ন', $moved ? 'success' : 'warning');
            redirect(back_url());
        }

        /* -------------------------------- plans ------------------------------ */
        case 'plan.save': {
            $id = safe_int(post('id'));
            $title = post('title');
            if ($title === '') {
                flash('প্ল্যানের নাম লিখুন', 'danger');
                redirect('?p=plans');
            }
            $weekdays = isset($_POST['weekdays']) && is_array($_POST['weekdays'])
                ? implode(',', array_map('intval', $_POST['weekdays']))
                : '1,2,3,4,5';
            $fields = [
                'title' => $title,
                'description' => post('description') !== '' ? post('description') : null,
                'category_id' => post('category_id') !== '' ? safe_int(post('category_id')) : null,
                'recurrence' => array_key_exists(post('recurrence'), RECURRENCE_LABEL) ? post('recurrence') : 'weekdays',
                'weekdays' => $weekdays,
                'month_days' => preg_replace('/[^0-9,]/', '', post('month_days')) ?: '1',
                'due_time' => preg_match('/^\d{2}:\d{2}$/', post('due_time')) ? post('due_time') : null,
                'month' => preg_match('/^\d{4}-\d{2}$/', post('month')) ? post('month') : current_month(),
                'estimated_mins' => max(0, safe_int(post('estimated_mins'), 30)),
                'priority' => array_key_exists(post('priority'), PRIORITY_LABEL) ? post('priority') : 'medium',
                'active' => isset($_POST['active']) ? 1 : 0,
            ];
            if ($id > 0) {
                db_update('plans', $fields, 'id = :id AND user_id = :uid', ['id' => $id, 'uid' => $uid]);
                flash('প্ল্যান আপডেট হয়েছে', 'success');
            } else {
                $fields['user_id'] = $uid;
                $fields['created_at'] = now();
                db_insert('plans', $fields);
                flash('মাসিক প্ল্যান যোগ হয়েছে', 'success');
            }
            redirect('?p=plans&month=' . ($fields['month'] ?: current_month()));
        }

        case 'plan.toggle': {
            $id = safe_int(post('id'));
            $plan = fetch_plan($uid, $id);
            if ($plan) {
                db_update('plans', ['active' => (int) $plan['active'] === 1 ? 0 : 1], 'id = :id AND user_id = :uid', ['id' => $id, 'uid' => $uid]);
                flash('প্ল্যানের অবস্থা বদলানো হয়েছে', 'info');
            }
            redirect('?p=plans&month=' . post('month', current_month()));
        }

        case 'plan.delete': {
            db_delete('plans', 'id = :id AND user_id = :u', ['id' => safe_int(post('id')), 'u' => $uid]);
            flash('প্ল্যান ও এর তৈরি কাজ মুছে ফেলা হয়েছে', 'info');
            redirect('?p=plans&month=' . post('month', current_month()));
        }

        case 'generate': {
            $month = preg_match('/^\d{4}-\d{2}$/', post('month')) ? post('month') : current_month();
            $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', post('from')) ? post('from') : $month . '-01';
            $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', post('to')) ? post('to') : $month . '-' . date('t', strtotime($month . '-01'));
            $result = generate_tasks($uid, $from, $to);
            flash(
                $result['created'] > 0 ? $result['created'] . ' টি কাজ তৈরি হয়েছে' : 'নতুন কোনো কাজ তৈরি করার দরকার নেই',
                $result['created'] > 0 ? 'success' : 'info'
            );
            redirect(back_url());
        }

        /* --------------------------------- logs ------------------------------ */
        case 'log.add': {
            $content = post('content');
            $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', post('log_date')) ? post('log_date') : today();
            if ($content === '') {
                flash('কী করেছেন লিখুন', 'danger');
                redirect('?p=log&date=' . $date);
            }
            db_insert('work_logs', [
                'user_id' => $uid,
                'log_date' => $date,
                'content' => $content,
                'minutes' => max(0, safe_int(post('minutes'))),
                'created_at' => now(),
            ]);
            flash('দিনের হিসাবে নোট যোগ হয়েছে', 'success');
            redirect('?p=log&date=' . $date);
        }

        case 'log.delete': {
            db_delete('work_logs', 'id = :id AND user_id = :u', ['id' => safe_int(post('id')), 'u' => $uid]);
            flash('নোট মুছে ফেলা হয়েছে', 'info');
            redirect('?p=log&date=' . post('date', today()));
        }

        /* ------------------------------ categories --------------------------- */
        case 'category.save': {
            $name = post('name');
            if ($name === '') {
                flash('শ্রেণির নাম লিখুন', 'danger');
                redirect('?p=settings');
            }
            $color = preg_match('/^#[0-9a-fA-F]{6}$/', post('color')) ? post('color') : '#007bff';
            $id = safe_int(post('id'));
            if ($id > 0) {
                db_update('categories', ['name' => $name, 'color' => $color], 'id = :id AND user_id = :uid', ['id' => $id, 'uid' => $uid]);
            } else {
                try {
                    db_insert('categories', ['user_id' => $uid, 'name' => $name, 'color' => $color, 'created_at' => now()]);
                } catch (Throwable $e) {
                    if (!is_unique_error($e)) {
                        throw $e;
                    }
                }
            }
            flash('শ্রেণি সেভ হয়েছে', 'success');
            redirect('?p=settings');
        }

        case 'category.delete': {
            db_delete('categories', 'id = :id AND user_id = :u', ['id' => safe_int(post('id')), 'u' => $uid]);
            flash('শ্রেণি মুছে ফেলা হয়েছে', 'info');
            redirect('?p=settings');
        }

        /* -------------------------------- profile ---------------------------- */
        case 'profile.save': {
            $name = post('name');
            $email = mb_strtolower(post('email'));
            if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                flash('সঠিক নাম ও ইমেইল দিন', 'danger');
                redirect('?p=settings');
            }
            if (one('SELECT id FROM users WHERE email = :e AND id <> :id', ['e' => $email, 'id' => $uid])) {
                flash('এই ইমেইল অন্য ইউজার ব্যবহার করছে', 'danger');
                redirect('?p=settings');
            }
            db_update('users', [
                'name' => $name,
                'email' => $email,
                'color' => preg_match('/^#[0-9a-fA-F]{6}$/', post('color')) ? post('color') : '#007bff',
            ], 'id = :uid', ['uid' => $uid]);
            flash('প্রোফাইল আপডেট হয়েছে', 'success');
            redirect('?p=settings');
        }

        case 'prefs.save': {
            db_update('users', [
                'notify_before_mins' => max(0, min(1440, safe_int(post('notify_before_mins'), 60))),
                'browser_notifications' => isset($_POST['browser_notifications']) ? 1 : 0,
                'auto_generate' => isset($_POST['auto_generate']) ? 1 : 0,
            ], 'id = :uid', ['uid' => $uid]);
            flash('রিমাইন্ডার সেটিংস সেভ হয়েছে', 'success');
            redirect('?p=settings');
        }

        case 'password.change': {
            $current = post('current');
            $next = post('next');
            $confirm = post('confirm');
            $row = one('SELECT * FROM users WHERE id = :id', ['id' => $uid]);
            if (!$row || !password_verify($current, (string) $row['password_hash'])) {
                flash('বর্তমান পাসওয়ার্ড ভুল', 'danger');
                redirect('?p=settings');
            }
            if (strlen($next) < 6) {
                flash('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন', 'danger');
                redirect('?p=settings');
            }
            if ($next !== $confirm) {
                flash('নতুন পাসওয়ার্ড দুটো মিলছে না', 'danger');
                redirect('?p=settings');
            }
            db_update('users', ['password_hash' => password_hash($next, PASSWORD_DEFAULT)], 'id = :uid', ['uid' => $uid]);
            flash('পাসওয়ার্ড বদলে গেছে', 'success');
            redirect('?p=settings');
        }

        /* --------------------------------- admin ----------------------------- */
        case 'user.save':
        case 'user.delete':
        case 'user.toggle': {
            if (!is_admin($user)) {
                flash('শুধু অ্যাডমিনের জন্য', 'danger');
                redirect('?p=dashboard');
            }
            if ($action === 'user.delete') {
                $id = safe_int(post('id'));
                if ($id === $uid) {
                    flash('নিজের অ্যাকাউন্ট মুছে দেওয়া যাবে না', 'danger');
                } else {
                    db_delete('users', 'id = :id', ['id' => $id]);
                    flash('ইউজার ও তার সব ডেটা মুছে ফেলা হয়েছে', 'info');
                }
                redirect('?p=users');
            }
            if ($action === 'user.toggle') {
                $id = safe_int(post('id'));
                $target = one('SELECT * FROM users WHERE id = :id', ['id' => $id]);
                if ($target) {
                    db_update('users', ['active' => (int) $target['active'] === 1 ? 0 : 1], 'id = :id', ['id' => $id]);
                    flash('অ্যাকাউন্টের অবস্থা বদলানো হয়েছে', 'info');
                }
                redirect('?p=users');
            }
            $id = safe_int(post('id'));
            $name = post('name');
            $email = mb_strtolower(post('email'));
            $password = post('password');
            $role = post('role') === 'admin' ? 'admin' : 'user';
            if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                flash('সঠিক নাম ও ইমেইল দিন', 'danger');
                redirect('?p=users');
            }
            if (one('SELECT id FROM users WHERE email = :e AND id <> :id', ['e' => $email, 'id' => $id])) {
                flash('এই ইমেইল আগেই ব্যবহৃত', 'danger');
                redirect('?p=users');
            }
            if ($id > 0) {
                db_update('users', ['name' => $name, 'email' => $email, 'role' => $role], 'id = :id', ['id' => $id]);
                if ($password !== '' && strlen($password) >= 6) {
                    db_update('users', ['password_hash' => password_hash($password, PASSWORD_DEFAULT)], 'id = :id', ['id' => $id]);
                }
                flash('ইউজার আপডেট হয়েছে', 'success');
            } else {
                if (strlen($password) < 6) {
                    flash('নতুন ইউজারের জন্য কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন', 'danger');
                    redirect('?p=users');
                }
                $newId = db_insert('users', [
                    'name' => $name,
                    'email' => $email,
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                    'role' => $role,
                    'active' => 1,
                    'color' => '#17a2b8',
                    'notify_before_mins' => 60,
                    'browser_notifications' => 0,
                    'auto_generate' => 1,
                    'created_at' => now(),
                ]);
                default_categories($newId);
                flash('নতুন ইউজার তৈরি হয়েছে', 'success');
            }
            redirect('?p=users');
        }
    }

    http_response_code(400);
    exit('অজানা অ্যাকশন');
}

/* ------------------------------- export / dump ---------------------------- */

function export_csv(array $user, string $what, string $month): never
{
    $report = month_report((int) $user['id'], $month);
    $rows = [];
    if ($what === 'report') {
        $rows[] = ['তারিখ', 'মোট', 'সম্পন্ন', 'বাদ', 'মিনিট'];
        foreach ($report['perDay'] as $d) {
            $rows[] = [$d['date'], $d['total'], $d['done'], $d['skipped'], $d['minutes']];
        }
        $rows[] = [];
        $rows[] = ['তারিখ', 'কাজ', 'অবস্থা', 'অগ্রাধিকার', 'শ্রেণি', 'মিনিট', 'নোট'];
        foreach ($report['tasks'] as $t) {
            $rows[] = [$t['due_date'], $t['title'], $t['status'], $t['priority'], $t['category_name'], $t['time_spent_mins'], $t['notes']];
        }
    } else {
        $rows[] = ['তারিখ', 'সময়', 'কাজ', 'অবস্থা', 'অগ্রাধিকার', 'শ্রেণি', 'মিনিট', 'নোট'];
        foreach ($report['tasks'] as $t) {
            $rows[] = [$t['due_date'], $t['due_time'], $t['title'], $t['status'], $t['priority'], $t['category_name'], $t['time_spent_mins'], $t['notes']];
        }
    }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $what . '-' . $month . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    foreach ($rows as $row) {
        fputcsv($out, $row);
    }
    fclose($out);
    exit;
}

/**
 * পুরো ডেটাবেসের MySQL-উপযোগী ডাম্প (SQLite → MySQL ট্রান্সফারের জন্য)।
 * স্কিমা (schema.mysql.sql) + প্রতিটি টেবিলের INSERT স্টেটমেন্ট থাকে।
 */
function export_sql_dump(): never
{
    $tables = ['users', 'categories', 'plans', 'tasks', 'work_logs'];
    $pdo = db();
    $sql = "-- কাজের হিসাব — MySQL/MariaDB ডাম্প (" . date('c') . ")\n";
    $sql .= "-- উৎস: " . (db_driver() === 'sqlite' ? 'SQLite' : 'MySQL') . "\n\n";
    $sql .= "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n";
    $schema = (string) @file_get_contents(dirname(__DIR__) . '/db/schema.mysql.sql');
    $sql .= "/* ---------- টেবিল তৈরি ---------- */\n" . $schema . "\n\n";
    $sql .= "/* ---------- ডেটা ---------- */\n";
    foreach ($tables as $table) {
        $rows = all('SELECT * FROM ' . $table);
        if (!$rows) {
            continue;
        }
        $sql .= "\n-- " . $table . ' (' . count($rows) . " rows)\n";
        foreach ($rows as $row) {
            $cols = array_keys($row);
            $vals = [];
            foreach ($row as $value) {
                $vals[] = $value === null ? 'NULL' : $pdo->quote((string) $value);
            }
            $sql .= 'INSERT INTO ' . $table . ' (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $vals) . ");\n";
        }
    }
    $sql .= "\nSET FOREIGN_KEY_CHECKS = 1;\n";
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="kajerhisab-mysql-' . date('Ymd-His') . '.sql"');
    echo $sql;
    exit;
}

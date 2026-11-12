<?php
declare(strict_types=1);

require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/queries.php';
require __DIR__ . '/inc/auth.php';
require __DIR__ . '/inc/ui.php';
require __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/actions.php';

boot_session();

$page = get('p', 'dashboard');
$publicPages = ['login', 'register', 'setup', 'install'];
$publicActions = ['login', 'register', 'logout', 'install.run'];

// --- POST অ্যাকশন ---------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $action = get('p', '');
    if (!in_array($action, $publicActions, true)) {
        require_login();
    }
    verify_csrf();
    handle_action($action, current_user());
    exit;
}

// --- প্রথমবার: ডেটাবেস তৈরি না হলে নিজে থেকেই ইনস্টলার দেখাই --------------
$dbReady = true;
$dbError = null;
if (!in_array($page, ['install', 'setup'], true)) {
    try {
        db();
    } catch (Throwable $e) {
        $dbReady = false;
        $dbError = $e->getMessage();
    }
    $configured = is_file(__DIR__ . '/config.php');
    if (!$configured || !$dbReady) {
        render_page('install', ['title' => 'ইনস্টল', 'dbError' => $dbError]);
        exit;
    }
}

// --- এক্সপোর্ট ------------------------------------------------------------
if ($page === 'export') {
    require_login();
    export_csv(current_user(), get('what', 'tasks'), get('month', current_month()));
}
if ($page === 'sql-dump') {
    require_admin();
    export_sql_dump();
}
if ($page === 'logout') {
    redirect('?p=login');
}

// --- পাবলিক পেজ -----------------------------------------------------------
if (in_array($page, $publicPages, true)) {
    if (current_user() && $page !== 'setup' && $page !== 'install') {
        redirect('?p=dashboard');
    }
    $titles = ['login' => 'লগইন', 'register' => 'রেজিস্ট্রেশন', 'setup' => 'সেটআপ', 'install' => 'ইনস্টল'];
    render_page($page, ['title' => $titles[$page] ?? 'কাজের হিসাব']);
    exit;
}

require_login();
$allowed = ['dashboard', 'plans', 'tasks', 'reminders', 'log', 'reports', 'users', 'settings'];
if (!in_array($page, $allowed, true)) {
    http_response_code(404);
    render_page('404', ['title' => 'খুঁজে পাওয়া যায়নি']);
    exit;
}
if ($page === 'users') {
    require_admin();
}
$titles = [
    'dashboard' => 'ড্যাশবোর্ড',
    'plans' => 'মাসিক ওয়ার্কপ্ল্যান',
    'tasks' => 'টুডু লিস্ট',
    'reminders' => 'রিমাইন্ডার সেন্টার',
    'log' => 'দৈনিক কাজের হিসাব',
    'reports' => 'মাসিক রিপোর্ট',
    'users' => 'টিম ও ইউজার',
    'settings' => 'সেটিংস',
];
render_page($page, ['title' => $titles[$page], 'active' => $page]);

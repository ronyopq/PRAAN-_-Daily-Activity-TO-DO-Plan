<?php
declare(strict_types=1);

function current_user(): ?array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $uid = (int) ($_SESSION['uid'] ?? 0);
    if ($uid <= 0) {
        return null;
    }
    $user = one('SELECT * FROM users WHERE id = :id AND active = 1', ['id' => $uid]);
    if (!$user) {
        unset($_SESSION['uid']);
        return null;
    }
    $cache = $user;
    return $user;
}

function require_login(): array
{
    $user = current_user();
    if (!$user) {
        $next = $_SERVER['REQUEST_URI'] ?? '/';
        redirect('?p=login&next=' . urlencode($next));
    }
    return $user;
}

function is_admin(?array $user): bool
{
    return ($user['role'] ?? '') === 'admin';
}

function require_admin(): array
{
    $user = require_login();
    if (!is_admin($user)) {
        http_response_code(403);
        render_page('403', ['title' => 'প্রবেশ নিষেধ']);
        exit;
    }
    return $user;
}

function login_user(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $user['id'];
}

function logout_user(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool) ($p['secure'] ?? false), (bool) ($p['httponly'] ?? true));
    }
    @session_destroy();
}

<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

error_reporting(E_ALL);
@ini_set('display_errors', (bool) cfg('debug', false) ? '1' : '0');
@ini_set('log_errors', '1');
$logDir = dirname(__DIR__) . '/data';
if (is_dir($logDir) && is_writable($logDir)) {
    @ini_set('error_log', $logDir . '/php-errors.log');
}

@date_default_timezone_set((string) cfg('timezone', 'Asia/Dhaka'));
if (function_exists('mb_internal_encoding')) {
    @mb_internal_encoding('UTF-8');
} else {
    // mbstring নেই এমন হোস্টিং-এর জন্য ন্যূনতম ফলব্যাক
    if (!function_exists('mb_strtolower')) {
        function mb_strtolower(string $s): string { return strtolower($s); }
    }
    if (!function_exists('mb_strtoupper')) {
        function mb_strtoupper(string $s): string { return strtoupper($s); }
    }
    if (!function_exists('mb_substr')) {
        function mb_substr(string $s, int $start, ?int $len = null): string {
            return $len === null ? substr($s, $start) : substr($s, $start, $len);
        }
    }
}

/* --------------------------------- session -------------------------------- */
function boot_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    $proto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    $secure = in_array($https, ['on', '1', 'true'], true) || $proto === 'https' || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'secure' => $secure,
        'samesite' => 'Lax',
    ]);
    session_name((string) cfg('session_name', 'KAJERHISAB'));
    @session_start();
}

/* --------------------------------- helpers -------------------------------- */

function redirect(string $to): never
{
    if (!headers_sent()) {
        header('Location: ' . $to, true, 302);
    } else {
        echo '<script>location.replace(' . json_encode($to) . ');</script>';
    }
    exit;
}

/** বর্তমান স্ক্রিপ্টের ভিত্তিতে নিরাপদ বেস URL (সাবফোল্ডারেও কাজ করে) */
function base_url(string $query = ''): string
{
    $script = basename((string) ($_SERVER['SCRIPT_NAME'] ?? 'index.php'));
    return $script . ($query !== '' ? '?' . ltrim($query, '?') : '');
}

function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function post(string $key, string $default = ''): string
{
    $v = $_POST[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function get(string $key, string $default = ''): string
{
    $v = $_GET[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function flash(string $message, string $tone = 'success'): void
{
    $_SESSION['flash'][] = ['text' => $message, 'tone' => $tone];
}

function take_flashes(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return is_array($f) ? $f : [];
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return (string) $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_token" value="' . e(csrf_token()) . '">';
}

function verify_csrf(): void
{
    $token = $_POST['_token'] ?? '';
    if (!is_string($token) || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $token)) {
        http_response_code(419);
        exit('সেশনের টোকেন মেলেনি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
    }
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function today(): string
{
    return date('Y-m-d');
}

function current_month(): string
{
    return date('Y-m');
}

function month_of(string $date): string
{
    return substr($date, 0, 7);
}

function add_days(string $date, int $days): string
{
    return date('Y-m-d', strtotime($date . ' ' . ($days >= 0 ? '+' : '') . $days . ' days'));
}

function month_dates(string $month): array
{
    $days = (int) date('t', strtotime($month . '-01'));
    $out = [];
    for ($i = 1; $i <= $days; $i++) {
        $out[] = $month . '-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT);
    }
    return $out;
}

function shift_month(string $month, int $delta): string
{
    return date('Y-m', strtotime($month . '-01 ' . ($delta >= 0 ? '+' : '') . $delta . ' months'));
}

function safe_int(mixed $value, int $default = 0): int
{
    return is_numeric($value) ? (int) $value : $default;
}

const WEEKDAYS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const WEEKDAYS_FULL_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const PRIORITY_LABEL = ['low' => 'কম জরুরি', 'medium' => 'স্বাভাবিক', 'high' => 'জরুরি', 'urgent' => 'অতি জরুরি'];
const PRIORITY_BADGE = ['low' => 'badge-info', 'medium' => 'badge-soft-warning', 'high' => 'badge-warning', 'urgent' => 'badge-danger'];
const STATUS_LABEL = ['pending' => 'পেন্ডিং', 'progress' => 'চলছে', 'done' => 'সম্পন্ন', 'skipped' => 'বাদ পড়েছে'];
const RECURRENCE_LABEL = [
    'daily' => 'প্রতিদিন',
    'weekdays' => 'সপ্তাহের কাজের দিনে',
    'weekend' => 'শুধু ছুটির দিনে',
    'weekly' => 'সপ্তাহে নির্দিষ্ট দিনে',
    'monthly' => 'মাসের নির্দিষ্ট তারিখে',
];

function month_label(string $month): string
{
    [$y, $m] = array_pad(explode('-', $month), 2, '01');
    return MONTHS_BN[((int) $m) - 1] . ' ' . $y;
}

function fmt_date(?string $date, bool $weekday = false, bool $year = true): string
{
    if (!$date) {
        return '—';
    }
    $ts = strtotime($date);
    $out = date('j', $ts) . ' ' . MONTHS_BN[((int) date('n', $ts)) - 1];
    if ($year) {
        $out .= ' ' . date('Y', $ts);
    }
    return ($weekday ? WEEKDAYS_BN[(int) date('w', $ts)] . ' • ' : '') . $out;
}

function fmt_clock(?string $time): string
{
    if (!$time) {
        return '';
    }
    [$h, $m] = array_pad(explode(':', $time), 2, '00');
    $period = ((int) $h) >= 12 ? 'PM' : 'AM';
    $hh = ((int) $h) % 12 === 0 ? 12 : ((int) $h) % 12;
    return sprintf('%d:%02d %s', $hh, (int) $m, $period);
}

function fmt_mins(int $mins): string
{
    if ($mins <= 0) {
        return '0 মিনিট';
    }
    $h = intdiv($mins, 60);
    $m = $mins % 60;
    if ($h === 0) {
        return $m . ' মিনিট';
    }
    return $m === 0 ? $h . ' ঘণ্টা' : $h . ' ঘ ' . $m . ' মি';
}

function plan_matches_date(array $plan, string $date): bool
{
    $dow = (int) date('w', strtotime($date));
    $day = (int) date('j', strtotime($date));
    $list = static function (?string $csv): array {
        return array_values(array_filter(array_map('intval', explode(',', (string) $csv)), static fn ($v) => $v >= 0));
    };
    return match ($plan['recurrence']) {
        'daily' => true,
        'weekend' => $dow === 6,
        'weekdays' => $dow >= 0 && $dow <= 5,
        'weekly' => in_array($dow, $list($plan['weekdays']), true),
        'monthly' => in_array($day, $list($plan['month_days']), true),
        default => false,
    };
}

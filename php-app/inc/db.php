<?php
declare(strict_types=1);

/** কনফিগ + PDO — SQLite ও MySQL/MariaDB দুটোতেই একই কোড */
function config_file(): string
{
    return dirname(__DIR__) . '/config.php';
}

/** @return array<string,mixed> */
function config(): array
{
    static $cfg = null;
    if (is_array($cfg)) {
        return $cfg;
    }
    $file = config_file();
    $cfg = is_file($file) ? require $file : require dirname(__DIR__) . '/config.sample.php';
    // লোকাল টেস্টে .env থাকলে সেটা দিয়ে ওভাররাইড (InfinityFree-এ দরকার নেই)
    $envFile = dirname(__DIR__) . '/.env';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            if (!str_contains($line, '=') || str_starts_with(trim($line), '#')) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v, " \t\"'");
            if ($k === 'DB_DRIVER') {
                $cfg['driver'] = $v;
            } elseif ($k === 'SQLITE_PATH') {
                $cfg['sqlite_path'] = str_starts_with($v, '/') ? $v : dirname(__DIR__) . '/' . ltrim($v, './');
            } elseif (str_starts_with($k, 'MYSQL_')) {
                $cfg['mysql'][strtolower(substr($k, 6))] = $v;
            }
        }
    }
    return $cfg;
}

function cfg(string $key, mixed $default = null): mixed
{
    return config()[$key] ?? $default;
}

/** কোন ড্রাইভার ব্যবহার হবে — 'auto' হলে হোস্টিং অনুযায়ী নিজেই ঠিক করে */
function db_driver(): string
{
    static $resolved = null;
    if (is_string($resolved)) {
        return $resolved;
    }
    $drivers = PDO::getAvailableDrivers();
    $hasSqlite = in_array('sqlite', $drivers, true);
    $hasMysql = in_array('mysql', $drivers, true);
    $mysql = (array) cfg('mysql', []);
    $mysqlReady = $hasMysql
        && ($mysql['host'] ?? '') !== ''
        && ($mysql['database'] ?? '') !== ''
        && ($mysql['username'] ?? '') !== '';
    $wanted = strtolower((string) cfg('driver', 'auto'));

    if ($wanted === 'mysql') {
        $resolved = 'mysql';
    } elseif ($wanted === 'sqlite') {
        $resolved = 'sqlite';
    } else {
        // InfinityFree-এ pdo_sqlite বন্ধ থাকে → MySQL রেডি থাকলে সেটাই
        $resolved = $hasSqlite ? 'sqlite' : ($mysqlReady ? 'mysql' : 'sqlite');
    }
    if ($resolved === 'sqlite' && !$hasSqlite && $mysqlReady) {
        $resolved = 'mysql';
    }
    if ($resolved === 'mysql' && !$hasMysql && $hasSqlite) {
        $resolved = 'sqlite';
    }
    return $resolved;
}

function driver_available(): bool
{
    $drivers = PDO::getAvailableDrivers();
    return in_array(db_driver(), $drivers, true);
}

function is_installed(): bool
{
    return is_file(dirname(__DIR__) . '/config.php') || is_file(dirname(__DIR__) . '/data/.installed-' . db_driver());
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $debug = (bool) cfg('debug', false);
    try {
        if (db_driver() === 'mysql') {
            $m = cfg('mysql', []);
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $m['host'] ?? 'localhost',
                $m['port'] ?? 3306,
                $m['database'] ?? '',
                $m['charset'] ?? 'utf8mb4'
            );
            $pdo = new PDO($dsn, (string) ($m['username'] ?? ''), (string) ($m['password'] ?? ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            try {
                $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            } catch (Throwable $ignored) {
                // কিছু হোস্টিং COLLATE সাপোর্ট করে না — চালিয়ে যাই
            }
        } else {
            if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
                throw new RuntimeException('এই হোস্টিং-এ pdo_sqlite নেই — ইনস্টলার থেকে MySQL বেছে নিন (?p=install)');
            }
            $path = sqlite_path();
            $pdo = new PDO('sqlite:' . $path, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA busy_timeout = 5000');
        }
    } catch (Throwable $e) {
        fail_db($e, $debug);
    }
    install_schema($pdo);
    return $pdo;
}

/** data/ লেখার অযোগ্য হলে temp ডিরেক্টরিতে ফอลব্যাক */
function sqlite_path(): string
{
    static $path = null;
    if (is_string($path)) {
        return $path;
    }
    $candidates = [];
    $candidates[] = (string) cfg('sqlite_path', dirname(__DIR__) . '/data/app.sqlite');
    $candidates[] = dirname(__DIR__) . '/data/app.sqlite';
    $candidates[] = rtrim(sys_get_temp_dir(), '/\\') . '/kajerhisab.sqlite';
    foreach ($candidates as $candidate) {
        $dir = dirname($candidate);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (is_file($candidate) ? is_writable($candidate) : is_writable($dir)) {
            return $path = $candidate;
        }
    }
    return $path = $candidates[0];
}

function fail_db(Throwable $e, bool $debug): never
{
    http_response_code(500);
    $msg = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="bn"><meta charset="utf-8"><title>ডেটাবেস সমস্যা</title>';
    echo '<body style="font-family:system-ui;background:#f4f6f9;padding:32px">';
    echo '<div style="max-width:640px;margin:auto;background:#fff;border-top:4px solid #dc3545;border-radius:6px;padding:24px;box-shadow:0 4px 18px rgba(0,0,0,.12)">';
    echo '<h1 style="font-size:20px;margin:0 0 8px;color:#dc3545">ডেটাবেসে সংযোগ করা যায়নি</h1>';
    echo '<p style="color:#495057;font-size:14px">PHP পোর্টেবল অ্যাপটি SQLite (ডিফল্ট) বা MySQL দুটোই সমর্থন করে। '
       . '<code>?p=install</code> ইনস্টলার খুলে ডেটাবেস (MySQL বা SQLite) বেছে নিন — একটি ফর্মেই সব হয়ে যাবে।</p>';
    if ($debug) {
        echo '<pre style="background:#f8f9fa;padding:10px;border-radius:4px;overflow:auto;font-size:12px">' . $msg . '</pre>';
    }
    echo '<p><a href="?p=install" style="display:inline-block;background:#007bff;color:#fff;padding:9px 14px;border-radius:4px;text-decoration:none">ইনস্টলার খুলুন →</a> &nbsp; <a href="?p=setup" style="color:#007bff">ডায়াগনস্টিক</a></p></div></body></html>';
    exit;
}

function install_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    $marker = dirname(__DIR__) . '/data/.installed-' . db_driver();
    if (is_file($marker)) {
        return;
    }
    $file = dirname(__DIR__) . '/db/schema.' . db_driver() . '.sql';
    if (is_file($file)) {
        $sql = (string) file_get_contents($file);
        foreach (preg_split('/;\s*\n/', $sql) ?: [] as $statement) {
            $statement = trim($statement);
            if ($statement !== '' && !str_starts_with($statement, '--')) {
                try {
                    $pdo->exec($statement);
                } catch (Throwable $e) {
                    if (!str_contains($e->getMessage(), 'already exists')) {
                        error_log('schema: ' . $e->getMessage());
                    }
                }
            }
        }
    }
    @file_put_contents($marker, date('c'));
}

/* ------------------------------ query helpers ----------------------------- */

function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function one(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function db_insert(string $table, array $data): int
{
    $cols = array_keys($data);
    $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', $cols) . ') VALUES (:' . implode(', :', $cols) . ')';
    q($sql, $data);
    return (int) db()->lastInsertId();
}

function db_update(string $table, array $data, string $where, array $whereParams = []): void
{
    $set = [];
    foreach (array_keys($data) as $col) {
        $set[] = $col . ' = :' . $col;
    }
    q('UPDATE ' . $table . ' SET ' . implode(', ', $set) . ' WHERE ' . $where, array_merge($data, $whereParams));
}

function db_delete(string $table, string $where, array $params): void
{
    q('DELETE FROM ' . $table . ' WHERE ' . $where, $params);
}

function is_unique_error(Throwable $e): bool
{
    return $e instanceof PDOException && (string) $e->getCode() === '23000';
}

/** both drivers: YYYY-MM part of a date column */
function sql_month(string $column): string
{
    return 'substr(' . $column . ', 1, 7)';
}

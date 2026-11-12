<?php
declare(strict_types=1);

function nav_counts(int $userId): array
{
    $overdue = one(
        "SELECT COUNT(*) AS c FROM tasks WHERE user_id = :u AND status IN ('pending','progress') AND due_date < :d",
        ['u' => $userId, 'd' => today()]
    );
    $todayCount = one(
        "SELECT COUNT(*) AS c FROM tasks WHERE user_id = :u AND status IN ('pending','progress') AND due_date = :d",
        ['u' => $userId, 'd' => today()]
    );
    return ['overdue' => (int) ($overdue['c'] ?? 0), 'today' => (int) ($todayCount['c'] ?? 0)];
}

function layout_header(string $title, ?array $user, string $active = ''): void
{
    $nav = [
        ['key' => 'dashboard', 'label' => 'ড্যাশবোর্ড', 'icon' => 'dashboard', 'group' => 'প্রধান'],
        ['key' => 'plans', 'label' => 'মাসিক ওয়ার্কপ্ল্যান', 'icon' => 'calendar', 'group' => 'পরিকল্পনা'],
        ['key' => 'tasks', 'label' => 'টুডু লিস্ট', 'icon' => 'list', 'group' => 'পরিকল্পনা'],
        ['key' => 'reminders', 'label' => 'রিমাইন্ডার সেন্টার', 'icon' => 'bell', 'group' => 'পরিকল্পনা'],
        ['key' => 'log', 'label' => 'দৈনিক কাজের হিসাব', 'icon' => 'book', 'group' => 'হিসাব'],
        ['key' => 'reports', 'label' => 'মাসিক রিপোর্ট', 'icon' => 'chart', 'group' => 'হিসাব'],
        ['key' => 'users', 'label' => 'টিম ও ইউজার', 'icon' => 'users', 'group' => 'অ্যাডমিন', 'admin' => true],
        ['key' => 'settings', 'label' => 'সেটিংস', 'icon' => 'settings', 'group' => 'অ্যাডমিন'],
    ];
    $counts = $user ? nav_counts((int) $user['id']) : ['overdue' => 0, 'today' => 0];
    $groups = [];
    foreach ($nav as $item) {
        if (!empty($item['admin']) && !is_admin($user)) {
            continue;
        }
        $groups[$item['group']][] = $item;
    }
    $initial = $user ? mb_strtoupper(mb_substr((string) $user['name'], 0, 1)) : 'ক';
    ?>
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?> — <?= e((string) cfg('app_name', 'কাজের হিসাব')) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/app.css">
</head>
<body class="lte-root lte-sidebar">
<aside class="lte-main-sidebar" id="sidebar">
  <a class="lte-brand" href="?p=dashboard"><span class="brand-mark">ক</span><span>কাজের <span style="font-weight:300;opacity:.85">হিসাব</span></span></a>
  <div class="lte-user-panel">
    <span class="avatar" style="background:<?= e((string) $user['color']) ?>"><?= e($initial) ?></span>
    <div style="min-width:0">
      <p class="name"><?= e((string) $user['name']) ?></p>
      <p class="meta"><?= is_admin($user) ? 'অ্যাডমিন' : 'মেম্বার' ?> • <?= e((string) $user['email']) ?></p>
    </div>
  </div>
  <nav class="pb">
    <?php foreach ($groups as $group => $items): ?>
      <div class="nav-header"><?= e($group) ?></div>
      <?php foreach ($items as $item): ?>
        <a class="nav-link <?= $active === $item['key'] ? 'active' : '' ?>" href="?p=<?= e($item['key']) ?>">
          <span class="nav-icon"><?= icon($item['icon']) ?></span><span style="flex:1"><?= e($item['label']) ?></span>
          <?php if ($item['key'] === 'reminders' && $counts['overdue'] > 0): ?><span class="lte-badge badge-danger"><?= $counts['overdue'] ?></span>
          <?php elseif ($item['key'] === 'log' && $counts['today'] > 0): ?><span class="lte-badge badge-warning"><?= $counts['today'] ?></span><?php endif; ?>
        </a>
      <?php endforeach; ?>
    <?php endforeach; ?>
    <div style="padding:16px 12px 40px">
      <form method="post" action="?p=logout"><?= csrf_field() ?>
        <button class="lte-btn lte-btn-outline btn-sidebar-logout" type="submit">লগ আউট</button>
      </form>
      <p style="color:#8b95a1;font-size:11px;margin:12px 0 0;line-height:1.5">ডেটা: <?= db_driver() === 'sqlite' ? 'SQLite' : 'MySQL' ?></p>
    </div>
  </nav>
</aside>

<div class="lte-content-wrapper">
  <nav class="lte-navbar">
    <button type="button" class="lte-nav-icon-btn only-mobile" onclick="document.getElementById('sidebar').classList.toggle('is-open')" aria-label="মেনু">☰</button>
    <a href="?p=dashboard" class="navbar-brand"><?= e((string) cfg('app_name', 'কাজের হিসাব')) ?></a>
    <span class="navbar-clock"><?= e(WEEKDAYS_FULL_BN[(int) date('w')] . ', ' . date('j') . ' ' . MONTHS_BN[(int) date('n') - 1] . ' ' . date('Y')) ?></span>
    <form class="navbar-search" method="get" action="index.php">
      <input type="hidden" name="p" value="tasks"><input type="hidden" name="view" value="all">
      <input type="search" name="q" placeholder="কাজ খুঁজুন…" value="<?= e(get('q')) ?>">
    </form>
    <div class="navbar-right">
      <a class="lte-nav-icon-btn" href="?p=reminders" title="রিমাইন্ডার"><span>🔔</span>
        <?php if ($counts['overdue'] + $counts['today'] > 0): ?><span class="lte-badge badge-danger nav-badge"><?= $counts['overdue'] + $counts['today'] ?></span><?php endif; ?>
      </a>
      <a class="navbar-user" href="?p=settings"><span class="avatar-sm" style="background:<?= e((string) $user['color']) ?>"><?= e($initial) ?></span>
        <span class="hide-mobile"><?= e((string) $user['name']) ?></span></a>
    </div>
  </nav>

  <main class="lte-main-content">
    <?php foreach (take_flashes() as $flash): ?>
      <div class="lte-alert lte-alert-<?= e($flash['tone']) ?>"><?= e($flash['text']) ?></div>
    <?php endforeach; ?>
    <noscript><div class="lte-alert lte-alert-warning">এই অ্যাপটি ভালোভাবে চালাতে ব্রাউজারে JavaScript চালু রাখুন।</div></noscript>
    <?php
}

function layout_footer(): void
{
    ?>
  </main>
  <footer class="lte-main-footer">
    <span><b><?= e((string) cfg('app_name', 'কাজের হিসাব')) ?></b> • টুডু, মাসিক প্ল্যান ও দৈনিক লগ</span>
    <span>PHP <?= e(PHP_VERSION) ?> • <?= db_driver() === 'sqlite' ? 'SQLite' : 'MySQL' ?> • v3.0</span>
  </footer>
</div>
<script src="assets/app.js"></script>
</body>
</html>
    <?php
}

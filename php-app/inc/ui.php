<?php
declare(strict_types=1);

function icon(string $name): string
{
    $paths = [
        'dashboard' => '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
        'calendar' => '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
        'list' => '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
        'bell' => '<path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8z"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
        'book' => '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z"/><path d="M8 7h8M8 11h5"/>',
        'chart' => '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        'users' => '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/>',
        'settings' => '<circle cx="12" cy="12" r="3"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
        'check' => '<path d="M20 6 9 17l-5-5"/>',
        'plus' => '<path d="M12 5v14M5 12h14"/>',
        'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        'alert' => '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        'repeat' => '<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
        'download' => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
        'search' => '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
        'user' => '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'key' => '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.5 12.5 20 3l1 3-2 1 .5 2.5-2.5.5.5 2.5-3-.5"/>',
        'inbox' => '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 3H7.3a2 2 0 0 0-1.8 1.1z"/>',
        'db' => '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
        'spark' => '<path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/>',
    ];
    $body = $paths[$name] ?? $paths['check'];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $body . '</svg>';
}

function priority_badge(string $p): string
{
    return '<span class="lte-badge ' . (PRIORITY_BADGE[$p] ?? 'badge-secondary') . '">'
        . e(PRIORITY_LABEL[$p] ?? PRIORITY_LABEL['medium']) . '</span>';
}

function small_box(string $tone, string $value, string $label, string $sub = '', string $ico = 'list', string $href = ''): string
{
    $inner = '<span class="icon">' . icon($ico) . '</span><div class="inner"><h3>' . e($value) . '</h3><p>' . e($label) . '</p>'
        . ($sub !== '' ? '<p class="sub">' . e($sub) . '</p>' : '') . '</div>';
    if ($href !== '') {
        return '<a class="lte-small-box bg-' . e($tone) . '-bg" href="' . e($href) . '">' . $inner . '</a>';
    }
    return '<div class="lte-small-box bg-' . e($tone) . '-bg">' . $inner . '</div>';
}

function back_url(): string
{
    $back = post('back');
    if ($back === '' || !str_starts_with($back, '?')) {
        $back = '/?p=tasks';
    }
    return $back;
}

function task_item(array $task, bool $selectable = false): string
{
    $done = $task['status'] === 'done';
    $skipped = $task['status'] === 'skipped';
    $overdue = !$done && !$skipped && $task['due_date'] < today();
    $html = '<li class="priority-' . e($task['priority']) . ($done ? ' is-done' : '') . '">';
    if ($selectable) {
        $html .= '<label class="pick"><input type="checkbox" name="items[]" value="' . (int) $task['id'] . '" form="bulkform"></label>';
    }
    $html .= '<form method="post" action="?p=task.complete" class="check-form">' . csrf_field()
        . '<input type="hidden" name="id" value="' . (int) $task['id'] . '">'
        . '<input type="hidden" name="status" value="' . ($done ? 'pending' : 'done') . '">'
        . '<button type="submit" class="lte-check' . ($done ? ' checked' : '') . '" title="' . ($done ? 'আবার পেন্ডিং' : 'সম্পন্ন করুন') . '"><span class="box">✓</span></button></form>';
    $html .= '<div class="task-body"><div class="task-title-row">';
    $html .= '<a class="task-title" href="?p=tasks&view=all&edit=' . (int) $task['id'] . '">' . e($task['title']) . '</a>';
    if ($task['source'] === 'plan') {
        $html .= '<span class="plan-mark" title="মাসিক প্ল্যান থেকে">' . icon('repeat') . '</span>';
    }
    if ($task['status'] === 'progress') {
        $html .= '<span class="lte-badge badge-info">চলছে</span>';
    }
    if ($overdue) {
        $html .= '<span class="lte-badge badge-danger">ওভারডিউ</span>';
    }
    if ($task['due_time']) {
        $html .= '<span class="lte-badge badge-secondary">' . e(fmt_clock((string) $task['due_time'])) . '</span>';
    }
    $html .= '</div>';
    if (!empty($task['description'])) {
        $html .= '<p class="task-desc">' . e((string) $task['description']) . '</p>';
    }
    $html .= '<div class="task-meta"><span>' . icon('calendar') . e(fmt_date((string) $task['due_date'], true)) . '</span>';
    $html .= '<span>' . priority_badge((string) $task['priority']) . '</span>';
    if (!empty($task['category_name'])) {
        $html .= '<span><i class="dot" style="background:' . e((string) $task['category_color']) . '"></i>' . e((string) $task['category_name']) . '</span>';
    }
    if ((int) $task['time_spent_mins'] > 0) {
        $html .= '<span>' . icon('clock') . (int) $task['time_spent_mins'] . ' মি</span>';
    }
    $html .= '</div></div><div class="task-actions">';
    if (!$done) {
        $html .= '<form method="post" action="?p=task.postpone">' . csrf_field()
            . '<input type="hidden" name="id" value="' . (int) $task['id'] . '"><input type="hidden" name="days" value="1">'
            . '<input type="hidden" name="back" value="' . e(current_uri()) . '">'
            . '<button class="lte-btn lte-btn-link lte-btn-sm" type="submit" title="কালকে ঠেলে দিন">কালকে</button></form>';
    }
    $html .= '<a class="lte-btn lte-btn-link lte-btn-sm" href="?p=tasks&view=all&edit=' . (int) $task['id'] . '">এডিট</a>';
    $html .= '<form method="post" action="?p=task.delete" onsubmit="return confirm(\'কাজটি মুছে ফেলবেন?\')">' . csrf_field()
        . '<input type="hidden" name="id" value="' . (int) $task['id'] . '"><input type="hidden" name="back" value="' . e(current_uri()) . '">'
        . '<button class="lte-btn lte-btn-link lte-btn-sm danger" type="submit">মুছুন</button></form>';
    $html .= '</div></li>';
    return $html;
}

function current_uri(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/?p=dashboard';
    return str_starts_with($uri, '/') ? $uri : '/?p=dashboard';
}

function task_list(array $tasks, string $empty = 'এখানে দেখার মতো কিছু নেই', string $emptyText = '', bool $selectable = false): string
{
    if (!$tasks) {
        return '<div class="empty"><div class="empty-icon">' . icon('check') . '</div><p class="empty-title">' . e($empty) . '</p>'
            . ($emptyText !== '' ? '<p class="empty-text">' . e($emptyText) . '</p>' : '') . '</div>';
    }
    $html = '<ul class="lte-todo">';
    foreach ($tasks as $task) {
        $html .= task_item($task, $selectable);
    }
    return $html . '</ul>';
}

function page_header(string $title, string $lead = '', string $active = '', string $actionsHtml = ''): void
{
    ?>
    <div class="lte-content-header">
      <div>
        <h1><?= e($title) ?></h1>
        <?php if ($lead !== ''): ?><p class="lead"><?= e($lead) ?></p><?php endif; ?>
      </div>
      <div class="header-actions">
        <?= $actionsHtml ?>
        <ol class="lte-breadcrumb">
          <li><a href="?p=dashboard">হোম</a></li><li>/</li><li class="active"><?= e($title) ?></li>
        </ol>
      </div>
    </div>
    <?php
}

function render_page(string $page, array $vars = []): void
{
    $user = current_user();
    $title = (string) ($vars['title'] ?? 'কাজের হিসাব');
    $active = (string) ($vars['active'] ?? $page);
    $file = __DIR__ . '/../pages/' . $page . '.php';
    if (!is_file($file)) {
        http_response_code(404);
        $page = '404';
        $file = __DIR__ . '/../pages/404.php';
        $title = 'খুঁজে পাওয়া যায়নি';
    }
    $noLayout = ['login', 'register', '403', '404', 'setup', 'install'];
    if (in_array($page, $noLayout, true)) {
        extract($vars, EXTR_SKIP);
        require $file;
        return;
    }
    $vars['user'] = $user;
    extract($vars, EXTR_SKIP);
    layout_header($title, $user, $active);
    require $file;
    layout_footer();
}

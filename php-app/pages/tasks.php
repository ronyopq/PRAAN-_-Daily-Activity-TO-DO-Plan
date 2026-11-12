<?php
$uid = (int) $user['id'];
$view = get('view', 'open');
$status = get('status', 'all');
$priority = get('priority', 'all');
$catFilter = get('category_id', 'all');
$search = get('q');
$month = preg_match('/^\d{4}-\d{2}$/', get('month')) ? get('month') : current_month();
$editId = safe_int(get('edit'));
$showForm = get('new') === '1' || $editId > 0;
$editing = $editId > 0 ? fetch_task($uid, $editId) : null;
$cats = user_categories($uid);

$filters = ['today' => today(), 'status' => $status, 'priority' => $priority, 'category_id' => $catFilter, 'q' => $search];
if (in_array($view, ['open', 'overdue', 'today', 'upcoming'], true)) {
    $filters['view'] = $view;
}
if ($view === 'month' || $view === 'all') {
    $filters['month'] = $month;
}
$tasks = fetch_tasks($uid, $filters);
$query = ['p' => 'tasks', 'view' => $view, 'status' => $status, 'priority' => $priority, 'category_id' => $catFilter, 'q' => $search, 'month' => $month];
$query = array_filter($query, static fn ($v, $k) => $v !== '' && !($k === 'status' && $v === 'all') && !($k === 'priority' && $v === 'all') && !($k === 'category_id' && $v === 'all'), ARRAY_FILTER_USE_BOTH);
$backQuery = 'index.php?' . http_build_query($query);
$backUrl = '?' . http_build_query($query);
$done = count(array_filter($tasks, static fn ($t) => $t['status'] === 'done'));
$overdueCount = count(array_filter($tasks, static fn ($t) => !in_array($t['status'], ['done', 'skipped'], true) && $t['due_date'] < today()));
$todayCount = count(array_filter($tasks, static fn ($t) => $t['due_date'] === today()));

$views = ['open' => 'বাকি সব', 'today' => 'আজ', 'overdue' => 'ওভারডিউ', 'upcoming' => 'আসন্ন ১৪ দিন', 'month' => 'এ মাস', 'all' => 'সব'];

$actions = '<a class="lte-btn lte-btn-outline" href="?p=export&what=tasks&month=' . e($month) . '">' . icon('download') . 'CSV</a>'
    . '<a class="lte-btn lte-btn-primary" href="?p=tasks&new=1">' . icon('plus') . 'নতুন কাজ</a>';
page_header('টুডু লিস্ট', 'সব কাজ এক জায়গায় — ফিল্টার করুন, সম্পন্ন করুন, তারিখ বদলান', 'tasks', $actions);
?>
<div class="grid g4 mb">
  <?= small_box('primary', (string) count($tasks), 'ফিল্টারে কাজ', 'আজে ' . $todayCount . ' টি', 'list') ?>
  <?= small_box('warning', (string) (count($tasks) - $done), 'বাকি', $done . ' টি সম্পন্ন', 'clock') ?>
  <?= small_box('danger', (string) $overdueCount, 'ওভারডিউ', 'আগের দিনের বকেয়া', 'alert', '?p=reminders') ?>
  <?= small_box('success', (count($tasks) ? (string) round(($done / count($tasks)) * 100) : '0') . '%', 'কমপ্লিশন', $view === 'month' ? month_label($month) : 'এই ভিউতে', 'check') ?>
</div>

<?php if ($showForm): ?>
<section class="lte-card bg-primary">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('plus') ?> <?= $editing ? 'কাজ সম্পাদনা' : 'নতুন কাজ / টুডু' ?></h2>
    <a href="<?= e($backUrl) ?>">বন্ধ করুন</a></header>
  <div class="lte-card-body">
    <form method="post" action="?p=task.save" class="stack">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= (int) ($editing['id'] ?? 0) ?>">
      <input type="hidden" name="back" value="<?= e($backUrl) ?>">
      <label class="lte-label">কাজের নাম *<input class="lte-form-control" name="title" required value="<?= e((string) ($editing['title'] ?? '')) ?>" placeholder="যেমন: মাসিক রিপোর্ট জমা দেওয়া"></label>
      <label class="lte-label">বিস্তারিত<textarea class="lte-form-control" name="description" rows="2"><?= e((string) ($editing['description'] ?? '')) ?></textarea></label>
      <div class="grid g3 tight">
        <label class="lte-label">তারিখ<input class="lte-form-control" type="date" name="due_date" value="<?= e((string) ($editing['due_date'] ?? today())) ?>"></label>
        <label class="lte-label">সময় (রিমাইন্ডার)<input class="lte-form-control" type="time" name="due_time" value="<?= e((string) ($editing['due_time'] ?? '')) ?>"></label>
        <label class="lte-label">সময় লেগেছে (মিনিট)<input class="lte-form-control" type="number" min="0" step="5" name="time_spent_mins" value="<?= (int) ($editing['time_spent_mins'] ?? 0) ?>"></label>
      </div>
      <div class="grid g3 tight">
        <label class="lte-label">শ্রেণি
          <select class="lte-form-control" name="category_id">
            <option value="">— শ্রেণি নেই —</option>
            <?php foreach ($cats as $c): ?>
              <option value="<?= (int) $c['id'] ?>" <?= (int) ($editing['category_id'] ?? 0) === (int) $c['id'] ? 'selected' : '' ?>><?= e((string) $c['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="lte-label">অগ্রাধিকার
          <select class="lte-form-control" name="priority">
            <?php foreach (PRIORITY_LABEL as $key => $label): ?><option value="<?= e($key) ?>" <?= ($editing['priority'] ?? 'medium') === $key ? 'selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
          </select>
        </label>
        <label class="lte-label">অবস্থা
          <select class="lte-form-control" name="status">
            <?php foreach (STATUS_LABEL as $key => $label): ?><option value="<?= e($key) ?>" <?= ($editing['status'] ?? 'pending') === $key ? 'selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
          </select>
        </label>
      </div>
      <label class="lte-label">যা করেছি (দৈনিক হিসাবে যোগ হবে)<textarea class="lte-form-control" name="notes" rows="2"><?= e((string) ($editing['notes'] ?? '')) ?></textarea></label>
      <button class="lte-btn lte-btn-primary" type="submit"><?= icon('check') ?>সেভ করুন</button>
    </form>
  </div>
</section>
<?php endif; ?>

<section class="lte-card bg-primary">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('search') ?> ফিল্টার</h2>
    <span class="lte-badge badge-soft-primary"><?= count($tasks) ?> ফলাফল</span></header>
  <div class="lte-card-body">
    <form method="get" action="index.php" class="stack">
      <input type="hidden" name="p" value="tasks">
      <input type="hidden" name="view" value="<?= e($view) ?>">
      <div class="chip-row">
        <?php foreach ($views as $key => $label): ?>
          <a class="lte-btn lte-btn-sm <?= $view === $key ? 'lte-btn-primary' : 'lte-btn-outline' ?>" href="?p=tasks&view=<?= e($key) ?>&month=<?= e($month) ?>"><?= e($label) ?></a>
        <?php endforeach; ?>
        <input class="lte-form-control w-auto" type="month" name="month" value="<?= e($month) ?>">
      </div>
      <div class="grid g4 tight">
        <input class="lte-form-control" type="search" name="q" placeholder="কাজ খুঁজুন…" value="<?= e($search) ?>">
        <select class="lte-form-control" name="status">
          <option value="all">সব অবস্থা</option>
          <?php foreach (STATUS_LABEL as $key => $label): ?><option value="<?= e($key) ?>" <?= $status === $key ? 'selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
        </select>
        <select class="lte-form-control" name="priority">
          <option value="all">সব অগ্রাধিকার</option>
          <?php foreach (PRIORITY_LABEL as $key => $label): ?><option value="<?= e($key) ?>" <?= $priority === $key ? 'selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
        </select>
        <select class="lte-form-control" name="category_id">
          <option value="all">সব শ্রেণি</option>
          <?php foreach ($cats as $c): ?><option value="<?= (int) $c['id'] ?>" <?= $catFilter === (string) $c['id'] ? 'selected' : '' ?>><?= e((string) $c['name']) ?></option><?php endforeach; ?>
        </select>
      </div>
      <button class="lte-btn lte-btn-primary lte-btn-sm" type="submit"><?= icon('search') ?>ফিল্টার করুন</button>
    </form>
  </div>
</section>

<form id="bulkform" method="post" action="?p=task.bulk" class="bulk-bar">
  <?= csrf_field() ?>
  <input type="hidden" name="back" value="<?= e($backUrl) ?>">
  <span class="bulk-label">সিলেক্টেড কাজে:</span>
  <select class="lte-form-control w-auto" name="bulk_action">
    <option value="done">সব সম্পন্ন</option>
    <option value="reopen">পেন্ডিং করুন</option>
    <option value="reschedule">তারিখ পিছান</option>
    <option value="delete">মুছুন</option>
  </select>
  <input class="lte-form-control w-auto" type="date" name="to_date" value="<?= e(add_days(today(), 1)) ?>" title="নতুন তারিখ">
  <button class="lte-btn lte-btn-warning lte-btn-sm" type="submit">চালান</button>
</form>

<section class="lte-card bg-dark">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('list') ?> কাজের তালিকা</h2>
    <span class="lte-badge badge-secondary"><?= count($tasks) ?> টি</span></header>
  <div class="lte-card-body">
    <?= task_list($tasks, 'এই ফিল্টারে কিছু নেই', 'অন্য ভিউ বেছে নিন বা নতুন কাজ যোগ করুন।', true) ?>
  </div>
</section>

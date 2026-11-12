<?php
$uid = (int) $user['id'];
$month = preg_match('/^\d{4}-\d{2}$/', get('month')) ? get('month') : current_month();
$editId = safe_int(get('edit'));
$showForm = get('new') === '1' || $editId > 0;
$editing = $editId > 0 ? fetch_plan($uid, $editId) : null;
$plans = fetch_plans($uid, $month);
$cats = user_categories($uid);
$stats = day_stats($uid, $month);
$doneCounts = plan_done_counts($uid, $month);
$dates = month_dates($month);
$day = today();

$planned = [];
$totalItems = 0;
$totalMins = 0;
foreach ($dates as $date) {
    $hits = array_values(array_filter($plans, static fn ($p) => (int) $p['active'] === 1 && plan_matches_date($p, $date)));
    $planned[$date] = $hits;
    $totalItems += count($hits);
    foreach ($hits as $h) {
        $totalMins += (int) $h['estimated_mins'];
    }
}
$activeDays = count(array_filter($planned, static fn ($h) => count($h) > 0));
$doneTotal = array_sum(array_column($stats, 'done'));
$taskTotal = array_sum(array_column($stats, 'total'));

$actions = '<form method="post" action="?p=generate" class="inline">' . csrf_field()
    . '<input type="hidden" name="month" value="' . e($month) . '">'
    . '<input type="hidden" name="from" value="' . e($month . '-01') . '">'
    . '<input type="hidden" name="to" value="' . e(end($dates)) . '">'
    . '<input type="hidden" name="back" value="?p=plans&month=' . e($month) . '">'
    . '<button class="lte-btn lte-btn-outline-primary" type="submit">' . icon('repeat') . month_label($month) . ' এর কাজ তৈরি</button></form>'
    . '<a class="lte-btn lte-btn-primary" href="?p=plans&month=' . e($month) . '&new=1">' . icon('plus') . 'নতুন প্ল্যান</a>';

page_header('মাসিক ওয়ার্কপ্ল্যান', 'মাসের শুরুতেই ঠিক করুন কোন দিনে কোন কাজ চলবে — বাকিটা টুডু লিস্ট ও রিমাইন্ডার সামলাবে', 'plans', $actions);
?>
<div class="month-switch">
  <a class="lte-btn lte-btn-outline lte-btn-sm" href="?p=plans&month=<?= e(shift_month($month, -1)) ?>">◀</a>
  <span><?= e(month_label($month)) ?></span>
  <a class="lte-btn lte-btn-outline lte-btn-sm" href="?p=plans&month=<?= e(shift_month($month, 1)) ?>">▶</a>
</div>

<div class="grid g4 mb">
  <?= small_box('dark', (string) count($plans), 'এ মাসের প্ল্যান', count(array_filter($plans, static fn ($p) => (int) $p['active'] === 1)) . ' টি সক্রিয়', 'repeat') ?>
  <?= small_box('primary', $activeDays . '/' . count($dates), 'দিনে কাজ আছে', $totalItems . ' টি কাজ তৈরি হবে', 'calendar') ?>
  <?= small_box('info', fmt_mins($totalMins), 'আনুমানিক সময়', 'প্ল্যান অনুযায়ী মাসজুড়ে', 'clock') ?>
  <?= small_box('success', (string) $doneTotal, 'এ মাসে সম্পন্ন', $taskTotal ? round(($doneTotal / $taskTotal) * 100) . '% হার' : 'শুরু হয়নি', 'check') ?>
</div>

<?php if ($showForm): ?>
<section class="lte-card bg-primary">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('calendar') ?> <?= $editing ? 'প্ল্যান সম্পাদনা' : 'নতুন মাসিক প্ল্যান' ?></h2>
    <a href="?p=plans&month=<?= e($month) ?>">বন্ধ করুন</a></header>
  <div class="lte-card-body">
    <form method="post" action="?p=plan.save" class="stack">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= (int) ($editing['id'] ?? 0) ?>">
      <input type="hidden" name="month" value="<?= e((string) ($editing['month'] ?? $month)) ?>">
      <div class="lte-alert lte-alert-info">মাসিক প্ল্যান মানে একই কাজ নির্দিষ্ট দিনে স্বয়ংক্রিয়ভাবে টুডু লিস্টে চলে আসবে — প্রতিদিন আলাদা করে লিখতে হবে না।</div>
      <label class="lte-label">কাজের নাম *<input class="lte-form-control" name="title" required value="<?= e((string) ($editing['title'] ?? '')) ?>" placeholder="যেমন: ডেইলি রিপোর্ট লেখা"></label>
      <label class="lte-label">বিবরণ<textarea class="lte-form-control" name="description" rows="2"><?= e((string) ($editing['description'] ?? '')) ?></textarea></label>
      <div class="grid g3 tight">
        <label class="lte-label">কতবার
          <select class="lte-form-control" name="recurrence">
            <?php foreach (RECURRENCE_LABEL as $key => $label): ?>
              <option value="<?= e($key) ?>" <?= ($editing['recurrence'] ?? 'weekdays') === $key ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="lte-label">রিমাইন্ডারের সময়<input class="lte-form-control" type="time" name="due_time" value="<?= e((string) ($editing['due_time'] ?? '18:00')) ?>"></label>
        <label class="lte-label">আনুমানিক সময় (মিনিট)<input class="lte-form-control" type="number" min="0" step="5" name="estimated_mins" value="<?= (int) ($editing['estimated_mins'] ?? 30) ?>"></label>
      </div>
      <div class="grid g3 tight">
        <div class="lte-label">সপ্তাহের দিন (weekly হলে)
          <div class="chip-row">
            <?php $cur = array_map('intval', explode(',', (string) ($editing['weekdays'] ?? '1,2,3,4,5'))); ?>
            <?php foreach (WEEKDAYS_BN as $i => $label): ?>
              <label class="chip"><input type="checkbox" name="weekdays[]" value="<?= $i ?>" <?= in_array($i, $cur, true) ? 'checked' : '' ?>><?= e($label) ?></label>
            <?php endforeach; ?>
          </div>
        </div>
        <label class="lte-label">মাসের তারিখ (monthly হলে)<input class="lte-form-control" name="month_days" value="<?= e((string) ($editing['month_days'] ?? '1')) ?>" placeholder="1,15,28"></label>
        <label class="lte-label">শ্রেণি
          <select class="lte-form-control" name="category_id">
            <option value="">— শ্রেণি নেই —</option>
            <?php foreach ($cats as $c): ?>
              <option value="<?= (int) $c['id'] ?>" <?= (int) ($editing['category_id'] ?? 0) === (int) $c['id'] ? 'selected' : '' ?>><?= e((string) $c['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
      </div>
      <div class="grid g2 tight">
        <label class="lte-label">অগ্রাধিকার
          <select class="lte-form-control" name="priority">
            <?php foreach (PRIORITY_LABEL as $key => $label): ?>
              <option value="<?= e($key) ?>" <?= ($editing['priority'] ?? 'medium') === $key ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="lte-check big-check"><input type="checkbox" name="active" value="1" <?= !$editing || (int) $editing['active'] === 1 ? 'checked' : '' ?>>
          <span>প্ল্যানটি সক্রিয়</span></label>
      </div>
      <button class="lte-btn lte-btn-primary" type="submit"><?= icon('check') ?>সেভ করুন</button>
    </form>
  </div>
</section>
<?php endif; ?>

<div class="grid g3">
  <section class="lte-card bg-primary x2">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('calendar') ?> <?= e(month_label($month)) ?> ক্যালেন্ডার</h2>
      <span class="muted small">প্রতিটি ঘরে সম্পন্ন/মোট</span></header>
    <div class="lte-card-body">
      <div class="cal">
        <?php foreach (WEEKDAYS_BN as $wd): ?><div class="cal-head"><?= e($wd) ?></div><?php endforeach; ?>
        <?php $offset = (int) date('w', strtotime($month . '-01')); ?>
        <?php for ($i = 0; $i < $offset; $i++): ?><div class="cal-cell empty-cell"></div><?php endfor; ?>
        <?php foreach ($dates as $date): $s = $stats[$date] ?? null; $allDone = $s && $s['total'] > 0 && $s['done'] === $s['total']; ?>
          <a class="cal-cell <?= $date === $day ? 'is-today' : '' ?> <?= ($s && $s['done'] < $s['total'] && $date < $day) ? 'is-overdue' : '' ?> <?= $allDone ? 'is-done' : '' ?>" href="?p=log&date=<?= e($date) ?>">
            <span class="day-num"><?= (int) substr($date, -2) ?><?= $s ? '<em>' . (int) $s['done'] . '/' . (int) $s['total'] . '</em>' : '' ?></span>
            <span class="day-dots">
              <?php foreach (array_slice($planned[$date], 0, 4) as $p): ?><i class="dot" style="background:<?= e((string) ($p['category_color'] ?: '#007bff')) ?>"></i><?php endforeach; ?>
            </span>
            <?php if (!empty($planned[$date])): ?><span class="day-plan"><?= count($planned[$date]) ?> কাজ</span><?php endif; ?>
          </a>
        <?php endforeach; ?>
      </div>
    </div>
  </section>

  <section class="lte-card bg-warning">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('spark') ?> কীভাবে শুরু করবেন</h2></header>
    <div class="lte-card-body">
      <ol class="steps">
        <li><b>নতুন প্ল্যান</b> বাটনে চাপুন।</li>
        <li>কাজের নাম, কতবার (প্রতিদিন / সাপ্তাহিক / মাসের তারিখ) ও রিমাইন্ডারের সময় দিন।</li>
        <li><b>কাজ তৈরি</b> বাটনে চাপলে পুরো মাসের টুডু তৈরি হবে।</li>
      </ol>
    </div>
  </section>
</div>

<section class="lte-card bg-dark">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('list') ?> প্ল্যান তালিকা</h2>
    <span class="lte-badge badge-secondary"><?= count($plans) ?> টি</span></header>
  <div class="table-wrap">
    <table class="lte-table">
      <thead><tr><th>কাজ</th><th>কতবার</th><th>রিমাইন্ডার</th><th>অগ্রাধিকার</th><th>এ মাসে</th><th class="right">অ্যাকশন</th></tr></thead>
      <tbody>
      <?php if (!$plans): ?>
        <tr><td colspan="6" class="muted center">এই মাসে কোনো প্ল্যান নেই — উপরের বাটন থেকে যোগ করুন।</td></tr>
      <?php endif; ?>
      <?php foreach ($plans as $p): ?>
        <?php $hits = count(array_filter($dates, static fn ($d) => plan_matches_date($p, $d))); $dc = $doneCounts[(int) $p['id']] ?? ['done' => 0, 'total' => 0]; ?>
        <tr class="<?= (int) $p['active'] === 1 ? '' : 'inactive' ?>">
          <td><div class="row-flex"><i class="dot" style="background:<?= e((string) ($p['category_color'] ?: '#adb5bd')) ?>"></i>
            <div><p class="strong"><?= e((string) $p['title']) ?></p>
              <p class="muted small"><?= e((string) ($p['category_name'] ?: 'শ্রেণিবিহীন')) ?> • ~<?= (int) $p['estimated_mins'] ?> মি</p></div></div></td>
          <td><span class="lte-badge badge-soft-primary"><?= e(RECURRENCE_LABEL[$p['recurrence']] ?? (string) $p['recurrence']) ?></span>
            <?php if ($p['recurrence'] === 'weekly'): ?><p class="muted small"><?php foreach (array_map('intval', explode(',', (string) $p['weekdays'])) as $d) { echo e(WEEKDAYS_BN[$d] ?? '') . ' '; } ?></p>
            <?php elseif ($p['recurrence'] === 'monthly'): ?><p class="muted small">তারিখ: <?= e((string) $p['month_days']) ?></p><?php endif; ?></td>
          <td><?= $p['due_time'] ? e(fmt_clock((string) $p['due_time'])) : '<span class="muted">সারাদিন</span>' ?></td>
          <td><?= priority_badge((string) $p['priority']) ?></td>
          <td><span class="small"><?= (int) $dc['done'] ?>/<?= $hits ?> সম্পন্ন</span>
            <div class="lte-progress"><div class="lte-progress-bar" style="width: <?= $hits ? (int) round(($dc['done'] / $hits) * 100) : 0 ?>%; background:#28a745"></div></div></td>
          <td><div class="row-actions">
            <a class="lte-btn lte-btn-outline lte-btn-sm" href="?p=plans&month=<?= e($month) ?>&edit=<?= (int) $p['id'] ?>">এডিট</a>
            <form method="post" action="?p=plan.toggle" class="inline"><?= csrf_field() ?>
              <input type="hidden" name="id" value="<?= (int) $p['id'] ?>"><input type="hidden" name="month" value="<?= e($month) ?>">
              <button class="lte-btn lte-btn-outline lte-btn-sm" type="submit"><?= (int) $p['active'] === 1 ? 'নিষ্ক্রিয়' : 'সক্রিয়' ?></button></form>
            <form method="post" action="?p=plan.delete" class="inline" onsubmit="return confirm('প্ল্যান ও এর তৈরি কাজগুলো মুছে যাবে। নিশ্চিত?')"><?= csrf_field() ?>
              <input type="hidden" name="id" value="<?= (int) $p['id'] ?>"><input type="hidden" name="month" value="<?= e($month) ?>">
              <button class="lte-btn lte-btn-outline lte-btn-sm danger" type="submit">মুছুন</button></form>
          </div></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

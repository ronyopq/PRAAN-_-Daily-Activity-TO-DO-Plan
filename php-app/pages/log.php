<?php
$uid = (int) $user['id'];
$date = preg_match('/^\d{4}-\d{2}-\d{2}$/', get('date')) ? get('date') : today();
$month = month_of($date);
$tasks = fetch_tasks($uid, ['date' => $date]);
$logs = fetch_logs($uid, ['date' => $date]);
$monthLogs = fetch_logs($uid, ['month' => $month]);
$stats = day_stats($uid, $month);
$dates = month_dates($month);
$doneCount = count(array_filter($tasks, static fn ($t) => $t['status'] === 'done'));
$leftover = array_values(array_filter($tasks, static fn ($t) => in_array($t['status'], ['pending', 'progress'], true)));
$taskMins = array_sum(array_map(static fn ($t) => (int) $t['time_spent_mins'], $tasks));
$logMins = array_sum(array_map(static fn ($l) => (int) $l['minutes'], $logs));

$actions = '<form method="get" action="index.php" class="inline"><input type="hidden" name="p" value="log">'
    . '<input class="lte-form-control w-auto" type="date" name="date" value="' . e($date) . '" onchange="this.form.submit()"></form>'
    . '<a class="lte-btn lte-btn-outline" href="?p=export&what=report&month=' . e($month) . '">' . icon('download') . 'CSV</a>'
    . '<a class="lte-btn lte-btn-primary" href="?p=tasks&new=1">' . icon('plus') . 'কাজ যোগ</a>';
page_header('দৈনিক কাজের হিসাব', 'যা করেছি, কত সময় লেগেছে আর কী বাকি — দিন ধরে ধরে হিসাব', 'log', $actions);
?>
<div class="grid g4 mb">
  <?= small_box('primary', (string) count($tasks), 'ওই দিনের কাজ', $doneCount . ' টি সম্পন্ন', 'list') ?>
  <?= small_box('success', fmt_mins($taskMins), 'কাজে দেওয়া সময়', 'টাস্ক অনুযায়ী', 'check') ?>
  <?= small_box('info', (string) count($logs), 'লগ এন্ট্রি', fmt_mins($logMins) . ' নোট করা', 'book') ?>
  <?= small_box($leftover ? 'danger' : 'dark', (string) count($leftover), 'বাকি', $leftover ? 'পরের দিনে ঠেলে দিন' : 'দারুণ, সব শেষ!', 'alert') ?>
</div>

<section class="lte-card bg-secondary">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('calendar') ?> <?= e(month_label($month)) ?> — দিনভিত্তিক হিসাব</h2>
    <span class="muted small">যেকোনো দিনে ক্লিক করুন</span></header>
  <div class="lte-card-body">
    <div class="strip">
      <?php foreach ($dates as $d): $s = $stats[$d] ?? null; $rate = $s && $s['total'] > 0 ? $s['done'] / $s['total'] : null; ?>
        <a class="strip-day <?= $d === $date ? 'selected' : '' ?> <?= $d === today() ? 'is-today' : '' ?>"
           style="background:<?= $rate === null ? '#f1f3f5' : ($rate >= 1 ? '#28a745' : ($rate > 0 ? '#7ed957' : '#ffc107')) ?>;color:<?= $rate === null ? '#495057' : '#fff' ?>"
           href="?p=log&date=<?= e($d) ?>" title="<?= e($d) ?><?= $s ? ' • ' . (int) $s['done'] . '/' . (int) $s['total'] : '' ?>"><?= (int) substr($d, -2) ?></a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<div class="grid g3 mt">
  <section class="lte-card <?= $leftover ? 'bg-warning' : 'bg-success' ?> x2">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('list') ?> <?= e(fmt_date($date, true)) ?> এর তালিকা</h2>
      <?php if ($leftover): ?>
        <form method="post" action="?p=task.bulk" class="inline"><?= csrf_field() ?>
          <input type="hidden" name="bulk_action" value="reschedule"><input type="hidden" name="to_date" value="<?= e(add_days($date, 1)) ?>">
          <input type="hidden" name="back" value="?p=log&date=<?= e($date) ?>">
          <?php foreach ($leftover as $t): ?><input type="hidden" name="items[]" value="<?= (int) $t['id'] ?>"><?php endforeach; ?>
          <button class="lte-btn lte-btn-outline-primary lte-btn-sm" type="submit">বাকি <?= count($leftover) ?> টি কালকে ঠেলে দিন</button></form>
      <?php endif; ?>
    </header>
    <div class="lte-card-body"><?= task_list($tasks, 'ওই দিনের কোনো কাজ নেই', 'টুডু লিস্ট থেকে কাজ যোগ করুন বা প্ল্যান থেকে তৈরি করুন।') ?></div>
  </section>

  <section class="lte-card bg-info">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('book') ?> নতুন নোট যোগ করুন</h2></header>
    <div class="lte-card-body">
      <form method="post" action="?p=log.add" class="stack">
        <?= csrf_field() ?>
        <input type="hidden" name="log_date" value="<?= e($date) ?>">
        <label class="lte-label">কী করলেন?
          <textarea class="lte-form-control" name="content" rows="3" placeholder="যেমন: ক্লায়েন্ট রিপোর্টের ড্রাফট শেষ, ৩টি ইমেইলের রিপ্লাই দেওয়া হয়েছে…" required></textarea></label>
        <label class="lte-label">সময় (মিনিট)<input class="lte-form-control" type="number" name="minutes" min="0" step="5" value="30"></label>
        <button class="lte-btn lte-btn-info" type="submit"><?= icon('plus') ?>হিসাবে যোগ করুন</button>
      </form>
      <div class="timeline-box">
        <p class="section-label">ওই দিনের নোট • <?= count($logs) ?></p>
        <?php if ($logs): ?>
          <ul class="lte-timeline">
            <?php foreach ($logs as $l): ?>
              <li class="lte-timeline-item done">
                <div class="tl-head"><p class="tl-text"><?= e((string) $l['content']) ?></p>
                  <form method="post" action="?p=log.delete" onsubmit="return confirm('নোটটি মুছবেন?')"><?= csrf_field() ?>
                    <input type="hidden" name="id" value="<?= (int) $l['id'] ?>"><input type="hidden" name="date" value="<?= e($date) ?>">
                    <button class="link-btn danger" type="submit">মুছুন</button></form></div>
                <p class="tl-meta"><?= (int) $l['minutes'] ? e(fmt_mins((int) $l['minutes'])) . ' • ' : '' ?><?= e(date('h:i A', strtotime((string) $l['created_at']))) ?></p>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php else: ?>
          <p class="muted small">আজকের নোট এখনো নেই। কাজ সম্পন্ন করলে স্বয়ংক্রিয়ভাবে এন্ট্রি যোগ হবে।</p>
        <?php endif; ?>
      </div>
    </div>
  </section>
</div>

<section class="lte-card bg-dark mt">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('inbox') ?> এ মাসের সব লগ</h2>
    <span class="lte-badge badge-secondary"><?= count($monthLogs) ?> এন্ট্রি</span></header>
  <div class="table-wrap">
    <table class="lte-table">
      <thead><tr><th>তারিখ</th><th>বিবরণ</th><th class="right">সময়</th></tr></thead>
      <tbody>
      <?php if (!$monthLogs): ?><tr><td colspan="3" class="muted center">এই মাসে কোনো লগ নেই।</td></tr><?php endif; ?>
      <?php
      $grouped = [];
      foreach ($monthLogs as $row) {
          $grouped[(string) $row['log_date']][] = $row;
      }
      foreach ($grouped as $d => $items): ?>
        <tr>
          <td class="strong nowrap"><?= e(fmt_date($d, false, false)) ?><span class="muted small block"><?= e(WEEKDAYS_FULL_BN[(int) date('w', strtotime($d))]) ?></span></td>
          <td><ul class="plain"><?php foreach ($items as $i): ?><li>• <?= e((string) $i['content']) ?></li><?php endforeach; ?></ul></td>
          <td class="right nowrap"><?= e(fmt_mins(array_sum(array_map(static fn ($i) => (int) $i['minutes'], $items)))) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

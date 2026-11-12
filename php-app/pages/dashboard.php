<?php
$uid = (int) $user['id'];
$day = today();
$month = current_month();

// দিনে একবার: প্ল্যান থেকে আজকের কাজ প্রস্তুত রাখা
if ((int) $user['auto_generate'] === 1 && ($_SESSION['generated'] ?? '') !== $day) {
    generate_tasks($uid, $day, $day);
    $_SESSION['generated'] = $day;
}

$todayTasks = fetch_tasks($uid, ['date' => $day]);
$overdue = fetch_tasks($uid, ['view' => 'overdue']);
$upcoming = fetch_tasks($uid, ['view' => 'upcoming']);
$report = month_report($uid, $month);
$logs = fetch_logs($uid, ['date' => $day, 'limit' => 6]);
$plans = fetch_plans($uid, $month);
$doneToday = count(array_filter($todayTasks, static fn ($t) => $t['status'] === 'done'));

$planToday = array_values(array_filter($plans, static fn ($p) => (int) $p['active'] === 1 && plan_matches_date($p, $day)));
$existingPlanIds = [];
foreach ($todayTasks as $t) {
    if ($t['plan_id']) {
        $existingPlanIds[(int) $t['plan_id']] = true;
    }
}
$missingPlans = array_values(array_filter($planToday, static fn ($p) => !isset($existingPlanIds[(int) $p['id']])));
$statsByDay = day_stats($uid, $month);

$weekBars = [];
for ($i = 6; $i >= 0; $i--) {
    $d = add_days($day, -$i);
    $weekBars[] = ['label' => WEEKDAYS_BN[(int) date('w', strtotime($d))], 'value' => (int) ($statsByDay[$d]['done'] ?? 0)];
}
$totals = $report['totals'];

$headerActions = '<form method="post" action="?p=generate" class="inline">' . csrf_field()
    . '<input type="hidden" name="from" value="' . e($day) . '"><input type="hidden" name="to" value="' . e($day) . '">'
    . '<input type="hidden" name="month" value="' . e($month) . '"><input type="hidden" name="back" value="?p=dashboard">'
    . '<button class="lte-btn lte-btn-outline-primary" type="submit">' . icon('repeat') . 'প্ল্যান থেকে আজকের কাজ</button></form>'
    . '<a class="lte-btn lte-btn-primary" href="?p=tasks&new=1">' . icon('plus') . 'নতুন কাজ</a>';

page_header('ড্যাশবোর্ড', WEEKDAYS_FULL_BN[(int) date('w')] . ', ' . fmt_date($day) . ' • ' . month_label($month), 'dashboard', $headerActions);
?>
<div class="grid g4 mb">
  <?= small_box('primary', (string) count($todayTasks), 'আজকের মোট কাজ', (count($todayTasks) - $doneToday) . ' টি বাকি', 'list', '?p=tasks&view=today') ?>
  <?= small_box('success', (string) $doneToday, 'আজ সম্পন্ন', month_label($month) . ' এ ' . $totals['done'] . ' টি', 'check', '?p=log') ?>
  <?= small_box('danger', (string) count($overdue), 'ওভারডিউ (আগের দিন)', 'যত দ্রুত সম্ভব শেষ করুন', 'alert', '?p=reminders') ?>
  <?= small_box('warning', fmt_mins($totals['minutes']), month_label($month) . ' এর মোট সময়', $totals['logEntries'] . ' লগ এন্ট্রি', 'clock', '?p=reports') ?>
</div>

<div class="grid g3">
  <section class="lte-card bg-primary x2">
    <header class="lte-card-header">
      <h2 class="lte-card-title"><?= icon('calendar') ?> আজকের রুটিন</h2>
      <div class="lte-card-tools"><span class="lte-badge badge-secondary"><?= count($todayTasks) ?> টি</span>
        <a href="?p=log">দিনের হিসাব</a></div>
    </header>
    <div class="lte-card-body">
      <?= task_list($todayTasks, 'আজকের জন্য কোনো কাজ নেই', 'মাসিক প্ল্যান থেকে আজকের কাজ তৈরি করুন অথবা নতুন কাজ যোগ করুন।') ?>
    </div>
    <footer class="lte-card-footer"><a class="lte-btn lte-btn-primary lte-btn-sm" href="?p=tasks&new=1">+ দ্রুত নতুন কাজ যোগ করুন</a></footer>
  </section>

  <div class="stack-gap">
    <section class="lte-card bg-danger">
      <header class="lte-card-header">
        <h2 class="lte-card-title"><?= icon('bell') ?> রিমাইন্ডার বোর্ড</h2>
        <span class="lte-badge <?= (count($overdue) + count($missingPlans)) ? 'badge-danger' : 'badge-success' ?>"><?= count($overdue) + count($missingPlans) ?> টি বাকি</span>
      </header>
      <div class="lte-card-body">
        <?php if ($missingPlans): ?>
          <div class="lte-alert lte-alert-warning">আজকের <?= count($missingPlans) ?> টি প্ল্যান এখনও তালিকায় নেই।
            <form method="post" action="?p=generate" class="inline"><?= csrf_field() ?>
              <input type="hidden" name="from" value="<?= e($day) ?>"><input type="hidden" name="to" value="<?= e($day) ?>">
              <input type="hidden" name="month" value="<?= e($month) ?>"><input type="hidden" name="back" value="?p=dashboard">
              <button class="link-btn" type="submit">এখনই তৈরি করুন</button>
            </form>
          </div>
        <?php endif; ?>
        <?php if ($overdue): ?>
          <p class="section-label danger">ওভারডিউ • <?= count($overdue) ?></p>
          <ul class="lte-todo">
            <?php foreach (array_slice($overdue, 0, 4) as $t): ?>
              <li class="priority-urgent">
                <div class="task-body"><p class="task-title"><?= e((string) $t['title']) ?></p>
                  <p class="task-desc danger"><?= e(fmt_date((string) $t['due_date'])) ?></p></div>
                <form method="post" action="?p=task.complete" class="inline"><?= csrf_field() ?>
                  <input type="hidden" name="id" value="<?= (int) $t['id'] ?>"><input type="hidden" name="status" value="done">
                  <input type="hidden" name="back" value="?p=dashboard">
                  <button class="lte-btn lte-btn-success lte-btn-sm" type="submit">শেষ</button>
                </form>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
        <?php if ($upcoming): ?>
          <p class="section-label info">আসন্ন ১৪ দিন • <?= count($upcoming) ?></p>
          <ul class="lte-todo">
            <?php foreach (array_slice($upcoming, 0, 3) as $t): ?>
              <li class="priority-low"><div class="task-body">
                <p class="task-title"><?= e((string) $t['title']) ?></p>
                <p class="task-desc"><?= e(fmt_date((string) $t['due_date'], true)) ?></p></div></li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
        <?php if (!$overdue && !$upcoming && !$missingPlans): ?>
          <div class="empty"><div class="empty-icon"><?= icon('check') ?></div>
            <p class="empty-title">সব ঠিক আছে</p><p class="empty-text">এই মুহূর্তে কোনো ওভারডিউ বা ডিউ কাজ নেই।</p></div>
        <?php endif; ?>
        <p class="right small" style="margin-top:8px"><a href="?p=reminders">সব রিমাইন্ডার →</a></p>
      </div>
    </section>

    <section class="lte-card bg-success">
      <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('trending') === '' ? icon('chart') : icon('chart') ?> এ মাসের অগ্রগতি</h2></header>
      <div class="lte-card-body">
        <div class="progress-flex">
          <div class="circle" style="--pct: <?= $totals['rate'] ?>"><span><?= $totals['rate'] ?>%</span><small>সম্পন্ন</small></div>
          <div class="grid g2 tight" style="flex:1">
            <?php foreach ([['মোট পরিকল্পিত', $totals['total']], ['সম্পন্ন', $totals['done']], ['বাদ পড়েছে', $totals['skipped']], ['মোট সময়', fmt_mins($totals['minutes'])]] as [$label, $value]): ?>
              <div class="lte-info-box"><div><p><?= e($label) ?></p><h3><?= e((string) $value) ?></h3></div></div>
            <?php endforeach; ?>
          </div>
        </div>
        <div class="bar-chart mt">
          <?php $max = max(1, ...array_column($weekBars, 'value')); ?>
          <?php foreach ($weekBars as $bar): ?>
            <div class="bar-col" title="<?= e($bar['label']) ?>: <?= (int) $bar['value'] ?>">
              <span class="bar-value"><?= (int) $bar['value'] ?: '' ?></span>
              <span class="bar" style="height: <?= max(3, (int) round(((int) $bar['value'] / $max) * 100)) ?>%"></span>
              <span class="bar-label"><?= e($bar['label']) ?></span>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </section>
  </div>
</div>

<div class="grid g2 mt">
  <section class="lte-card bg-secondary">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('book') ?> আজকের কাজের হিসাব</h2><a href="?p=log">খুলুন →</a></header>
    <div class="lte-card-body">
      <?php if ($logs): ?>
        <ul class="lte-timeline">
          <?php foreach ($logs as $l): ?>
            <li class="lte-timeline-item done">
              <p class="tl-text"><?= e((string) $l['content']) ?></p>
              <p class="tl-meta"><?= e(date('h:i A', strtotime((string) $l['created_at']))) ?><?= (int) $l['minutes'] ? ' • ' . e(fmt_mins((int) $l['minutes'])) : '' ?></p>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php else: ?>
        <div class="empty"><div class="empty-icon"><?= icon('book') ?></div>
          <p class="empty-title">আজ এখনো কোনো লগ নেই</p>
          <p class="empty-text">কাজ শেষ করলে স্বয়ংক্রিয়ভাবে এন্ট্রি যোগ হবে।</p>
          <a class="lte-btn lte-btn-outline-primary lte-btn-sm" href="?p=log">নোট লিখুন</a></div>
      <?php endif; ?>
    </div>
  </section>

  <section class="lte-card bg-dark">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('repeat') ?> এ মাসের প্ল্যান</h2><a href="?p=plans">প্ল্যান →</a></header>
    <div class="lte-card-body">
      <?php if ($plans): ?>
        <ul class="plain-list">
          <?php foreach (array_slice($plans, 0, 7) as $p): ?>
            <li><span class="dot" style="background:<?= e((string) ($p['category_color'] ?: '#6c757d')) ?>"></span>
              <span class="grow ellipsis"><?= e((string) $p['title']) ?></span>
              <?php if ((int) $p['active'] !== 1): ?><span class="lte-badge badge-secondary">নিষ্ক্রিয়</span><?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php else: ?>
        <div class="empty"><div class="empty-icon"><?= icon('calendar') ?></div>
          <p class="empty-title">এ মাসের কোনো প্ল্যান নেই</p>
          <p class="empty-text">একবার প্ল্যান বানালে প্রতিদিন কাজ স্বয়ংক্রিয়ভাবে তালিকায় চলে আসবে।</p>
          <a class="lte-btn lte-btn-primary lte-btn-sm" href="?p=plans&new=1">মাসিক প্ল্যান বানান</a></div>
      <?php endif; ?>
    </div>
  </section>
</div>

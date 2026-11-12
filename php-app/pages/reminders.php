<?php
$uid = (int) $user['id'];
$day = today();
$overdue = fetch_tasks($uid, ['view' => 'overdue']);
$todayTasks = fetch_tasks($uid, ['date' => $day]);
$upcoming = fetch_tasks($uid, ['view' => 'upcoming']);
$nowHM = date('H:i');
$openToday = array_values(array_filter($todayTasks, static fn ($t) => in_array($t['status'], ['pending', 'progress'], true)));
$dueNow = array_values(array_filter($openToday, static fn ($t) => !$t['due_time'] || $t['due_time'] <= $nowHM));
$plans = fetch_plans($uid, current_month());
$existing = [];
foreach ($todayTasks as $t) {
    if ($t['plan_id']) {
        $existing[(int) $t['plan_id']] = true;
    }
}
$missing = array_values(array_filter($plans, static fn ($p) => (int) $p['active'] === 1 && plan_matches_date($p, $day) && !isset($existing[(int) $p['id']])));

$actions = '<form method="post" action="?p=generate" class="inline">' . csrf_field()
    . '<input type="hidden" name="from" value="' . e($day) . '"><input type="hidden" name="to" value="' . e($day) . '">'
    . '<input type="hidden" name="month" value="' . e(current_month()) . '"><input type="hidden" name="back" value="?p=reminders">'
    . '<button class="lte-btn lte-btn-outline-primary" type="submit">' . icon('spark') . 'আজকের প্ল্যান-কাজ তৈরি</button></form>';
page_header('রিমাইন্ডার সেন্টার', 'মাসিক প্ল্যান ও টুডু লিস্ট থেকে ডিউ কাজের তালিকা — এখান থেকেই শেষ করুন বা পিছিয়ে দিন', 'reminders', $actions);
?>
<div class="grid g4 mb">
  <?= small_box('danger', (string) count($overdue), 'ওভারডিউ', 'নজরে রাখুন', 'alert') ?>
  <?= small_box('warning', (string) count($todayTasks), 'আজকের ডিউ', count($dueNow) . ' টি এখনই করার', 'clock') ?>
  <?= small_box('info', (string) count($upcoming), 'আসন্ন ১৪ দিন', 'আগাম পরিকল্পনা', 'calendar') ?>
  <?= small_box('secondary', (string) count($missing), 'প্ল্যান বাকি', 'আজকের তালিকায় আসেনি', 'repeat') ?>
</div>

<?php if ($missing): ?>
  <div class="lte-alert lte-alert-warning">আজ <?= count($missing) ?> টি প্ল্যান অনুযায়ী কাজ থাকার কথা কিন্তু তালিকায় নেই:
    <b><?= e(implode(', ', array_slice(array_column($missing, 'title'), 0, 3))) ?></b>
    <form method="post" action="?p=generate" class="inline"><?= csrf_field() ?>
      <input type="hidden" name="from" value="<?= e($day) ?>"><input type="hidden" name="to" value="<?= e($day) ?>">
      <input type="hidden" name="month" value="<?= e(current_month()) ?>"><input type="hidden" name="back" value="?p=reminders">
      <button class="link-btn" type="submit">তৈরি করে দিন</button></form>
  </div>
<?php endif; ?>

<div class="grid g2">
  <section class="lte-card bg-danger" id="overdue">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('alert') ?> ওভারডিউ • <?= count($overdue) ?></h2>
      <?php if ($overdue): ?>
        <form method="post" action="?p=task.bulk" class="inline"><?= csrf_field() ?>
          <input type="hidden" name="bulk_action" value="reschedule"><input type="hidden" name="to_date" value="<?= e($day) ?>">
          <input type="hidden" name="back" value="?p=reminders">
          <?php foreach ($overdue as $t): ?><input type="hidden" name="items[]" value="<?= (int) $t['id'] ?>"><?php endforeach; ?>
          <button class="lte-btn lte-btn-outline lte-btn-sm" type="submit">সব আজকে নিন</button></form>
      <?php endif; ?>
    </header>
    <div class="lte-card-body"><?= task_list($overdue, 'কোনো ওভারডিউ নেই 🎉', 'আগের দিনের সব বকেয়া শেষ — দারুণ!') ?></div>
  </section>

  <section class="lte-card bg-warning">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('clock') ?> আজকের ডিউ • <?= count($todayTasks) ?></h2>
      <span class="lte-badge badge-soft-warning">এখন <?= e(fmt_clock($nowHM)) ?></span></header>
    <div class="lte-card-body"><?= task_list($todayTasks, 'আজকের সব কাজ শেষ', 'নতুন কাজ টুডু লিস্ট থেকে যোগ করুন।') ?></div>
  </section>
</div>

<section class="lte-card bg-info mt">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('calendar') ?> আসন্ন কাজ • <?= count($upcoming) ?></h2></header>
  <div class="table-wrap">
    <table class="lte-table">
      <thead><tr><th>কাজ</th><th>কবে</th><th class="right">অ্যাকশন</th></tr></thead>
      <tbody>
      <?php if (!$upcoming): ?><tr><td colspan="3" class="muted center">পরের ১৪ দিনে কিছু নেই।</td></tr><?php endif; ?>
      <?php foreach (array_slice($upcoming, 0, 15) as $t): $diff = max(1, (int) round((strtotime((string) $t['due_date']) - strtotime($day)) / 86400)); ?>
        <tr>
          <td><p class="strong"><?= e((string) $t['title']) ?></p>
            <p class="muted small"><?= e((string) ($t['category_name'] ?: 'শ্রেণিবিহীন')) ?><?= $t['due_time'] ? ' • ' . e(fmt_clock((string) $t['due_time'])) : '' ?></p></td>
          <td><?= e(fmt_date((string) $t['due_date'], true, false)) ?></td>
          <td><div class="row-actions">
            <form method="post" action="?p=task.postpone" class="inline"><?= csrf_field() ?>
              <input type="hidden" name="id" value="<?= (int) $t['id'] ?>"><input type="hidden" name="days" value="-<?= $diff ?>">
              <input type="hidden" name="back" value="?p=reminders">
              <button class="lte-btn lte-btn-outline lte-btn-sm" type="submit">আজকে</button></form>
            <form method="post" action="?p=task.complete" class="inline"><?= csrf_field() ?>
              <input type="hidden" name="id" value="<?= (int) $t['id'] ?>"><input type="hidden" name="status" value="done">
              <input type="hidden" name="back" value="?p=reminders">
              <button class="lte-btn lte-btn-success lte-btn-sm" type="submit">শেষ</button></form>
          </div></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

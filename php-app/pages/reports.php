<?php
$uid = (int) $user['id'];
$month = preg_match('/^\d{4}-\d{2}$/', get('month')) ? get('month') : current_month();
$report = month_report($uid, $month);
$totals = $report['totals'];
$dates = month_dates($month);
$statsByDay = [];
foreach ($report['perDay'] as $d) {
    $statsByDay[$d['date']] = $d;
}
$best = null;
foreach ($statsByDay as $d => $s) {
    if ($best === null || $s['done'] > $best['done']) {
        $best = ['date' => $d, 'done' => $s['done']];
    }
}
$actions = '<form method="get" action="index.php" class="inline"><input type="hidden" name="p" value="reports">'
    . '<input class="lte-form-control w-auto" type="month" name="month" value="' . e($month) . '" onchange="this.form.submit()"></form>'
    . '<a class="lte-btn lte-btn-outline" href="?p=export&what=report&month=' . e($month) . '">' . icon('download') . 'CSV</a>';
page_header('মাসিক রিপোর্ট', 'প্ল্যান অনুযায়ী কতটুকু হলো, কোন দিনে কত কাজ — সব হিসাব', 'reports', $actions);
?>
<div class="grid g4 mb">
  <?= small_box('primary', (string) $totals['total'], 'মোট কাজ', $totals['pending'] . ' টি বাকি', 'list') ?>
  <?= small_box('success', (string) $totals['done'], 'সম্পন্ন', $totals['rate'] . '% কমপ্লিশন', 'check') ?>
  <?= small_box('info', fmt_mins($totals['minutes']), 'কাজে ব্যয় সময়', 'নোটে ' . fmt_mins($totals['logMinutes']), 'clock') ?>
  <?= small_box('dark', (string) ($best['done'] ?? 0), 'সেরা দিনে সম্পন্ন', $best ? fmt_date($best['date'], false, false) : '—', 'chart') ?>
</div>

<div class="grid g3">
  <section class="lte-card bg-success x2">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('chart') ?> দিনে দিনে সম্পন্ন কাজ</h2>
      <span class="lte-badge badge-soft-success"><?= e(month_label($month)) ?></span></header>
    <div class="lte-card-body">
      <?php $max = 1; foreach ($statsByDay as $s) { $max = max($max, $s['done']); } ?>
      <div class="bar-chart tall">
        <?php foreach ($dates as $d): $s = $statsByDay[$d] ?? ['done' => 0, 'total' => 0]; ?>
          <div class="bar-col" title="<?= e($d) ?>: <?= (int) $s['done'] ?>/<?= (int) $s['total'] ?>">
            <span class="bar-value"><?= (int) $s['done'] ?: '' ?></span>
            <span class="bar <?= $d === today() ? 'today' : '' ?> <?= empty($s['done']) ? 'zero' : '' ?>" style="height:<?= max(3, (int) round(((int) $s['done'] / $max) * 100)) ?>%"></span>
            <span class="bar-label"><?= (int) substr($d, -2) ?></span>
          </div>
        <?php endforeach; ?>
      </div>
      <div class="summary-row">
        <span>মোট কাজ: <b><?= $totals['total'] ?></b></span><span>সম্পন্ন: <b class="green"><?= $totals['done'] ?></b></span>
        <span>বাদ: <b><?= $totals['skipped'] ?></b></span><span>লগ এন্ট্রি: <b class="teal"><?= $totals['logEntries'] ?></b></span>
      </div>
    </div>
  </section>

  <section class="lte-card bg-dark">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('chart') ?> সামগ্রিক অগ্রগতি</h2></header>
    <div class="lte-card-body center">
      <div class="circle big" style="--pct: <?= $totals['rate'] ?>"><span><?= $totals['rate'] ?>%</span><small>এ মাসের</small></div>
      <p class="muted"><?= $totals['done'] ?> / <?= $totals['total'] ?> কাজ শেষ হয়েছে</p>
      <div class="lte-info-box"><div><p>মোট ব্যয় সময়</p><h3><?= e(fmt_mins($totals['minutes'] + $totals['logMinutes'])) ?></h3></div></div>
    </div>
  </section>
</div>

<div class="grid g2 mt">
  <section class="lte-card bg-info">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('list') ?> শ্রেণি অনুযায়ী হিসাব</h2></header>
    <div class="lte-card-body">
      <?php if (!$report['perCategory']): ?><p class="muted center">এ মাসে কোনো কাজ নেই।</p><?php endif; ?>
      <?php foreach ($report['perCategory'] as $c): $pct = $c['total'] ? (int) round(($c['done'] / $c['total']) * 100) : 0; ?>
        <div class="cat-row">
          <div class="cat-head"><span><i class="dot" style="background:<?= e($c['color']) ?>"></i><?= e($c['name']) ?></span>
            <span class="muted small"><?= $c['done'] ?>/<?= $c['total'] ?> • <?= e(fmt_mins($c['minutes'])) ?></span></div>
          <div class="lte-progress"><div class="lte-progress-bar" style="width:<?= $pct ?>%;background:<?= e($c['color']) ?>"></div></div>
        </div>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="lte-card bg-secondary">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('book') ?> দিনের লগ এন্ট্রি</h2>
      <span class="lte-badge badge-secondary"><?= $totals['logEntries'] ?></span></header>
    <div class="table-wrap">
      <table class="lte-table">
        <thead><tr><th>তারিখ</th><th>কী করেছেন</th><th class="right">সময়</th></tr></thead>
        <tbody>
        <?php if (!$report['logs']): ?><tr><td colspan="3" class="muted center">এ মাসে কোনো লগ নেই।</td></tr><?php endif; ?>
        <?php foreach (array_slice($report['logs'], 0, 30) as $l): ?>
          <tr><td class="nowrap strong"><?= e(fmt_date((string) $l['log_date'], false, false)) ?></td>
            <td><?= e((string) $l['content']) ?></td>
            <td class="right nowrap"><?= (int) $l['minutes'] ? e(fmt_mins((int) $l['minutes'])) : '—' ?></td></tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>
</div>

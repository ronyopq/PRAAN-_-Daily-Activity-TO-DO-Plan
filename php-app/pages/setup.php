<?php
$info = null;
$error = null;
try {
    $info = database_info();
} catch (Throwable $ex) {
    $error = $ex->getMessage();
}
$configExists = is_file(dirname(__DIR__) . '/config.php');
$dbWritable = is_writable(dirname(__DIR__) . '/data');
?>
<div class="lte-login-page" style="align-items:flex-start;padding-top:32px">
  <div class="lte-login-box" style="max-width:720px">
    <div class="lte-login-logo"><span class="brand-mark">ক</span> সেটআপ ও ডেটাবেস
      <small>InfinityFree / Apache হোস্টিং-এর জন্য প্রস্তুত</small>
    </div>
    <div class="card">
      <?php if ($error): ?>
        <div class="lte-alert lte-alert-danger">সংযোগ ব্যর্থ: <?= e($error) ?></div>
      <?php endif; ?>
      <div class="grid g2 tight">
        <div class="lte-info-box"><div><p>ডেটাবেস ইঞ্জিন</p><h3><?= e($info['engine'] ?? '—') ?></h3></div></div>
        <div class="lte-info-box"><div><p>সংস্করণ</p><h3><?= e((string) ($info['version'] ?? '—')) ?></h3></div></div>
        <div class="lte-info-box"><div><p>অবস্থান</p><h3 style="font-size:13px;word-break:break-all"><?= e((string) ($info['location'] ?? '—')) ?></h3></div></div>
        <div class="lte-info-box"><div><p>সাইজ</p><h3><?= e((string) ($info['size'] ?? '—')) ?></h3></div></div>
      </div>

      <table class="lte-table" style="margin-top:12px">
        <tbody>
          <tr><td>config.php</td><td class="right"><?= $configExists ? '<span class="lte-badge badge-success">আছে</span>' : '<span class="lte-badge badge-warning">নেই (sample ব্যবহৃত হচ্ছে)</span>' ?></td></tr>
          <tr><td>data/ লেখার অনুমতি</td><td class="right"><?= $dbWritable ? '<span class="lte-badge badge-success">ঠিক আছে</span>' : '<span class="lte-badge badge-danger">chmod 775 দিন</span>' ?></td></tr>
          <tr><td>PHP সংস্করণ</td><td class="right"><?= e((string) ($info['php'] ?? PHP_VERSION)) ?></td></tr>
          <tr><td>PDO ড্রাইভার</td><td class="right"><?= e(implode(', ', array_intersect(['sqlite', 'mysql'], PDO::getAvailableDrivers())) ?: 'কোনোটি নেই') ?></td></tr>
        </tbody>
      </table>

      <?php if ($info): ?>
        <p class="section-label">টেবিলের রো</p>
        <table class="lte-table">
          <tbody>
          <?php foreach ($info['counts'] as $t => $c): ?>
            <tr><td class="mono"><?= e($t) ?></td><td class="right strong"><?= (int) $c ?></td></tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>

      <div class="lte-alert lte-alert-info" style="margin-top:14px">
        <b>SQLite → MySQL পরে:</b> <code>config.php</code>-এ <code>'driver' =&gt; 'mysql'</code> করে MySQL তথ্য দিন,
        তারপর <code>?p=setup</code> খুললে টেবিল নিজেই তৈরি হবে। পুরনো ডেটা নিতে অ্যাডমিন হিসেবে লগইন করে
        <code>?p=sql-dump</code> থেকে ডাম্প নামিয়ে phpMyAdmin-এ ইমপোর্ট করুন।
      </div>
      <p class="center"><a class="lte-btn lte-btn-primary" href="?p=login">লগইন পেজে যান</a></p>
    </div>
  </div>
</div>

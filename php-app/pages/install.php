<?php
$drivers = PDO::getAvailableDrivers();
$hasMysql = in_array('mysql', $drivers, true);
$hasSqlite = in_array('sqlite', $drivers, true);
$installed = user_count_safe() > 0;
$message = $_SESSION['install_msg'] ?? null;
unset($_SESSION['install_msg']);
$cfg = config();
$mysql = (array) ($cfg['mysql'] ?? []);
$required = ['pdo' => extension_loaded('pdo'), 'mysql' => $hasMysql, 'sqlite' => $hasSqlite];
$phpOk = version_compare(PHP_VERSION, '8.0.0', '>=');
?>
<div class="lte-login-page" style="align-items:flex-start;padding-top:28px">
  <div class="lte-login-box" style="max-width:760px">
    <div class="lte-login-logo"><span class="brand-mark">ক</span> <?= e((string) ($cfg['app_name'] ?? 'কাজের হিসাব')) ?>
      <small>ইনস্টলার — InfinityFree / Apache / nginx সবখানে একই</small>
    </div>

    <div class="card">
      <?php if ($message): ?>
        <div class="lte-alert lte-alert-<?= e($message['tone']) ?>"><?= e($message['text']) ?></div>
      <?php endif; ?>

      <?php if ($installed): ?>
        <div class="lte-alert lte-alert-success">ইনস্টলেশন শেষ — <b><?= (int) user_count_safe() ?></b> টি অ্যাকাউন্ট আছে।</div>
        <div class="row-flex" style="gap:8px;flex-wrap:wrap">
          <a class="lte-btn lte-btn-primary" href="?p=login">লগইন করুন</a>
          <a class="lte-btn lte-btn-outline" href="?p=setup">ডেটাবেস ডায়াগনস্টিক</a>
        </div>
      <?php endif; ?>

      <p class="section-label">হোস্টিং পরীক্ষা</p>
      <table class="lte-table">
        <tbody>
          <tr><td>PHP সংস্করণ</td><td class="right"><?= e(PHP_VERSION) ?>
            <?= $phpOk ? '<span class="lte-badge badge-success">ঠিক</span>' : '<span class="lte-badge badge-danger">8.0+ দরকার</span>' ?></td></tr>
          <tr><td>PDO</td><td class="right"><?= $required['pdo'] ? '<span class="lte-badge badge-success">আছে</span>' : '<span class="lte-badge badge-danger">নেই</span>' ?></td></tr>
          <tr><td>MySQL / MariaDB ড্রাইভার</td><td class="right"><?= $hasMysql ? '<span class="lte-badge badge-success">আছে</span>' : '<span class="lte-badge badge-warning">নেই</span>' ?></td></tr>
          <tr><td>SQLite ড্রাইভার</td><td class="right"><?= $hasSqlite ? '<span class="lte-badge badge-success">আছে</span>' : '<span class="lte-badge badge-warning">নেই (স্বাভাবিক)</span>' ?></td></tr>
          <tr><td><code>data/</code> লেখার অনুমতি</td><td class="right"><?= is_writable(dirname(__DIR__) . '/data') ? '<span class="lte-badge badge-success">আছে</span>' : '<span class="lte-badge badge-warning">নেই</span>' ?></td></tr>
          <tr><td><code>config.php</code> লেখা যাবে?</td><td class="right"><?= is_writable(dirname(__DIR__)) ? '<span class="lte-badge badge-success">হ্যাঁ</span>' : '<span class="lte-badge badge-warning">না — হাতে বানাতে হবে</span>' ?></td></tr>
        </tbody>
      </table>

      <p class="section-label">১) ডেটাবেস বেছে নিন</p>
      <div class="grid g2 tight">
        <div class="lte-info-box"><div><p>InfinityFree-এ সুপারিশ</p><h3 style="font-size:15px">MySQL</h3>
          <span class="muted small">Control Panel → MySQL Databases থেকে host, DB name, username, password নিন।</span></div></div>
        <div class="lte-info-box"><div><p>হোস্টিং-এ SQLite থাকলে</p><h3 style="font-size:15px">SQLite</h3>
          <span class="muted small">কোনো সেটআপ লাগে না — data/app.sqlite ফাইল নিজেই তৈরি হবে।</span></div></div>
      </div>

      <form method="post" action="?p=install.run" class="stack" style="margin-top:12px">
        <?= csrf_field() ?>
        <p class="section-label" style="margin:0">২) ডেটাবেস তথ্য</p>
        <div class="grid g2 tight">
          <label class="lte-label">ড্রাইভার
            <select class="lte-form-control" name="driver" id="driver">
              <option value="mysql" <?= $hasMysql ? '' : 'disabled' ?>>MySQL / MariaDB</option>
              <option value="sqlite" <?= $hasSqlite ? '' : 'disabled' ?>>SQLite (ফাইল)</option>
            </select>
          </label>
          <label class="lte-label">পোর্ট<input class="lte-form-control" name="port" value="<?= e((string) ($mysql['port'] ?? 3306)) ?>"></label>
        </div>
        <label class="lte-label">MySQL হোস্ট<input class="lte-form-control" name="host" value="<?= e((string) ($mysql['host'] ?? '')) ?>" placeholder="sql104.infinityfree.com"></label>
        <div class="grid g2 tight">
          <label class="lte-label">ডাটাবেসের নাম<input class="lte-form-control" name="database" value="<?= e((string) ($mysql['database'] ?? '')) ?>" placeholder="if0_12345678_kajerhisab"></label>
          <label class="lte-label">ইউজারনেম<input class="lte-form-control" name="username" value="<?= e((string) ($mysql['username'] ?? '')) ?>" placeholder="if0_12345678"></label>
        </div>
        <label class="lte-label">পাসওয়ার্ড<input class="lte-form-control" type="password" name="password" value="<?= e((string) ($mysql['password'] ?? '')) ?>" autocomplete="new-password"></label>

        <p class="section-label" style="margin:6px 0 0">৩) অ্যাডমিন অ্যাকাউন্ট</p>
        <div class="grid g2 tight">
          <label class="lte-label">আপনার নাম<input class="lte-form-control" name="name" value="" placeholder="আপনার নাম" <?= $installed ? '' : 'required' ?>></label>
          <label class="lte-label">ইমেইল<input class="lte-form-control" type="email" name="email" value="" placeholder="you@example.com" <?= $installed ? '' : 'required' ?>></label>
        </div>
        <label class="lte-label">পাসওয়ার্ড (৬+ অক্ষর)<input class="lte-form-control" type="password" name="admin_password" minlength="6" <?= $installed ? '' : 'required' ?>></label>

        <button class="lte-btn lte-btn-primary lg" type="submit"><?= icon('check') ?>ইনস্টল করুন</button>
        <p class="muted small" style="margin:0">টেবিল না থাকলে নিজে তৈরি হবে; অ্যাডমিন অ্যাকাউন্ট না থাকলে তৈরি হবে। বিদ্যমান ডেটা মুছে যাবে না।</p>
      </form>

      <p class="auth-note">যদি <code>config.php</code> লেখা না যায়, ইনস্টল শেষে স্ক্রিনে কোড দেখাবে — সেটি কপি করে <code>config.php</code> নামে সেভ করুন।</p>
    </div>
  </div>
</div>

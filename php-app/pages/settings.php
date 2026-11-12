<?php
$uid = (int) $user['id'];
$cats = user_categories($uid);
$dbInfo = is_admin($user) ? database_info() : null;
$colors = ['#007bff', '#28a745', '#dc3545', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#343a40'];
$driver = db_driver();
page_header('সেটিংস', 'প্রোফাইল, রিমাইন্ডার, শ্রেণি, ডেটাবেস ও PHP হোস্টিং তথ্য', 'settings');
?>
<div class="grid g2">
  <section class="lte-card bg-primary">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('user') ?> প্রোফাইল</h2></header>
    <div class="lte-card-body">
      <form method="post" action="?p=profile.save" class="stack">
        <?= csrf_field() ?>
        <label class="lte-label">নাম<input class="lte-form-control" name="name" value="<?= e((string) $user['name']) ?>" required></label>
        <label class="lte-label">ইমেইল<input class="lte-form-control" type="email" name="email" value="<?= e((string) $user['email']) ?>" required></label>
        <label class="lte-label">অ্যাভাটার রঙ
          <div class="color-row">
            <?php foreach ($colors as $c): ?>
              <label class="color-dot" style="background:<?= e($c) ?>;<?= $user['color'] === $c ? 'outline:2px solid #343a40' : '' ?>">
                <input type="radio" name="color" value="<?= e($c) ?>" <?= $user['color'] === $c ? 'checked' : '' ?>></label>
            <?php endforeach; ?>
          </div>
        </label>
        <button class="lte-btn lte-btn-primary" type="submit"><?= icon('check') ?>প্রোফাইল সেভ করুন</button>
      </form>
    </div>
  </section>

  <section class="lte-card bg-dark">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('key') ?> পাসওয়ার্ড পরিবর্তন</h2></header>
    <div class="lte-card-body">
      <form method="post" action="?p=password.change" class="stack">
        <?= csrf_field() ?>
        <label class="lte-label">বর্তমান পাসওয়ার্ড<input class="lte-form-control" type="password" name="current" required></label>
        <div class="grid g2 tight">
          <label class="lte-label">নতুন পাসওয়ার্ড<input class="lte-form-control" type="password" name="next" minlength="6" required></label>
          <label class="lte-label">আবার লিখুন<input class="lte-form-control" type="password" name="confirm" minlength="6" required></label>
        </div>
        <button class="lte-btn lte-btn-dark" type="submit"><?= icon('key') ?>পাসওয়ার্ড বদলান</button>
      </form>
    </div>
  </section>

  <section class="lte-card bg-warning">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('bell') ?> রিমাইন্ডার প্রেফারেন্স</h2></header>
    <div class="lte-card-body">
      <form method="post" action="?p=prefs.save" class="stack">
        <?= csrf_field() ?>
        <label class="lte-label">কত আগে রিমাইন্ড
          <select class="lte-form-control" name="notify_before_mins">
            <?php foreach ([0 => 'ঠিক সময়', 15 => '১৫ মিনিট আগে', 30 => '৩০ মিনিট আগে', 60 => '১ ঘণ্টা আগে', 240 => '৪ ঘণ্টা আগে', 1440 => '১ দিন আগে'] as $m => $label): ?>
              <option value="<?= (int) $m ?>" <?= (int) $user['notify_before_mins'] === (int) $m ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="lte-check big-check"><input type="checkbox" name="auto_generate" value="1" <?= (int) $user['auto_generate'] === 1 ? 'checked' : '' ?>>
          <span>প্রতিদিন লগইনের পর প্ল্যান অনুযায়ী আজকের কাজ স্বয়ংক্রিয়ভাবে তৈরি রাখুন</span></label>
        <label class="lte-check big-check"><input type="checkbox" name="browser_notifications" value="1" <?= (int) $user['browser_notifications'] === 1 ? 'checked' : '' ?>>
          <span>ব্রাউজার নোটিফিকেশন চালু (ডিউ হলে পপআপ)</span></label>
        <div class="row-flex">
          <button class="lte-btn lte-btn-warning" type="submit"><?= icon('check') ?>সেভ করুন</button>
          <button class="lte-btn lte-btn-outline" type="button" onclick="requestNotify()">নোটিফিকেশন টেস্ট</button>
        </div>
      </form>
    </div>
  </section>

  <section class="lte-card bg-success">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('list') ?> শ্রেণি (ক্যাটাগরি)</h2>
      <span class="lte-badge badge-secondary"><?= count($cats) ?> টি</span></header>
    <div class="lte-card-body">
      <table class="lte-table">
        <tbody>
        <?php foreach ($cats as $c): ?>
          <tr>
            <td><form method="post" action="?p=category.save" class="row-flex"><?= csrf_field() ?>
              <input type="hidden" name="id" value="<?= (int) $c['id'] ?>">
              <input class="lte-form-control" name="name" value="<?= e((string) $c['name']) ?>">
              <input type="color" name="color" value="<?= e((string) $c['color']) ?>" class="color-input">
              <button class="lte-btn lte-btn-outline lte-btn-sm" type="submit">সেভ</button></form></td>
            <td class="right">
              <form method="post" action="?p=category.delete" class="inline" onsubmit="return confirm('শ্রেণিটি মুছবেন? কাজগুলো থেকে শ্রেণি সরে যাবে।')"><?= csrf_field() ?>
                <input type="hidden" name="id" value="<?= (int) $c['id'] ?>">
                <button class="lte-btn lte-btn-outline lte-btn-sm danger" type="submit">মুছুন</button></form></td>
          </tr>
        <?php endforeach; ?>
        <tr><td colspan="2">
          <form method="post" action="?p=category.save" class="row-flex"><?= csrf_field() ?>
            <input class="lte-form-control" name="name" placeholder="নতুন শ্রেণির নাম" required>
            <input type="color" name="color" value="#007bff" class="color-input">
            <button class="lte-btn lte-btn-success lte-btn-sm" type="submit">যোগ করুন</button></form>
        </td></tr>
        </tbody>
      </table>
    </div>
  </section>
</div>

<?php if ($dbInfo): ?>
<section class="lte-card bg-dark mt">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('db') ?> ডেটাবেস কোথায় সেভ হচ্ছে</h2>
    <span class="lte-badge badge-soft-success"><?= e($dbInfo['engine']) ?></span></header>
  <div class="lte-card-body">
    <div class="lte-alert lte-alert-info">
      সব ইউজার, টুডু, প্ল্যান, রিমাইন্ডার ও কাজের হিসাব সেভ হচ্ছে <b><?= e($dbInfo['engine']) ?></b>-এ —
      ব্রাউজারে নয়। এখন ব্যবহার হচ্ছে <code><?= e($driver) ?></code> ড্রাইভার।
      পরে MySQL-এ যেতে <code>config.php</code>-এ <code>'driver' =&gt; 'mysql'</code> করে তথ্য দিন।
    </div>
    <div class="grid g3 tight">
      <div class="lte-info-box"><div><p>ইঞ্জিন</p><h3 style="font-size:14px"><?= e($dbInfo['engine']) ?></h3></div></div>
      <div class="lte-info-box"><div><p>সংস্করণ</p><h3 style="font-size:14px"><?= e((string) $dbInfo['version']) ?></h3></div></div>
      <div class="lte-info-box"><div><p>সাইজ</p><h3><?= e((string) $dbInfo['size']) ?></h3></div></div>
      <div class="lte-info-box" style="grid-column:span 3"><div><p>অবস্থান / সংযোগ</p><h3 style="font-size:13px;word-break:break-all"><?= e((string) $dbInfo['location']) ?></h3></div></div>
    </div>
    <table class="lte-table mt">
      <thead><tr><th>টেবিল</th><th class="right">রো</th></tr></thead>
      <tbody>
      <?php
      $labels = ['users' => 'ইউজার (লগইন)', 'categories' => 'শ্রেণি', 'plans' => 'মাসিক প্ল্যান', 'tasks' => 'টুডু/কাজ', 'work_logs' => 'দৈনিক লগ'];
      foreach ($dbInfo['counts'] as $table => $count): ?>
        <tr><td class="mono"><?= e($table) ?> <span class="muted small">— <?= e($labels[$table] ?? '') ?></span></td>
          <td class="right strong"><?= (int) $count ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <div class="grid g2 tight mt">
      <a class="lte-btn lte-btn-outline" href="?p=setup"><?= icon('settings') ?>সেটআপ ও সংযোগ পরীক্ষা</a>
      <a class="lte-btn lte-btn-info" href="?p=sql-dump"><?= icon('download') ?>MySQL ডাম্প ডাউনলোড (ট্রান্সফার)</a>
    </div>
    <div class="lte-alert lte-alert-warning mt">
      <b>SQLite ব্যাকআপ:</b> <code>data/app.sqlite</code> ফাইলটি ডাউনলোড করে রাখলেই পুরো ডেটা সেভ থাকবে।
      MySQL-এ যাওয়ার সময় উপরের ডাম্পটি phpMyAdmin-এ ইমপোর্ট করুন।
    </div>
  </div>
</section>
<?php endif; ?>

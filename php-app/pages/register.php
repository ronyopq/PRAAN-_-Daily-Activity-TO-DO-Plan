<div class="lte-login-page">
  <div class="lte-login-box">
    <div class="lte-login-logo"><span class="brand-mark green">ক</span> <?= e((string) cfg('app_name', 'কাজের হিসাব')) ?>
      <small>নতুন অ্যাকাউন্ট • নিজের টুডু, প্ল্যান ও দিনের হিসাব</small>
    </div>
    <div class="card">
      <h2 class="auth-title">অ্যাকাউন্ট খুলুন</h2>
      <p class="auth-sub">প্রতি ইউজারের নিজস্ব কাজ, প্ল্যান ও রিমাইন্ডার থাকবে</p>
      <?php foreach (take_flashes() as $flash): ?>
        <div class="lte-alert lte-alert-<?= e($flash['tone']) ?>"><?= e($flash['text']) ?></div>
      <?php endforeach; ?>
      <form method="post" action="?p=register" class="stack">
        <?= csrf_field() ?>
        <label class="lte-label">নাম<input class="lte-form-control" name="name" required maxlength="80" placeholder="আপনার নাম"></label>
        <label class="lte-label">ইমেইল<input class="lte-form-control" type="email" name="email" required placeholder="you@example.com"></label>
        <div class="two-col">
          <label class="lte-label">পাসওয়ার্ড <small>(কমপক্ষে ৬ অক্ষর)</small><input class="lte-form-control" type="password" name="password" required minlength="6"></label>
          <label class="lte-label">আবার দিন<input class="lte-form-control" type="password" name="confirm" required minlength="6"></label>
        </div>
        <button class="lte-btn lte-btn-success lte-btn-block lg" type="submit">অ্যাকাউন্ট খুলুন</button>
      </form>
      <div class="auth-footer"><span>আগেই অ্যাকাউন্ট আছে?</span> <a href="?p=login">লগ ইন করুন</a></div>
    </div>
  </div>
</div>

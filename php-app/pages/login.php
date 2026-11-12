<?php $needsSetup = user_count() === 0; ?>
<div class="lte-login-page">
  <div class="lte-login-box">
    <div class="lte-login-logo"><span class="brand-mark">ক</span> <?= e((string) cfg('app_name', 'কাজের হিসাব')) ?>
      <small>টুডু লিস্ট • মাসিক ওয়ার্কপ্ল্যান • দৈনিক কাজের হিসাব</small>
    </div>
    <div class="card">
      <h2 class="auth-title">অ্যাকাউন্টে লগ ইন করুন</h2>
      <p class="auth-sub">অ্যাডমিন ও ইউজার — একই ফর্ম, নিজের ইমেইল ও পাসওয়ার্ড দিন</p>
      <?php foreach (take_flashes() as $flash): ?>
        <div class="lte-alert lte-alert-<?= e($flash['tone']) ?>"><?= e($flash['text']) ?></div>
      <?php endforeach; ?>
      <?php if ($needsSetup): ?>
        <div class="lte-alert lte-alert-info">এখনো কোনো অ্যাকাউন্ট নেই। <a href="?p=register">প্রথম অ্যাকাউন্টটি অ্যাডমিন হিসেবে খুলুন</a>।</div>
      <?php endif; ?>
      <form method="post" action="?p=login<?= get('next') !== '' ? '&next=' . urlencode(get('next')) : '' ?>" class="stack">
        <?= csrf_field() ?>
        <label class="lte-label">ইমেইল
          <input class="lte-form-control" type="email" name="email" required autocomplete="username" placeholder="you@example.com">
        </label>
        <label class="lte-label">পাসওয়ার্ড
          <input class="lte-form-control" type="password" name="password" required autocomplete="current-password" placeholder="••••••">
        </label>
        <button class="lte-btn lte-btn-primary lte-btn-block lg" type="submit">লগ ইন</button>
      </form>
      <div class="auth-footer"><span>অ্যাকাউন্ট নেই?</span> <a href="?p=register">নতুন অ্যাকাউন্ট খুলুন</a></div>
      <div class="auth-footer" style="border:0;margin-top:6px;padding-top:0;justify-content:center">
        <a href="?p=setup" style="font-size:12px;color:#6c757d">সিস্টেম / ডেটাবেস সেটআপ তথ্য</a>
      </div>
    </div>
    <p class="auth-note">প্রথম অ্যাকাউন্টটি অ্যাডমিন হয় — অ্যাডমিন ইউজার তৈরি, টিম প্রগ্রেস ও ডেটাবেস তথ্য দেখতে পারেন।<br>
      ডেটা সংরক্ষিত হচ্ছে: <b><?= db_driver() === 'sqlite' ? 'SQLite' : 'MySQL' ?></b></p>
  </div>
</div>

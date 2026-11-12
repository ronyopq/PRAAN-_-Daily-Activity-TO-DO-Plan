<?php
$day = today();
$users = all('SELECT * FROM users ORDER BY id');
$counts = [];
foreach (all("SELECT user_id, COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done FROM tasks GROUP BY user_id") as $row) {
    $counts[(int) $row['user_id']] = ['total' => (int) $row['total'], 'done' => (int) $row['done']];
}
$team = team_today_stats($day);
$editId = safe_int(get('edit'));
$editing = $editId > 0 ? one('SELECT * FROM users WHERE id = :id', ['id' => $editId]) : null;
$showForm = get('new') === '1' || $editing !== null;

$actions = '<a class="lte-btn lte-btn-primary" href="?p=users&new=1">' . icon('plus') . 'নতুন ইউজার</a>';
page_header('টিম ও ইউজার', 'মাল্টি-ইউজার স্পেস — প্রত্যেকের নিজস্ব টুডু, প্ল্যান, রিমাইন্ডার ও হিসাব', 'users', $actions);
?>
<div class="grid g4 mb">
  <?= small_box('primary', (string) count($users), 'মোট অ্যাকাউন্ট', count(array_filter($users, static fn ($u) => (int) $u['active'] === 1)) . ' টি সক্রিয়', 'users') ?>
  <?= small_box('dark', (string) count(array_filter($users, static fn ($u) => $u['role'] === 'admin')), 'অ্যাডমিন', 'সব ম্যানেজ করতে পারে', 'key') ?>
  <?= small_box('success', (string) array_sum(array_column($counts, 'done')), 'সব মিলিয়ে সম্পন্ন', 'মোট কাজের মধ্যে', 'check') ?>
  <?= small_box('warning', (string) array_sum(array_column($team, 'total')), 'আজকের মোট কাজ', $day, 'list') ?>
</div>

<?php if ($showForm): ?>
<section class="lte-card bg-primary">
  <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('users') ?> <?= $editing ? 'ইউজার সম্পাদনা' : 'নতুন ইউজার' ?></h2>
    <a href="?p=users">বন্ধ করুন</a></header>
  <div class="lte-card-body">
    <form method="post" action="?p=user.save" class="stack">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= (int) ($editing['id'] ?? 0) ?>">
      <div class="grid g2 tight">
        <label class="lte-label">নাম<input class="lte-form-control" name="name" required value="<?= e((string) ($editing['name'] ?? '')) ?>"></label>
        <label class="lte-label">ইমেইল<input class="lte-form-control" type="email" name="email" required value="<?= e((string) ($editing['email'] ?? '')) ?>"></label>
      </div>
      <div class="grid g3 tight">
        <label class="lte-label"><?= $editing ? 'নতুন পাসওয়ার্ড (ফাঁকা = অপরিবর্তিত)' : 'পাসওয়ার্ড' ?>
          <input class="lte-form-control" type="text" name="password" <?= $editing ? '' : 'required' ?> minlength="6"></label>
        <label class="lte-label">রোল
          <select class="lte-form-control" name="role">
            <option value="user" <?= ($editing['role'] ?? 'user') === 'user' ? 'selected' : '' ?>>মেম্বার</option>
            <option value="admin" <?= ($editing['role'] ?? '') === 'admin' ? 'selected' : '' ?>>অ্যাডমিন</option>
          </select></label>
        <div class="form-actions"><button class="lte-btn lte-btn-primary" type="submit"><?= icon('check') ?>সেভ করুন</button></div>
      </div>
    </form>
  </div>
</section>
<?php endif; ?>

<div class="grid g3">
  <section class="lte-card bg-dark x2">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('users') ?> ইউজার তালিকা</h2>
      <span class="lte-badge badge-secondary"><?= count($users) ?></span></header>
    <div class="table-wrap">
      <table class="lte-table">
        <thead><tr><th>ইউজার</th><th>রোল</th><th>অবস্থা</th><th>অগ্রগতি</th><th class="right">অ্যাকশন</th></tr></thead>
        <tbody>
        <?php foreach ($users as $u): $s = $counts[(int) $u['id']] ?? ['total' => 0, 'done' => 0]; $pct = $s['total'] ? (int) round(($s['done'] / $s['total']) * 100) : 0; ?>
          <tr class="<?= (int) $u['active'] === 1 ? '' : 'inactive' ?>">
            <td><div class="row-flex"><span class="avatar-sm" style="background:<?= e((string) $u['color']) ?>"><?= e(mb_strtoupper(mb_substr((string) $u['name'], 0, 1))) ?></span>
              <div><p class="strong"><?= e((string) $u['name']) ?></p><p class="muted small"><?= e((string) $u['email']) ?></p></div></div></td>
            <td><span class="lte-badge <?= $u['role'] === 'admin' ? 'badge-primary' : 'badge-secondary' ?>"><?= $u['role'] === 'admin' ? 'অ্যাডমিন' : 'মেম্বার' ?></span></td>
            <td><span class="lte-badge <?= (int) $u['active'] === 1 ? 'badge-success' : 'badge-danger' ?>"><?= (int) $u['active'] === 1 ? 'সক্রিয়' : 'বন্ধ' ?></span></td>
            <td><span class="small"><?= $s['done'] ?>/<?= $s['total'] ?></span>
              <div class="lte-progress"><div class="lte-progress-bar" style="width:<?= $pct ?>%"></div></div></td>
            <td><div class="row-actions">
              <a class="lte-btn lte-btn-outline lte-btn-sm" href="?p=users&edit=<?= (int) $u['id'] ?>">এডিট</a>
              <form method="post" action="?p=user.toggle" class="inline"><?= csrf_field() ?>
                <input type="hidden" name="id" value="<?= (int) $u['id'] ?>">
                <button class="lte-btn lte-btn-outline lte-btn-sm" type="submit"><?= (int) $u['active'] === 1 ? 'বন্ধ' : 'চালু' ?></button></form>
              <?php if ((int) $u['id'] !== (int) $user['id']): ?>
                <form method="post" action="?p=user.delete" class="inline" onsubmit="return confirm('এই ইউজারের সব কাজ, প্ল্যান ও লগ মুছে যাবে। নিশ্চিত?')"><?= csrf_field() ?>
                  <input type="hidden" name="id" value="<?= (int) $u['id'] ?>">
                  <button class="lte-btn lte-btn-outline lte-btn-sm danger" type="submit">মুছুন</button></form>
              <?php endif; ?>
            </div></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>

  <section class="lte-card bg-primary">
    <header class="lte-card-header"><h2 class="lte-card-title"><?= icon('chart') ?> আজকের টিম প্রগ্রেস</h2>
      <span class="lte-badge badge-soft-primary"><?= e($day) ?></span></header>
    <div class="lte-card-body">
      <?php foreach ($team as $t): $pct = $t['total'] ? (int) round(($t['done'] / $t['total']) * 100) : 0; ?>
        <div class="cat-row">
          <div class="cat-head"><span><i class="dot" style="background:<?= e($t['color']) ?>"></i><?= e($t['name']) ?></span>
            <span class="muted small"><?= $t['done'] ?>/<?= $t['total'] ?> • <?= e(fmt_mins($t['minutes'])) ?></span></div>
          <div class="lte-progress"><div class="lte-progress-bar" style="width:<?= $pct ?>%;background:<?= $t['total'] && $t['done'] === $t['total'] ? '#28a745' : '#007bff' ?>"></div></div>
        </div>
      <?php endforeach; ?>
      <div class="lte-alert lte-alert-info mt">টিম মেম্বাররা একে অপরের কাজ দেখতে পায় না — শুধু অ্যাডমিন এই সামারি দেখেন।</div>
    </div>
  </section>
</div>

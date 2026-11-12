# কাজের হিসাব — শুধু PHP (InfinityFree-রেডি)

টুডু লিস্ট + মাসিক ওয়ার্কপ্ল্যান + প্রতিদিনের কাজের হিসাব। **PHP 8.0+**, Composer/SSH/cron **লাগে না**।
একটি ফোল্ডার `htdocs`-এ আপলোড করলেই চলবে — প্রথমবার খুললেই **ইনস্টলার** আসবে।

> ⚠️ InfinityFree-এ ৫০০ এরর বা সাদা পেজ এলে নিচের **“সমস্যা হলে”** অংশটি দেখুন (মূল কারণ `.htaccess`-এ `Options` এবং `SQLite` এক্সটেনশন না থাকা — দুটোই এই ভার্সনে ঠিক করা)।

---

## ১. আপলোড (৩ ধাপ)

1. InfinityFree → **File Manager** (বা FTP) → `htdocs` → এই ফোল্ডারের **সব ফাইল** আপলোড করুন:
   `index.php`, `.htaccess` (hidden), `install.txt`, `config.sample.php`, `assets/`, `inc/`, `pages/`, `db/`, `data/`
   — (`.env`, `config.php`, `data/app.sqlite` আপলোড করবেন না)
2. `data/` ফোল্ডারের permission **755** (বা 775) রাখুন। `config.php` হাতে বানাতে হবে না — ইনস্টলার বানিয়ে দেবে।
3. ব্রাউজারে আপনার সাইট খুলুন (যেমন `https://yoursite.infinityfreeapp.com/`) → **ইনস্টলার** আসবে:
   - ড্রাইভার: **MySQL** বেছে নিন
   - InfinityFree Control Panel → **MySQL Databases** থেকে `host`, `database`, `username`, `password` বসান
   - আপনার নাম, ইমেইল, পাসওয়ার্ড দিয়ে **ইনস্টল করুন** → লগইন পেজে চলে যাবে

প্রথম যে অ্যাকাউন্ট তৈরি হবে সেটিই **অ্যাডমিন** (পরে `?p=users` থেকে বাকিদের খুলে দিতে পারবেন)।

---

## ২. ডেটাবেস: MySQL (InfinityFree) বা SQLite — একই কোড

ইনস্টলার নিজেই `config.php` লিখে দেয়। হাতে করতে চাইলে:

```php
'driver' => 'mysql',            // অথবা 'sqlite' / 'auto'
'mysql' => [
    'host' => 'sql104.infinityfree.com',
    'port' => 3306,
    'database' => 'if0_12345678_kajerhisab',
    'username' => 'if0_12345678',
    'password' => '••••••••',
    'charset' => 'utf8mb4',
],
```

- `'driver' => 'auto'` → হোস্টিং-এ `pdo_sqlite` থাকলে SQLite, না থাকলে MySQL (কনফিগ পূরণ থাকলে)।
- SQLite → MySQL ট্রান্সফার: অ্যাডমিন লগইন → `?p=sql-dump` → স্কিমা + INSERT সহ `.sql` → phpMyAdmin-এ ইমপোর্ট।
- সব SQL দুই ড্রাইভারেই চলে (`::int`, `ILIKE`, `ON CONFLICT`, `RETURNING`, `to_char` ব্যবহার করা হয়নি)।

---

## ৩. সমস্যা হলে (InfinityFree ট্রাবলশুটিং)

| লক্ষণ | কারণ / সমাধান |
|---|---|
| **500 Internal Server Error** পুরো সাইটে | `.htaccess`-এ `Options`/`php_value` থাকলে InfinityFree 500 দেয়। এই ভার্সনে সেগুলো **নেই** — পুরনো ফাইল থাকলে মুছে নতুন `.htaccess` আপলোড করুন। |
| **সাদা পেজ** | `config.php`-তে `'debug' => true` করুন, অথবা `data/php-errors.log` দেখুন। সাধারণত `data/` লেখার অনুমতি না থাকা। |
| “pdo_sqlite নেই” | InfinityFree-এ SQLite বন্ধ — ইনস্টলারে **MySQL** বেছে নিন। |
| অ্যাডমিন লগইন হচ্ছে না | পাসওয়ার্ড ৬+ অক্ষর, `data/` writable, সেশন কুকি ব্লক নয় কিনা দেখুন। HTTPS-এ কুকি `secure` হয়। |
| লগইন লুপ | ইনস্টল ঠিক থাকলে ব্রাউজার কুকি ক্লিয়ার করুন; SSL বন্ধ থাকলে `http://` দিয়ে খুলুন। |
| ফাইল আপলোড হলো না | `.htaccess` hidden ফাইল — File Manager-এ *Show hidden files* চালু করুন। |
| PHP সংস্করণ | Control Panel → *PHP Configuration* → **8.2** রাখুন। |

ডায়াগনস্টিক: `?p=setup` (PHP, PDO ড্রাইভার, পারমিশন, টেবিল-রো) — পাসওয়ার্ড ছাড়াই দেখায়।
ইনস্টলার আবার চালাতে: `?p=install` (বিদ্যমান ডেটা মুছে যায় না)।

---

## ৪. লোকাল টেস্ট

```bash
cp config.sample.php config.php
php -S 127.0.0.1:8080 router.php   # → http://127.0.0.1:8080  (ইনস্টলার আসবে)
```

## ৫. ফিচার

- মাল্টি-ইউজার (প্রথম = অ্যাডমিন), bcrypt, CSRF, httponly সেশন
- মাসিক ওয়ার্কপ্ল্যান → এক ক্লিকে পুরো মাসের টুডু (ডুপ্লিকেট-সেফ)
- টুডু লিস্ট: ভিউ/ফিল্টার/সার্চ/বাল্ক/CSV
- রিমাইন্ডার সেন্টার: ওভারডিউ, আজ, আসন্ন ১৪ দিন, প্ল্যান বাদ পড়া
- দৈনিক হিসাব: নোট+সময়, অটো-লগ, বাকি কাজ কালকে
- মাসিক রিপোর্ট: চার্ট, শ্রেণি, CSV; অ্যাডমিন: ইউজার ও টিম প্রগ্রেস
- ডেটাবেস প্যানেল: ড্রাইভার/সংযোগ/সাইজ + MySQL ডাম্প

## ৬. ফাইল

```
index.php  .htaccess  router.php  install.txt  config.sample.php
inc/ db.php bootstrap.php queries.php auth.php ui.php layout.php actions.php
pages/ dashboard plans tasks reminders log reports users settings login register install setup 403 404
db/ schema.sqlite.sql schema.mysql.sql
data/ (.gitkeep, .htaccess — SQLite ফাইল এখানে, ওয়েব থেকে বন্ধ)
assets/ app.css app.js
```

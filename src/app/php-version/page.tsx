import Link from "next/link";

export const metadata = {
  title: "PHP সংস্করণ (InfinityFree-রেডি) — কাজের হিসাব",
  description: "SQLite ডিফল্ট, পরে MySQL-এ ট্রান্সফারযোগ্য — InfinityFree-তে চলার মতো সম্পূর্ণ PHP অ্যাপ",
};

const FEATURES = [
  ["মাল্টি-ইউজার লগইন", "রেজিস্ট্রেশন/লগইন, প্রথম অ্যাকাউন্ট অ্যাডমিন, bcrypt, CSRF, httponly সেশন"],
  ["মাসিক ওয়ার্কপ্ল্যান", "প্রতিদিন / সাপ্তাহিক / মাসের তারিখ — এক ক্লিকে পুরো মাসের টুডু"],
  ["টুডু লিস্ট", "ভিউ, ফিল্টার, সার্চ, বাল্ক অ্যাকশন, CSV এক্সপোর্ট"],
  ["রিমাইন্ডার সেন্টার", "ওভারডিউ, আজকের ডিউ, আসন্ন ১৪ দিন, প্ল্যান বাদ পড়া কাজ"],
  ["দৈনিক হিসাব", "নোট + সময়, সম্পন্ন করলে অটো-লগ, বাকি কাজ কালকে ঠেলে দেওয়া"],
  ["মাসিক রিপোর্ট", "দিনভিত্তিক চার্ট, শ্রেণিভিত্তিক অগ্রগতি, লগ এন্ট্রি"],
  ["অ্যাডমিন প্যানেল", "ইউজার তৈরি/বন্ধ/মুছুন, টিম প্রগ্রেস, ডেটাবেস তথ্য"],
  ["ডেটা পোর্টেবল", "এখন SQLite; একই কোডে MySQL — `?p=sql-dump` দিয়ে ট্রান্সফার"],
];

const STEPS = [
  ["htdocs-এ আপলোড", "প্যাকেজের ভেতরের সব ফাইল (লুকানো .htaccess ও install.txt সহ) InfinityFree File Manager দিয়ে htdocs-এ তুলুন"],
  ["সাইট খুলুন", "ব্রাউজারে আপনার ডোমেইন খুলুন — ইনস্টলার নিজে থেকেই আসবে (কোনো config.php হাতে বানাতে হবে না)"],
  ["MySQL দিন", "Control Panel → MySQL Databases থেকে host / database / username / password বসিয়ে ড্রাইভার MySQL বেছে নিন"],
  ["অ্যাডমিন তৈরি", "নাম, ইমেইল, পাসওয়ার্ড দিয়ে ইনস্টল করুন → লগইন → প্ল্যান বানিয়ে “কাজ তৈরি”"],
];

const FIXES = [
  "`.htaccess`-এ `Options -Indexes` InfinityFree-এ ৫০০ এরর দেয় → সরিয়ে দেওয়া হয়েছে (শুধু DirectoryIndex + IfModule rewrite)",
  "InfinityFree-এ `pdo_sqlite` সাধারণত বন্ধ → ড্রাইভার `auto`: SQLite না থাকলে MySQL, আর SQLite থাকলে ফাইল-ডেটাবেস",
  "প্রথমবার `config.php`/টেবিল না থাকলে অ্যাপ নিজেই ইনস্টলার দেখায় — সাদা পেজ/ফ্যাটাল এরর নয়",
  "ইনস্টলার config.php লিখে দেয়; লেখা না গেলে স্ক্রিনে কোড দেখায় (কপি-পেস্ট)",
  "`mbstring` না থাকলে ফলব্যাক, `ini_set`/`setlocale` guarded, HTTPS প্রপার ডিটেকশন (লগইন লুপ এড়াতে)",
  "SQLite ফোল্ডার read-only হলে temp ডিরেক্টরিতে ফলব্যাক; টাস্ক জেনারেশন ডুপ্লিকেট-সেফ",
];

const FILES = [
  ["index.php", "ফ্রন্ট কন্ট্রোলার (?p=... রাউটিং ও অ্যাকশন)"],
  [".htaccess / router.php", "Apache রিরাইট (InfinityFree) ও লোকাল সার্ভার রাউটার"],
  ["config.sample.php", "driver = auto | mysql | sqlite — ইনস্টলার নিজেই config.php বানায়"],
  ["inc/db.php", "PDO (SQLite/MySQL), auto-install, কুয়েরি হেল্পার"],
  ["inc/queries.php", "সব ডেটা কুয়েরি — দুই ড্রাইভারেই চলে"],
  ["inc/bootstrap.php", "session, বাংলা তারিখ/লেবেল হেল্পার"],
  ["inc/auth.php · inc/actions.php", "লগইন/রোল গার্ড · সব POST, CSV ও MySQL ডাম্প"],
  ["inc/ui.php · inc/layout.php", "AdminLTE ধাঁচের UI ও লেআউট"],
  ["pages/*.php", "dashboard, plans, tasks, reminders, log, reports, users, settings, install, setup"],
  ["db/schema.sqlite.sql", "SQLite টেবিল (auto-apply)"],
  ["db/schema.mysql.sql", "MySQL/MariaDB টেবিল (auto-apply / phpMyAdmin)"],
  ["data/.htaccess", "SQLite ফাইল ওয়েব থেকে বন্ধ"],
];

export default function PhpVersionPage() {
  return (
    <div className="lte-root" style={{ padding: "28px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="lte-card bg-primary">
          <div className="lte-card-body" style={{ padding: 24 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#007bff" }}>
              শুধু PHP · InfinityFree-এ পরীক্ষিত ফিক্স · ১ ক্লিক ইনস্টলার
            </p>
            <h1 style={{ fontSize: 28, margin: "6px 0 8px" }}>কাজের হিসাব — PHP সংস্করণ</h1>
            <p style={{ margin: 0, color: "#6c757d", fontSize: 14.5, maxWidth: 800 }}>
              InfinityFree-এর জন্য নতুন করে ঠিক করা হয়েছে: <b>.htaccess থেকে <code>Options</code> সরানো</b> (এটাই ৫০০ এররের কারণ ছিল),
              <b> pdo_sqlite না থাকলেও MySQL-এ চলবে</b>, আর প্রথমবার সাইট খুললেই <b>ইনস্টলার</b> — কোড এডিট করা লাগে না।
              ডেটা MySQL-এ (InfinityFree) অথবা SQLite ফাইলে — একই কোড।
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <a className="lte-btn lte-btn-success" href="/php-version.tar.gz" download>
                ⬇ PHP সোর্স ডাউনলোড (.tar.gz)
              </a>
              <Link className="lte-btn lte-btn-outline" href="/login">
                Next.js অ্যাপে লগইন
              </Link>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
          <section className="lte-card bg-success">
            <header className="lte-card-header">
              <h2 className="lte-card-title">InfinityFree-এ ৪ ধাপ (ইনস্টলারসহ)</h2>
            </header>
            <div className="lte-card-body">
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.85, color: "#495057" }}>
                {STEPS.map(([title, text]) => (
                  <li key={title} style={{ marginBottom: 6 }}>
                    <b>{title}</b> — <span style={{ color: "#6c757d" }}>{text}</span>
                  </li>
                ))}
              </ol>
              <div className="lte-alert lte-alert-info" style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5 }}>
                লুকানো ফাইল <code>.htaccess</code> আপলোড করতে ভুলবেন না (File Manager-এ hidden files দেখান)। cron নেই বলে দিনে প্রথমবার ড্যাশবোর্ড খোলার সময় আজকের কাজ তৈরি হয়ে যায়।
              </div>
            </div>
          </section>

          <section className="lte-card bg-dark">
            <header className="lte-card-header">
              <h2 className="lte-card-title">SQLite → MySQL ট্রান্সফার</h2>
            </header>
            <div className="lte-card-body" style={{ fontSize: 13.5, lineHeight: 1.8, color: "#495057" }}>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  <code>config.php</code> → <code>&apos;driver&apos; =&gt; &apos;mysql&apos;</code> এবং InfinityFree-এর
                  MySQL host/db/user/password দিন
                </li>
                <li>
                  <code>?p=setup</code> খুলুন — <code>db/schema.mysql.sql</code> থেকে টেবিল নিজেই তৈরি হবে
                </li>
                <li>
                  পুরনো ডেটা: SQLite মোডে অ্যাডমিন হিসেবে <code>?p=sql-dump</code> → স্কিমা + INSERT সহ `.sql` →
                  phpMyAdmin-এ ইমপোর্ট
                </li>
                <li>
                  আবার <code>?p=setup</code> — টেবিলের রো কাউন্ট মিলিয়ে নিন
                </li>
              </ol>
              <div className="lte-alert lte-alert-warning" style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5 }}>
                কোডে কোনো Postgres-নির্ভর SQL নেই (<code>::int</code>, <code>ILIKE</code>, <code>ON CONFLICT</code>,
                <code>RETURNING</code> বাদ) — তাই ড্রাইভার বদলালে পেজ বদলাতে হয় না।
              </div>
            </div>
          </section>
        </div>

        <section className="lte-card bg-info" style={{ marginTop: 16 }}>
          <header className="lte-card-header">
            <h2 className="lte-card-title">ফিচার</h2>
            <span className="lte-badge badge-soft-info">MySQL ও SQLite — দুই মোডে + ফ্রেশ আপলোডে পরীক্ষিত</span>
          </header>
          <div className="lte-card-body">
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
              {FEATURES.map(([title, text]) => (
                <div key={title} className="lte-info-box">
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#343a40" }}>{title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6c757d" }}>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lte-card bg-danger" style={{ marginTop: 16 }}>
          <header className="lte-card-header">
            <h2 className="lte-card-title">InfinityFree-এ যা ঠিক করা হয়েছে</h2>
          </header>
          <div className="lte-card-body">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9, color: "#495057" }}>
              {FIXES.map((f) => (
                <li key={f} style={{ marginBottom: 4 }}>{f}</li>
              ))}
            </ul>
            <div className="lte-alert lte-alert-warning" style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5 }}>
              আপলোডের পরও সমস্যা হলে <code>?p=install</code> (ইনস্টলার) অথবা <code>?p=setup</code> (ডায়াগনস্টিক: PHP, PDO ড্রাইভার,
              পারমিশন, টেবিল-রো) খুলুন। বিস্তারিত ট্রাবলশুটিং টেবিল <code>README.md</code>-তে আছে।
            </div>
          </div>
        </section>

        <section className="lte-card bg-dark" style={{ marginTop: 16 }}>
          <header className="lte-card-header">
            <h2 className="lte-card-title">ফাইল কাঠামো</h2>
          </header>
          <div className="lte-card-body" style={{ padding: 0 }}>
            <table className="lte-table">
              <tbody>
                {FILES.map(([file, desc]) => (
                  <tr key={file}>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, whiteSpace: "nowrap" }}>{file}</td>
                    <td style={{ fontSize: 12.5, color: "#6c757d" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lte-card bg-warning" style={{ marginTop: 16 }}>
          <div className="lte-card-body" style={{ fontSize: 13, color: "#856404" }}>
            <b>প্রিভিউ নোট:</b> এই প্রিভিউ সার্ভার Next.js চালায়, তাই এখানে PHP রান করে না। PHP ফাইলগুলো উপরের
            ডাউনলোড থেকে নিয়ে যেকোনো PHP হোস্টিং (InfinityFree / Apache / nginx / cPanel) বা লোকাল{" "}
            <code>php -S 127.0.0.1:8080 router.php</code>-এ চালান। Next.js ভার্সনটি আলাদা করে PostgreSQL-এ চলছে।
          </div>
        </section>
      </div>
    </div>
  );
}

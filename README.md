# PRAAN — Daily Activity & To-Do Plan

টুডু লিস্ট, মাসিক ওয়ার্কপ্ল্যান, রিমাইন্ডার ও দৈনিক কাজের হিসাব — বাংলা ইন্টারফেস,
মাল্টি-ইউজার লগইন, Next.js + PostgreSQL (Supabase)।

## চালু করা

```bash
npm install
cp .env.example .env      # তারপর DATABASE_URL বসান
npm run dev
```

`http://localhost:3000` খুলুন। প্রথম যে অ্যাকাউন্ট তৈরি হবে সেটিই অ্যাডমিন।

## ডেটাবেস

- সব টেবিল আলাদা স্কিমায় থাকে — ডিফল্ট `praantodo` (`DB_SCHEMA` দিয়ে বদলানো যায়)।
  এতে Supabase প্রজেক্টের `public` স্কিমার অন্য অ্যাপের `users` টেবিলের সাথে সংঘর্ষ হয় না।
- **অ্যাপ নিজেই টেবিল তৈরি করে** — প্রথম রিকোয়েস্টে `src/db/bootstrap.ts` idempotent DDL চালায়।
  `npm run db:push` বা হাতে SQL চালানো বাধ্যতামূলক নয়।
- ডেটাবেস ইউজার নিজে স্কিমা/টেবিল বানাতে না পারলে `drizzle/0000_init.sql` Supabase SQL
  editor-এ চালান, তারপর `grant` লাইনগুলোও চালান।
- স্বাস্থ্য যাচাই: `GET /api/health` — কানেকশন ও স্কিমা দুটোই জানায়, সমস্যা হলে বাংলায় কারণ বলে।

```
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
```

## স্ক্রিপ্ট

| কমান্ড | কাজ |
| --- | --- |
| `npm run dev` | ডেভ সার্ভার |
| `npm run build` / `npm start` | প্রোডাকশন বিল্ড / রান |
| `npm run typecheck` | TypeScript যাচাই |
| `npm run lint` | ESLint |
| `npm run db:push` | Drizzle দিয়ে স্কিমা সিঙ্ক (ঐচ্ছিক) |

## PHP সংস্করণ

`php-app/` ফোল্ডারে InfinityFree-রেডি PHP + SQLite/MySQL সংস্করণ আছে (আলাদা অ্যাপ,
আলাদা ডেটাবেস)। বিস্তারিত `php-app/README.md`-এ।

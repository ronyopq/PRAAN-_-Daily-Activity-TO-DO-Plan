import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./adminlte.css";

export const metadata: Metadata = {
  title: "কাজের হিসাব — টুডু, মাসিক প্ল্যান ও দৈনিক ওয়ার্ক লগ",
  description:
    "মাসিক ওয়ার্কপ্ল্যান সেট করুন, প্রতিদিন রিমাইন্ডার পান এবং যা করেছেন তার হিসাব রাখুন — মাল্টি-ইউজার টিম স্পেস।",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#343a40",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="lte-root" style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      <div className="lte-card" style={{ maxWidth: 520, width: "100%", borderTopColor: "#007bff" }}>
        <div className="lte-card-body" style={{ padding: 28, textAlign: "center" }}>
          <p style={{ fontSize: 44, fontWeight: 700, margin: 0, color: "#007bff" }}>404</p>
          <h1 style={{ fontSize: 20, margin: "8px 0 6px" }}>পেজটি খুঁজে পাওয়া যায়নি</h1>
          <p style={{ color: "#6c757d", fontSize: 14, marginBottom: 18 }}>
            আপনি যে ঠিকানায় এসেছেন সেটি নেই অথবা সরিয়ে ফেলা হয়েছে।
          </p>
          <Link href="/dashboard" className="lte-btn lte-btn-primary">
            ড্যাশবোর্ডে ফিরে যান
          </Link>
        </div>
      </div>
    </div>
  );
}

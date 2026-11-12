"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="lte-root" style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      <div className="lte-card" style={{ maxWidth: 560, width: "100%", borderTopColor: "#dc3545" }}>
        <div className="lte-card-body" style={{ padding: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 6px", color: "#dc3545" }}>কিছু একটা ভুল হয়েছে</h1>
          <p style={{ color: "#6c757d", fontSize: 14, marginBottom: 16 }}>
            পেজটি লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন — সমস্যা থাকলে লগআউট করে নতুন করে ঢুকুন।
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="lte-btn lte-btn-primary" onClick={reset}>
              আবার চেষ্টা করুন
            </button>
            <a className="lte-btn lte-btn-outline" href="/login">
              লগইন পেজ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

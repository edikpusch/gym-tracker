"use client";
import Link from "next/link";
export default function WorkoutSummaryPage() {
  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>🏁</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--c-text)", marginBottom: 8, textAlign: "center" }}>Workout abgeschlossen!</h1>
      <p style={{ color: "var(--c-text-3)", marginBottom: 32, textAlign: "center" }}>Gute Arbeit. Alle Sätze wurden gespeichert.</p>
      <Link href="/" style={{ padding: "14px 32px", background: "var(--c-accent)", borderRadius: 14, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
        Zurück zur Startseite
      </Link>
    </div>
  );
}

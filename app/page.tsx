"use client";

export default function Home() {
  return (
    <div style={screen}>
      <main style={shell}>
        <div style={topBar}>
          <div style={brandPill}>Gym Tracker</div>
          <a href="/history/index.html" style={historyLink}>
            Verlauf
          </a>
        </div>

        <div style={buttonGrid}>
          <a href="/workout/push/index.html" style={{ ...workoutCard, ...pushCard }}>
            <span style={buttonKicker}>Montag</span>
            <span style={buttonTitle}>PUSH</span>
            <span style={buttonCopy}>Bankdruecken, Klimmzuege breit, Dips</span>
          </a>

          <a href="/workout/pull/index.html" style={{ ...workoutCard, ...pullCard }}>
            <span style={buttonKicker}>Mittwoch</span>
            <span style={buttonTitle}>PULL</span>
            <span style={buttonCopy}>Rudern, Push-ups, Face Pulls</span>
          </a>

          <a href="/workout/legs/index.html" style={{ ...workoutCard, ...legsCard }}>
            <span style={buttonKicker}>Freitag</span>
            <span style={buttonTitle}>MIXED</span>
            <span style={buttonCopy}>Kniebeugen, Klimmzuege, Core</span>
          </a>
        </div>
      </main>
    </div>
  );
}

const screen = {
  minHeight: "100dvh",
  padding: "10px",
  background:
    "radial-gradient(circle at top, #dde6f5 0%, #f3f5f9 42%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
};

const shell = {
  maxWidth: 460,
  minHeight: "calc(100dvh - 20px)",
  margin: "0 auto",
  padding: "14px",
  borderRadius: 28,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 38,
  padding: "8px 14px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 14,
  fontWeight: "bold",
};

const historyLink = {
  textDecoration: "none",
  color: "#2563eb",
  fontWeight: "bold",
  fontSize: 16,
};

const buttonGrid = {
  display: "grid",
  gridTemplateRows: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  flex: 1,
  minHeight: 0,
};

const workoutCard = {
  borderRadius: 28,
  color: "#fff",
  textDecoration: "none",
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  minHeight: 0,
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.14)",
};

const pushCard = {
  background: "linear-gradient(135deg, #ef4444 0%, #c62828 100%)",
};

const pullCard = {
  background: "linear-gradient(135deg, #2563eb 0%, #1452b8 100%)",
};

const legsCard = {
  background: "linear-gradient(135deg, #16a34a 0%, #1f6b31 100%)",
};

const buttonKicker = {
  fontSize: 12,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  opacity: 0.78,
};

const buttonTitle = {
  fontSize: 36,
  lineHeight: 1,
  fontWeight: "bold",
};

const buttonCopy = {
  fontSize: 14,
  lineHeight: 1.3,
  fontWeight: 600,
  opacity: 0.92,
};

"use client";

const workoutDays = [
  {
    href: "/workout/push/index.html",
    label: "Push",
    title: "Montag",
    copy: "Brust, Schultern, Trizeps, Core",
    gradient: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
  },
  {
    href: "/workout/pull/index.html",
    label: "Pull",
    title: "Mittwoch",
    copy: "Rücken, Bizeps, Core",
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)",
  },
  {
    href: "/workout/legs/index.html",
    label: "Legs",
    title: "Freitag",
    copy: "Beine, Waden, Core",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
  },
];

export default function WorkoutPage() {
  return (
    <main style={screen}>
      <div style={shell}>
        <div style={topBar}>
          <div style={brandPill}>Gym Tracker</div>
          <a href="/index.html" style={backButton}>
            ← Zurück
          </a>
        </div>

        <div style={hero}>
          <div style={eyebrow}>Workout</div>
          <h1 style={title}>Training starten</h1>
          <p style={heroCopy}>
            Wähle den passenden Trainingstag und spring direkt in dein aktives Workout.
          </p>
        </div>

        <div style={cardList}>
          {workoutDays.map((day) => (
            <a
              key={day.href}
              href={day.href}
              style={{
                ...dayCard,
                background: day.gradient,
              }}
            >
              <div style={dayBadge}>{day.label}</div>
              <div style={dayTitle}>{day.title}</div>
              <div style={dayCopy}>{day.copy}</div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

const screen = {
  minHeight: "100%",
  padding: "10px 10px 28px",
  background: "radial-gradient(circle at top, #dde6f5 0%, #f3f5f9 42%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
  boxSizing: "border-box" as const,
};

const shell = {
  maxWidth: 460,
  margin: "0 auto",
  padding: 12,
  borderRadius: 28,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 13,
  fontWeight: "bold",
};

const backButton = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f1f5f9",
  color: "#374151",
  fontSize: 12,
  fontWeight: "bold",
  textDecoration: "none",
};

const hero = {
  padding: "14px 16px",
  borderRadius: 24,
  background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
  color: "#fff",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.18)",
  marginBottom: 12,
};

const eyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: "rgba(255,255,255,0.6)",
  fontWeight: "bold",
};

const title = {
  margin: "6px 0 8px",
  fontSize: 28,
  fontWeight: "bold",
  color: "#fff",
};

const heroCopy = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.82)",
};

const cardList = {
  display: "grid",
  gap: 12,
};

const dayCard = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  minHeight: 132,
  padding: "14px 14px 16px",
  borderRadius: 24,
  textDecoration: "none",
  color: "#fff",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.14)",
};

const dayBadge = {
  display: "inline-flex",
  alignSelf: "flex-start" as const,
  minHeight: 24,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.16)",
  fontSize: 11,
  fontWeight: "bold",
  letterSpacing: 0.8,
  textTransform: "uppercase" as const,
};

const dayTitle = {
  marginTop: 28,
  fontSize: 28,
  lineHeight: 1,
  fontWeight: "bold",
};

const dayCopy = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.92)",
};

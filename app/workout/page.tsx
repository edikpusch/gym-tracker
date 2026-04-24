export default function WorkoutPage() {
  return (
    <div
      style={{
        padding: 20,
        fontFamily: "sans-serif",
        maxWidth: 500,
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: 30 }}>Workout starten</h1>

      <a href="/workout/push/index.html" style={card}>
        <h2 style={{ margin: 0 }}>Montag (Push)</h2>
        <p style={copy}>Brust / Schultern / Trizeps / Core</p>
      </a>

      <a href="/workout/pull/index.html" style={card}>
        <h2 style={{ margin: 0 }}>Mittwoch (Pull)</h2>
        <p style={copy}>Ruecken / Bizeps / Core</p>
      </a>

      <a href="/workout/legs/index.html" style={card}>
        <h2 style={{ margin: 0 }}>Freitag (Legs)</h2>
        <p style={copy}>Beine / Waden / Core</p>
      </a>
    </div>
  );
}

const card = {
  padding: 20,
  marginBottom: 15,
  border: "2px solid #ddd",
  borderRadius: 10,
  cursor: "pointer",
  background: "#fafafa",
  display: "block",
  textDecoration: "none",
  color: "inherit",
};

const copy = {
  margin: 0,
  color: "#666",
};

"use client";

type Props = {
  secondsLeft: number;
  totalSeconds: number;
  progress: number;
  isLogging: boolean;
  pendingWeight: number;
  pendingReps: number;
  pendingSetType: "warmup" | "workset";
  onWeightChange: (w: number) => void;
  onRepsChange: (r: number) => void;
  onSkip: () => void;
  onLogDone: () => void;
};

const RADIUS = 44;
const CIRC = 2 * Math.PI * RADIUS;

export function RestOverlay({
  secondsLeft,
  totalSeconds,
  progress,
  isLogging,
  pendingWeight,
  pendingReps,
  pendingSetType,
  onWeightChange,
  onRepsChange,
  onSkip,
  onLogDone,
}: Props) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = Math.floor(secondsLeft % 60);
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}`;
  const dash = CIRC * (1 - progress);

  return (
    <div style={{
      position: "fixed",
      bottom: "calc(var(--c-tab-height) + var(--safe-area-bottom))",
      left: 0,
      right: 0,
      background: "var(--c-surface)",
      borderTop: "1px solid var(--c-border)",
      borderRadius: "20px 20px 0 0",
      padding: "20px 20px 24px",
      zIndex: 40,
      animation: "slide-up 0.25s ease",
    }}>
      {/* Timer row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--c-surface-3)" strokeWidth={6} />
            <circle
              cx="50" cy="50" r={RADIUS}
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth={6}
              strokeDasharray={CIRC}
              strokeDashoffset={dash}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>
            <span style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 500 }}>PAUSE</span>
          </div>
        </div>

        {/* Log-while-resting section */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
            {pendingSetType === "warmup" ? "Aufwärmsatz" : "Arbeitssatz"} eintragen
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <p style={{ fontSize: 10, color: "var(--c-text-3)", marginBottom: 4, textAlign: "center" }}>KG</p>
              <div style={{ display: "flex", alignItems: "center", background: "var(--c-surface-2)", borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => onWeightChange(Math.max(0, pendingWeight - 2.5))} style={{ padding: "8px 10px", color: "var(--c-text-2)", fontSize: 18, fontWeight: 300 }}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                  {pendingWeight % 1 === 0 ? pendingWeight : pendingWeight.toFixed(1)}
                </span>
                <button onClick={() => onWeightChange(pendingWeight + 2.5)} style={{ padding: "8px 10px", color: "var(--c-text-2)", fontSize: 18, fontWeight: 300 }}>+</button>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "var(--c-text-3)", marginBottom: 4, textAlign: "center" }}>WDH</p>
              <div style={{ display: "flex", alignItems: "center", background: "var(--c-surface-2)", borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => onRepsChange(Math.max(1, pendingReps - 1))} style={{ padding: "8px 10px", color: "var(--c-text-2)", fontSize: 18, fontWeight: 300 }}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                  {pendingReps}
                </span>
                <button onClick={() => onRepsChange(pendingReps + 1)} style={{ padding: "8px 10px", color: "var(--c-text-2)", fontSize: 18, fontWeight: 300 }}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSkip}
          style={{
            flex: 1,
            padding: "12px 0",
            borderRadius: 12,
            border: "1px solid var(--c-border-strong)",
            background: "transparent",
            color: "var(--c-text-2)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Überspringen
        </button>
        <button
          onClick={onLogDone}
          style={{
            flex: 2,
            padding: "12px 0",
            borderRadius: 12,
            border: "none",
            background: "var(--c-accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          ✓ Satz gespeichert
        </button>
      </div>
    </div>
  );
}

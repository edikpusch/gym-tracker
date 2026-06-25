"use client";

import { useEffect, useState } from "react";

type WorkoutTab = "focus" | "list";

type Props = {
  dayName: string;
  exerciseIndex: number;
  totalExercises: number;
  startedAt: number;
  tab: WorkoutTab;
  onTabChange: (tab: WorkoutTab) => void;
  onFinish: () => void;
};

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function WorkoutHeader({ dayName, exerciseIndex, totalExercises, startedAt, tab, onTabChange, onFinish }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const progress = totalExercises > 0 ? exerciseIndex / totalExercises : 0;

  return (
    <div style={{
      paddingTop: "calc(12px + var(--safe-area-top))",
      paddingLeft: "calc(16px + var(--safe-area-left))",
      paddingRight: "calc(16px + var(--safe-area-right))",
      paddingBottom: 0,
      background: "var(--c-bg)",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--c-accent)", fontWeight: 600, marginBottom: 1, textTransform: "uppercase", letterSpacing: 0.8 }}>
            {dayName} · Läuft
          </p>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
            Übung {exerciseIndex + 1} / {totalExercises} · {formatElapsed(elapsed)}
          </p>
        </div>
        <button
          onClick={onFinish}
          style={{
            padding: "7px 14px",
            borderRadius: 20,
            border: "1px solid var(--c-border-strong)",
            background: "var(--c-surface)",
            color: "var(--c-text-2)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Beenden
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--c-surface-2)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.max(progress * 100, 3)}%`,
          background: "var(--c-accent)",
          borderRadius: 2,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--c-surface)", borderRadius: 10, padding: 3, marginBottom: 16 }}>
        {(["focus", "list"] as WorkoutTab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: 8,
              background: tab === t ? "var(--c-surface-3)" : "transparent",
              color: tab === t ? "var(--c-text)" : "var(--c-text-3)",
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {t === "focus" ? "Aktuell" : "Alle Übungen"}
          </button>
        ))}
      </div>
    </div>
  );
}

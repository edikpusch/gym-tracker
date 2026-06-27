"use client";

import type { SetEntry } from "@/lib/db";

type LastLoggedSet = {
  exerciseName: string;
  setLabel: string;
  weight: number;
  reps: number;
};

type Props = {
  secondsLeft: number;
  totalSeconds: number;
  progress: number;
  lastLoggedSet: LastLoggedSet | null;
  lastSessionSets: SetEntry[];
  nextWorkSetIndex: number;
  pendingWeight: number;
  pendingReps: number;
  onWeightChange: (w: number) => void;
  onRepsChange: (r: number) => void;
  onSkip: () => void;
};

const RADIUS = 52;
const CIRC = 2 * Math.PI * RADIUS;

function weightStep(w: number): number {
  return w >= 80 ? 5 : w >= 20 ? 2.5 : w >= 5 ? 1 : 0.5;
}

export function RestOverlay({
  secondsLeft,
  totalSeconds,
  progress,
  lastLoggedSet,
  lastSessionSets,
  nextWorkSetIndex,
  pendingWeight,
  pendingReps,
  onWeightChange,
  onRepsChange,
  onSkip,
}: Props) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = Math.floor(secondsLeft % 60);
  const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;
  const dash = CIRC * (1 - progress);
  const step = weightStep(pendingWeight);
  const nextRef = lastSessionSets[nextWorkSetIndex] ?? null;

  return (
    <div style={{
      position: "fixed",
      bottom: "calc(var(--c-tab-height) + var(--safe-area-bottom))",
      left: 0,
      right: 0,
      background: "var(--c-surface)",
      borderTop: "1px solid var(--c-border-strong)",
      borderRadius: "24px 24px 0 0",
      padding: "20px 20px 28px",
      zIndex: 40,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>

      {/* Confirmation */}
      {lastLoggedSet && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--c-success-dim)",
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: 12,
          padding: "10px 14px",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-success)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-success)" }}>
              {lastLoggedSet.setLabel} gespeichert
            </p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
              {lastLoggedSet.exerciseName} · {lastLoggedSet.weight} kg × {lastLoggedSet.reps}
            </p>
          </div>
        </div>
      )}

      {/* Timer + Next set row */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>

        {/* Timer */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width={120} height={120} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--c-surface-3)" strokeWidth={7} />
            <circle
              cx="60" cy="60" r={RADIUS}
              fill="none"
              stroke={secondsLeft <= 10 ? "var(--c-warning)" : "var(--c-accent)"}
              strokeWidth={7}
              strokeDasharray={CIRC}
              strokeDashoffset={dash}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{timeStr}</span>
            <span style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 600, letterSpacing: 0.8, marginTop: 2 }}>PAUSE</span>
          </div>
        </div>

        {/* Next set inputs */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: 0.7 }}>
              Nächster Satz
            </p>
            {nextRef && (
              <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                · letztes Mal{" "}
                <span style={{ fontWeight: 700, color: "var(--c-text-2)" }}>
                  {nextRef.weight} kg × {nextRef.reps}
                </span>
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* KG */}
            <div style={{ display: "flex", alignItems: "center", background: "var(--c-surface-2)", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => onWeightChange(Math.max(0, +(pendingWeight - step).toFixed(2)))}
                style={{ padding: "10px 14px", color: "var(--c-text-2)", fontSize: 20, fontWeight: 300, lineHeight: 1 }}
              >−</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                {pendingWeight % 1 === 0 ? pendingWeight : pendingWeight.toFixed(1)} <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 400 }}>kg</span>
              </span>
              <button
                onClick={() => onWeightChange(+(pendingWeight + step).toFixed(2))}
                style={{ padding: "10px 14px", color: "var(--c-text-2)", fontSize: 20, fontWeight: 300, lineHeight: 1 }}
              >+</button>
            </div>
            {/* WDH */}
            <div style={{ display: "flex", alignItems: "center", background: "var(--c-surface-2)", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => onRepsChange(Math.max(1, pendingReps - 1))}
                style={{ padding: "10px 14px", color: "var(--c-text-2)", fontSize: 20, fontWeight: 300, lineHeight: 1 }}
              >−</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 700, color: "var(--c-text)", fontVariantNumeric: "tabular-nums" }}>
                {pendingReps} <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 400 }}>Wdh</span>
              </span>
              <button
                onClick={() => onRepsChange(pendingReps + 1)}
                style={{ padding: "10px 14px", color: "var(--c-text-2)", fontSize: 20, fontWeight: 300, lineHeight: 1 }}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        style={{
          width: "100%",
          padding: "14px 0",
          borderRadius: 14,
          border: "1px solid var(--c-border-strong)",
          background: "transparent",
          color: "var(--c-text-2)",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        Weiter →
      </button>
    </div>
  );
}

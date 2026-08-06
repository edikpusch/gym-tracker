"use client";

import { useRef } from "react";
import type { TrainingPlanBlock } from "@/lib/trainingModel";
import type { SetEntry } from "@/lib/db";

function weightStep(w: number): number {
  return w >= 80 ? 5 : w >= 20 ? 2.5 : w >= 5 ? 1 : 0.5;
}

type ExerciseState = {
  exercise: {
    id: string;
    name: string;
    sets: number;
    minReps: number;
    maxReps: number;
    restSeconds: number;
  };
  completedWorkSets: number;
  sets: (SetEntry & { saved: boolean })[];
};

type Props = {
  exerciseState: ExerciseState | null;
  blocks: TrainingPlanBlock[];
  lastSessionSets: SetEntry[];
  bestSet: SetEntry | null;
  currentWorkSetIndex: number;
  pendingWeight: number;
  pendingReps: number;
  pendingSetType: "warmup" | "workset";
  onWeightChange: (w: number) => void;
  onRepsChange: (r: number) => void;
  onSetDone: (weight: number, reps: number) => Promise<void>;
  onNextExercise: () => void;
  isLastExercise: boolean;
  isResting: boolean;
};

function getWarmupRounds(blocks: TrainingPlanBlock[], exerciseId: string): number {
  const warmup = blocks.find((b) => b.type === "warmup" && b.parentExerciseId === exerciseId);
  return warmup?.type === "warmup" ? warmup.rounds : 0;
}

function SetDot({ logged, isCurrent, isWarmupSlot }: {
  logged: (SetEntry & { saved: boolean }) | null;
  isCurrent: boolean;
  isWarmupSlot: boolean;
}) {
  const color = isWarmupSlot ? "var(--c-warning)" : "var(--c-accent)";
  const size = isCurrent ? 14 : 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: logged ? color : "transparent",
        border: `2px solid ${logged ? color : isCurrent ? color : "var(--c-border-strong)"}`,
        boxShadow: isCurrent ? `0 0 0 3px ${isWarmupSlot ? "rgba(245,158,11,0.2)" : "rgba(99,102,241,0.2)"}` : "none",
        transition: "all 0.2s",
        flexShrink: 0,
      }} />
      {logged && (
        <span style={{ fontSize: 9, color: "var(--c-text-3)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>
          {logged.weight}kg
        </span>
      )}
    </div>
  );
}

export function ExerciseFocus({
  exerciseState,
  blocks,
  lastSessionSets,
  bestSet,
  currentWorkSetIndex,
  pendingWeight,
  pendingReps,
  pendingSetType,
  onWeightChange,
  onRepsChange,
  onSetDone,
  onNextExercise,
  isLastExercise,
  isResting,
}: Props) {
  const weightInputRef = useRef<HTMLInputElement>(null);
  const repsInputRef = useRef<HTMLInputElement>(null);

  if (!exerciseState) return null;

  const { exercise, sets, completedWorkSets } = exerciseState;
  const warmupRounds = getWarmupRounds(blocks, exercise.id);
  const totalSets = warmupRounds + exercise.sets;
  const allDone = completedWorkSets >= exercise.sets;
  const isWarmup = pendingSetType === "warmup";
  const step = weightStep(pendingWeight);
  const maxLastWeight = lastSessionSets.length ? Math.max(...lastSessionSets.map((s) => s.weight)) : 0;

  function handleWeightInput(raw: string) {
    const v = parseFloat(raw.replace(",", "."));
    if (!isNaN(v) && v >= 0) onWeightChange(v);
  }

  function handleRepsInput(raw: string) {
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1) onRepsChange(v);
  }

  // Completion screen — exercise fully done
  if (allDone) {
    const workSets = sets.filter((s) => s.setType === "workset");
    const volume = workSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const maxWeight = workSets.length ? Math.max(...workSets.map((s) => s.weight)) : 0;

    return (
      <div style={{ padding: "0 16px" }}>
        {/* Exercise done header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--c-success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--c-text)" }}>{exercise.name}</h2>
          </div>
          <p style={{ fontSize: 13, color: "var(--c-text-3)", marginLeft: 42 }}>Übung abgeschlossen</p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Sätze", value: String(workSets.length) },
            { label: "Max", value: `${maxWeight} kg` },
            { label: "Volumen", value: `${volume} kg` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", marginBottom: 2 }}>{value}</p>
              <p style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Logged sets */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
            Arbeitssätze
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {workSets.map((s, i) => (
              <div key={i} style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                padding: "11px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--c-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", flex: 1 }}>{s.weight} kg</span>
                <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>× {s.reps} Wdh</span>
                <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{s.weight * s.reps} kg</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onNextExercise}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 14,
            background: isLastExercise ? "var(--c-success)" : "var(--c-accent)",
            border: "none",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {isLastExercise ? "Workout beenden 🏁" : "Nächste Übung →"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px" }}>

      {/* Exercise title */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--c-text)", lineHeight: 1.2, marginBottom: 4 }}>
          {exercise.name}
        </h2>
        <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>
          {exercise.sets} × {exercise.minReps}–{exercise.maxReps} Wdh · {exercise.restSeconds}s Pause
        </p>
      </div>

      {/* Set dots */}
      {totalSets > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          {/* Warmup group */}
          {warmupRounds > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-warning)", textTransform: "uppercase", letterSpacing: 0.8 }}>AW</span>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                {Array.from({ length: warmupRounds }).map((_, i) => {
                  const logged = sets[i] ?? null;
                  const isCurrent = i === sets.length && !isResting;
                  return <SetDot key={i} logged={logged} isCurrent={isCurrent} isWarmupSlot={true} />;
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {warmupRounds > 0 && (
            <div style={{ width: 1, height: 28, background: "var(--c-border-strong)", marginTop: 14, flexShrink: 0 }} />
          )}

          {/* Work sets group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-accent)", textTransform: "uppercase", letterSpacing: 0.8 }}>Sätze</span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              {Array.from({ length: exercise.sets }).map((_, i) => {
                const globalIndex = warmupRounds + i;
                const logged = sets[globalIndex] ?? null;
                const isCurrent = globalIndex === sets.length && !isResting;
                return <SetDot key={i} logged={logged} isCurrent={isCurrent} isWarmupSlot={false} />;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Last session comparison */}
      {lastSessionSets.length > 0 && !isResting && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            Letztes Training
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
            {lastSessionSets.map((s, i) => {
              const isCurrent = i === currentWorkSetIndex;
              return (
                <div key={i} style={{
                  background: isCurrent ? "rgba(99,102,241,0.1)" : "var(--c-surface)",
                  border: `1px solid ${isCurrent ? "var(--c-accent)" : "var(--c-border)"}`,
                  borderRadius: 8,
                  padding: "5px 10px",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? "var(--c-accent)" : "var(--c-text-2)" }}>
                    S{i + 1}: {s.weight} kg × {s.reps}
                  </span>
                </div>
              );
            })}
            {bestSet && bestSet.weight > maxLastWeight && (
              <span style={{ fontSize: 11, color: "var(--c-warning)", fontWeight: 700, paddingLeft: 4 }}>
                ↗ Best: {bestSet.weight} kg
              </span>
            )}
          </div>
        </div>
      )}
      {lastSessionSets.length === 0 && !isResting && (
        <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Erste Session — kein Vergleich</p>
        </div>
      )}

      {/* Current set label */}
      {!isResting && (
        <p style={{
          fontSize: 12,
          color: isWarmup ? "var(--c-warning)" : "var(--c-accent)",
          fontWeight: 600,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}>
          {isWarmup
            ? `Aufwärmsatz ${sets.length + 1} / ${warmupRounds}`
            : `Arbeitssatz ${completedWorkSets + 1} / ${exercise.sets}`}
        </p>
      )}

      {/* Inputs — always visible (during rest: pre-setting next set) */}
      {!isResting && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {/* Weight */}
          <div>
            <p style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 6, textAlign: "center", fontWeight: 500 }}>GEWICHT (KG)</p>
            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, overflow: "hidden" }}>
              <button
                onClick={() => onWeightChange(Math.max(0, +(pendingWeight - step).toFixed(2)))}
                style={{ width: "100%", padding: "10px 0", fontSize: 22, color: "var(--c-text-2)", fontWeight: 300 }}
              >−</button>
              <input
                ref={weightInputRef}
                type="number"
                inputMode="decimal"
                value={pendingWeight}
                onChange={(e) => handleWeightInput(e.target.value)}
                style={{
                  width: "100%",
                  textAlign: "center",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "var(--c-text)",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "4px 0",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <button
                onClick={() => onWeightChange(+(pendingWeight + step).toFixed(2))}
                style={{ width: "100%", padding: "10px 0", fontSize: 22, color: "var(--c-text-2)", fontWeight: 300 }}
              >+</button>
            </div>
          </div>

          {/* Reps */}
          <div>
            <p style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 6, textAlign: "center", fontWeight: 500 }}>WDHL.</p>
            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, overflow: "hidden" }}>
              <button
                onClick={() => onRepsChange(Math.max(1, pendingReps - 1))}
                style={{ width: "100%", padding: "10px 0", fontSize: 22, color: "var(--c-text-2)", fontWeight: 300 }}
              >−</button>
              <input
                ref={repsInputRef}
                type="number"
                inputMode="numeric"
                value={pendingReps}
                onChange={(e) => handleRepsInput(e.target.value)}
                style={{
                  width: "100%",
                  textAlign: "center",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "var(--c-text)",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "4px 0",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <button
                onClick={() => onRepsChange(pendingReps + 1)}
                style={{ width: "100%", padding: "10px 0", fontSize: 22, color: "var(--c-text-2)", fontWeight: 300 }}
              >+</button>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      {!isResting && (
        <button
          onClick={() => onSetDone(pendingWeight, pendingReps)}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 14,
            background: "var(--c-accent)",
            border: "none",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {isWarmup ? "Aufwärmsatz ✓" : "Satz abschließen ✓"}
        </button>
      )}
    </div>
  );
}

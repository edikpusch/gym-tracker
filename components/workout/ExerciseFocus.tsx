"use client";

import { useRef } from "react";
import type { TrainingPlanBlock } from "@/lib/trainingModel";
import type { SetEntry } from "@/lib/db";

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
  suggestion: { weight: number; label: string } | null;
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

function SetChip({ label, logged, isCurrent, isWarmupSlot }: {
  label: string;
  logged: (SetEntry & { saved: boolean }) | null;
  isCurrent: boolean;
  isWarmupSlot: boolean;
}) {
  return (
    <div style={{
      padding: logged ? "5px 8px" : "5px 10px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      border: `1px solid ${logged ? "transparent" : isCurrent ? "var(--c-accent)" : "var(--c-border)"}`,
      background: logged
        ? (isWarmupSlot ? "var(--c-surface-2)" : "var(--c-accent)")
        : isCurrent
        ? "var(--c-accent-dim)"
        : "transparent",
      color: logged
        ? (isWarmupSlot ? "var(--c-text-3)" : "#fff")
        : isCurrent
        ? "var(--c-accent)"
        : "var(--c-text-3)",
      whiteSpace: "nowrap" as const,
    }}>
      {label}{logged ? ` ${logged.weight}×${logged.reps}` : ""}
    </div>
  );
}

export function ExerciseFocus({
  exerciseState,
  blocks,
  suggestion,
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
  const weightStep = pendingWeight >= 20 ? 2.5 : 1;

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
            Geloggte Sätze
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {workSets.map((s, i) => (
              <div key={i} style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 600 }}>S{i + 1}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)" }}>{s.weight} kg</span>
                <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>× {s.reps} Wdh</span>
                <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{s.weight * s.reps} kg Vol.</span>
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

      {/* Set chips */}
      {totalSets > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {Array.from({ length: totalSets }).map((_, i) => {
            const isWarmupSlot = i < warmupRounds;
            const logged = sets[i] ?? null;
            const isCurrent = i === sets.length && !isResting;
            const label = isWarmupSlot
              ? `AW${i + 1}`
              : `S${i - warmupRounds + 1}`;
            return (
              <SetChip
                key={i}
                label={label}
                logged={logged}
                isCurrent={isCurrent}
                isWarmupSlot={isWarmupSlot}
              />
            );
          })}
        </div>
      )}

      {/* Suggestion */}
      {suggestion && !isResting && (
        <div style={{
          background: "var(--c-surface)",
          border: "1px solid var(--c-border)",
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <p style={{ fontSize: 13, color: "var(--c-text-2)" }}>{suggestion.label}</p>
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
                onClick={() => onWeightChange(Math.max(0, +(pendingWeight - weightStep).toFixed(2)))}
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
                onClick={() => onWeightChange(+(pendingWeight + weightStep).toFixed(2))}
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

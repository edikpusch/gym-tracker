"use client";

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
  exerciseStates: ExerciseState[];
  currentIndex: number;
  blocks: TrainingPlanBlock[];
  onSelectExercise: (index: number) => void;
};

function getWarmupRounds(blocks: TrainingPlanBlock[], exerciseId: string): number {
  const warmup = blocks.find((b) => b.type === "warmup" && b.parentExerciseId === exerciseId);
  return warmup?.type === "warmup" ? warmup.rounds : 0;
}

export function ExerciseList({ exerciseStates, currentIndex, blocks, onSelectExercise }: Props) {
  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {exerciseStates.map((es, i) => {
        const warmupRounds = getWarmupRounds(blocks, es.exercise.id);
        const totalSets = warmupRounds + es.exercise.sets;
        const done = es.completedWorkSets >= es.exercise.sets;
        const isCurrent = i === currentIndex;
        const workSetsLogged = es.sets.filter((s) => s.setType === "workset").length;

        return (
          <button
            key={es.exercise.id}
            onClick={() => onSelectExercise(i)}
            style={{
              width: "100%",
              textAlign: "left",
              background: isCurrent ? "var(--c-accent-dim)" : "var(--c-surface)",
              border: `1px solid ${isCurrent ? "var(--c-accent-border)" : "var(--c-border)"}`,
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {/* Status indicator */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              flexShrink: 0,
              background: done ? "var(--c-success)" : isCurrent ? "var(--c-accent)" : "var(--c-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}>
              {done ? "✓" : isCurrent ? "▶" : <span style={{ color: "var(--c-text-3)", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 15,
                fontWeight: 600,
                color: done ? "var(--c-text-3)" : "var(--c-text)",
                marginBottom: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {es.exercise.name}
              </p>
              <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                {es.exercise.sets} × {es.exercise.minReps}–{es.exercise.maxReps}
                {warmupRounds > 0 ? ` + ${warmupRounds}W` : ""}
              </p>
            </div>

            {/* Set progress */}
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: done ? "var(--c-success)" : isCurrent ? "var(--c-accent)" : "var(--c-text-3)" }}>
                {workSetsLogged}/{es.exercise.sets}
              </p>
              <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>Sätze</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

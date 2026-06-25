"use client";

import { useState } from "react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {exerciseStates.map((es, i) => {
        const warmupRounds = getWarmupRounds(blocks, es.exercise.id);
        const done = es.completedWorkSets >= es.exercise.sets;
        const isCurrent = i === currentIndex;
        const workSetsLogged = es.sets.filter((s) => s.setType === "workset");
        const isExpanded = expandedId === es.exercise.id;

        return (
          <div
            key={es.exercise.id}
            style={{
              background: isCurrent ? "var(--c-accent-dim)" : "var(--c-surface)",
              border: `1px solid ${isCurrent ? "var(--c-accent-border)" : "var(--c-border)"}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <button
              onClick={() => {
                if (isCurrent || done) {
                  setExpandedId(isExpanded ? null : es.exercise.id);
                } else {
                  onSelectExercise(i);
                }
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
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
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                  : isCurrent
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}><polygon points="5,3 19,12 5,21" fill="#fff" /></svg>
                  : <span style={{ color: "var(--c-text-3)", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                }
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
                  {warmupRounds > 0 ? ` + ${warmupRounds} AW` : ""}
                </p>
              </div>

              {/* Right side */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: done ? "var(--c-success)" : isCurrent ? "var(--c-accent)" : "var(--c-text-3)" }}>
                    {workSetsLogged.length}/{es.exercise.sets}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>Sätze</p>
                </div>
                {(done || isCurrent) && workSetsLogged.length > 0 && (
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--c-text-3)" strokeWidth={2} strokeLinecap="round"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </div>
            </button>

            {/* Expanded sets */}
            {isExpanded && workSetsLogged.length > 0 && (
              <div style={{ borderTop: "1px solid var(--c-border)", padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {workSetsLogged.map((s, si) => (
                  <div key={si} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--c-surface-2)",
                    borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)" }}>S{si + 1}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)" }}>{s.weight} kg</span>
                    <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>× {s.reps} Wdh</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{s.weight * s.reps} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

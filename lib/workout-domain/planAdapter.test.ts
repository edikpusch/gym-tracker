import assert from "node:assert/strict";
import test from "node:test";
import type { TrainingDay, TrainingPlan } from "@/lib/trainingPlans";
import { createWorkoutSnapshotFromPlan } from "@/lib/workout-domain/planAdapter";
import { buildWorkoutQueue } from "@/lib/workout-domain/queue";

test("converts grouped plan exercises into an alternating superset queue", () => {
  const group = {
    id: "group-1",
    type: "superset" as const,
    label: "Supersatz",
    rounds: 2,
    transitionSeconds: 15,
    roundRestSeconds: 90,
  };
  const day: TrainingDay = {
    id: "day-1",
    name: "Upper",
    slot: "mixed",
    color: "#fff",
    exercises: [
      { id: "a", name: "benchpress", sets: 2, minReps: 8, maxReps: 10, restSeconds: 90, group },
      { id: "b", name: "cable_row", sets: 2, minReps: 10, maxReps: 12, restSeconds: 90, group },
    ],
    blocks: [
      { id: "warmup:a", type: "warmup", label: "Warm-up", parentExerciseId: "a", rounds: 1, restSeconds: 45 },
    ],
  };
  const plan: TrainingPlan = { id: "plan-1", name: "Plan", description: "", accent: "#fff", origin: "custom", days: [day] };

  const snapshot = createWorkoutSnapshotFromPlan(plan, day, 123);
  const queue = buildWorkoutQueue(snapshot);

  assert.equal(snapshot.steps.length, 1);
  assert.equal(snapshot.steps[0].type, "superset");
  assert.equal(snapshot.steps[0].type === "superset" ? snapshot.steps[0].exercises[0].guidanceKey : null, "benchpress");
  assert.deepEqual(queue.map((item) => `${item.exercise.id}:${item.plannedSet.kind}:${item.round ?? 0}`), [
    "a:warmup:0",
    "a:workset:1",
    "b:workset:1",
    "a:workset:2",
    "b:workset:2",
  ]);
  assert.deepEqual(queue.slice(1).map((item) => item.restSeconds), [15, 90, 15, 90]);
});

test("preserves optional block order in the workout snapshot", () => {
  const exercise = { id: "a", name: "benchpress", sets: 1, minReps: 8, maxReps: 10, restSeconds: 60 };
  const day: TrainingDay = {
    id: "day-optional",
    name: "Optional",
    slot: "mixed",
    color: "#fff",
    exercises: [exercise],
    blocks: [
      { id: "note-1", type: "note", label: "Technik", notes: "Kontrolliert" },
      { id: "exercise:a", type: "exercise", label: "Bankdrücken", exerciseId: "a", exerciseKind: "compound", category: "Brust", sets: 1, minReps: 8, maxReps: 10, restSeconds: 60, warmupSets: 0, weight: { unit: "kg", loadKind: "external", allowNegative: false, min: 0, max: null, quickSteps: [2.5, 1] } },
      { id: "pause-1", type: "pause", label: "Trinken", seconds: 45, scope: "workout" },
    ],
  };
  const plan: TrainingPlan = { id: "plan", name: "Plan", description: "", accent: "#fff", origin: "custom", days: [day] };
  const snapshot = createWorkoutSnapshotFromPlan(plan, day, 1);

  assert.deepEqual(snapshot.steps.map((step) => step.type), ["note", "exercise", "pause"]);
  assert.deepEqual(buildWorkoutQueue(snapshot).map((item) => item.activity?.type ?? "set"), ["note", "set", "pause"]);
});

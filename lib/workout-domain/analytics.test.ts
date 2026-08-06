import assert from "node:assert/strict";
import test from "node:test";
import { getExerciseBests, getExerciseProgress, summarizeSessionExercises, type HistorySession } from "@/lib/workout-domain/analytics";

const session: HistorySession = {
  id: "session",
  workoutName: "Upper",
  startedAt: 1_000,
  endedAt: 61_000,
  durationMs: 60_000,
  activeDurationMs: 20_000,
  volumeKg: 1_600,
  workSetCount: 2,
  warmupSetCount: 1,
  source: "v2",
  sets: [
    { id: "warmup", exerciseId: "bench", exerciseName: "Bankdrücken", kind: "warmup", weight: 100, reps: 20, unit: "kg", completedAt: 2_000, activeDurationMs: 1_000, loadKind: "external", volumeKg: 2_000 },
    { id: "work-1", exerciseId: "bench", exerciseName: "Bankdrücken", kind: "workset", weight: 80, reps: 10, unit: "kg", completedAt: 3_000, activeDurationMs: 3_000, loadKind: "external", volumeKg: 800 },
    { id: "work-2", exerciseId: "bench", exerciseName: "Bankdrücken", kind: "workset", weight: 80, reps: 10, unit: "kg", completedAt: 4_000, activeDurationMs: 3_000, loadKind: "external", volumeKg: 800 },
  ],
};

test("warm-up sets stay out of bests and exercise progress", () => {
  const bests = getExerciseBests([session]);
  const progress = getExerciseProgress([session], "bench");
  assert.equal(bests[0].weight, 80);
  assert.equal(bests[0].estimatedOneRepMaxKg.toFixed(1), "106.7");
  assert.equal(progress[0].volumeKg, 1_600);
});

test("per-side loads are normalized before comparing estimated strength", () => {
  const perSide: HistorySession = {
    ...session,
    id: "per-side",
    sets: [{ ...session.sets[1], id: "side", exerciseId: "press", exerciseName: "Plate Press", loadKind: "per-side", weight: 30, reps: 10, volumeKg: 600 }],
  };
  assert.equal(getExerciseBests([perSide])[0].estimatedOneRepMaxKg.toFixed(1), "80.0");
});

test("session summaries keep warm-ups visible but outside work volume", () => {
  const summary = summarizeSessionExercises(session)[0];
  assert.equal(summary.workSets.length, 2);
  assert.equal(summary.warmupSets.length, 1);
  assert.equal(summary.volumeKg, 1_600);
  assert.equal(summary.bestSet?.id, "work-1");
});

test("exercise progress exposes the actual strongest set for transparent comparisons", () => {
  const progress = getExerciseProgress([session], "bench");
  assert.equal(progress[0].bestSet.weight, 80);
  assert.equal(progress[0].bestSet.reps, 10);
});

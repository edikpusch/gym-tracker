import assert from "node:assert/strict";
import test from "node:test";
import type { HistorySession } from "@/lib/workout-domain/analytics";
import { getRecommendedWorkout, getWorkoutDaySummary } from "@/lib/workout-start";
import type { TrainingPlan } from "@/lib/trainingPlans";

const plan: TrainingPlan = {
  id: "plan",
  name: "Plan",
  description: "",
  accent: "#fff",
  origin: "custom",
  days: [
    { id: "a", name: "A", slot: "push", color: "#fff", exercises: [{ id: "bench", name: "bench-press", sets: 3, minReps: 6, maxReps: 8, restSeconds: 120 }] },
    { id: "b", name: "B", slot: "pull", color: "#fff", exercises: [{ id: "row", name: "barbell-row", sets: 2, minReps: 8, maxReps: 10, restSeconds: 90 }] },
  ],
};

function session(workoutId: string, workSetCount = 1): HistorySession {
  return { id: `session:${workoutId}`, planId: "plan", workoutId, workoutName: workoutId.toUpperCase(), startedAt: 10, endedAt: 20, durationMs: 10, activeDurationMs: 5, volumeKg: 10, workSetCount, warmupSetCount: 0, sets: [], source: "v2" };
}

test("recommendation follows the plan order and wraps around", () => {
  assert.equal(getRecommendedWorkout(plan, [session("a")]).day?.id, "b");
  assert.equal(getRecommendedWorkout(plan, [session("b")]).day?.id, "a");
});

test("empty sessions do not advance the plan recommendation", () => {
  assert.equal(getRecommendedWorkout(plan, [session("a", 0)]).day?.id, "a");
});

test("workout summary derives set count and duration from the executable snapshot", () => {
  const summary = getWorkoutDaySummary(plan, plan.days[0]);
  assert.equal(summary.workSetCount, 3);
  assert.equal(summary.exerciseCount, 1);
  assert.ok(summary.estimatedMinutes >= 8);
});

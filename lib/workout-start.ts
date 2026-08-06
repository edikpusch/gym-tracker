import type { HistorySession } from "@/lib/workout-domain/analytics";
import { createWorkoutSnapshotFromPlan } from "@/lib/workout-domain/planAdapter";
import type { TrainingDay, TrainingPlan } from "@/lib/trainingPlans";

export type WorkoutDaySummary = {
  exerciseCount: number;
  workSetCount: number;
  warmupSetCount: number;
  estimatedMinutes: number;
};

export function getWorkoutDaySummary(plan: TrainingPlan, day: TrainingDay): WorkoutDaySummary {
  const snapshot = createWorkoutSnapshotFromPlan(plan, day, 0);
  let exerciseCount = 0;
  let workSetCount = 0;
  let warmupSetCount = 0;
  let estimatedSeconds = 0;

  for (const step of snapshot.steps) {
    if (step.type === "pause") {
      estimatedSeconds += step.seconds;
      continue;
    }
    if (step.type === "mobility") {
      estimatedSeconds += step.durationSeconds * step.rounds;
      continue;
    }
    if (step.type === "note") continue;

    const exercises = step.type === "exercise" ? [step.exercise] : step.exercises;
    exerciseCount += exercises.length;
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        if (set.kind === "warmup") warmupSetCount += 1;
        else workSetCount += 1;
        estimatedSeconds += 45 + set.restSeconds;
      }
    }
  }

  return {
    exerciseCount,
    workSetCount,
    warmupSetCount,
    estimatedMinutes: Math.max(1, Math.round(estimatedSeconds / 60)),
  };
}

export function getRecommendedWorkout(plan: TrainingPlan, sessions: HistorySession[]) {
  const eligible = sessions.find((session) =>
    session.planId === plan.id &&
    session.workSetCount > 0 &&
    plan.days.some((day) => day.id === session.workoutId)
  );

  if (!eligible?.workoutId) {
    return { day: plan.days[0] ?? null, reason: "Erste Einheit in diesem Plan" };
  }

  const previousIndex = plan.days.findIndex((day) => day.id === eligible.workoutId);
  const day = plan.days[(previousIndex + 1) % plan.days.length] ?? null;
  return { day, reason: `Als Nächstes nach ${eligible.workoutName}` };
}

export function getLatestSessionsByWorkout(sessions: HistorySession[]) {
  const latest = new Map<string, HistorySession>();
  for (const session of sessions) {
    if (session.workoutId && !latest.has(session.workoutId)) latest.set(session.workoutId, session);
  }
  return latest;
}

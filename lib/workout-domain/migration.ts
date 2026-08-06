"use client";

import type { GymTrackerDB, SetEntry, WorkoutSession } from "@/lib/db";
import { getDb } from "@/lib/db";
import { createWorkoutRuntime } from "@/lib/workout-domain/stateMachine";
import {
  WORKOUT_SCHEMA_VERSION,
  type ExerciseWorkoutStep,
  type PlannedSet,
  type SessionSetRecord,
  type WorkoutSnapshot,
} from "@/lib/workout-domain/types";

const LEGACY_MIGRATION_META_KEY = "migration:legacy-dexie-v1-to-v2";

function normalizeId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildLegacySnapshot(
  session: WorkoutSession,
  sets: SetEntry[]
): WorkoutSnapshot {
  const byExercise = new Map<string, SetEntry[]>();
  sets
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((set) => {
      const exerciseId = set.exerciseId ?? normalizeId(set.exercise);
      const exerciseSets = byExercise.get(exerciseId) ?? [];
      exerciseSets.push(set);
      byExercise.set(exerciseId, exerciseSets);
    });

  const steps: ExerciseWorkoutStep[] = Array.from(byExercise.entries()).map(
    ([exerciseId, exerciseSets], exerciseIndex) => ({
      id: `legacy-step:${exerciseIndex}:${exerciseId}`,
      type: "exercise",
      exercise: {
        id: `legacy-exercise:${exerciseIndex}:${exerciseId}`,
        exerciseId,
        name: exerciseSets[0]?.exercise ?? exerciseId,
        loadKind: "external",
        weightStep: 2.5,
        sets: exerciseSets.map<PlannedSet>((set, setIndex) => ({
          id: `legacy-set:${set.id ?? set.timestamp}:${setIndex}`,
          kind: set.setType === "warmup" ? "warmup" : "workset",
          targetReps: { min: set.reps, max: set.reps },
          targetLoad: { value: set.weight, unit: "kg" },
          restSeconds: 0,
        })),
      },
    })
  );

  return {
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    planId: session.planId ?? "legacy-plan",
    planName: session.planName ?? "Importierter Plan",
    workoutId: session.dayId ?? `legacy-workout:${session.sessionId}`,
    workoutName: session.dayName ?? "Importiertes Workout",
    capturedAt: session.startedAt,
    steps,
  };
}

function migrateSession(session: WorkoutSession, sets: SetEntry[]) {
  const sessionId = `legacy:${session.sessionId}`;
  const snapshot = buildLegacySnapshot(session, sets);
  const runtime = createWorkoutRuntime({
    sessionId,
    snapshot,
    now: session.startedAt,
  });
  const queueByPlannedSetId = new Map(
    runtime.queue.map((item) => [item.plannedSet.id, item])
  );

  const exerciseSteps = snapshot.steps.filter(
    (step): step is ExerciseWorkoutStep => step.type === "exercise"
  );
  const results: SessionSetRecord[] = exerciseSteps.flatMap((step) =>
    step.exercise.sets.flatMap((plannedSet, index): SessionSetRecord[] => {
      const source = sets
        .filter(
          (set) =>
            (set.exerciseId ?? normalizeId(set.exercise)) ===
            step.exercise.exerciseId
        )
        .sort((a, b) => a.timestamp - b.timestamp)[index];
      const queueItem = queueByPlannedSetId.get(plannedSet.id);
      if (!source || !queueItem) return [];

      return [{
        id: `${sessionId}:${queueItem.id}`,
        sessionId,
        queueItemId: queueItem.id,
        stepId: queueItem.stepId,
        exerciseId: queueItem.exercise.exerciseId,
        exerciseName: source.exercise,
        setKind: source.setType === "warmup" ? "warmup" : "workset",
        status: "completed",
        weight: source.weight,
        reps: source.reps,
        unit: "kg",
        startedAt: source.timestamp,
        completedAt: source.timestamp,
        activeDurationMs: 0,
        updatedAt: source.timestamp,
      } satisfies SessionSetRecord];
    })
  );

  return {
    ...runtime,
    status: session.endedAt ? "completed" as const : "legacy_incomplete" as const,
    phase: session.endedAt ? "completed" as const : "review" as const,
    results,
    queueIndex: runtime.queue.length,
    endedAt: session.endedAt ?? null,
    updatedAt: session.endedAt ?? session.startedAt,
    migrationSource: "legacy-dexie-v1" as const,
  };
}

export async function migrateLegacyWorkoutData(db: GymTrackerDB = getDb()) {
  return db.transaction(
    "rw",
    db.sessions,
    db.sets,
    db.workoutSessionsV2,
    db.workoutSetsV2,
    db.workoutMeta,
    async () => {
      const alreadyMigrated = await db.workoutMeta.get(
        LEGACY_MIGRATION_META_KEY
      );

      const legacySessions = await db.sessions.toArray();
      const legacySets = await db.sets.toArray();
      let migratedSessions = 0;
      let migratedSets = 0;

      for (const session of legacySessions) {
        const sessionId = `legacy:${session.sessionId}`;
        if (await db.workoutSessionsV2.get(sessionId)) continue;

        const sessionSets = legacySets.filter(
          (set) => set.sessionId === session.sessionId
        );
        const migrated = migrateSession(session, sessionSets);
        await db.workoutSessionsV2.put(migrated);
        if (migrated.results.length > 0) {
          await db.workoutSetsV2.bulkPut(migrated.results);
        }
        migratedSessions += 1;
        migratedSets += migrated.results.length;
      }

      await db.workoutMeta.put({
        key: LEGACY_MIGRATION_META_KEY,
        value: WORKOUT_SCHEMA_VERSION.toString(),
        updatedAt: Date.now(),
      });

      return {
        migratedSessions,
        migratedSets,
        alreadyMigrated: Boolean(alreadyMigrated),
      };
    }
  );
}

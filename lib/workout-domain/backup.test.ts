import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { configureAppStorageDriver } from "@/lib/appStorage";
import { createGymTrackerDb } from "@/lib/db";
import { createGymTrackerBackup, importGymTrackerBackup } from "@/lib/appBackup";
import { createWorkoutRuntime, reduceWorkoutState } from "@/lib/workout-domain/stateMachine";
import { WORKOUT_SCHEMA_VERSION, type WorkoutSnapshot } from "@/lib/workout-domain/types";

function memoryStorage() {
  const values = new Map<string, string>();
  return { name: "test", isAvailable: () => true, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) };
}

test("v3 backup round-trips workout sessions, records and local entries", async () => {
  configureAppStorageDriver(memoryStorage());
  const source = createGymTrackerDb(`backup-source-${Date.now()}`);
  const target = createGymTrackerDb(`backup-target-${Date.now()}`);
  const snapshot: WorkoutSnapshot = { schemaVersion: WORKOUT_SCHEMA_VERSION, planId: "plan", planName: "Plan", workoutId: "day", workoutName: "Day", capturedAt: 1, steps: [{ id: "step", type: "exercise", exercise: { id: "instance", exerciseId: "bench", name: "Bankdrücken", loadKind: "external", weightStep: 2.5, sets: [{ id: "set", kind: "workset", targetReps: { min: 8, max: 10 }, restSeconds: 60 }] } }] };
  let runtime = createWorkoutRuntime({ sessionId: "session:backup", snapshot, now: 1_000 });
  runtime = reduceWorkoutState(runtime, { type: "start_set", now: 2_000 });
  runtime = reduceWorkoutState(runtime, { type: "complete_set", now: 5_000 });
  runtime = reduceWorkoutState(runtime, { type: "finish_workout", now: 6_000 });
  // Completing the only set enters review, so finish_workout is accepted.
  await source.workoutSessionsV2.put(runtime);
  await source.workoutSetsV2.bulkPut(runtime.results);

  const backup = await createGymTrackerBackup(source);
  assert.equal(backup.version, 3);
  assert.equal(backup.database?.workoutSessionsV2.length, 1);
  await importGymTrackerBackup(JSON.stringify(backup), target);
  assert.equal(await target.workoutSessionsV2.count(), 1);
  assert.equal(await target.workoutSetsV2.count(), 1);

  await source.delete();
  await target.delete();
  configureAppStorageDriver(null);
});

test("an empty backup does not wipe existing training data", async () => {
  configureAppStorageDriver(memoryStorage());
  const db = createGymTrackerDb(`backup-empty-guard-${Date.now()}`);
  // Ein echtes Training auf dem Gerät …
  // Ein minimaler, aber gültiger Session-Datensatz reicht — geprüft wird nur,
  // dass der Import ihn nicht anfasst.
  await db.workoutSessionsV2.put({
    sessionId: "session:vorhanden",
    status: "completed",
    phase: "review",
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    results: [],
    queue: [],
    queueIndex: 0,
    startedAt: 1,
    updatedAt: 1,
  } as never);

  // … und ein Backup, das auf einem frischen Gerät erzeugt wurde: alles leer.
  const emptyBackup = JSON.stringify({
    app: "gym-tracker",
    version: 3,
    exportedAt: new Date(0).toISOString(),
    entries: {
      workoutLogs: null, activePlan: null, customPlans: null, recentPlanExercises: null,
      bodyWeight: null, preferences: null, exerciseFavorites: null, customExercises: null,
      planVersion: null, activeWorkout: null, activeWorkoutSnapshot: null,
    },
    database: {
      legacySets: [], legacySessions: [], weights: [], legacyActiveWorkout: [],
      settings: [], workoutSessionsV2: [], workoutSetsV2: [], workoutMeta: [],
    },
  });

  await assert.rejects(
    () => importGymTrackerBackup(emptyBackup, db),
    /keine Trainings/,
    "der Import muss abbrechen statt alles zu löschen"
  );
  assert.equal(await db.workoutSessionsV2.count(), 1, "das vorhandene Training muss erhalten bleiben");
  await db.delete();
});

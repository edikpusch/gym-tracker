import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { createGymTrackerDb } from "@/lib/db";
import { migrateLegacyWorkoutData } from "@/lib/workout-domain/migration";
import {
  createOrResumeWorkoutSession,
  dispatchActiveWorkoutAction,
  getActiveWorkoutSession,
  getMatchingSetSuggestion,
} from "@/lib/workout-domain/storage";
import {
  WORKOUT_SCHEMA_VERSION,
  type WorkoutSnapshot,
} from "@/lib/workout-domain/types";

function snapshot(): WorkoutSnapshot {
  return {
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    planId: "plan",
    planName: "Plan",
    workoutId: "push",
    workoutName: "Push",
    capturedAt: 1_000,
    steps: [
      {
        id: "step",
        type: "exercise",
        exercise: {
          id: "bench-instance",
          exerciseId: "bench",
          name: "Bankdrücken",
          loadKind: "external",
          weightStep: 2.5,
          sets: [
            {
              id: "set-1",
              kind: "workset",
              targetReps: { min: 6, max: 8 },
              targetLoad: { value: 80, unit: "kg" },
              restSeconds: 90,
            },
          ],
        },
      },
    ],
  };
}

test("concurrent initialization creates exactly one active session", async () => {
  const db = createGymTrackerDb(`gym-tracker-test-${Date.now()}-active`);
  try {
    const [first, second] = await Promise.all([
      createOrResumeWorkoutSession({ snapshot: snapshot(), now: 1_000, db }),
      createOrResumeWorkoutSession({ snapshot: snapshot(), now: 1_001, db }),
    ]);

    assert.equal(first.sessionId, second.sessionId);
    assert.equal(await db.workoutSessionsV2.count(), 1);
    assert.equal((await getActiveWorkoutSession(db))?.sessionId, first.sessionId);

    await dispatchActiveWorkoutAction({ type: "start_set", now: 2_000 }, db);
    const active = await getActiveWorkoutSession(db);
    assert.equal(active?.phase, "active_set");
  } finally {
    db.close();
    await db.delete();
  }
});

test("legacy migration is preserving and idempotent", async () => {
  const db = createGymTrackerDb(`gym-tracker-test-${Date.now()}-migration`);
  try {
    await db.sessions.add({
      sessionId: 42,
      startedAt: 1_000,
      endedAt: 5_000,
      planId: "legacy-plan",
      planName: "Legacy",
      dayId: "push",
      dayName: "Push",
    });
    await db.sets.add({
      sessionId: 42,
      timestamp: 3_000,
      exercise: "Bankdrücken",
      exerciseId: "bench",
      weight: 80,
      reps: 8,
      setIndex: 0,
      setType: "workset",
    });

    const first = await migrateLegacyWorkoutData(db);
    const second = await migrateLegacyWorkoutData(db);

    assert.deepEqual(first, {
      migratedSessions: 1,
      migratedSets: 1,
      alreadyMigrated: false,
    });
    assert.equal(second.alreadyMigrated, true);
    assert.equal(await db.workoutSessionsV2.count(), 1);
    assert.equal(await db.workoutSetsV2.count(), 1);
    assert.equal(
      (await db.workoutSessionsV2.get("legacy:42"))?.migrationSource,
      "legacy-dexie-v1"
    );
  } finally {
    db.close();
    await db.delete();
  }
});

test("matching suggestions use the same set slot from the latest session", async () => {
  const db = createGymTrackerDb(`gym-tracker-test-${Date.now()}-suggestion`);
  try {
    const current = await createOrResumeWorkoutSession({
      snapshot: snapshot(),
      now: 10_000,
      db,
    });
    const item = current.queue[0];
    assert.ok(item);

    await db.workoutSetsV2.bulkPut([
      {
        id: "old:first",
        sessionId: "old",
        queueItemId: "old-1",
        stepId: "step",
        exerciseId: "bench",
        exerciseName: "Bankdrücken",
        setKind: "workset",
        status: "completed",
        weight: 75,
        reps: 8,
        unit: "kg",
        startedAt: 1_000,
        completedAt: 2_000,
        activeDurationMs: 1_000,
        updatedAt: 2_000,
      },
      {
        id: "new:first",
        sessionId: "new",
        queueItemId: "new-1",
        stepId: "step",
        exerciseId: "bench",
        exerciseName: "Bankdrücken",
        setKind: "workset",
        status: "completed",
        weight: 80,
        reps: 7,
        unit: "kg",
        startedAt: 5_000,
        completedAt: 6_000,
        activeDurationMs: 1_000,
        updatedAt: 6_000,
      },
    ]);

    const suggestion = await getMatchingSetSuggestion(current, item, db);
    assert.equal(suggestion?.weight, 80);
    assert.equal(suggestion?.reps, 7);
  } finally {
    db.close();
    await db.delete();
  }
});

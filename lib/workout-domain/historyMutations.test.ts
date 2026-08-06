import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { createGymTrackerDb } from "@/lib/db";
import { deleteCompletedHistorySession, deleteCompletedHistorySet, updateCompletedHistorySet } from "@/lib/workout-domain/historyMutations";
import { createWorkoutRuntime, reduceWorkoutState } from "@/lib/workout-domain/stateMachine";
import type { WorkoutSnapshot } from "@/lib/workout-domain/types";

const snapshot: WorkoutSnapshot = { schemaVersion: 2, planId: "plan", planName: "Plan", workoutId: "day", workoutName: "Day", capturedAt: 1, steps: [{ id: "step", type: "exercise", exercise: { id: "exercise", exerciseId: "bench", name: "Bench", loadKind: "external", weightStep: 2.5, sets: [{ id: "set", kind: "workset", targetReps: { min: 8, max: 10 }, restSeconds: 60 }] } }] };

async function completedSession(databaseName: string) {
  const db = createGymTrackerDb(databaseName);
  let state = createWorkoutRuntime({ sessionId: "session", snapshot, now: 10 });
  state = reduceWorkoutState(state, { type: "update_draft", draft: { weight: 50, reps: 8 }, now: 11 });
  state = reduceWorkoutState(state, { type: "start_set", now: 12 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 13 });
  state = reduceWorkoutState(state, { type: "review_workout", now: 14 });
  state = reduceWorkoutState(state, { type: "finish_workout", now: 15 });
  await db.workoutSessionsV2.put(state);
  await db.workoutSetsV2.bulkPut(state.results);
  return { db, state, setId: state.results[0].id };
}

test("editing and deleting a v2 set updates both stored representations", async () => {
  const { db, setId } = await completedSession(`history-mutation-${Date.now()}`);
  assert.equal(await updateCompletedHistorySet({ sessionId: "session", source: "v2", setId, weight: 60, reps: 9 }, db), true);
  assert.equal((await db.workoutSetsV2.get(setId))?.weight, 60);
  assert.equal((await db.workoutSessionsV2.get("session"))?.results[0].reps, 9);
  assert.equal(await deleteCompletedHistorySet({ sessionId: "session", source: "v2", setId }, db), true);
  assert.equal((await db.workoutSetsV2.get(setId))?.status, "deleted");
  assert.equal((await db.workoutSessionsV2.get("session"))?.results[0].status, "deleted");
  await db.delete();
});

test("deleting a completed session removes its session and set rows", async () => {
  const { db } = await completedSession(`history-session-delete-${Date.now()}`);
  assert.equal(await deleteCompletedHistorySession({ id: "session", source: "v2" }, db), true);
  assert.equal(await db.workoutSessionsV2.count(), 0);
  assert.equal(await db.workoutSetsV2.count(), 0);
  await db.delete();
});

test("deleting a migrated session also removes the preserved legacy source", async () => {
  const { db, state } = await completedSession(`history-migrated-delete-${Date.now()}`);
  await db.workoutSessionsV2.clear();
  await db.workoutSetsV2.clear();
  const migrated = { ...state, sessionId: "legacy:42", migrationSource: "legacy-dexie-v1" as const, results: state.results.map((record) => ({ ...record, sessionId: "legacy:42" })) };
  await db.workoutSessionsV2.put(migrated);
  await db.workoutSetsV2.bulkPut(migrated.results);
  await db.sessions.put({ id: 42, sessionId: 42, startedAt: 1, endedAt: 2, dayName: "Legacy" });
  await db.sets.put({ id: 42, sessionId: 42, timestamp: 1, exercise: "Bench", weight: 10, reps: 10, setIndex: 0, setType: "workset" });
  assert.equal(await deleteCompletedHistorySession({ id: "legacy:42", source: "v2" }, db), true);
  assert.equal(await db.workoutSessionsV2.count(), 0);
  assert.equal(await db.sessions.count(), 0);
  assert.equal(await db.sets.count(), 0);
  await db.delete();
});

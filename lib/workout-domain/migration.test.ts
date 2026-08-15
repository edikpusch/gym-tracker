import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { createGymTrackerDb } from "@/lib/db";
import { migrateLegacyWorkoutData } from "@/lib/workout-domain/migration";

async function seedLegacySession(db: ReturnType<typeof createGymTrackerDb>) {
  await db.sessions.put({ id: 1, sessionId: 1712345678901, startedAt: 1, endedAt: 2, dayName: "Legacy" });
  await db.sets.put({ id: 1, sessionId: 1712345678901, timestamp: 1, exercise: "Bench", weight: 60, reps: 10, setIndex: 0, setType: "workset" });
}

test("legacy data is migrated once", async () => {
  const db = createGymTrackerDb(`migration-once-${Date.now()}`);
  await seedLegacySession(db);

  const first = await migrateLegacyWorkoutData(db);
  assert.equal(first.alreadyMigrated, false);
  assert.equal(first.migratedSessions, 1);
  assert.equal(first.migratedSets, 1);

  const second = await migrateLegacyWorkoutData(db);
  assert.equal(second.alreadyMigrated, true);
  assert.equal(second.migratedSessions, 0);
  await db.delete();
});

test("a session deleted from history is not re-imported on the next start", async () => {
  const db = createGymTrackerDb(`migration-no-reimport-${Date.now()}`);
  await seedLegacySession(db);
  await migrateLegacyWorkoutData(db);
  assert.equal(await db.workoutSessionsV2.count(), 1);

  // Der Nutzer löscht das Training im Verlauf. Die Legacy-Zeilen können dabei
  // erhalten bleiben (z. B. weil migrationSource fehlt) — die Migration darf
  // sie beim nächsten Kaltstart trotzdem nicht zurückholen.
  await db.workoutSessionsV2.clear();
  await db.workoutSetsV2.clear();

  const rerun = await migrateLegacyWorkoutData(db);
  assert.equal(rerun.alreadyMigrated, true);
  assert.equal(rerun.migratedSessions, 0);
  assert.equal(await db.workoutSessionsV2.count(), 0, "das gelöschte Training darf nicht zurückkehren");
  await db.delete();
});

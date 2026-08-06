"use client";

import { getDb, type GymTrackerDB } from "@/lib/db";
import type { HistorySession } from "@/lib/workout-domain/analytics";

type SetMutation = {
  sessionId: string;
  source: HistorySession["source"];
  setId: string;
};

type SetUpdate = SetMutation & {
  weight: number;
  reps: number;
  bodyWeight?: number;
};

function legacyNumericId(value: string, prefix: string) {
  if (!value.startsWith(prefix)) return null;
  const parsed = Number(value.slice(prefix.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function updateCompletedHistorySet(update: SetUpdate, db: GymTrackerDB = getDb()) {
  if (!Number.isFinite(update.weight) || update.weight < 0 || !Number.isInteger(update.reps) || update.reps < 1) return false;
  if (update.bodyWeight != null && (!Number.isFinite(update.bodyWeight) || update.bodyWeight <= 0)) return false;

  if (update.source === "legacy") {
    const setId = legacyNumericId(update.setId, "legacy-set:");
    if (setId == null) return false;
    return (await db.sets.update(setId, { weight: update.weight, reps: update.reps })) > 0;
  }

  return db.transaction("rw", db.workoutSessionsV2, db.workoutSetsV2, async () => {
    const session = await db.workoutSessionsV2.get(update.sessionId);
    const record = session?.results.find((result) => result.id === update.setId && result.status === "completed");
    if (!session || !record) return false;
    const now = Date.now();
    const nextRecord = { ...record, weight: update.weight, reps: update.reps, bodyWeight: update.bodyWeight, updatedAt: now };
    const nextSession = { ...session, results: session.results.map((result) => result.id === update.setId ? nextRecord : result), updatedAt: now };
    await Promise.all([db.workoutSessionsV2.put(nextSession), db.workoutSetsV2.put(nextRecord)]);
    return true;
  });
}

export async function deleteCompletedHistorySet(target: SetMutation, db: GymTrackerDB = getDb()) {
  if (target.source === "legacy") {
    const setId = legacyNumericId(target.setId, "legacy-set:");
    if (setId == null) return false;
    await db.sets.delete(setId);
    return true;
  }

  return db.transaction("rw", db.workoutSessionsV2, db.workoutSetsV2, async () => {
    const session = await db.workoutSessionsV2.get(target.sessionId);
    const record = session?.results.find((result) => result.id === target.setId && result.status === "completed");
    if (!session || !record) return false;
    const now = Date.now();
    const deletedRecord = { ...record, status: "deleted" as const, updatedAt: now };
    await Promise.all([
      db.workoutSessionsV2.put({ ...session, results: session.results.map((result) => result.id === target.setId ? deletedRecord : result), updatedAt: now }),
      db.workoutSetsV2.put(deletedRecord),
    ]);
    return true;
  });
}

export async function deleteCompletedHistorySession(session: Pick<HistorySession, "id" | "source">, db: GymTrackerDB = getDb()) {
  if (session.source === "legacy") {
    const sessionId = legacyNumericId(session.id, "legacy-raw:");
    if (sessionId == null) return false;
    await db.transaction("rw", db.sessions, db.sets, async () => {
      await db.sets.where("sessionId").equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });
    return true;
  }

  const existing = await db.workoutSessionsV2.get(session.id);
  if (!existing || existing.status !== "completed") return false;
  await db.transaction("rw", db.workoutSessionsV2, db.workoutSetsV2, db.sessions, db.sets, async () => {
    await db.workoutSetsV2.where("sessionId").equals(session.id).delete();
    await db.workoutSessionsV2.delete(session.id);
    if (existing.migrationSource === "legacy-dexie-v1") {
      const legacySessionId = legacyNumericId(existing.sessionId, "legacy:");
      if (legacySessionId != null) {
        await db.sets.where("sessionId").equals(legacySessionId).delete();
        await db.sessions.delete(legacySessionId);
      }
    }
  });
  return true;
}

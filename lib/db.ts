"use client";

import Dexie, { type Table } from "dexie";

export type LoggedSetType = "warmup" | "workset";

export type SetEntry = {
  id?: number;
  sessionId: number;
  timestamp: number;
  exercise: string;
  exerciseId?: string;
  weight: number;
  reps: number;
  setIndex: number;
  setType: LoggedSetType;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
};

export type WorkoutSession = {
  id?: number;
  sessionId: number;
  startedAt: number;
  endedAt?: number;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
  totalVolume?: number;
};

export type WeightEntry = {
  id?: number;
  date: string;
  weight: number;
  timestamp: number;
};

export type ActiveWorkoutSnapshot = {
  id?: number;
  key: string;
  sessionId: number;
  startedAt: number;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
  exerciseId: string;
  exerciseIndex: number;
  setIndex: number;
  weight: number;
  reps: number;
  isResting: boolean;
  restEndsAt: number | null;
  updatedAt: number;
};

export type AppSetting = {
  key: string;
  value: string;
};

class GymTrackerDB extends Dexie {
  sets!: Table<SetEntry, number>;
  sessions!: Table<WorkoutSession, number>;
  weights!: Table<WeightEntry, number>;
  activeWorkout!: Table<ActiveWorkoutSnapshot, number>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super("gym-tracker-v2");
    this.version(1).stores({
      sets: "++id, sessionId, timestamp, exercise, exerciseId, setType",
      sessions: "++id, sessionId, startedAt, planId, dayId",
      weights: "++id, date, timestamp",
      activeWorkout: "++id, key",
      settings: "key",
    });
  }
}

let _db: GymTrackerDB | null = null;

export function getDb(): GymTrackerDB {
  if (!_db) {
    _db = new GymTrackerDB();
  }
  return _db;
}

export async function getSetsForExercise(exerciseId: string): Promise<SetEntry[]> {
  const db = getDb();
  return db.sets
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.setType === "workset")
    .toArray();
}

export async function getSetsForSession(sessionId: number): Promise<SetEntry[]> {
  const db = getDb();
  return db.sets.where("sessionId").equals(sessionId).sortBy("timestamp");
}

export async function saveSet(entry: Omit<SetEntry, "id">): Promise<SetEntry> {
  const db = getDb();
  const id = await db.sets.add(entry);
  return { ...entry, id };
}

export async function updateSet(id: number, patch: Partial<SetEntry>): Promise<void> {
  const db = getDb();
  await db.sets.update(id, patch);
}

export async function deleteSet(id: number): Promise<void> {
  const db = getDb();
  await db.sets.delete(id);
}

export async function getRecentSessionsForExercise(
  exerciseId: string,
  limit = 10
): Promise<SetEntry[][]> {
  const db = getDb();
  const sets = await db.sets
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.setType === "workset")
    .reverse()
    .sortBy("timestamp");

  const bySession = new Map<number, SetEntry[]>();
  for (const set of sets) {
    if (!bySession.has(set.sessionId)) bySession.set(set.sessionId, []);
    bySession.get(set.sessionId)!.push(set);
  }

  return Array.from(bySession.values()).slice(0, limit);
}

export async function getLastSessionSets(exerciseId: string): Promise<SetEntry[]> {
  const sessions = await getRecentSessionsForExercise(exerciseId, 1);
  return sessions[0] ?? [];
}

export async function getBestSet(exerciseId: string): Promise<SetEntry | null> {
  const db = getDb();
  const sets = await db.sets
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.setType === "workset")
    .toArray();
  if (!sets.length) return null;
  return sets.reduce((best, s) => (s.weight > best.weight ? s : best), sets[0]);
}

export async function saveActiveWorkout(snapshot: Omit<ActiveWorkoutSnapshot, "id">): Promise<void> {
  const db = getDb();
  const existing = await db.activeWorkout.where("key").equals(snapshot.key).first();
  if (existing?.id) {
    await db.activeWorkout.update(existing.id, { ...snapshot, updatedAt: Date.now() });
  } else {
    await db.activeWorkout.add({ ...snapshot, updatedAt: Date.now() });
  }
}

export async function getActiveWorkout(key: string): Promise<ActiveWorkoutSnapshot | null> {
  const db = getDb();
  return (await db.activeWorkout.where("key").equals(key).first()) ?? null;
}

export async function clearActiveWorkout(key: string): Promise<void> {
  const db = getDb();
  await db.activeWorkout.where("key").equals(key).delete();
}

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.settings.get(key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.settings.put({ key, value });
}

export async function getRecentSessions(limit = 20): Promise<WorkoutSession[]> {
  const db = getDb();
  return db.sessions.orderBy("startedAt").reverse().limit(limit).toArray();
}

export async function saveSession(session: Omit<WorkoutSession, "id">): Promise<WorkoutSession> {
  const db = getDb();
  const id = await db.sessions.add(session);
  return { ...session, id };
}

export async function updateSession(sessionId: number, patch: Partial<WorkoutSession>): Promise<void> {
  const db = getDb();
  const existing = await db.sessions.where("sessionId").equals(sessionId).first();
  if (existing?.id) await db.sessions.update(existing.id, patch);
}

export async function saveWeight(entry: Omit<WeightEntry, "id">): Promise<WeightEntry> {
  const db = getDb();
  const id = await db.weights.add(entry);
  return { ...entry, id };
}

export async function getWeightHistory(): Promise<WeightEntry[]> {
  const db = getDb();
  return db.weights.orderBy("timestamp").toArray();
}

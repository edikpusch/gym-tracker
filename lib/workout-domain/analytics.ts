"use client";

import { getDb, type SetEntry, type WorkoutSession } from "@/lib/db";
import type { LoadKind, SessionSetRecord, WorkoutRuntimeState } from "@/lib/workout-domain/types";

export type HistorySet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  kind: "warmup" | "workset" | "dropset";
  weight: number;
  reps: number;
  bodyWeight?: number;
  unit: "kg" | "lb";
  completedAt: number;
  activeDurationMs: number;
  loadKind: LoadKind;
  volumeKg: number;
};

export type HistorySession = {
  id: string;
  planId?: string;
  planName?: string;
  workoutId?: string;
  workoutName: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  activeDurationMs: number;
  volumeKg: number;
  workSetCount: number;
  warmupSetCount: number;
  sets: HistorySet[];
  source: "v2" | "legacy";
};

export type ExerciseBest = {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  unit: "kg" | "lb";
  bodyWeight?: number;
  date: number;
  estimatedOneRepMaxKg: number;
  bestSetVolumeKg: number;
  loadKind: LoadKind;
};

export type ExerciseSessionSummary = {
  exerciseId: string;
  exerciseName: string;
  workSets: HistorySet[];
  warmupSets: HistorySet[];
  volumeKg: number;
  bestSet: HistorySet | null;
};

function toKg(value: number, unit: "kg" | "lb") {
  return unit === "lb" ? value * 0.45359237 : value;
}

function effectiveLoadKg(record: Pick<HistorySet, "weight" | "unit" | "bodyWeight" | "loadKind">) {
  const weight = toKg(record.weight, record.unit);
  const bodyWeight = record.bodyWeight == null ? null : toKg(record.bodyWeight, record.unit);
  if (record.loadKind === "bodyweight") return Math.max(0, bodyWeight ?? weight);
  if (record.loadKind === "bodyweight-plus") return Math.max(0, (bodyWeight ?? 0) + weight);
  if (record.loadKind === "assisted") return bodyWeight == null ? Math.max(0, weight) : Math.max(0, bodyWeight - Math.abs(weight));
  if (record.loadKind === "per-side") return Math.max(0, weight * 2);
  return Math.max(0, weight);
}

function fromV2Set(record: SessionSetRecord, session: WorkoutRuntimeState): HistorySet {
  const loadKind = session.queue.find((item) => item.id === record.queueItemId)?.exercise.loadKind ?? "external";
  const base = {
    id: record.id,
    exerciseId: record.exerciseId,
    exerciseName: record.exerciseName,
    kind: record.setKind,
    weight: record.weight,
    reps: record.reps,
    bodyWeight: record.bodyWeight,
    unit: record.unit,
    completedAt: record.completedAt,
    activeDurationMs: record.activeDurationMs,
    loadKind,
  } satisfies Omit<HistorySet, "volumeKg">;
  return { ...base, volumeKg: effectiveLoadKg(base) * record.reps };
}

function fromLegacySet(record: SetEntry): HistorySet {
  const base = {
    id: `legacy-set:${record.id ?? `${record.sessionId}:${record.setIndex}`}`,
    exerciseId: record.exerciseId ?? record.exercise,
    exerciseName: record.exercise,
    kind: record.setType,
    weight: record.weight,
    reps: record.reps,
    unit: "kg" as const,
    completedAt: record.timestamp,
    activeDurationMs: 0,
    loadKind: "external" as const,
  };
  return { ...base, volumeKg: effectiveLoadKg(base) * record.reps };
}

export function historySessionFromRuntime(session: WorkoutRuntimeState, referenceTime = session.endedAt ?? session.updatedAt): HistorySession {
  const sets = session.results.filter((record) => record.status === "completed").map((record) => fromV2Set(record, session));
  const workSets = sets.filter((set) => set.kind !== "warmup");
  const endedAt = session.endedAt ?? referenceTime;
  return {
    id: session.sessionId,
    planId: session.snapshot.planId,
    planName: session.snapshot.planName,
    workoutId: session.snapshot.workoutId,
    workoutName: session.snapshot.workoutName,
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - session.startedAt),
    activeDurationMs: session.clock.totalActiveMs,
    volumeKg: workSets.reduce((sum, set) => sum + set.volumeKg, 0),
    workSetCount: workSets.length,
    warmupSetCount: sets.length - workSets.length,
    sets,
    source: "v2",
  };
}

export function summarizeSessionExercises(session: HistorySession): ExerciseSessionSummary[] {
  const groups = new Map<string, ExerciseSessionSummary>();
  for (const set of session.sets) {
    const group = groups.get(set.exerciseId) ?? {
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      workSets: [],
      warmupSets: [],
      volumeKg: 0,
      bestSet: null,
    };
    if (set.kind === "warmup") {
      group.warmupSets.push(set);
    } else {
      group.workSets.push(set);
      group.volumeKg += set.volumeKg;
      if (!group.bestSet || effectiveLoadKg(set) * (1 + set.reps / 30) > effectiveLoadKg(group.bestSet) * (1 + group.bestSet.reps / 30)) {
        group.bestSet = set;
      }
    }
    groups.set(set.exerciseId, group);
  }
  return Array.from(groups.values());
}

function buildLegacySession(session: WorkoutSession, records: SetEntry[]): HistorySession {
  const sets = records.map(fromLegacySet);
  const workSets = sets.filter((set) => set.kind !== "warmup");
  const endedAt = session.endedAt ?? session.startedAt;
  return {
    id: `legacy-raw:${session.sessionId}`,
    planId: session.planId,
    planName: session.planName,
    workoutId: session.dayId,
    workoutName: session.dayName ?? "Workout",
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - session.startedAt),
    activeDurationMs: sets.reduce((sum, set) => sum + set.activeDurationMs, 0),
    volumeKg: workSets.reduce((sum, set) => sum + set.volumeKg, 0),
    workSetCount: workSets.length,
    warmupSetCount: sets.length - workSets.length,
    sets,
    source: "legacy",
  };
}

export async function getWorkoutHistory(limit?: number) {
  const db = getDb();
  const [v2Sessions, legacySessions, legacySets] = await Promise.all([
    db.workoutSessionsV2.where("status").equals("completed").toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
  ]);
  const migratedLegacyIds = new Set(v2Sessions.filter((session) => session.migrationSource === "legacy-dexie-v1").map((session) => session.sessionId.replace(/^legacy:/, "")));
  const normalized = [
    ...v2Sessions.map((session) => historySessionFromRuntime(session)),
    ...legacySessions
      .filter((session) => session.endedAt && !migratedLegacyIds.has(String(session.sessionId)))
      .map((session) => buildLegacySession(session, legacySets.filter((set) => set.sessionId === session.sessionId))),
  ].sort((a, b) => b.startedAt - a.startedAt);
  return limit == null ? normalized : normalized.slice(0, Math.max(0, limit));
}

export function getExerciseBests(sessions: HistorySession[]) {
  const bests = new Map<string, ExerciseBest>();
  sessions.flatMap((session) => session.sets).filter((set) => set.kind !== "warmup").forEach((set) => {
    const loadKg = effectiveLoadKg(set);
    const estimatedOneRepMaxKg = loadKg * (1 + set.reps / 30);
    const candidate: ExerciseBest = {
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      weight: set.weight,
      reps: set.reps,
      unit: set.unit,
      bodyWeight: set.bodyWeight,
      date: set.completedAt,
      estimatedOneRepMaxKg,
      bestSetVolumeKg: set.volumeKg,
      loadKind: set.loadKind,
    };
    const current = bests.get(set.exerciseId);
    if (!current || candidate.estimatedOneRepMaxKg > current.estimatedOneRepMaxKg || (candidate.estimatedOneRepMaxKg === current.estimatedOneRepMaxKg && candidate.bestSetVolumeKg > current.bestSetVolumeKg)) {
      bests.set(set.exerciseId, candidate);
    }
  });
  return Array.from(bests.values()).sort((a, b) => b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg);
}

export function getExerciseProgress(sessions: HistorySession[], exerciseId: string) {
  return sessions
    .map((session) => {
      const sets = session.sets.filter((set) => set.kind !== "warmup" && set.exerciseId === exerciseId);
      if (!sets.length) return null;
      return {
        sessionId: session.id,
        date: session.startedAt,
        volumeKg: sets.reduce((sum, set) => sum + set.volumeKg, 0),
        bestEstimatedOneRepMaxKg: Math.max(...sets.map((set) => effectiveLoadKg(set) * (1 + set.reps / 30))),
        bestSet: sets.reduce((best, set) => effectiveLoadKg(set) * (1 + set.reps / 30) > effectiveLoadKg(best) * (1 + best.reps / 30) ? set : best),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .reverse();
}

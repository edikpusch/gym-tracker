"use client";

import type { GymTrackerDB } from "@/lib/db";
import { getDb } from "@/lib/db";
import { createWorkoutRuntime, reduceWorkoutState, type WorkoutAction } from "@/lib/workout-domain/stateMachine";
import type {
  SessionSetRecord,
  WorkoutQueueItem,
  WorkoutRuntimeState,
  WorkoutSnapshot,
} from "@/lib/workout-domain/types";

export const ACTIVE_SESSION_META_KEY = "active-workout-session-v2";

function createSessionId(now: number) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `session:${randomId}` : `session:${now}`;
}

export async function getActiveWorkoutSession(
  db: GymTrackerDB = getDb()
): Promise<WorkoutRuntimeState | null> {
  const meta = await db.workoutMeta.get(ACTIVE_SESSION_META_KEY);
  if (meta) {
    const session = await db.workoutSessionsV2.get(meta.value);
    if (session?.status === "in_progress") return session;
  }

  const fallback = await db.workoutSessionsV2
    .where("status")
    .equals("in_progress")
    .first();

  if (fallback) {
    await db.workoutMeta.put({
      key: ACTIVE_SESSION_META_KEY,
      value: fallback.sessionId,
      updatedAt: fallback.updatedAt,
    });
  }

  return fallback ?? null;
}

export async function createOrResumeWorkoutSession({
  snapshot,
  now = Date.now(),
  db = getDb(),
}: {
  snapshot: WorkoutSnapshot;
  now?: number;
  db?: GymTrackerDB;
}) {
  return db.transaction(
    "rw",
    db.workoutSessionsV2,
    db.workoutSetsV2,
    db.workoutMeta,
    async () => {
      const meta = await db.workoutMeta.get(ACTIVE_SESSION_META_KEY);
      const metaSession = meta
        ? await db.workoutSessionsV2.get(meta.value)
        : null;

      if (metaSession?.status === "in_progress") {
        return metaSession;
      }

      const orphanedActive = await db.workoutSessionsV2
        .where("status")
        .equals("in_progress")
        .first();
      if (orphanedActive) {
        await db.workoutMeta.put({
          key: ACTIVE_SESSION_META_KEY,
          value: orphanedActive.sessionId,
          updatedAt: now,
        });
        return orphanedActive;
      }

      const runtime = createWorkoutRuntime({
        sessionId: createSessionId(now),
        snapshot,
        now,
      });
      await db.workoutSessionsV2.put(runtime);
      await db.workoutMeta.put({
        key: ACTIVE_SESSION_META_KEY,
        value: runtime.sessionId,
        updatedAt: now,
      });
      return runtime;
    }
  );
}

export async function persistWorkoutSession(
  state: WorkoutRuntimeState,
  db: GymTrackerDB = getDb()
) {
  await db.transaction(
    "rw",
    db.workoutSessionsV2,
    db.workoutSetsV2,
    db.workoutMeta,
    async () => {
      await db.workoutSessionsV2.put(state);
      if (state.results.length > 0) {
        await db.workoutSetsV2.bulkPut(state.results);
      }

      const meta = await db.workoutMeta.get(ACTIVE_SESSION_META_KEY);
      if (state.status === "in_progress") {
        await db.workoutMeta.put({
          key: ACTIVE_SESSION_META_KEY,
          value: state.sessionId,
          updatedAt: state.updatedAt,
        });
      } else if (meta?.value === state.sessionId) {
        await db.workoutMeta.delete(ACTIVE_SESSION_META_KEY);
      }
    }
  );
}

export async function dispatchActiveWorkoutAction(
  action: WorkoutAction,
  db: GymTrackerDB = getDb()
) {
  return db.transaction(
    "rw",
    db.workoutSessionsV2,
    db.workoutSetsV2,
    db.workoutMeta,
    async () => {
      const meta = await db.workoutMeta.get(ACTIVE_SESSION_META_KEY);
      if (!meta) return null;
      const current = await db.workoutSessionsV2.get(meta.value);
      if (!current || current.status !== "in_progress") return null;

      const next = reduceWorkoutState(current, action);
      await db.workoutSessionsV2.put(next);

      if (next.status === "discarded") {
        // Ohne dieses Aufräumen blieben die Sätze mit Status "completed" in
        // workoutSetsV2 stehen. getMatchingSetSuggestion prüft nur den Status,
        // nicht ob die Session verworfen wurde — ein versehentlich mit 999 kg
        // gespeicherter Satz wurde deshalb auch nach dem Verwerfen noch als
        // Vorschlag angeboten und automatisch in den Draft geschrieben.
        await db.workoutSetsV2.where("sessionId").equals(next.sessionId).delete();
      } else if (next.results.length > 0) {
        await db.workoutSetsV2.bulkPut(next.results);
      }

      if (next.status === "in_progress") {
        await db.workoutMeta.put({
          key: ACTIVE_SESSION_META_KEY,
          value: next.sessionId,
          updatedAt: next.updatedAt,
        });
      } else {
        await db.workoutMeta.delete(ACTIVE_SESSION_META_KEY);
      }

      return next;
    }
  );
}

export async function getMatchingSetSuggestion(
  state: WorkoutRuntimeState,
  item: WorkoutQueueItem,
  db: GymTrackerDB = getDb()
): Promise<SessionSetRecord | null> {
  const ordinal = state.queue
    .filter(
      (candidate) =>
        candidate.exercise.exerciseId === item.exercise.exerciseId &&
        candidate.plannedSet.kind === item.plannedSet.kind
    )
    .findIndex((candidate) => candidate.id === item.id);

  const candidates = await db.workoutSetsV2
    .where("exerciseId")
    .equals(item.exercise.exerciseId)
    .filter(
      (record) =>
        record.sessionId !== state.sessionId &&
        record.status === "completed" &&
        record.setKind === item.plannedSet.kind
    )
    .toArray();
  if (candidates.length === 0) return null;

  const bySession = new Map<string, SessionSetRecord[]>();
  candidates.forEach((record) => {
    const records = bySession.get(record.sessionId) ?? [];
    records.push(record);
    bySession.set(record.sessionId, records);
  });

  const latestSession = Array.from(bySession.values())
    .map((records) => records.sort((a, b) => a.completedAt - b.completedAt))
    .sort(
      (a, b) =>
        (b[b.length - 1]?.completedAt ?? 0) -
        (a[a.length - 1]?.completedAt ?? 0)
    )[0];

  return latestSession?.[Math.max(0, ordinal)] ?? latestSession?.[0] ?? null;
}

import { buildWorkoutQueue } from "@/lib/workout-domain/queue";
import {
  WORKOUT_SCHEMA_VERSION,
  type ExerciseProgressStatus,
  type SessionSetRecord,
  type SetDraft,
  type WorkoutRuntimeState,
  type WorkoutSnapshot,
} from "@/lib/workout-domain/types";

export type WorkoutAction =
  | { type: "update_draft"; draft: Partial<SetDraft>; now: number }
  | { type: "start_set"; now: number }
  | { type: "complete_set"; now: number }
  | { type: "start_activity"; now: number }
  | { type: "complete_activity"; now: number }
  | { type: "finish_rest"; now: number }
  | { type: "skip_rest"; now: number }
  | { type: "adjust_rest"; deltaMs: number; now: number }
  | { type: "select_queue_item"; queueIndex: number; now: number }
  | { type: "edit_last_set"; weight: number; reps: number; now: number }
  | { type: "undo_last_set"; now: number }
  | { type: "defer_exercise"; exerciseId: string; now: number }
  | { type: "skip_exercise"; exerciseId: string; now: number }
  | { type: "app_hidden"; now: number }
  | { type: "resume_interrupted_set"; now: number }
  | { type: "pause_workout"; now: number }
  | { type: "resume_workout"; now: number }
  | { type: "review_workout"; now: number }
  | { type: "finish_workout"; now: number }
  | { type: "discard_workout"; now: number };

function clampDuration(value: number) {
  return Math.max(0, Math.round(value));
}

function getLiveSetDuration(state: WorkoutRuntimeState, now: number) {
  if (state.clock.currentSetStartedAt == null) {
    return state.clock.currentSetAccumulatedMs;
  }

  return (
    state.clock.currentSetAccumulatedMs +
    clampDuration(now - state.clock.currentSetStartedAt)
  );
}

function accumulateRunningSegment(state: WorkoutRuntimeState, now: number) {
  const startedAt = state.clock.currentSetStartedAt;
  if (startedAt == null) return state;

  const item = state.queue[state.queueIndex];
  const segmentMs = clampDuration(now - startedAt);
  const exerciseId = item?.activity ? undefined : item?.exercise.exerciseId;

  return {
    ...state,
    clock: {
      ...state.clock,
      currentSetStartedAt: null,
      currentSetAccumulatedMs:
        state.clock.currentSetAccumulatedMs + segmentMs,
      totalActiveMs: state.clock.totalActiveMs + segmentMs,
      exerciseActiveMs: exerciseId
        ? {
            ...state.clock.exerciseActiveMs,
            [exerciseId]:
              (state.clock.exerciseActiveMs[exerciseId] ?? 0) + segmentMs,
          }
        : state.clock.exerciseActiveMs,
    },
  };
}

function closePreviousRest(state: WorkoutRuntimeState, now: number) {
  const restStartedAt = state.clock.restStartedAt;
  if (restStartedAt == null || state.results.length === 0) return state.results;

  const lastIndex = state.results.length - 1;
  return state.results.map((record, index) =>
    index === lastIndex
      ? {
          ...record,
          restEndedAt: now,
          actualRestMs: clampDuration(now - restStartedAt),
          updatedAt: now,
        }
      : record
  );
}

function findNextPendingQueueIndex(
  state: WorkoutRuntimeState,
  afterIndex: number,
  options: {
    results?: SessionSetRecord[];
    completedActivityIds?: string[];
    exerciseStatus?: WorkoutRuntimeState["exerciseStatus"];
    excludeExerciseId?: string;
    wrap?: boolean;
  } = {}
) {
  const results = options.results ?? state.results;
  const completedSetIds = new Set(results.filter((result) => result.status === "completed").map((result) => result.queueItemId));
  const completedActivityIds = new Set(options.completedActivityIds ?? state.completedActivityIds ?? []);
  const exerciseStatus = options.exerciseStatus ?? state.exerciseStatus;
  const indexes = [
    ...Array.from({ length: Math.max(0, state.queue.length - afterIndex - 1) }, (_, offset) => afterIndex + offset + 1),
    ...(options.wrap === false ? [] : Array.from({ length: Math.min(state.queue.length, afterIndex + 1) }, (_, index) => index)),
  ];
  return indexes.find((index) => {
    const item = state.queue[index];
    if (!item) return false;
    if (item.activity) return !completedActivityIds.has(item.id);
    return item.exercise.exerciseId !== options.excludeExerciseId && exerciseStatus[item.exercise.exerciseId] !== "skipped" && !completedSetIds.has(item.id);
  }) ?? state.queue.length;
}

function deriveExerciseStatus(
  state: WorkoutRuntimeState,
  queueIndex: number,
  results: SessionSetRecord[]
) {
  const status: Record<string, ExerciseProgressStatus> = {
    ...state.exerciseStatus,
  };
  const completedByExercise = new Map<string, number>();

  results.forEach((record) => {
    if (record.status !== "completed") return;
    completedByExercise.set(
      record.exerciseId,
      (completedByExercise.get(record.exerciseId) ?? 0) + 1
    );
  });

  state.queue.filter((item) => !item.activity).forEach((item) => {
    const exerciseId = item.exercise.exerciseId;
    const forcedStatus = state.exerciseStatus[exerciseId];
    if (forcedStatus === "skipped") {
      status[exerciseId] = "skipped";
      return;
    }
    const total = state.queue.filter(
      (candidate) => !candidate.activity && candidate.exercise.exerciseId === exerciseId
    ).length;
    const completed = completedByExercise.get(exerciseId) ?? 0;
    status[exerciseId] = completed >= total
      ? "completed"
      : forcedStatus === "deferred"
        ? "deferred"
        : completed > 0
          ? "partial"
          : "not_started";
  });

  const current = state.queue[queueIndex];
  if (current && !current.activity && status[current.exercise.exerciseId] !== "completed") {
    status[current.exercise.exerciseId] = "current";
  }

  return status;
}

export function createWorkoutRuntime({
  sessionId,
  snapshot,
  now,
}: {
  sessionId: string;
  snapshot: WorkoutSnapshot;
  now: number;
}): WorkoutRuntimeState {
  const queue = buildWorkoutQueue(snapshot);
  const first = queue[0];
  const exerciseStatus: Record<string, ExerciseProgressStatus> = Object.fromEntries(
    queue.filter((item) => !item.activity).map((item) => [item.exercise.exerciseId, "not_started" as const])
  );

  if (first && !first.activity) {
    exerciseStatus[first.exercise.exerciseId] = "current";
  }

  return {
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    sessionId,
    status: "in_progress",
    phase: queue.length > 0 ? "ready" : "review",
    resumePhase: null,
    snapshot,
    queue,
    queueIndex: 0,
    draft: {
      weight: first?.plannedSet.targetLoad?.value ?? 0,
      reps: first?.plannedSet.targetReps.max ?? 1,
      unit: first?.exercise.weightUnit ?? first?.plannedSet.targetLoad?.unit ?? "kg",
    },
    results: [],
    completedActivityIds: [],
    exerciseStatus,
    clock: {
      workoutStartedAt: now,
      currentSetWallStartedAt: null,
      currentSetStartedAt: null,
      currentSetAccumulatedMs: 0,
      totalActiveMs: 0,
      exerciseActiveMs: {},
      restStartedAt: null,
      restPlannedEndsAt: null,
      frozenRestRemainingMs: null,
      lastRestCompletedAt: null,
    },
    startedAt: now,
    endedAt: null,
    updatedAt: now,
  };
}

export function reduceWorkoutState(
  state: WorkoutRuntimeState,
  action: WorkoutAction
): WorkoutRuntimeState {
  if (state.status !== "in_progress") return state;

  if (action.type === "update_draft") {
    return {
      ...state,
      draft: { ...state.draft, ...action.draft },
      updatedAt: action.now,
    };
  }

  if (action.type === "start_set") {
    if (state.phase !== "ready" || !state.queue[state.queueIndex] || state.queue[state.queueIndex].activity) return state;

    return {
      ...state,
      phase: "active_set",
      results: closePreviousRest(state, action.now),
      clock: {
        ...state.clock,
        currentSetWallStartedAt: action.now,
        currentSetStartedAt: action.now,
        currentSetAccumulatedMs: 0,
        restStartedAt: null,
        restPlannedEndsAt: null,
        frozenRestRemainingMs: null,
        lastRestCompletedAt: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "complete_set") {
    if (state.phase !== "active_set") return state;
    const item = state.queue[state.queueIndex];
    if (!item || item.activity || state.clock.currentSetStartedAt == null) return state;

    const liveSegmentMs = clampDuration(
      action.now - state.clock.currentSetStartedAt
    );
    const activeDurationMs = getLiveSetDuration(state, action.now);
    const result: SessionSetRecord = {
      id: `${state.sessionId}:${item.id}`,
      sessionId: state.sessionId,
      queueItemId: item.id,
      stepId: item.stepId,
      exerciseId: item.exercise.exerciseId,
      exerciseName: item.exercise.name,
      setKind: item.plannedSet.kind,
      status: "completed",
      weight: item.exercise.loadKind === "bodyweight" ? 0 : Math.abs(state.draft.weight),
      reps: state.draft.reps,
      bodyWeight: state.draft.bodyWeight,
      unit: state.draft.unit,
      startedAt: state.clock.currentSetWallStartedAt ?? action.now,
      completedAt: action.now,
      activeDurationMs,
      restStartedAt: action.now,
      updatedAt: action.now,
    };
    const results = [...state.results, result];
    const nextIndex = findNextPendingQueueIndex(state, state.queueIndex, { results });
    const nextItem = state.queue[nextIndex];
    const exerciseId = item.exercise.exerciseId;

    return {
      ...state,
      phase: nextItem ? "resting" : "review",
      queueIndex: nextIndex,
      draft: nextItem
        ? {
            weight: nextItem.plannedSet.targetLoad?.value ?? state.draft.weight,
            reps: nextItem.plannedSet.targetReps.max,
            bodyWeight: state.draft.bodyWeight,
            unit: nextItem.exercise.weightUnit ?? nextItem.plannedSet.targetLoad?.unit ?? state.draft.unit,
          }
        : state.draft,
      results,
      exerciseStatus: deriveExerciseStatus(state, nextIndex, results),
      clock: {
        ...state.clock,
        currentSetWallStartedAt: null,
        currentSetStartedAt: null,
        currentSetAccumulatedMs: 0,
        totalActiveMs: state.clock.totalActiveMs + liveSegmentMs,
        exerciseActiveMs: {
          ...state.clock.exerciseActiveMs,
          [exerciseId]:
            (state.clock.exerciseActiveMs[exerciseId] ?? 0) + liveSegmentMs,
        },
        restStartedAt: nextItem ? action.now : null,
        restPlannedEndsAt: nextItem
          ? action.now + item.restSeconds * 1000
          : null,
        frozenRestRemainingMs: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "start_activity") {
    const item = state.queue[state.queueIndex];
    if (state.phase !== "ready" || !item?.activity || !item.activity.durationSeconds) return state;
    return {
      ...state,
      phase: "timed_activity",
      clock: {
        ...state.clock,
        currentSetWallStartedAt: action.now,
        currentSetStartedAt: item.activity.type === "mobility" ? action.now : null,
        currentSetAccumulatedMs: 0,
        restStartedAt: action.now,
        restPlannedEndsAt: action.now + item.activity.durationSeconds * 1000,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "complete_activity") {
    const item = state.queue[state.queueIndex];
    if (!item?.activity || (state.phase !== "ready" && state.phase !== "timed_activity")) return state;
    const completedActivityIds = [...new Set([...(state.completedActivityIds ?? []), item.id])];
    const nextIndex = findNextPendingQueueIndex(state, state.queueIndex, { completedActivityIds });
    const nextItem = state.queue[nextIndex];
    const activeSegment = state.phase === "timed_activity" && item.activity.type === "mobility"
      ? getLiveSetDuration(state, action.now)
      : 0;
    return {
      ...state,
      phase: nextItem ? "ready" : "review",
      queueIndex: nextIndex,
      completedActivityIds,
      draft: nextItem && !nextItem.activity ? {
        weight: nextItem.plannedSet.targetLoad?.value ?? state.draft.weight,
        reps: nextItem.plannedSet.targetReps.max,
        bodyWeight: state.draft.bodyWeight,
        unit: nextItem.exercise.weightUnit ?? nextItem.plannedSet.targetLoad?.unit ?? state.draft.unit,
      } : state.draft,
      exerciseStatus: deriveExerciseStatus(state, nextIndex, state.results),
      clock: {
        ...state.clock,
        currentSetWallStartedAt: null,
        currentSetStartedAt: null,
        currentSetAccumulatedMs: 0,
        totalActiveMs: state.clock.totalActiveMs + activeSegment,
        restStartedAt: null,
        restPlannedEndsAt: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "finish_rest" || action.type === "skip_rest") {
    if (state.phase !== "resting") return state;
    if (
      action.type === "finish_rest" &&
      state.clock.restPlannedEndsAt != null &&
      action.now < state.clock.restPlannedEndsAt
    ) {
      return state;
    }

    return {
      ...state,
      phase: "ready",
      clock: { ...state.clock, restPlannedEndsAt: null, lastRestCompletedAt: action.type === "finish_rest" ? action.now : null },
      updatedAt: action.now,
    };
  }

  if (action.type === "adjust_rest") {
    if (state.phase !== "resting" || state.clock.restPlannedEndsAt == null) {
      return state;
    }

    return {
      ...state,
      clock: {
        ...state.clock,
        restPlannedEndsAt: Math.max(
          action.now,
          state.clock.restPlannedEndsAt + action.deltaMs
        ),
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "select_queue_item") {
    if (
      (state.phase !== "ready" &&
        state.phase !== "resting" &&
        state.phase !== "review") ||
      !state.queue[action.queueIndex] ||
      state.queue[action.queueIndex].activity ||
      state.exerciseStatus[
        state.queue[action.queueIndex].exercise.exerciseId
      ] === "skipped" ||
      state.results.some(
        (result) =>
          result.queueItemId === state.queue[action.queueIndex].id &&
          result.status === "completed"
      )
    ) {
      return state;
    }

    return {
      ...state,
      phase: "ready",
      queueIndex: action.queueIndex,
      draft: {
        weight: state.queue[action.queueIndex].plannedSet.targetLoad?.value ?? state.draft.weight,
        reps: state.queue[action.queueIndex].plannedSet.targetReps.max,
        bodyWeight: state.draft.bodyWeight,
        unit: state.queue[action.queueIndex].exercise.weightUnit ?? state.queue[action.queueIndex].plannedSet.targetLoad?.unit ?? state.draft.unit,
      },
      exerciseStatus: deriveExerciseStatus(
        {
          ...state,
          exerciseStatus: {
            ...state.exerciseStatus,
            [state.queue[action.queueIndex].exercise.exerciseId]: "current",
          },
        },
        action.queueIndex,
        state.results
      ),
      clock: {
        ...state.clock,
        restPlannedEndsAt: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "edit_last_set") {
    const lastCompletedIndex = state.results.findLastIndex(
      (result) => result.status === "completed"
    );
    if (lastCompletedIndex < 0) return state;

    return {
      ...state,
      results: state.results.map((result, index) =>
        index === lastCompletedIndex
          ? {
              ...result,
              weight: action.weight,
              reps: action.reps,
              updatedAt: action.now,
            }
          : result
      ),
      updatedAt: action.now,
    };
  }

  if (action.type === "undo_last_set") {
    const lastCompletedIndex = state.results.findLastIndex(
      (result) => result.status === "completed"
    );
    const lastCompleted = state.results[lastCompletedIndex];
    if (!lastCompleted) return state;
    const queueIndex = state.queue.findIndex(
      (item) => item.id === lastCompleted.queueItemId
    );
    if (queueIndex < 0) return state;

    const results = state.results.map((result, index) =>
      index === lastCompletedIndex
        ? { ...result, status: "deleted" as const, updatedAt: action.now }
        : result
    );
    const exerciseActiveMs = Math.max(
      0,
      (state.clock.exerciseActiveMs[lastCompleted.exerciseId] ?? 0) -
        lastCompleted.activeDurationMs
    );
    const statusBase = {
      ...state,
      exerciseStatus: {
        ...state.exerciseStatus,
        [lastCompleted.exerciseId]: "current" as const,
      },
    };

    return {
      ...state,
      phase: "ready",
      queueIndex,
      results,
      draft: {
        weight: lastCompleted.weight,
        reps: lastCompleted.reps,
        bodyWeight: lastCompleted.bodyWeight,
        unit: lastCompleted.unit,
      },
      exerciseStatus: deriveExerciseStatus(statusBase, queueIndex, results),
      clock: {
        ...state.clock,
        totalActiveMs: Math.max(
          0,
          state.clock.totalActiveMs - lastCompleted.activeDurationMs
        ),
        exerciseActiveMs: {
          ...state.clock.exerciseActiveMs,
          [lastCompleted.exerciseId]: exerciseActiveMs,
        },
        restStartedAt: null,
        restPlannedEndsAt: null,
      },
      updatedAt: action.now,
    };
  }

  if (
    action.type === "defer_exercise" ||
    action.type === "skip_exercise"
  ) {
    if (state.phase === "active_set") return state;
    const exerciseStatus = {
      ...state.exerciseStatus,
      [action.exerciseId]:
        action.type === "skip_exercise" ? "skipped" as const : "deferred" as const,
    };
    const nextIndex = findNextPendingQueueIndex(state, state.queueIndex, {
      exerciseStatus,
      excludeExerciseId: action.exerciseId,
    });
    const nextState = { ...state, exerciseStatus };
    const nextItem = state.queue[nextIndex];

    return {
      ...state,
      phase: nextIndex < state.queue.length ? "ready" : "review",
      queueIndex: nextIndex,
      draft: nextItem && !nextItem.activity ? {
        weight: nextItem.plannedSet.targetLoad?.value ?? state.draft.weight,
        reps: nextItem.plannedSet.targetReps.max,
        bodyWeight: state.draft.bodyWeight,
        unit: nextItem.exercise.weightUnit ?? nextItem.plannedSet.targetLoad?.unit ?? state.draft.unit,
      } : state.draft,
      exerciseStatus: deriveExerciseStatus(
        nextState,
        nextIndex,
        state.results
      ),
      clock: {
        ...state.clock,
        restPlannedEndsAt: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "app_hidden") {
    if (state.phase !== "active_set") return state;
    const accumulated = accumulateRunningSegment(state, action.now);
    return {
      ...accumulated,
      phase: "interrupted",
      resumePhase: "active_set",
      updatedAt: action.now,
    };
  }

  if (action.type === "resume_interrupted_set") {
    if (state.phase !== "interrupted" || state.resumePhase !== "active_set") {
      return state;
    }

    return {
      ...state,
      phase: "active_set",
      resumePhase: null,
      clock: { ...state.clock, currentSetStartedAt: action.now },
      updatedAt: action.now,
    };
  }

  if (action.type === "pause_workout") {
    if (
      state.phase === "completed" ||
      state.phase === "discarded" ||
      state.phase === "workout_paused"
    ) {
      return state;
    }

    const currentItem = state.queue[state.queueIndex];
    const accumulated =
      state.phase === "active_set" || (state.phase === "timed_activity" && currentItem?.activity?.type === "mobility")
        ? accumulateRunningSegment(state, action.now)
        : state;
    const remaining =
      (state.phase === "resting" || state.phase === "timed_activity") && state.clock.restPlannedEndsAt != null
        ? clampDuration(state.clock.restPlannedEndsAt - action.now)
        : null;

    return {
      ...accumulated,
      phase: "workout_paused",
      resumePhase: state.phase === "active_set" ? "active_set" : state.phase === "resting" ? "resting" : state.phase === "timed_activity" ? "timed_activity" : "ready",
      clock: {
        ...accumulated.clock,
        restPlannedEndsAt: null,
        frozenRestRemainingMs: remaining,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "resume_workout") {
    if (state.phase !== "workout_paused") return state;
    const resumePhase = state.resumePhase ?? "ready";
    const resumesActiveSet = resumePhase === "active_set";
    const resumesMobility = resumePhase === "timed_activity" && state.queue[state.queueIndex]?.activity?.type === "mobility";

    return {
      ...state,
      phase: resumesActiveSet ? "interrupted" : resumePhase,
      resumePhase: resumesActiveSet ? "active_set" : null,
      clock: {
        ...state.clock,
        restPlannedEndsAt:
          (resumePhase === "resting" || resumePhase === "timed_activity") &&
          state.clock.frozenRestRemainingMs != null
            ? action.now + state.clock.frozenRestRemainingMs
            : null,
        currentSetStartedAt: resumesMobility ? action.now : state.clock.currentSetStartedAt,
        frozenRestRemainingMs: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "review_workout") {
    const accumulated =
      state.phase === "active_set"
        ? accumulateRunningSegment(state, action.now)
        : state;
    return {
      ...accumulated,
      phase: "review",
      resumePhase: null,
      clock: {
        ...accumulated.clock,
        currentSetStartedAt: null,
        restStartedAt: null,
        restPlannedEndsAt: null,
      },
      updatedAt: action.now,
    };
  }

  if (action.type === "finish_workout") {
    if (state.phase !== "review") return state;
    const completedExerciseIds = new Set(
      state.results
        .filter((result) => result.status === "completed")
        .map((result) => result.exerciseId)
    );
    const exerciseStatus = { ...state.exerciseStatus };
    state.queue.filter((item) => !item.activity).forEach((item) => {
      if (exerciseStatus[item.exercise.exerciseId] !== "completed") {
        exerciseStatus[item.exercise.exerciseId] = completedExerciseIds.has(
          item.exercise.exerciseId
        )
          ? "partial"
          : "skipped";
      }
    });
    return {
      ...state,
      status: "completed",
      phase: "completed",
      endedAt: action.now,
      exerciseStatus,
      updatedAt: action.now,
    };
  }

  if (action.type === "discard_workout") {
    return {
      ...state,
      status: "discarded",
      phase: "discarded",
      endedAt: action.now,
      updatedAt: action.now,
    };
  }

  return state;
}

export function getWorkoutTimes(state: WorkoutRuntimeState, now: number) {
  const liveSetMs =
    state.phase === "active_set" && state.clock.currentSetStartedAt != null
      ? clampDuration(now - state.clock.currentSetStartedAt)
      : 0;

  return {
    setMs: state.clock.currentSetAccumulatedMs + liveSetMs,
    activeWorkoutMs: state.clock.totalActiveMs + liveSetMs,
    elapsedWorkoutMs: clampDuration((state.endedAt ?? now) - state.startedAt),
  };
}

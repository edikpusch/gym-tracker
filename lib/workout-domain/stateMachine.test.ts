import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkoutQueue } from "@/lib/workout-domain/queue";
import {
  createWorkoutRuntime,
  getWorkoutTimes,
  reduceWorkoutState,
} from "@/lib/workout-domain/stateMachine";
import {
  WORKOUT_SCHEMA_VERSION,
  type PlannedSet,
  type WorkoutExercise,
  type WorkoutSnapshot,
} from "@/lib/workout-domain/types";

function set(id: string, kind: PlannedSet["kind"] = "workset"): PlannedSet {
  return {
    id,
    kind,
    targetReps: { min: 6, max: 8 },
    targetLoad: { value: 80, unit: "kg" },
    restSeconds: 90,
  };
}

function exercise(id: string, sets: PlannedSet[]): WorkoutExercise {
  return {
    id: `instance:${id}`,
    exerciseId: id,
    name: id,
    loadKind: "external",
    weightStep: 2.5,
    sets,
  };
}

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
        id: "bench-step",
        type: "exercise",
        exercise: exercise("bench", [set("bench-1"), set("bench-2")]),
      },
    ],
  };
}

test("a set only starts explicitly and completion enters rest", () => {
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: snapshot(),
    now: 1_000,
  });

  assert.equal(state.phase, "ready");
  assert.equal(getWorkoutTimes(state, 2_000).setMs, 0);

  state = reduceWorkoutState(state, { type: "start_set", now: 2_000 });
  assert.equal(state.phase, "active_set");
  assert.equal(getWorkoutTimes(state, 4_000).setMs, 2_000);

  state = reduceWorkoutState(state, { type: "complete_set", now: 7_000 });
  assert.equal(state.phase, "resting");
  assert.equal(state.results[0]?.activeDurationMs, 5_000);
  assert.equal(state.clock.totalActiveMs, 5_000);
  assert.equal(state.clock.restPlannedEndsAt, 97_000);

  const tooEarly = reduceWorkoutState(state, {
    type: "finish_rest",
    now: 96_999,
  });
  assert.equal(tooEarly.phase, "resting");

  state = reduceWorkoutState(state, { type: "finish_rest", now: 97_000 });
  assert.equal(state.phase, "ready");
  assert.equal(state.clock.currentSetStartedAt, null);
});

test("bodyweight sets preserve body weight and use the exercise unit", () => {
  const bodyweightExercise: WorkoutExercise = {
    ...exercise("pullup", [{ ...set("pullup-1"), targetLoad: { value: 0, unit: "lb" } }]),
    loadKind: "bodyweight",
    weightUnit: "lb",
    weightStep: 1,
  };
  let state = createWorkoutRuntime({
    sessionId: "session:bodyweight",
    snapshot: {
      ...snapshot(),
      steps: [{ id: "pullup-step", type: "exercise", exercise: bodyweightExercise }],
    },
    now: 1_000,
  });

  assert.equal(state.draft.unit, "lb");
  state = reduceWorkoutState(state, { type: "update_draft", draft: { weight: 25, bodyWeight: 180, reps: 9 }, now: 1_500 });
  state = reduceWorkoutState(state, { type: "start_set", now: 2_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 4_000 });

  assert.equal(state.results[0]?.weight, 0);
  assert.equal(state.results[0]?.bodyWeight, 180);
  assert.equal(state.results[0]?.unit, "lb");
  assert.equal(state.results[0]?.reps, 9);
});

test("optional note, pause and mobility steps complete without creating set records", () => {
  const activitySnapshot: WorkoutSnapshot = {
    ...snapshot(),
    steps: [
      { id: "note", type: "note", label: "Hinweis", text: "Langsam ausführen" },
      { id: "pause", type: "pause", label: "Pause", seconds: 30 },
      { id: "mobility", type: "mobility", label: "Schulterkreisen", durationSeconds: 10, rounds: 2 },
    ],
  };
  let state = createWorkoutRuntime({ sessionId: "session:activities", snapshot: activitySnapshot, now: 1_000 });

  state = reduceWorkoutState(state, { type: "complete_activity", now: 2_000 });
  assert.equal(state.queue[state.queueIndex].activity?.type, "pause");
  state = reduceWorkoutState(state, { type: "start_activity", now: 3_000 });
  assert.equal(state.phase, "timed_activity");
  assert.equal(state.clock.restPlannedEndsAt, 33_000);
  state = reduceWorkoutState(state, { type: "complete_activity", now: 33_000 });
  assert.equal(state.queue[state.queueIndex].activity?.type, "mobility");
  state = reduceWorkoutState(state, { type: "start_activity", now: 34_000 });
  state = reduceWorkoutState(state, { type: "complete_activity", now: 54_000 });

  assert.equal(state.phase, "review");
  assert.equal(state.results.length, 0);
  assert.equal(state.completedActivityIds.length, 3);
  assert.equal(state.clock.totalActiveMs, 20_000);
});

test("skipping an exercise preserves the following optional activity", () => {
  const mixedSnapshot: WorkoutSnapshot = {
    ...snapshot(),
    steps: [
      { id: "a-step", type: "exercise", exercise: exercise("a", [set("a-1")]) },
      { id: "note", type: "note", label: "Technik", text: "Ruhig" },
      { id: "b-step", type: "exercise", exercise: exercise("b", [set("b-1")]) },
    ],
  };
  let state = createWorkoutRuntime({ sessionId: "session:skip-activity", snapshot: mixedSnapshot, now: 1_000 });

  state = reduceWorkoutState(state, { type: "skip_exercise", exerciseId: "a", now: 2_000 });
  assert.equal(state.queue[state.queueIndex].activity?.type, "note");
  state = reduceWorkoutState(state, { type: "complete_activity", now: 3_000 });
  assert.equal(state.queue[state.queueIndex].exercise.exerciseId, "b");
});

test("free exercise selection finishes every remaining step without repeats", () => {
  const mixedSnapshot: WorkoutSnapshot = {
    ...snapshot(),
    steps: [
      { id: "a-step", type: "exercise", exercise: exercise("a", [set("a-1")]) },
      { id: "note", type: "note", label: "Technik", text: "Ruhig" },
      { id: "b-step", type: "exercise", exercise: exercise("b", [set("b-1")]) },
    ],
  };
  let state = createWorkoutRuntime({ sessionId: "session:jump", snapshot: mixedSnapshot, now: 1_000 });
  const bIndex = state.queue.findIndex((item) => !item.activity && item.exercise.exerciseId === "b");
  state = reduceWorkoutState(state, { type: "select_queue_item", queueIndex: bIndex, now: 2_000 });
  state = reduceWorkoutState(state, { type: "start_set", now: 3_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 4_000 });
  state = reduceWorkoutState(state, { type: "skip_rest", now: 4_500 });
  assert.equal(state.queue[state.queueIndex].exercise.exerciseId, "a");

  state = reduceWorkoutState(state, { type: "start_set", now: 5_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 6_000 });
  state = reduceWorkoutState(state, { type: "skip_rest", now: 6_500 });
  assert.equal(state.queue[state.queueIndex].activity?.type, "note");
  state = reduceWorkoutState(state, { type: "complete_activity", now: 7_000 });

  assert.equal(state.phase, "review");
  assert.deepEqual(state.results.filter((result) => result.status === "completed").map((result) => result.exerciseId), ["b", "a"]);
  assert.deepEqual(state.completedActivityIds, ["queue:note"]);
});

test("leaving the app pauses only the set timer", () => {
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: snapshot(),
    now: 1_000,
  });
  state = reduceWorkoutState(state, { type: "start_set", now: 2_000 });
  state = reduceWorkoutState(state, { type: "app_hidden", now: 5_000 });

  assert.equal(state.phase, "interrupted");
  assert.equal(getWorkoutTimes(state, 12_000).setMs, 3_000);
  assert.equal(getWorkoutTimes(state, 12_000).elapsedWorkoutMs, 11_000);

  state = reduceWorkoutState(state, {
    type: "resume_interrupted_set",
    now: 12_000,
  });
  state = reduceWorkoutState(state, { type: "complete_set", now: 14_000 });

  assert.equal(state.results[0]?.activeDurationMs, 5_000);
  assert.equal(state.results[0]?.startedAt, 2_000);
  assert.equal(state.clock.totalActiveMs, 5_000);
});

test("a manually paused workout freezes a running rest timer", () => {
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: snapshot(),
    now: 0,
  });
  state = reduceWorkoutState(state, { type: "start_set", now: 1_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 2_000 });
  state = reduceWorkoutState(state, { type: "pause_workout", now: 12_000 });

  assert.equal(state.phase, "workout_paused");
  assert.equal(state.clock.frozenRestRemainingMs, 80_000);

  state = reduceWorkoutState(state, { type: "resume_workout", now: 50_000 });
  assert.equal(state.phase, "resting");
  assert.equal(state.clock.restPlannedEndsAt, 130_000);
});

test("supersets alternate work sets after optional warm-ups", () => {
  const grouped: WorkoutSnapshot = {
    ...snapshot(),
    steps: [
      {
        id: "superset",
        type: "superset",
        label: "A",
        rounds: 2,
        transitionSeconds: 15,
        roundRestSeconds: 90,
        exercises: [
          exercise("row", [
            set("row-warmup", "warmup"),
            set("row-1"),
            set("row-2"),
          ]),
          exercise("press", [set("press-1"), set("press-2")]),
        ],
      },
    ],
  };

  const queue = buildWorkoutQueue(grouped);
  assert.deepEqual(
    queue.map((item) => [
      item.exercise.exerciseId,
      item.plannedSet.id,
      item.restSeconds,
    ]),
    [
      ["row", "row-warmup", 90],
      ["row", "row-1", 15],
      ["press", "press-1", 90],
      ["row", "row-2", 15],
      ["press", "press-2", 90],
    ]
  );
});

test("the last completed set can be edited and undone without losing history", () => {
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: snapshot(),
    now: 0,
  });
  state = reduceWorkoutState(state, { type: "start_set", now: 1_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 4_000 });
  state = reduceWorkoutState(state, {
    type: "edit_last_set",
    weight: 82.5,
    reps: 7,
    now: 5_000,
  });

  assert.equal(state.results[0]?.weight, 82.5);
  assert.equal(state.results[0]?.reps, 7);

  state = reduceWorkoutState(state, { type: "undo_last_set", now: 6_000 });
  assert.equal(state.phase, "ready");
  assert.equal(state.queueIndex, 0);
  assert.equal(state.results[0]?.status, "deleted");
  assert.equal(state.clock.totalActiveMs, 0);
  assert.equal(state.draft.weight, 82.5);
});

test("an exercise can be deferred and selected again later", () => {
  const multiExercise: WorkoutSnapshot = {
    ...snapshot(),
    steps: [
      snapshot().steps[0]!,
      {
        id: "row-step",
        type: "exercise",
        exercise: exercise("row", [set("row-1")]),
      },
    ],
  };
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: multiExercise,
    now: 0,
  });
  state = reduceWorkoutState(state, {
    type: "defer_exercise",
    exerciseId: "bench",
    now: 1_000,
  });

  assert.equal(state.exerciseStatus.bench, "deferred");
  assert.equal(state.queue[state.queueIndex]?.exercise.exerciseId, "row");

  state = reduceWorkoutState(state, {
    type: "select_queue_item",
    queueIndex: 0,
    now: 2_000,
  });
  assert.equal(state.exerciseStatus.bench, "current");
});

test("skipped exercises are not selected by automatic progression", () => {
  const multiExercise: WorkoutSnapshot = {
    ...snapshot(),
    steps: [
      snapshot().steps[0]!,
      {
        id: "row-step",
        type: "exercise",
        exercise: exercise("row", [set("row-1")]),
      },
    ],
  };
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: multiExercise,
    now: 0,
  });
  state = reduceWorkoutState(state, {
    type: "skip_exercise",
    exerciseId: "bench",
    now: 1_000,
  });

  assert.equal(state.exerciseStatus.bench, "skipped");
  assert.equal(state.queue[state.queueIndex]?.exercise.exerciseId, "row");
});

test("an early finish keeps completed sets while discard clears active status", () => {
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: snapshot(),
    now: 0,
  });
  state = reduceWorkoutState(state, { type: "start_set", now: 1_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 2_000 });
  state = reduceWorkoutState(state, { type: "review_workout", now: 3_000 });
  state = reduceWorkoutState(state, { type: "finish_workout", now: 4_000 });

  assert.equal(state.status, "completed");
  assert.equal(state.results.filter((result) => result.status === "completed").length, 1);

  let discarded = createWorkoutRuntime({
    sessionId: "session:discarded",
    snapshot: snapshot(),
    now: 0,
  });
  discarded = reduceWorkoutState(discarded, {
    type: "discard_workout",
    now: 2_000,
  });
  assert.equal(discarded.status, "discarded");
  assert.equal(discarded.phase, "discarded");
});

test("re-logging a set after undo keeps record ids unique", () => {
  let state = createWorkoutRuntime({
    sessionId: "session:test",
    snapshot: snapshot(),
    now: 1_000,
  });
  state = reduceWorkoutState(state, { type: "update_draft", draft: { weight: 60, reps: 10 }, now: 1_100 });
  state = reduceWorkoutState(state, { type: "start_set", now: 2_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 5_000 });
  state = reduceWorkoutState(state, { type: "undo_last_set", now: 6_000 });
  state = reduceWorkoutState(state, { type: "update_draft", draft: { weight: 62.5, reps: 10 }, now: 6_500 });
  state = reduceWorkoutState(state, { type: "start_set", now: 7_000 });
  state = reduceWorkoutState(state, { type: "complete_set", now: 9_000 });

  assert.equal(state.results.length, 2);
  assert.equal(new Set(state.results.map((record) => record.id)).size, 2);
  assert.equal(state.results.filter((record) => record.status === "completed").length, 1);
  assert.equal(state.results.find((record) => record.status === "completed")?.weight, 62.5);
});

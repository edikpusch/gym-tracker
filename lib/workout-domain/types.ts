export const WORKOUT_SCHEMA_VERSION = 2 as const;

export type WeightUnit = "kg" | "lb";

export type LoadKind =
  | "external"
  | "bodyweight"
  | "bodyweight-plus"
  | "assisted"
  | "machine"
  | "per-side";

export type PlannedSetKind = "warmup" | "workset" | "dropset";
export type RecordedSetStatus = "completed" | "aborted" | "deleted";

export type RepTarget = {
  min: number;
  max: number;
};

export type LoadTarget = {
  value: number;
  unit: WeightUnit;
};

export type PlannedSet = {
  id: string;
  kind: PlannedSetKind;
  targetReps: RepTarget;
  targetLoad?: LoadTarget;
  restSeconds: number;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  guidanceKey?: string;
  name: string;
  loadKind: LoadKind;
  weightStep: number;
  weightUnit?: WeightUnit;
  sets: PlannedSet[];
  notes?: string;
  mediaId?: string;
};

export type ExerciseWorkoutStep = {
  id: string;
  type: "exercise";
  exercise: WorkoutExercise;
};

export type SupersetWorkoutStep = {
  id: string;
  type: "superset";
  label: string;
  rounds: number;
  transitionSeconds: number;
  roundRestSeconds: number;
  exercises: WorkoutExercise[];
};

export type CircuitWorkoutStep = {
  id: string;
  type: "circuit";
  label: string;
  rounds: number;
  transitionSeconds: number;
  roundRestSeconds: number;
  exercises: WorkoutExercise[];
};

export type PauseWorkoutStep = {
  id: string;
  type: "pause";
  label: string;
  seconds: number;
};

export type MobilityWorkoutStep = {
  id: string;
  type: "mobility";
  label: string;
  durationSeconds: number;
  rounds: number;
  mediaId?: string;
};

export type NoteWorkoutStep = {
  id: string;
  type: "note";
  label: string;
  text: string;
};

export type WorkoutStep =
  | ExerciseWorkoutStep
  | SupersetWorkoutStep
  | CircuitWorkoutStep
  | PauseWorkoutStep
  | MobilityWorkoutStep
  | NoteWorkoutStep;

export type WorkoutSnapshot = {
  schemaVersion: typeof WORKOUT_SCHEMA_VERSION;
  planId: string;
  planName: string;
  workoutId: string;
  workoutName: string;
  capturedAt: number;
  steps: WorkoutStep[];
};

export type WorkoutQueueItem = {
  id: string;
  stepId: string;
  groupId?: string;
  groupType?: "superset" | "circuit";
  round?: number;
  exercise: WorkoutExercise;
  plannedSet: PlannedSet;
  restSeconds: number;
  activity?: {
    type: "pause" | "mobility" | "note";
    label: string;
    text?: string;
    durationSeconds?: number;
    rounds?: number;
  };
};

export type SetDraft = {
  weight: number;
  reps: number;
  bodyWeight?: number;
  unit: WeightUnit;
};

export type SessionSetRecord = {
  id: string;
  sessionId: string;
  queueItemId: string;
  stepId: string;
  exerciseId: string;
  exerciseName: string;
  setKind: PlannedSetKind;
  status: RecordedSetStatus;
  weight: number;
  reps: number;
  bodyWeight?: number;
  unit: WeightUnit;
  startedAt: number;
  completedAt: number;
  activeDurationMs: number;
  restStartedAt?: number;
  restEndedAt?: number;
  actualRestMs?: number;
  updatedAt: number;
};

export type ExerciseProgressStatus =
  | "not_started"
  | "current"
  | "partial"
  | "completed"
  | "deferred"
  | "skipped";

export type SessionPhase =
  | "ready"
  | "active_set"
  | "resting"
  | "timed_activity"
  | "interrupted"
  | "workout_paused"
  | "review"
  | "completed"
  | "discarded";

export type SessionStatus =
  | "in_progress"
  | "completed"
  | "discarded"
  | "legacy_incomplete";

export type WorkoutClock = {
  workoutStartedAt: number;
  currentSetWallStartedAt: number | null;
  currentSetStartedAt: number | null;
  currentSetAccumulatedMs: number;
  totalActiveMs: number;
  exerciseActiveMs: Record<string, number>;
  restStartedAt: number | null;
  restPlannedEndsAt: number | null;
  frozenRestRemainingMs: number | null;
  lastRestCompletedAt?: number | null;
};

export type WorkoutRuntimeState = {
  schemaVersion: typeof WORKOUT_SCHEMA_VERSION;
  sessionId: string;
  status: SessionStatus;
  phase: SessionPhase;
  resumePhase: "ready" | "active_set" | "resting" | "timed_activity" | null;
  snapshot: WorkoutSnapshot;
  queue: WorkoutQueueItem[];
  queueIndex: number;
  draft: SetDraft;
  results: SessionSetRecord[];
  completedActivityIds: string[];
  exerciseStatus: Record<string, ExerciseProgressStatus>;
  clock: WorkoutClock;
  startedAt: number;
  endedAt: number | null;
  updatedAt: number;
  migrationSource?: "legacy-dexie-v1";
};

export type WorkoutMetaEntry = {
  key: string;
  value: string;
  updatedAt: number;
};

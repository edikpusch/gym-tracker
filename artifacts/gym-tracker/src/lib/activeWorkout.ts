

import {
  getStorageItem,
  hasAppStorage,
  removeStorageItem,
  setStorageItem,
} from "@/lib/appStorage";

export type ActiveWorkoutState = {
  href: string;
  workoutLabel: string;
  planName?: string;
  dayName?: string;
  stateLabel: string;
  sessionId: number;
  workoutType: string;
  updatedAt: number;
};

export const ACTIVE_WORKOUT_KEY = "gym-tracker.active-workout";
export const ACTIVE_WORKOUT_SNAPSHOT_KEY = "gym-tracker.active-workout-snapshot";

export type ActiveWorkoutSnapshot = {
  workoutType: string;
  sessionId: number;
  exerciseIndex: number;
  exerciseInstanceId?: string;
  exerciseReference?: string;
  setIndex: number;
  weight: number;
  reps: number;
  isResting: boolean;
  restEndsAt: number | null;
  stretchIndex: number;
  stretchEndsAt: number | null;
  workoutPausedAt: number | null;
  startTime: number;
  setStartedAt: number;
  updatedAt: number;
};

export function getActiveWorkoutState(): ActiveWorkoutState | null {
  if (!hasAppStorage()) {
    return null;
  }

  try {
    const raw = getStorageItem(ACTIVE_WORKOUT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ActiveWorkoutState;
    const snapshot = getStoredSnapshot();
    if (
      !parsed?.href ||
      !parsed?.workoutLabel ||
      typeof parsed.sessionId !== "number" ||
      typeof parsed.workoutType !== "string" ||
      !snapshot ||
      snapshot.sessionId !== parsed.sessionId ||
      snapshot.workoutType !== parsed.workoutType
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setActiveWorkoutState(state: ActiveWorkoutState) {
  if (!hasAppStorage()) {
    return;
  }

  setStorageItem(ACTIVE_WORKOUT_KEY, JSON.stringify(state));
}

function getStoredSnapshot(): ActiveWorkoutSnapshot | null {
  if (!hasAppStorage()) {
    return null;
  }

  try {
    const raw = getStorageItem(ACTIVE_WORKOUT_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ActiveWorkoutSnapshot;
    if (
      typeof parsed?.workoutType !== "string" ||
      typeof parsed?.sessionId !== "number" ||
      typeof parsed?.exerciseIndex !== "number" ||
      typeof parsed?.setIndex !== "number" ||
      (parsed.exerciseInstanceId != null &&
        typeof parsed.exerciseInstanceId !== "string") ||
      (parsed.exerciseReference != null &&
        typeof parsed.exerciseReference !== "string")
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getActiveWorkoutSnapshot(
  workoutType: string
): ActiveWorkoutSnapshot | null {
  const snapshot = getStoredSnapshot();
  if (!snapshot || snapshot.workoutType !== workoutType) {
    return null;
  }

  return snapshot;
}

export function setActiveWorkoutSnapshot(snapshot: ActiveWorkoutSnapshot) {
  if (!hasAppStorage()) {
    return;
  }

  setStorageItem(
    ACTIVE_WORKOUT_SNAPSHOT_KEY,
    JSON.stringify(snapshot)
  );
}

export function clearActiveWorkoutState() {
  if (!hasAppStorage()) {
    return;
  }

  removeStorageItem(ACTIVE_WORKOUT_KEY);
  removeStorageItem(ACTIVE_WORKOUT_SNAPSHOT_KEY);
}

"use client";

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

const ACTIVE_WORKOUT_KEY = "gym-tracker.active-workout";
const ACTIVE_WORKOUT_SNAPSHOT_KEY = "gym-tracker.active-workout-snapshot";

export type ActiveWorkoutSnapshot = {
  workoutType: string;
  sessionId: number;
  exerciseIndex: number;
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

function hasStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function getActiveWorkoutState(): ActiveWorkoutState | null {
  if (!hasStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_WORKOUT_KEY);
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
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(state));
}

function getStoredSnapshot(): ActiveWorkoutSnapshot | null {
  if (!hasStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_WORKOUT_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ActiveWorkoutSnapshot;
    if (
      typeof parsed?.workoutType !== "string" ||
      typeof parsed?.sessionId !== "number" ||
      typeof parsed?.exerciseIndex !== "number" ||
      typeof parsed?.setIndex !== "number"
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
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(
    ACTIVE_WORKOUT_SNAPSHOT_KEY,
    JSON.stringify(snapshot)
  );
}

export function clearActiveWorkoutState() {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  window.localStorage.removeItem(ACTIVE_WORKOUT_SNAPSHOT_KEY);
}

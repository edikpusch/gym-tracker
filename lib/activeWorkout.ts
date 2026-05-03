"use client";

export type ActiveWorkoutState = {
  href: string;
  workoutLabel: string;
  planName?: string;
  dayName?: string;
  stateLabel: string;
  updatedAt: number;
};

const ACTIVE_WORKOUT_KEY = "gym-tracker.active-workout";

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
    if (!parsed?.href || !parsed?.workoutLabel) {
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

export function clearActiveWorkoutState() {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(ACTIVE_WORKOUT_KEY);
}

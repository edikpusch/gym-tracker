"use client";

import { create } from "zustand";
import type { SetEntry } from "@/lib/db";

export type WorkoutPhase =
  | "idle"
  | "warmup"
  | "active"
  | "resting"
  | "done";

export type ActiveSet = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  setType: "warmup" | "workset";
  weight: number;
  reps: number;
};

export type WorkoutState = {
  sessionId: number | null;
  planId: string | null;
  planName: string | null;
  dayId: string | null;
  dayName: string | null;
  startedAt: number | null;
  phase: WorkoutPhase;
  exerciseIndex: number;
  setIndex: number;
  weight: number;
  reps: number;
  restEndsAt: number | null;
  restDurationSec: number;
  loggedSets: SetEntry[];
  pendingSet: ActiveSet | null;
};

type WorkoutActions = {
  startWorkout: (params: {
    planId: string;
    planName: string;
    dayId: string;
    dayName: string;
  }) => void;
  setPhase: (phase: WorkoutPhase) => void;
  setExerciseIndex: (index: number) => void;
  setSetIndex: (index: number) => void;
  setWeight: (weight: number) => void;
  setReps: (reps: number) => void;
  startRest: (durationSec: number) => void;
  skipRest: () => void;
  addLoggedSet: (set: SetEntry) => void;
  removeLoggedSet: (id: number) => void;
  updateLoggedSet: (id: number, patch: Partial<SetEntry>) => void;
  setPendingSet: (set: ActiveSet | null) => void;
  endWorkout: () => void;
  resetWorkout: () => void;
};

const initialState: WorkoutState = {
  sessionId: null,
  planId: null,
  planName: null,
  dayId: null,
  dayName: null,
  startedAt: null,
  phase: "idle",
  exerciseIndex: 0,
  setIndex: 0,
  weight: 40,
  reps: 10,
  restEndsAt: null,
  restDurationSec: 90,
  loggedSets: [],
  pendingSet: null,
};

export const useWorkoutStore = create<WorkoutState & WorkoutActions>((set) => ({
  ...initialState,

  startWorkout: ({ planId, planName, dayId, dayName }) => {
    const now = Date.now();
    set({
      sessionId: now,
      planId,
      planName,
      dayId,
      dayName,
      startedAt: now,
      phase: "active",
      exerciseIndex: 0,
      setIndex: 0,
      loggedSets: [],
      pendingSet: null,
      restEndsAt: null,
    });
  },

  setPhase: (phase) => set({ phase }),
  setExerciseIndex: (exerciseIndex) => set({ exerciseIndex, setIndex: 0 }),
  setSetIndex: (setIndex) => set({ setIndex }),
  setWeight: (weight) => set({ weight }),
  setReps: (reps) => set({ reps }),

  startRest: (durationSec) =>
    set({ phase: "resting", restEndsAt: Date.now() + durationSec * 1000, restDurationSec: durationSec }),

  skipRest: () => set({ phase: "active", restEndsAt: null }),

  addLoggedSet: (entry) =>
    set((state) => ({ loggedSets: [...state.loggedSets, entry] })),

  removeLoggedSet: (id) =>
    set((state) => ({ loggedSets: state.loggedSets.filter((s) => s.id !== id) })),

  updateLoggedSet: (id, patch) =>
    set((state) => ({
      loggedSets: state.loggedSets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),

  setPendingSet: (pendingSet) => set({ pendingSet }),

  endWorkout: () => set({ phase: "done" }),

  resetWorkout: () => set(initialState),
}));

export type AppStore = {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
};

export const useAppStore = create<AppStore>((set) => ({
  theme: "dark",
  setTheme: (theme) => set({ theme }),
}));

import { getAllWorkoutDays } from "@/lib/workoutPlan";

const STORAGE_KEY = "gym-tracker-sets";
const PLAN_VERSION_KEY = "gym-tracker-plan-version";
const PLAN_VERSION = "2026-04-23-plan-v2";

export type SetType = {
  exercise: string;
  weight: number;
  reps: number;
  set: number;
  sessionId: number;
  timestamp: number;
  type?: string;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
};

export type SetComparisonKind = "better" | "worse" | "same" | "new";

const REP_RANGES: Record<string, { min: number; max: number }> =
  getAllWorkoutDays().reduce<Record<string, { min: number; max: number }>>(
    (acc, day) => {
      day.exercises.forEach((exercise) => {
        acc[exercise.name] = {
          min: exercise.minReps,
          max: exercise.maxReps,
        };
      });
      return acc;
    },
    {}
  );

function getWorkSets(sets: SetType[]) {
  return sets.filter((set) => set.set > 0);
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readStoredSets(): SetType[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidSet).sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error("Local set storage could not be read:", error);
    return [];
  }
}

function writeStoredSets(sets: SetType[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch (error) {
    console.error("Local set storage could not be written:", error);
  }
}

export function ensureCurrentPlanStorage() {
  if (!canUseStorage()) {
    return;
  }

  try {
    const currentVersion = window.localStorage.getItem(PLAN_VERSION_KEY);

    if (currentVersion === PLAN_VERSION) {
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(PLAN_VERSION_KEY, PLAN_VERSION);
  } catch (error) {
    console.error("Local plan storage could not be updated:", error);
  }
}

function isValidSet(value: unknown): value is SetType {
  if (!value || typeof value !== "object") {
    return false;
  }

  const set = value as Partial<SetType>;

  return (
    typeof set.exercise === "string" &&
    typeof set.weight === "number" &&
    typeof set.reps === "number" &&
    typeof set.set === "number" &&
    typeof set.sessionId === "number" &&
    typeof set.timestamp === "number"
  );
}

export async function getAllSets(): Promise<SetType[]> {
  return readStoredSets().sort((a, b) => b.timestamp - a.timestamp);
}

export async function getSetsBySession(sessionId: number): Promise<SetType[]> {
  return readStoredSets()
    .filter((set) => set.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function deleteWorkoutSession(
  sessionId: number
): Promise<boolean> {
  const currentSets = readStoredSets();
  const nextSets = currentSets.filter((set) => set.sessionId !== sessionId);

  if (nextSets.length === currentSets.length) {
    return false;
  }

  writeStoredSets(nextSets);
  return true;
}

export async function getLastSetForExercise(
  exercise: string,
  setNumber: number,
  workoutType?: string
): Promise<SetType | null> {
  const match = readStoredSets()
    .filter(
      (set) =>
        set.exercise === exercise &&
        set.set === setNumber &&
        (!workoutType || set.type === workoutType)
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return match ?? null;
}

export async function getPreviousMatchingSet(
  exercise: string,
  setNumber: number,
  workoutType: string | undefined,
  currentSessionId: number
): Promise<SetType | null> {
  const match = readStoredSets()
    .filter(
      (set) =>
        set.exercise === exercise &&
        set.set === setNumber &&
        set.sessionId !== currentSessionId &&
        (!workoutType || set.type === workoutType)
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return match ?? null;
}

export async function getBestMatchingSet(
  exercise: string,
  setNumber: number,
  workoutType?: string
): Promise<SetType | null> {
  const matches = readStoredSets().filter(
    (set) =>
      set.exercise === exercise &&
      set.set === setNumber &&
      (!workoutType || set.type === workoutType)
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((best, current) => {
    if (current.weight > best.weight) {
      return current;
    }

    if (current.weight === best.weight && current.reps > best.reps) {
      return current;
    }

    return best;
  }, matches[0]);
}

export async function getLastSessionForExercise(
  exercise: string,
  currentSessionId: number,
  workoutType?: string
): Promise<SetType[]> {
  const all = readStoredSets()
    .filter(
      (set) =>
        set.exercise === exercise &&
        (!workoutType || set.type === workoutType)
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  const previous = all.find((set) => set.sessionId !== currentSessionId);

  if (!previous) {
    return [];
  }

  return all
    .filter((set) => set.sessionId === previous.sessionId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function getTopSet(sets: SetType[]): SetType | null {
  const workSets = getWorkSets(sets);

  if (workSets.length === 0) {
    return null;
  }

  return workSets.reduce((best, current) => {
    if (current.weight > best.weight) {
      return current;
    }

    if (current.weight === best.weight && current.reps > best.reps) {
      return current;
    }

    return best;
  }, workSets[0]);
}

export function getFatigue(sets: SetType[]) {
  const workSets = getWorkSets(sets);

  if (workSets.length < 2) {
    return null;
  }

  return workSets[workSets.length - 1].reps - workSets[0].reps;
}

export function getProgress(current: SetType | null, last: SetType | null) {
  if (!current || !last) {
    return null;
  }

  return {
    weight: current.weight - last.weight,
    reps: current.reps - last.reps,
  };
}

export function getSetComparison(
  current: SetType | null,
  previous: SetType | null
) {
  if (!current) {
    return null;
  }

  if (!previous) {
    return {
      kind: "new" as SetComparisonKind,
      weight: 0,
      reps: 0,
    };
  }

  const weight = current.weight - previous.weight;
  const reps = current.reps - previous.reps;

  if (weight > 0 || (weight === 0 && reps > 0)) {
    return {
      kind: "better" as SetComparisonKind,
      weight,
      reps,
    };
  }

  if (weight < 0 || (weight === 0 && reps < 0)) {
    return {
      kind: "worse" as SetComparisonKind,
      weight,
      reps,
    };
  }

  return {
    kind: "same" as SetComparisonKind,
    weight,
    reps,
  };
}

export function getCoachDecision(exercise: string, sets: SetType[]) {
  const range = REP_RANGES[exercise];
  const workSets = getWorkSets(sets);

  if (!range || workSets.length === 0) {
    return { action: "keep", reason: "no data" };
  }

  const top = getTopSet(workSets);
  const fatigue = getFatigue(workSets);

  if (!top || fatigue === null) {
    return { action: "keep", reason: "insufficient data" };
  }

  if (top.reps >= range.max && fatigue >= -2) {
    return { action: "increase", reason: "strong" };
  }

  if (top.reps < range.min || fatigue <= -4) {
    return { action: "decrease", reason: "fatigue/high effort" };
  }

  return { action: "keep", reason: "stable" };
}

export async function saveSet({
  exercise,
  weight,
  reps,
  set,
  sessionId,
  type,
  planId,
  planName,
  dayId,
  dayName,
}: {
  exercise: string;
  weight: number;
  reps: number;
  set: number;
  sessionId: number;
  type?: string;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
}) {
  if (!sessionId || Number.isNaN(sessionId)) {
    console.error("Invalid sessionId.");
    return;
  }

  const nextSet: SetType = {
    exercise,
    weight,
    reps,
    set,
    sessionId,
    timestamp: Date.now(),
    type: type ?? detectWorkoutType(exercise),
    planId,
    planName,
    dayId,
    dayName,
  };

  const sets = readStoredSets();
  sets.push(nextSet);
  writeStoredSets(sets);
}

function detectWorkoutType(exercise: string) {
  if (
    [
      "benchpress",
      "pullups_wide",
      "shoulderpress",
      "dips",
      "bulgarian",
      "hanging_leg_raises",
    ].includes(exercise)
  ) {
    return "push";
  }

  if (
    [
      "rows",
      "pushups",
      "romanian_deadlift",
      "face_pulls",
      "walking_lunges",
    ].includes(exercise)
  ) {
    return "pull";
  }

  if (
    ["squat", "pullups", "shoulderpress_pushups", "core"].includes(exercise)
  ) {
    return "mixed";
  }

  return "workout";
}

import { getItem, setItem } from "./storage";

export const WORKOUT_LOG_KEY = "gym-tracker-sets";
export const BODY_WEIGHT_KEY = "gym-tracker-body-weight";
export const APP_PREFERENCES_KEY = "gym-tracker-app-preferences";

export type WorkoutType = "push" | "pull" | "legs" | "mixed";

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

export type WorkoutDay = {
  type: WorkoutType;
  name: string;
  color: string;
  softColor: string;
  exercises: Exercise[];
};

export type LoggedSet = {
  eventType?: "set";
  exercise: string;
  exerciseId?: string;
  weight: number;
  reps: number;
  set: number;
  sessionId: number;
  timestamp: number;
  type?: string;
  dayName?: string;
};

export type BodyWeightEntry = {
  id: string;
  weight: number;
  timestamp: number;
  note?: string;
};

export type AppPreferences = {
  themeMode: "light" | "dark";
};

export const DEFAULT_PLAN: Record<WorkoutType, WorkoutDay> = {
  push: {
    type: "push",
    name: "Push",
    color: "#E52B2E",
    softColor: "#FEECEC",
    exercises: [
      { id: "benchpress", name: "Bankdrücken", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
      { id: "incline_benchpress", name: "Schrägbankdrücken", sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      { id: "overhead_press", name: "Schulterdrücken", sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      { id: "lateral_raise", name: "Seitheben", sets: 3, minReps: 12, maxReps: 15, restSeconds: 60 },
      { id: "dips", name: "Dips", sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
    ],
  },
  pull: {
    type: "pull",
    name: "Pull",
    color: "#2563EB",
    softColor: "#EFF5FF",
    exercises: [
      { id: "pullups_wide", name: "Klimmzüge breit", sets: 3, minReps: 5, maxReps: 8, restSeconds: 120 },
      { id: "chest_supported_row", name: "Chest Supported Row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      { id: "cable_row", name: "Rudern am Kabel", sets: 3, minReps: 10, maxReps: 12, restSeconds: 90 },
      { id: "bicep_curl", name: "Bizepscurl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 60 },
      { id: "facepull", name: "Face Pull", sets: 3, minReps: 12, maxReps: 15, restSeconds: 60 },
    ],
  },
  legs: {
    type: "legs",
    name: "Legs",
    color: "#16A34A",
    softColor: "#ECFDF3",
    exercises: [
      { id: "squat", name: "Kniebeugen", sets: 4, minReps: 6, maxReps: 10, restSeconds: 180 },
      { id: "leg_press", name: "Beinpresse", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
      { id: "rdl", name: "Romanian Deadlift", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
      { id: "leg_curl", name: "Leg Curl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 60 },
      { id: "calf_raise", name: "Wadenheben", sets: 3, minReps: 15, maxReps: 20, restSeconds: 60 },
    ],
  },
  mixed: {
    type: "mixed",
    name: "Mixed",
    color: "#16A34A",
    softColor: "#ECFDF3",
    exercises: [
      { id: "squat", name: "Kniebeugen", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
      { id: "pullups", name: "Klimmzüge", sets: 3, minReps: 5, maxReps: 8, restSeconds: 120 },
      { id: "benchpress", name: "Bankdrücken", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
      { id: "rdl", name: "Romanian Deadlift", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
      { id: "lateral_raise", name: "Seitheben", sets: 3, minReps: 12, maxReps: 15, restSeconds: 60 },
    ],
  },
};

export async function getWorkoutLog(): Promise<LoggedSet[]> {
  const raw = await getItem(WORKOUT_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e: LoggedSet) => !e.eventType || e.eventType === "set") : [];
  } catch {
    return [];
  }
}

export async function saveWorkoutSets(newSets: LoggedSet[]): Promise<void> {
  const existing = await getWorkoutLog();
  const all = [...existing, ...newSets];
  await setItem(WORKOUT_LOG_KEY, JSON.stringify(all));
}

export type SessionSummary = {
  sessionId: number;
  dayName: string;
  workoutType: string;
  timestamp: number;
  totalSets: number;
  exercises: string[];
};

export async function getSessionSummaries(): Promise<SessionSummary[]> {
  const log = await getWorkoutLog();
  const bySession: Record<number, LoggedSet[]> = {};
  for (const entry of log) {
    if (!bySession[entry.sessionId]) bySession[entry.sessionId] = [];
    bySession[entry.sessionId].push(entry);
  }

  return Object.entries(bySession)
    .map(([, sets]) => {
      const sorted = sets.sort((a, b) => a.timestamp - b.timestamp);
      const exerciseNames = [...new Set(sorted.map((s) => s.exercise))];
      const dayName = sorted[0]?.dayName ?? sorted[0]?.type ?? "Workout";
      return {
        sessionId: sorted[0].sessionId,
        dayName,
        workoutType: sorted[0]?.type ?? "push",
        timestamp: sorted[0].timestamp,
        totalSets: sets.length,
        exercises: exerciseNames,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getBodyWeightEntries(): Promise<BodyWeightEntry[]> {
  const raw = await getItem(BODY_WEIGHT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.sort((a: BodyWeightEntry, b: BodyWeightEntry) => b.timestamp - a.timestamp) : [];
  } catch {
    return [];
  }
}

export async function saveBodyWeightEntry(weight: number, note?: string): Promise<BodyWeightEntry> {
  const entry: BodyWeightEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    weight,
    timestamp: Date.now(),
    note: note?.trim() || undefined,
  };
  const entries = await getBodyWeightEntries();
  entries.push(entry);
  await setItem(BODY_WEIGHT_KEY, JSON.stringify(entries));
  return entry;
}

export async function deleteBodyWeightEntry(id: string): Promise<void> {
  const entries = await getBodyWeightEntries();
  await setItem(BODY_WEIGHT_KEY, JSON.stringify(entries.filter((e) => e.id !== id)));
}

export async function getPreferences(): Promise<AppPreferences> {
  const raw = await getItem(APP_PREFERENCES_KEY);
  if (!raw) return { themeMode: "light" };
  try {
    const parsed = JSON.parse(raw);
    return { themeMode: parsed?.themeMode === "dark" ? "dark" : "light" };
  } catch {
    return { themeMode: "light" };
  }
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  const existing = await getItem(APP_PREFERENCES_KEY);
  const current = existing ? JSON.parse(existing) : {};
  await setItem(APP_PREFERENCES_KEY, JSON.stringify({ ...current, ...prefs }));
}

export async function getSessionSets(sessionId: number): Promise<LoggedSet[]> {
  const log = await getWorkoutLog();
  return log.filter((s) => s.sessionId === sessionId);
}

export type ExerciseProgressItem = {
  exerciseId: string;
  exercise: string;
  latestSet: LoggedSet;
  previousSet: LoggedSet | null;
  bestSet: LoggedSet | null;
  deltaWeight: number;
  deltaReps: number;
  kind: "better" | "worse" | "same" | "new";
};

export async function getExerciseProgress(): Promise<ExerciseProgressItem[]> {
  const log = await getWorkoutLog();
  const byExercise: Record<string, LoggedSet[]> = {};
  for (const set of log) {
    const key = set.exerciseId ?? set.exercise;
    if (!byExercise[key]) byExercise[key] = [];
    byExercise[key].push(set);
  }

  return Object.entries(byExercise).map(([, sets]) => {
    const sorted = [...sets].sort((a, b) => a.timestamp - b.timestamp);
    const sessionIds = [...new Set(sorted.map((s) => s.sessionId))];
    const latestSessionId = sessionIds[sessionIds.length - 1];
    const prevSessionId = sessionIds.length >= 2 ? sessionIds[sessionIds.length - 2] : null;
    const latestSets = sorted.filter((s) => s.sessionId === latestSessionId);
    const prevSets = prevSessionId ? sorted.filter((s) => s.sessionId === prevSessionId) : [];

    const topSet = (arr: LoggedSet[]) =>
      arr.reduce<LoggedSet | null>((best, s) => {
        if (!best) return s;
        const score = s.weight * s.reps;
        return score > best.weight * best.reps ? s : best;
      }, null);

    const latestTop = topSet(latestSets)!;
    const prevTop = topSet(prevSets);
    const bestTop = topSet(sorted);

    const deltaWeight = prevTop ? latestTop.weight - prevTop.weight : 0;
    const deltaReps = prevTop ? latestTop.reps - prevTop.reps : 0;
    const kind: ExerciseProgressItem["kind"] = !prevTop
      ? "new"
      : deltaWeight > 0 || deltaReps > 0
      ? "better"
      : deltaWeight < 0 || deltaReps < 0
      ? "worse"
      : "same";

    return {
      exerciseId: sorted[0].exerciseId ?? sorted[0].exercise,
      exercise: sorted[0].exercise,
      latestSet: latestTop,
      previousSet: prevTop,
      bestSet: bestTop,
      deltaWeight,
      deltaReps,
      kind,
    };
  });
}

export type WorkoutStats = {
  totalSessions: number;
  totalSets: number;
  totalVolumeKg: number;
  thisWeekSessions: number;
  lastWeekSessions: number;
  avgSetsPerSession: number;
  mostTrainedExercise: string | null;
};

export async function getWorkoutStats(): Promise<WorkoutStats> {
  const log = await getWorkoutLog();
  if (log.length === 0) {
    return {
      totalSessions: 0,
      totalSets: 0,
      totalVolumeKg: 0,
      thisWeekSessions: 0,
      lastWeekSessions: 0,
      avgSetsPerSession: 0,
      mostTrainedExercise: null,
    };
  }

  const now = Date.now();
  const week = 7 * 86400000;
  const sessionIds = [...new Set(log.map((s) => s.sessionId))];
  const sessionTimestamps = Object.fromEntries(
    sessionIds.map((id) => {
      const ts = log.find((s) => s.sessionId === id)?.timestamp ?? 0;
      return [id, ts];
    })
  );

  const thisWeekSessions = sessionIds.filter(
    (id) => now - sessionTimestamps[id] <= week
  ).length;
  const lastWeekSessions = sessionIds.filter((id) => {
    const diff = now - sessionTimestamps[id];
    return diff > week && diff <= 2 * week;
  }).length;

  const totalVolumeKg = log.reduce((sum, s) => sum + s.weight * s.reps, 0);

  const exerciseCounts: Record<string, number> = {};
  for (const s of log) {
    exerciseCounts[s.exercise] = (exerciseCounts[s.exercise] ?? 0) + 1;
  }
  const mostTrainedExercise =
    Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalSessions: sessionIds.length,
    totalSets: log.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    thisWeekSessions,
    lastWeekSessions,
    avgSetsPerSession:
      sessionIds.length > 0
        ? Math.round((log.length / sessionIds.length) * 10) / 10
        : 0,
    mostTrainedExercise,
  };
}

export type ExerciseLibraryItem = {
  id: string;
  name: string;
  category: string;
  categoryColor: string;
};

export function getExerciseLibrary(): ExerciseLibraryItem[] {
  const categoryMeta: Record<WorkoutType, { label: string; color: string }> = {
    push: { label: "Push", color: "#E52B2E" },
    pull: { label: "Pull", color: "#2563EB" },
    legs: { label: "Beine", color: "#16A34A" },
    mixed: { label: "Mixed", color: "#16A34A" },
  };

  const seen = new Set<string>();
  const items: ExerciseLibraryItem[] = [];

  for (const [type, day] of Object.entries(DEFAULT_PLAN) as [WorkoutType, typeof DEFAULT_PLAN[WorkoutType]][]) {
    for (const ex of day.exercises) {
      if (!seen.has(ex.id)) {
        seen.add(ex.id);
        items.push({
          id: ex.id,
          name: ex.name,
          category: categoryMeta[type].label,
          categoryColor: categoryMeta[type].color,
        });
      }
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

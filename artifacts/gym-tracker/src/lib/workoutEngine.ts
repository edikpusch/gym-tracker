import {
  getStorageItem,
  hasAppStorage,
  removeStorageItem,
  setStorageItem,
} from "@/lib/appStorage";
import { resolveExerciseCatalogReference } from "@/lib/trainingCatalog";
import { getAllWorkoutDays } from "@/lib/workoutPlan";

export const WORKOUT_LOG_KEY = "gym-tracker-sets";
export const PLAN_VERSION_KEY = "gym-tracker-plan-version";
export const PLAN_VERSION = "2026-04-23-plan-v2";

export type LoggedSetType = "warmup" | "workset";

export type SetType = {
  eventType?: "set";
  exercise: string;
  exerciseId?: string;
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
  setType?: LoggedSetType;
};

export type WorkoutFlowEvent = {
  eventType: "stretch" | "pause";
  exercise: string;
  weight: 0;
  reps: 0;
  set: 0;
  sessionId: number;
  timestamp: number;
  type?: string;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
  label: string;
  contextLabel?: string;
  durationSeconds: number;
  scope?: "exercise" | "workout";
};

export type WorkoutLogEntry = SetType | WorkoutFlowEvent;
export type SetComparisonKind = "better" | "worse" | "same" | "new";
export type BestSetInsight = {
  set: SetType | null;
  label: string | null;
  detail: string | null;
  sampleCount: number;
};
export type CoachDecision = {
  action: "increase" | "keep" | "decrease";
  reason: "no-data" | "stable" | "strong" | "fatigue";
  label: string;
  detail: string;
};
export type ExerciseTrendDirection =
  | "building"
  | "up"
  | "flat"
  | "down"
  | "mixed";
export type ExerciseTrendInsight = {
  direction: ExerciseTrendDirection;
  label: string;
  detail: string;
  recentTopSets: SetType[];
  sampleCount: number;
};
export type ExerciseSuggestionSource =
  | "matching-set"
  | "last-session"
  | "best-set"
  | "default";
export type ExerciseSuggestionInsight = {
  source: ExerciseSuggestionSource;
  label: string;
  detail: string;
  weight: number | null;
  reps: number | null;
  confidence: "high" | "medium" | "baseline";
};

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

export function isLoggedSetEntry(entry: WorkoutLogEntry): entry is SetType {
  return entry.eventType !== "stretch" && entry.eventType !== "pause";
}

export function isFlowEventEntry(
  entry: WorkoutLogEntry
): entry is WorkoutFlowEvent {
  return entry.eventType === "stretch" || entry.eventType === "pause";
}

function getWorkSets(sets: SetType[]) {
  return sets.filter(isWorkSetEntry);
}

function readStoredSets(): WorkoutLogEntry[] {
  if (!hasAppStorage()) {
    return [];
  }

  try {
    const raw = getStorageItem(WORKOUT_LOG_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    let didNormalizeLegacyEntries = false;
    const normalizedEntries = parsed
      .filter(isValidEntry)
      .map((entry) => {
        const normalized = normalizeWorkoutLogEntry(entry);

        if (
          isLoggedSetEntry(entry) &&
          isLoggedSetEntry(normalized) &&
          (entry.exerciseId !== normalized.exerciseId ||
            entry.setType !== normalized.setType)
        ) {
          didNormalizeLegacyEntries = true;
        }

        return normalized;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    if (didNormalizeLegacyEntries) {
      writeStoredSets(normalizedEntries);
    }

    return normalizedEntries;
  } catch (error) {
    console.error("Local set storage could not be read:", error);
    return [];
  }
}

function writeStoredSets(sets: WorkoutLogEntry[]) {
  if (!hasAppStorage()) {
    return;
  }

  try {
    setStorageItem(WORKOUT_LOG_KEY, JSON.stringify(sets));
  } catch (error) {
    console.error("Local set storage could not be written:", error);
  }
}

export function ensureCurrentPlanStorage() {
  if (!hasAppStorage()) {
    return;
  }

  try {
    const currentVersion = getStorageItem(PLAN_VERSION_KEY);

    if (currentVersion === PLAN_VERSION) {
      return;
    }

    setStorageItem(PLAN_VERSION_KEY, PLAN_VERSION);
  } catch (error) {
    console.error("Local plan storage could not be updated:", error);
  }
}

function hasBaseEntryShape(value: unknown): value is Partial<WorkoutLogEntry> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<WorkoutLogEntry>;
  return (
    typeof entry.exercise === "string" &&
    typeof entry.weight === "number" &&
    typeof entry.reps === "number" &&
    typeof entry.set === "number" &&
    typeof entry.sessionId === "number" &&
    typeof entry.timestamp === "number"
  );
}

function isValidSet(value: unknown): value is SetType {
  if (!hasBaseEntryShape(value)) {
    return false;
  }

  const set = value as Partial<SetType>;
  return (
    (set.eventType === undefined || set.eventType === "set") &&
    (set.setType === undefined ||
      set.setType === "warmup" ||
      set.setType === "workset")
  );
}

function isValidFlowEvent(value: unknown): value is WorkoutFlowEvent {
  if (!hasBaseEntryShape(value)) {
    return false;
  }

  const entry = value as Partial<WorkoutFlowEvent>;
  return (
    (entry.eventType === "stretch" || entry.eventType === "pause") &&
    typeof entry.label === "string" &&
    typeof entry.durationSeconds === "number"
  );
}

function isValidEntry(value: unknown): value is WorkoutLogEntry {
  return isValidSet(value) || isValidFlowEvent(value);
}

function inferSetType(set: Pick<SetType, "set" | "setType">): LoggedSetType {
  if (set.setType === "warmup" || set.setType === "workset") {
    return set.setType;
  }

  return set.set === 0 ? "warmup" : "workset";
}

function normalizeSetEntry(set: SetType): SetType {
  return {
    ...set,
    exerciseId: set.exerciseId ?? resolveExerciseCatalogReference(set.exercise) ?? undefined,
    setType: inferSetType(set),
  };
}

function normalizeWorkoutLogEntry(entry: WorkoutLogEntry): WorkoutLogEntry {
  if (!isLoggedSetEntry(entry)) {
    return entry;
  }

  return normalizeSetEntry(entry);
}

export function isWarmupSetEntry(set: SetType) {
  return inferSetType(set) === "warmup";
}

export function isWorkSetEntry(set: SetType) {
  return inferSetType(set) === "workset";
}

export function getLoggedSetExerciseReference(set: Pick<SetType, "exercise" | "exerciseId">) {
  return set.exerciseId ?? resolveExerciseCatalogReference(set.exercise) ?? set.exercise;
}

export async function getAllSets(): Promise<WorkoutLogEntry[]> {
  return readStoredSets().sort((a, b) => b.timestamp - a.timestamp);
}

export async function getSetsBySession(sessionId: number): Promise<WorkoutLogEntry[]> {
  return readStoredSets()
    .filter((set) => set.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getSessionSetEntries(sessionId: number): Promise<SetType[]> {
  return (await getSetsBySession(sessionId)).filter(isLoggedSetEntry);
}

function getStoredSetEntries() {
  return readStoredSets().filter(isLoggedSetEntry);
}

function matchesExerciseInstance(
  set: SetType,
  exercise: string,
  exerciseId?: string
) {
  if (exerciseId) {
    return getLoggedSetExerciseReference(set) === exerciseId;
  }

  const currentReference = resolveExerciseCatalogReference(exercise);
  const setReference = getLoggedSetExerciseReference(set);

  if (currentReference && setReference) {
    return setReference === currentReference;
  }

  if (!currentReference && setReference === exercise) {
    return true;
  }

  return (
    !currentReference &&
    set.exercise.trim().toLowerCase() === exercise.trim().toLowerCase()
  );
}

function matchesSetContext(
  set: SetType,
  setNumber: number,
  workoutType?: string,
  setType?: LoggedSetType
) {
  return (
    set.set === setNumber &&
    (!workoutType || set.type === workoutType) &&
    (!setType || inferSetType(set) === setType)
  );
}

export async function saveWorkoutEvent({
  label,
  contextLabel,
  durationSeconds,
  eventType,
  scope,
  sessionId,
  type,
  planId,
  planName,
  dayId,
  dayName,
}: {
  label: string;
  contextLabel?: string;
  durationSeconds: number;
  eventType: "stretch" | "pause";
  scope?: "exercise" | "workout";
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

  const nextEvent: WorkoutFlowEvent = {
    eventType,
    exercise: label,
    weight: 0,
    reps: 0,
    set: 0,
    sessionId,
    timestamp: Date.now(),
    type,
    planId,
    planName,
    dayId,
    dayName,
    label,
    contextLabel,
    durationSeconds,
    scope,
  };

  const entries = readStoredSets();
  entries.push(nextEvent);
  writeStoredSets(entries);
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
  workoutType?: string,
  exerciseId?: string,
  setType?: LoggedSetType
): Promise<SetType | null> {
  const match = getStoredSetEntries()
    .filter(
      (set) =>
        matchesExerciseInstance(set, exercise, exerciseId) &&
        matchesSetContext(set, setNumber, workoutType, setType)
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return match ?? null;
}

export async function getPreviousMatchingSet(
  exercise: string,
  setNumber: number,
  workoutType: string | undefined,
  currentSessionId: number,
  exerciseId?: string,
  setType?: LoggedSetType
): Promise<SetType | null> {
  const match = getStoredSetEntries()
    .filter(
      (set) =>
        matchesExerciseInstance(set, exercise, exerciseId) &&
        set.sessionId !== currentSessionId &&
        matchesSetContext(set, setNumber, workoutType, setType)
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return match ?? null;
}

export async function getBestMatchingSet(
  exercise: string,
  setNumber: number,
  workoutType?: string,
  exerciseId?: string,
  setType?: LoggedSetType
): Promise<SetType | null> {
  if (setType === "warmup") {
    return null;
  }

  const matches = getStoredSetEntries().filter(
    (set) =>
      matchesExerciseInstance(set, exercise, exerciseId) &&
      matchesSetContext(set, setNumber, workoutType, setType)
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

export async function getBestSetForExercise(
  exercise: string,
  workoutType?: string,
  exerciseId?: string
): Promise<SetType | null> {
  const matches = getStoredSetEntries().filter(
    (set) =>
      matchesExerciseInstance(set, exercise, exerciseId) &&
      (!workoutType || set.type === workoutType) &&
      inferSetType(set) === "workset"
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

export async function getBestSetInsightForExercise(
  exercise: string,
  workoutType?: string,
  exerciseId?: string
): Promise<BestSetInsight> {
  const matches = getStoredSetEntries().filter(
    (set) =>
      matchesExerciseInstance(set, exercise, exerciseId) &&
      (!workoutType || set.type === workoutType) &&
      inferSetType(set) === "workset"
  );

  if (matches.length === 0) {
    return {
      set: null,
      label: null,
      detail: null,
      sampleCount: 0,
    };
  }

  const best = matches.reduce((currentBest, current) => {
    if (current.weight > currentBest.weight) {
      return current;
    }

    if (current.weight === currentBest.weight && current.reps > currentBest.reps) {
      return current;
    }

    return currentBest;
  }, matches[0]);

  const sameWeightMatches = matches.filter((set) => set.weight === best.weight);
  const hasRepTieBreak = sameWeightMatches.some((set) => set.reps < best.reps);

  return {
    set: best,
    label: hasRepTieBreak ? "Bestgewicht + Wdh." : "Höchstes Gewicht",
    detail: `${matches.length} Arbeitssätze verglichen`,
    sampleCount: matches.length,
  };
}

export async function getLastSessionForExercise(
  exercise: string,
  currentSessionId: number,
  workoutType?: string,
  exerciseId?: string,
  setType?: LoggedSetType
): Promise<SetType[]> {
  const sessions = await getRecentSessionsForExercise(
    exercise,
    currentSessionId,
    workoutType,
    exerciseId,
    setType,
    1
  );

  return sessions[0] ?? [];
}

export async function getExerciseSuggestionForSet({
  exercise,
  setNumber,
  currentSessionId,
  workoutType,
  exerciseId,
  setType,
  defaultReps,
}: {
  exercise: string;
  setNumber: number;
  currentSessionId: number;
  workoutType?: string;
  exerciseId?: string;
  setType?: LoggedSetType;
  defaultReps: number;
}): Promise<ExerciseSuggestionInsight> {
  const matchingSet = await getPreviousMatchingSet(
    exercise,
    setNumber,
    workoutType,
    currentSessionId,
    exerciseId,
    setType
  );

  if (matchingSet) {
    return {
      source: "matching-set",
      label: "Vorschlag: letzter Satzplatz",
      detail: `${formatSetStat(matchingSet.weight, matchingSet.reps)} · höchste Relevanz`,
      weight: matchingSet.weight,
      reps: matchingSet.reps,
      confidence: "high",
    };
  }

  const lastSession = await getLastSessionForExercise(
    exercise,
    currentSessionId,
    workoutType,
    exerciseId,
    setType
  );
  const lastSessionSet =
    lastSession.find((set) => set.set === setNumber) ??
    lastSession.find((set) => (!setType ? true : inferSetType(set) === setType)) ??
    null;

  if (lastSessionSet) {
    return {
      source: "last-session",
      label: "Vorschlag: letzte Einheit",
      detail: `${formatSetStat(lastSessionSet.weight, lastSessionSet.reps)} · gleicher Satztyp`,
      weight: lastSessionSet.weight,
      reps: lastSessionSet.reps,
      confidence: "medium",
    };
  }

  const bestSet = await getBestSetForExercise(exercise, workoutType, exerciseId);
  if (bestSet) {
    return {
      source: "best-set",
      label: "Vorschlag: Bestleistung",
      detail: `${formatSetStat(bestSet.weight, bestSet.reps)} · oberer Referenzwert`,
      weight: bestSet.weight,
      reps: bestSet.reps,
      confidence: "medium",
    };
  }

  return {
    source: "default",
    label: "Vorschlag: Standardwert",
    detail: `${defaultReps} Wdh. als sauberer Einstieg`,
    weight: null,
    reps: defaultReps,
    confidence: "baseline",
  };
}

export async function getRecentSessionsForExercise(
  exercise: string,
  currentSessionId: number,
  workoutType?: string,
  exerciseId?: string,
  setType?: LoggedSetType,
  limit = 3
): Promise<SetType[][]> {
  const all = getStoredSetEntries()
    .filter(
      (set) =>
        matchesExerciseInstance(set, exercise, exerciseId) &&
        (!workoutType || set.type === workoutType) &&
        (!setType || inferSetType(set) === setType)
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  const sessionMap = new Map<number, SetType[]>();
  for (const set of all) {
    if (set.sessionId === currentSessionId) {
      continue;
    }

    const sessionSets = sessionMap.get(set.sessionId);
    if (sessionSets) {
      sessionSets.push(set);
    } else {
      sessionMap.set(set.sessionId, [set]);
    }
  }

  return Array.from(sessionMap.values())
    .slice(0, Math.max(1, limit))
    .map((sessionSets) => sessionSets.slice().sort((a, b) => a.timestamp - b.timestamp));
}

export function getExerciseTrendInsight(
  sessions: SetType[][]
): ExerciseTrendInsight {
  const recentTopSets = sessions
    .map((session) => getTopSet(session))
    .filter((set): set is SetType => Boolean(set))
    .slice(0, 3);

  if (recentTopSets.length < 2) {
    return {
      direction: "building",
      label: "Trend baut sich auf",
      detail: "Noch zu wenige Einheiten für einen stabilen Leistungsverlauf.",
      recentTopSets,
      sampleCount: recentTopSets.length,
    };
  }

  const latest = recentTopSets[0];
  const previous = recentTopSets[1];
  const older = recentTopSets[2] ?? null;
  const latestComparison = getSetComparison(latest, previous);
  const previousComparison = older ? getSetComparison(previous, older) : null;
  const deltaText = formatComparisonDeltaText(latest, previous);

  if (latestComparison?.kind === "better") {
    return {
      direction:
        previousComparison?.kind === "better" || previousComparison == null
          ? "up"
          : "mixed",
      label:
        previousComparison?.kind === "better"
          ? "Trend steigt"
          : "Trend erholt sich",
      detail:
        previousComparison?.kind === "better"
          ? `${deltaText} stärker als letzte Einheit, mit Rückenwind über mehrere Sessions.`
          : `${deltaText} stärker als letzte Einheit.`,
      recentTopSets,
      sampleCount: recentTopSets.length,
    };
  }

  if (latestComparison?.kind === "same") {
    return {
      direction: "flat",
      label: "Trend stabil",
      detail: "Die letzten passenden Top-Sets liegen aktuell auf demselben Niveau.",
      recentTopSets,
      sampleCount: recentTopSets.length,
    };
  }

  if (latestComparison?.kind === "worse") {
    return {
      direction:
        previousComparison?.kind === "worse" || previousComparison == null
          ? "down"
          : "mixed",
      label:
        previousComparison?.kind === "worse"
          ? "Trend fällt"
          : "Trend schwankt",
      detail:
        previousComparison?.kind === "worse"
          ? `${deltaText} unter letzter Einheit, mit nachlassender Linie über mehrere Sessions.`
          : `${deltaText} unter letzter Einheit.`,
      recentTopSets,
      sampleCount: recentTopSets.length,
    };
  }

  return {
    direction: "mixed",
    label: "Trend gemischt",
    detail: "Die letzten Einheiten schwanken aktuell ohne klare Richtung.",
    recentTopSets,
    sampleCount: recentTopSets.length,
  };
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
  if (!range) {
    return getCoachDecisionForRange(sets, null, null);
  }

  return getCoachDecisionForRange(sets, range.min, range.max);
}

export function getCoachDecisionForRange(
  sets: SetType[],
  minReps: number | null,
  maxReps: number | null
): CoachDecision {
  const workSets = getWorkSets(sets);

  if (minReps == null || maxReps == null || workSets.length === 0) {
    return {
      action: "keep",
      reason: "no-data",
      label: "Gewicht halten",
      detail: "Erst ein paar saubere Arbeitssätze sammeln.",
    };
  }

  const top = getTopSet(workSets);
  const fatigue = getFatigue(workSets);

  if (!top || fatigue === null) {
    return {
      action: "keep",
      reason: "no-data",
      label: "Gewicht halten",
      detail: "Noch zu wenig Verlauf für eine sichere Progression.",
    };
  }

  if (top.reps >= maxReps && fatigue >= -2) {
    return {
      action: "increase",
      reason: "strong",
      label: "Leicht steigern",
      detail: "Top-Set stark, Erschöpfung bleibt kontrolliert.",
    };
  }

  if (top.reps < minReps || fatigue <= -4) {
    return {
      action: "decrease",
      reason: "fatigue",
      label: "Eher entlasten",
      detail: "Unter der Zielrange oder starkes Abfallen über die Sätze.",
    };
  }

  return {
    action: "keep",
    reason: "stable",
    label: "Gewicht halten",
    detail: "Erst Reps in der Zielrange stabilisieren.",
  };
}

function formatSetStat(weight: number, reps: number) {
  return `${weight} kg × ${reps}`;
}

function formatComparisonDeltaText(current: SetType, previous: SetType) {
  const weightDelta = current.weight - previous.weight;
  const repsDelta = current.reps - previous.reps;
  const parts: string[] = [];

  if (weightDelta !== 0) {
    parts.push(`${weightDelta > 0 ? "+" : ""}${weightDelta} kg`);
  }

  if (repsDelta !== 0) {
    parts.push(`${repsDelta > 0 ? "+" : ""}${repsDelta} Wdh.`);
  }

  return parts.join(" · ") || "±0";
}

export async function saveSet({
  exercise,
  exerciseId,
  weight,
  reps,
  set,
  sessionId,
  type,
  planId,
  planName,
  dayId,
  dayName,
  setType,
}: {
  exercise: string;
  exerciseId?: string;
  weight: number;
  reps: number;
  set: number;
  sessionId: number;
  type?: string;
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
  setType: LoggedSetType;
}) {
  if (!sessionId || Number.isNaN(sessionId)) {
    console.error("Invalid sessionId.");
    return;
  }

  const nextSet: SetType = {
    eventType: "set",
    exercise,
    exerciseId,
    weight,
    reps,
    set,
    sessionId,
    timestamp: Date.now(),
    type: type ?? "workout",
    planId,
    planName,
    dayId,
    dayName,
    setType,
  };

  const sets = readStoredSets();
  sets.push(normalizeSetEntry(nextSet));
  writeStoredSets(sets);
}

export async function updateStoredSet(
  timestamp: number,
  updates: Pick<SetType, "weight" | "reps">
): Promise<SetType | null> {
  const entries = readStoredSets();
  const targetIndex = entries.findIndex(
    (entry) => isLoggedSetEntry(entry) && entry.timestamp === timestamp
  );

  if (targetIndex === -1) {
    return null;
  }

  const currentEntry = entries[targetIndex];
  if (!isLoggedSetEntry(currentEntry)) {
    return null;
  }

  const nextEntry: SetType = {
    ...currentEntry,
    weight: updates.weight,
    reps: updates.reps,
  };

  entries[targetIndex] = normalizeSetEntry(nextEntry);
  writeStoredSets(entries);
  return normalizeSetEntry(nextEntry);
}

export async function deleteStoredSet(timestamp: number): Promise<boolean> {
  const entries = readStoredSets();
  const nextEntries = entries.filter(
    (entry) => !(isLoggedSetEntry(entry) && entry.timestamp === timestamp)
  );

  if (nextEntries.length === entries.length) {
    return false;
  }

  writeStoredSets(nextEntries);
  return true;
}

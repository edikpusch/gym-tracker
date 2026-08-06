import {
  ACTIVE_WORKOUT_KEY,
  ACTIVE_WORKOUT_SNAPSHOT_KEY,
  clearActiveWorkoutState,
} from "@/lib/activeWorkout";
import { APP_PREFERENCES_KEY, getAppPreferences } from "@/lib/appPreferences";
import {
  getAppStorageDriverName,
  hasAppStorage,
  readStorageEntries,
  writeStorageEntries,
} from "@/lib/appStorage";
import {
  Directory,
  Encoding,
  Filesystem,
} from "@capacitor/filesystem";
import { isNativePlatform } from "@/lib/platform";
import { Share } from "@capacitor/share";
import { BODY_WEIGHT_KEY } from "@/lib/bodyWeight";
import { CUSTOM_EXERCISE_LIBRARY_KEY } from "@/lib/exerciseLibrary";
import { EXERCISE_FAVORITES_KEY } from "@/lib/exerciseFavorites";
import {
  ACTIVE_PLAN_KEY,
  CUSTOM_PLANS_KEY,
  RECENT_PLAN_EXERCISES_KEY,
} from "@/lib/trainingPlans";
import {
  PLAN_VERSION,
  PLAN_VERSION_KEY,
  WORKOUT_LOG_KEY,
} from "@/lib/workoutEngine";
import { getDb, type ActiveWorkoutSnapshot, type AppSetting, type GymTrackerDB, type SetEntry, type WeightEntry, type WorkoutSession } from "@/lib/db";
import type { SessionSetRecord, WorkoutMetaEntry, WorkoutRuntimeState } from "@/lib/workout-domain/types";

const BACKUP_VERSION = 3;

type BackupEntryValue = string | null;

type BackupStorageEntries = {
  workoutLogs: BackupEntryValue;
  activePlan: BackupEntryValue;
  customPlans: BackupEntryValue;
  recentPlanExercises: BackupEntryValue;
  bodyWeight: BackupEntryValue;
  preferences: BackupEntryValue;
  exerciseFavorites: BackupEntryValue;
  customExercises: BackupEntryValue;
  planVersion: BackupEntryValue;
  activeWorkout: BackupEntryValue;
  activeWorkoutSnapshot: BackupEntryValue;
};

export type GymTrackerBackupSummary = {
  workoutSessionCount: number;
  loggedSetCount: number;
  customPlanCount: number;
  customExerciseCount: number;
  archivedExerciseCount: number;
  favoriteCount: number;
  recentPlanExerciseCount: number;
  hasResumeState: boolean;
};

export type GymTrackerBackup = {
  app: "gym-tracker";
  version: number;
  exportedAt: string;
  storageDriver?: string;
  summary: GymTrackerBackupSummary;
  entries: BackupStorageEntries;
  database?: BackupDatabaseEntries;
};

type BackupDatabaseEntries = {
  legacySets: SetEntry[];
  legacySessions: WorkoutSession[];
  weights: WeightEntry[];
  legacyActiveWorkout: ActiveWorkoutSnapshot[];
  settings: AppSetting[];
  workoutSessionsV2: WorkoutRuntimeState[];
  workoutSetsV2: SessionSetRecord[];
  workoutMeta: WorkoutMetaEntry[];
};

const EMPTY_DATABASE: BackupDatabaseEntries = {
  legacySets: [], legacySessions: [], weights: [], legacyActiveWorkout: [], settings: [], workoutSessionsV2: [], workoutSetsV2: [], workoutMeta: [],
};

const STORAGE_KEY_MAP: Record<keyof BackupStorageEntries, string> = {
  workoutLogs: WORKOUT_LOG_KEY,
  activePlan: ACTIVE_PLAN_KEY,
  customPlans: CUSTOM_PLANS_KEY,
  recentPlanExercises: RECENT_PLAN_EXERCISES_KEY,
  bodyWeight: BODY_WEIGHT_KEY,
  preferences: APP_PREFERENCES_KEY,
  exerciseFavorites: EXERCISE_FAVORITES_KEY,
  customExercises: CUSTOM_EXERCISE_LIBRARY_KEY,
  planVersion: PLAN_VERSION_KEY,
  activeWorkout: ACTIVE_WORKOUT_KEY,
  activeWorkoutSnapshot: ACTIVE_WORKOUT_SNAPSHOT_KEY,
};

function isBackupEntryValue(value: unknown): value is BackupEntryValue {
  return value === null || typeof value === "string";
}

function isValidBackupEntries(value: unknown): value is BackupStorageEntries {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entries = value as Partial<BackupStorageEntries>;
  return (
    isBackupEntryValue(entries.workoutLogs) &&
    isBackupEntryValue(entries.activePlan) &&
    isBackupEntryValue(entries.customPlans) &&
    isBackupEntryValue(entries.recentPlanExercises) &&
    isBackupEntryValue(entries.bodyWeight) &&
    isBackupEntryValue(entries.preferences) &&
    isBackupEntryValue(entries.exerciseFavorites) &&
    isBackupEntryValue(entries.customExercises) &&
    isBackupEntryValue(entries.planVersion) &&
    isBackupEntryValue(entries.activeWorkout) &&
    isBackupEntryValue(entries.activeWorkoutSnapshot)
  );
}

function normalizeBackupEntries(
  entries: Partial<BackupStorageEntries>
): BackupStorageEntries {
  return {
    workoutLogs: entries.workoutLogs ?? null,
    activePlan: entries.activePlan ?? null,
    customPlans: entries.customPlans ?? null,
    recentPlanExercises: entries.recentPlanExercises ?? null,
    bodyWeight: entries.bodyWeight ?? null,
    preferences: entries.preferences ?? null,
    exerciseFavorites: entries.exerciseFavorites ?? null,
    customExercises: entries.customExercises ?? null,
    planVersion: entries.planVersion ?? PLAN_VERSION,
    activeWorkout: entries.activeWorkout ?? null,
    activeWorkoutSnapshot: entries.activeWorkoutSnapshot ?? null,
  };
}

function parseJsonValue<T>(value: BackupEntryValue): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildBackupSummary(entries: BackupStorageEntries, database?: BackupDatabaseEntries): GymTrackerBackupSummary {
  const workoutLogs = parseJsonValue<unknown[]>(entries.workoutLogs);
  const customPlans = parseJsonValue<unknown[]>(entries.customPlans);
  const customExercises = parseJsonValue<Array<{ archived?: boolean }>>(
    entries.customExercises
  );
  const favorites = parseJsonValue<unknown[]>(entries.exerciseFavorites);
  const recentPlanExercises = parseJsonValue<unknown[]>(entries.recentPlanExercises);
  const activeWorkout = parseJsonValue<Record<string, unknown>>(entries.activeWorkout);
  const activeWorkoutSnapshot = parseJsonValue<Record<string, unknown>>(
    entries.activeWorkoutSnapshot
  );

  const workoutSessionCount = Array.isArray(workoutLogs)
    ? new Set(
        workoutLogs
          .map((entry) =>
            entry && typeof entry === "object" && "sessionId" in entry
              ? String((entry as { sessionId?: unknown }).sessionId ?? "")
              : ""
          )
          .filter(Boolean)
      ).size
    : 0;

  const customExerciseCount = Array.isArray(customExercises)
    ? customExercises.length
    : 0;
  const archivedExerciseCount = Array.isArray(customExercises)
    ? customExercises.filter((entry) => Boolean(entry?.archived)).length
    : 0;

  const databaseSessionCount = database?.workoutSessionsV2.filter((session) => session.status === "completed").length ?? 0;
  const databaseSetCount = database?.workoutSetsV2.filter((set) => set.status === "completed").length ?? 0;
  return {
    workoutSessionCount: Math.max(workoutSessionCount, databaseSessionCount),
    loggedSetCount: Math.max(Array.isArray(workoutLogs) ? workoutLogs.length : 0, databaseSetCount),
    customPlanCount: Array.isArray(customPlans) ? customPlans.length : 0,
    customExerciseCount,
    archivedExerciseCount,
    favoriteCount: Array.isArray(favorites) ? favorites.length : 0,
    recentPlanExerciseCount: Array.isArray(recentPlanExercises)
      ? recentPlanExercises.length
      : 0,
    hasResumeState: Boolean(activeWorkout && activeWorkoutSnapshot),
  };
}

function normalizeBackupSummary(
  summary: Partial<GymTrackerBackupSummary> | null | undefined,
  entries: BackupStorageEntries,
  database?: BackupDatabaseEntries
): GymTrackerBackupSummary {
  const fallback = buildBackupSummary(entries, database);
  if (!summary || typeof summary !== "object") {
    return fallback;
  }

  return {
    workoutSessionCount:
      typeof summary.workoutSessionCount === "number"
        ? summary.workoutSessionCount
        : fallback.workoutSessionCount,
    loggedSetCount:
      typeof summary.loggedSetCount === "number"
        ? summary.loggedSetCount
        : fallback.loggedSetCount,
    customPlanCount:
      typeof summary.customPlanCount === "number"
        ? summary.customPlanCount
        : fallback.customPlanCount,
    customExerciseCount:
      typeof summary.customExerciseCount === "number"
        ? summary.customExerciseCount
        : fallback.customExerciseCount,
    archivedExerciseCount:
      typeof summary.archivedExerciseCount === "number"
        ? summary.archivedExerciseCount
        : fallback.archivedExerciseCount,
    favoriteCount:
      typeof summary.favoriteCount === "number"
        ? summary.favoriteCount
        : fallback.favoriteCount,
    recentPlanExerciseCount:
      typeof summary.recentPlanExerciseCount === "number"
        ? summary.recentPlanExerciseCount
        : fallback.recentPlanExerciseCount,
    hasResumeState:
      typeof summary.hasResumeState === "boolean"
        ? summary.hasResumeState
        : fallback.hasResumeState,
  };
}

export function inspectGymTrackerBackup(rawText: string) {
  const parsed = JSON.parse(rawText) as Partial<GymTrackerBackup>;
  if (parsed.app !== "gym-tracker" || !isValidBackupEntries(parsed.entries)) {
    throw new Error("Diese Datei ist kein gueltiges Gym-Tracker-Backup.");
  }

  const entries = normalizeBackupEntries(parsed.entries);
  const candidateDatabase = parsed.database as Partial<BackupDatabaseEntries> | undefined;
  const database: BackupDatabaseEntries = candidateDatabase && typeof candidateDatabase === "object"
    ? Object.fromEntries(Object.keys(EMPTY_DATABASE).map((key) => [key, Array.isArray(candidateDatabase[key as keyof BackupDatabaseEntries]) ? candidateDatabase[key as keyof BackupDatabaseEntries] : []])) as BackupDatabaseEntries
    : EMPTY_DATABASE;
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
    storageDriver:
      typeof parsed.storageDriver === "string" ? parsed.storageDriver : null,
    summary: normalizeBackupSummary(parsed.summary, entries, database),
    entries,
    database,
    hasDatabase: Boolean(candidateDatabase),
  };
}

function buildBackupFileName() {
  return `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function isNativeApp() {
  return isNativePlatform();
}

function isShareCancellation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: string; message?: string };
  const message = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.name === "AbortError" ||
    message.includes("cancel") ||
    message.includes("canceled") ||
    message.includes("cancelled")
  );
}

async function exportNativeBackupFile(fileName: string, text: string) {
  const shareSupport = await Share.canShare();
  if (!shareSupport.value) {
    return { method: "none" as const };
  }

  const path = `exports/${fileName}`;
  await Filesystem.writeFile({
    path,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  const fileUri = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });

  try {
    await Share.share({
      title: "Gym Tracker Backup",
      text: "Backup fuer deinen Gym Tracker",
      files: [fileUri.uri],
    });
    return { method: "native-share" as const };
  } catch (error) {
    if (isShareCancellation(error)) {
      return { method: "cancelled" as const };
    }

    throw error;
  }
}

export async function createGymTrackerBackup(db: GymTrackerDB = getDb()): Promise<GymTrackerBackup> {
  const rawEntries = hasAppStorage()
    ? readStorageEntries(Object.values(STORAGE_KEY_MAP))
    : {};
  const entries = Object.entries(STORAGE_KEY_MAP).reduce((result, [entryKey, storageKey]) => {
    result[entryKey as keyof BackupStorageEntries] = rawEntries[storageKey] ?? null;
    return result;
  }, {} as BackupStorageEntries);

  if (!entries.preferences && hasAppStorage()) {
    entries.preferences = JSON.stringify(getAppPreferences());
  }

  if (!entries.planVersion) {
    entries.planVersion = PLAN_VERSION;
  }

  const [legacySets, legacySessions, weights, legacyActiveWorkout, settings, workoutSessionsV2, workoutSetsV2, workoutMeta] = await Promise.all([
    db.sets.toArray(), db.sessions.toArray(), db.weights.toArray(), db.activeWorkout.toArray(), db.settings.toArray(), db.workoutSessionsV2.toArray(), db.workoutSetsV2.toArray(), db.workoutMeta.toArray(),
  ]);
  const database: BackupDatabaseEntries = { legacySets, legacySessions, weights, legacyActiveWorkout, settings, workoutSessionsV2, workoutSetsV2, workoutMeta };

  return {
    app: "gym-tracker",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    storageDriver: getAppStorageDriverName(),
    summary: buildBackupSummary(entries, database),
    entries,
    database,
  };
}

export async function serializeGymTrackerBackup(db: GymTrackerDB = getDb()) {
  return JSON.stringify(await createGymTrackerBackup(db), null, 2);
}

export async function exportGymTrackerBackup() {
  if (typeof window === "undefined") {
    return { method: "none" as const };
  }

  const fileName = buildBackupFileName();
  const text = await serializeGymTrackerBackup();

  if (isNativeApp()) {
    return exportNativeBackupFile(fileName, text);
  }

  const file = new File([text], fileName, { type: "application/json" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (!("canShare" in navigator) ||
      navigator.canShare?.({
        files: [file],
      }))
  ) {
    try {
      await navigator.share({
        title: "Gym Tracker Backup",
        text: "Backup fuer deinen Gym Tracker",
        files: [file],
      });
      return { method: "share" as const };
    } catch (error) {
      if (isShareCancellation(error)) {
        return { method: "cancelled" as const };
      }
    }
  }

  const blob = new Blob([text], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);

  return { method: "download" as const };
}

export async function importGymTrackerBackup(rawText: string, db: GymTrackerDB = getDb()) {
  if (!hasAppStorage()) {
    throw new Error("Lokaler Speicher ist auf diesem Geraet nicht verfuegbar.");
  }

  const inspected = inspectGymTrackerBackup(rawText);
  const entries = inspected.entries;
  const database = inspected.database;

  clearActiveWorkoutState();

  const nextStorageEntries = (Object.keys(STORAGE_KEY_MAP) as Array<keyof BackupStorageEntries>).reduce<
    Record<string, string | null>
  >((result, entryKey) => {
    result[STORAGE_KEY_MAP[entryKey]] = entries[entryKey];
    return result;
  }, {});

  writeStorageEntries(nextStorageEntries);

  if (inspected.hasDatabase) await db.transaction("rw", [db.sets, db.sessions, db.weights, db.activeWorkout, db.settings, db.workoutSessionsV2, db.workoutSetsV2, db.workoutMeta], async () => {
    await Promise.all([db.sets.clear(), db.sessions.clear(), db.weights.clear(), db.activeWorkout.clear(), db.settings.clear(), db.workoutSessionsV2.clear(), db.workoutSetsV2.clear(), db.workoutMeta.clear()]);
    await Promise.all([
      database.legacySets.length ? db.sets.bulkPut(database.legacySets) : Promise.resolve(),
      database.legacySessions.length ? db.sessions.bulkPut(database.legacySessions) : Promise.resolve(),
      database.weights.length ? db.weights.bulkPut(database.weights) : Promise.resolve(),
      database.legacyActiveWorkout.length ? db.activeWorkout.bulkPut(database.legacyActiveWorkout) : Promise.resolve(),
      database.settings.length ? db.settings.bulkPut(database.settings) : Promise.resolve(),
      database.workoutSessionsV2.length ? db.workoutSessionsV2.bulkPut(database.workoutSessionsV2) : Promise.resolve(),
      database.workoutSetsV2.length ? db.workoutSetsV2.bulkPut(database.workoutSetsV2) : Promise.resolve(),
      database.workoutMeta.length ? db.workoutMeta.bulkPut(database.workoutMeta) : Promise.resolve(),
    ]);
  });

  return {
    restoredAt: new Date().toISOString(),
    summary: buildBackupSummary(entries, database),
  };
}

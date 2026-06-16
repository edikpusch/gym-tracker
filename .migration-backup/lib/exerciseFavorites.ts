import {
  ensureCustomExerciseLibraryEntry,
  findCustomExerciseEntry,
  setCustomExerciseFavorite,
} from "@/lib/exerciseLibrary";
import { getStorageItem, hasAppStorage, setStorageItem } from "@/lib/appStorage";
import { resolveExerciseCatalogReference } from "@/lib/trainingCatalog";

export const EXERCISE_FAVORITES_KEY = "gym-tracker-exercise-favorites";

function readFavoriteIds() {
  if (!hasAppStorage()) {
    return [] as string[];
  }

  try {
    const raw = getStorageItem(EXERCISE_FAVORITES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch (error) {
    console.error("Exercise favorites could not be read:", error);
    return [];
  }
}

function writeFavoriteIds(ids: string[]) {
  if (!hasAppStorage()) {
    return;
  }

  try {
    setStorageItem(EXERCISE_FAVORITES_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error("Exercise favorites could not be written:", error);
  }
}

function resolveExistingExerciseReference(value: string) {
  const existing = resolveExerciseCatalogReference(value);
  if (existing) {
    return existing;
  }

  return findCustomExerciseEntry(value)?.id ?? null;
}

function resolveExerciseReference(
  value: string,
  defaults?: {
    sets: number;
    minReps: number;
    maxReps: number;
    restSeconds: number;
  }
) {
  const existing = resolveExistingExerciseReference(value);
  if (existing) {
    return existing;
  }

  const customEntry = ensureCustomExerciseLibraryEntry({
    value,
    defaults,
  });

  return customEntry?.id ?? null;
}

export function getFavoriteExerciseIds() {
  return readFavoriteIds();
}

export function removeFavoriteExerciseId(reference: string) {
  const ids = new Set(readFavoriteIds());
  ids.delete(reference);
  writeFavoriteIds(Array.from(ids));
}

export function isExerciseFavorite(value: string) {
  const reference = resolveExistingExerciseReference(value);
  if (!reference) {
    return false;
  }

  return readFavoriteIds().includes(reference);
}

export function setExerciseFavorite(
  value: string,
  favorite: boolean,
  defaults?: {
    sets: number;
    minReps: number;
    maxReps: number;
    restSeconds: number;
  }
) {
  const reference = resolveExerciseReference(value, defaults);
  if (!reference) {
    return null;
  }

  const ids = new Set(readFavoriteIds());
  if (favorite) {
    ids.add(reference);
  } else {
    ids.delete(reference);
  }
  writeFavoriteIds(Array.from(ids));

  if (reference.startsWith("custom:")) {
    setCustomExerciseFavorite(reference, favorite);
  }

  return reference;
}

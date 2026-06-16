import { getStorageItem, hasAppStorage, setStorageItem } from "@/lib/appStorage";

export type CustomExerciseKind = "compound" | "isolation";
export type CustomExerciseCategory =
  | "Brust"
  | "Rücken"
  | "Schultern"
  | "Beine"
  | "Arme"
  | "Core"
  | "Ganzkörper"
  | "Oberkörper"
  | "Unterkörper"
  | "Hüfte"
  | "Mobilität";

export type CustomExerciseLibraryEntry = {
  id: string;
  label: string;
  category: CustomExerciseCategory;
  kind: CustomExerciseKind;
  source: "custom";
  favorite?: boolean;
  archived?: boolean;
  supportsAssistanceWeight?: boolean;
  defaults?: {
    sets: number;
    minReps: number;
    maxReps: number;
    restSeconds: number;
  };
};

export const CUSTOM_EXERCISE_LIBRARY_KEY = "gym-tracker-custom-exercises";
export const CUSTOM_EXERCISE_CATEGORIES: CustomExerciseCategory[] = [
  "Brust",
  "Rücken",
  "Schultern",
  "Beine",
  "Arme",
  "Core",
  "Ganzkörper",
  "Oberkörper",
  "Unterkörper",
  "Hüfte",
  "Mobilität",
];

function isValidCustomExerciseEntry(
  value: unknown
): value is CustomExerciseLibraryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<CustomExerciseLibraryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.label === "string" &&
    typeof entry.category === "string" &&
    (entry.kind === "compound" || entry.kind === "isolation")
  );
}

function normalizeCustomExerciseEntry(
  entry: CustomExerciseLibraryEntry
): CustomExerciseLibraryEntry {
  return {
    ...entry,
    source: "custom",
    favorite: entry.favorite ?? false,
    archived: entry.archived ?? false,
    defaults: entry.defaults
      ? {
          sets: Math.max(1, Math.round(Number(entry.defaults.sets) || 3)),
          minReps: Math.max(1, Number(entry.defaults.minReps) || 8),
          maxReps: Math.max(
            Math.max(1, Number(entry.defaults.minReps) || 8),
            Number(entry.defaults.maxReps) || Number(entry.defaults.minReps) || 12
          ),
          restSeconds: Math.max(
            15,
            Math.round(Number(entry.defaults.restSeconds) || 90)
          ),
        }
      : undefined,
  };
}

function readStoredCustomExercises() {
  if (!hasAppStorage()) {
    return [] as CustomExerciseLibraryEntry[];
  }

  try {
    const raw = getStorageItem(CUSTOM_EXERCISE_LIBRARY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isValidCustomExerciseEntry)
      .map((entry) => normalizeCustomExerciseEntry(entry));
  } catch (error) {
    console.error("Custom exercise library could not be read:", error);
    return [];
  }
}

function writeStoredCustomExercises(entries: CustomExerciseLibraryEntry[]) {
  if (!hasAppStorage()) {
    return;
  }

  try {
    setStorageItem(CUSTOM_EXERCISE_LIBRARY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Custom exercise library could not be written:", error);
  }
}

export function getCustomExerciseLibraryEntries(options?: {
  includeArchived?: boolean;
}) {
  const includeArchived = options?.includeArchived ?? false;
  const entries = readStoredCustomExercises();
  return includeArchived ? entries : entries.filter((entry) => !entry.archived);
}

export function getCustomExerciseCatalogEntries() {
  return getCustomExerciseLibraryEntries();
}

export function setCustomExerciseFavorite(value: string, favorite: boolean) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const entries = readStoredCustomExercises();
  const index = entries.findIndex(
    (entry) =>
      entry.id.toLowerCase() === normalized ||
      entry.label.toLowerCase() === normalized
  );

  if (index === -1) {
    return null;
  }

  entries[index] = normalizeCustomExerciseEntry({
    ...entries[index],
    favorite,
  });
  writeStoredCustomExercises(entries);
  return entries[index];
}

export function findCustomExerciseEntry(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    readStoredCustomExercises().find(
      (entry) =>
        entry.id.toLowerCase() === normalized ||
        entry.label.toLowerCase() === normalized
    ) ?? null
  );
}

export function ensureCustomExerciseLibraryEntry({
  value,
  defaults,
  category = "Ganzkörper",
  kind = "compound",
}: {
  value: string;
  defaults?: CustomExerciseLibraryEntry["defaults"];
  category?: CustomExerciseCategory;
  kind?: CustomExerciseKind;
}) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const existing = findCustomExerciseEntry(trimmed);
  if (existing) {
    if (existing.archived) {
      const restored = normalizeCustomExerciseEntry({
        ...existing,
        archived: false,
        defaults: defaults ?? existing.defaults,
        category,
        kind,
      });
      const entries = readStoredCustomExercises().map((entry) =>
        entry.id === restored.id ? restored : entry
      );
      writeStoredCustomExercises(entries);
      return restored;
    }
    return existing;
  }

  const entries = readStoredCustomExercises();
  const nextId = createCustomExerciseId(trimmed, entries);
  const nextEntry = normalizeCustomExerciseEntry({
    id: nextId,
    label: trimmed,
    category,
    kind,
    source: "custom",
    favorite: false,
    defaults,
  });

  entries.unshift(nextEntry);
  writeStoredCustomExercises(entries);
  return nextEntry;
}

export function renameCustomExerciseEntry(id: string, nextLabel: string) {
  const trimmed = nextLabel.trim();
  if (!trimmed) {
    return {
      status: "invalid" as const,
      entry: null,
    };
  }

  const entries = readStoredCustomExercises();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return {
      status: "missing" as const,
      entry: null,
    };
  }

  const duplicate = entries.find(
    (entry, entryIndex) =>
      entryIndex !== index &&
      !entry.archived &&
      entry.label.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (duplicate) {
    return {
      status: "duplicate" as const,
      entry: duplicate,
    };
  }

  const nextEntry = normalizeCustomExerciseEntry({
    ...entries[index],
    label: trimmed,
  });
  entries[index] = nextEntry;
  writeStoredCustomExercises(entries);

  return {
    status: "updated" as const,
    entry: nextEntry,
  };
}

export function setCustomExerciseArchived(id: string, archived: boolean) {
  const entries = readStoredCustomExercises();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return null;
  }

  const nextEntry = normalizeCustomExerciseEntry({
    ...entries[index],
    archived,
    favorite: archived ? false : entries[index].favorite,
  });
  entries[index] = nextEntry;
  writeStoredCustomExercises(entries);
  return nextEntry;
}

export function updateCustomExerciseEntry(
  id: string,
  patch: Partial<
    Pick<
      CustomExerciseLibraryEntry,
      "category" | "kind" | "favorite" | "supportsAssistanceWeight" | "defaults"
    >
  >
) {
  const entries = readStoredCustomExercises();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return null;
  }

  const nextEntry = normalizeCustomExerciseEntry({
    ...entries[index],
    ...patch,
    defaults: patch.defaults
      ? {
          ...entries[index].defaults,
          ...patch.defaults,
        }
      : entries[index].defaults,
  });
  entries[index] = nextEntry;
  writeStoredCustomExercises(entries);
  return nextEntry;
}

function createCustomExerciseId(
  label: string,
  existing: CustomExerciseLibraryEntry[]
) {
  const base = `custom:${slugify(label)}`;
  let candidate = base;
  let suffix = 2;

  while (existing.some((entry) => entry.id === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "exercise"
  );
}

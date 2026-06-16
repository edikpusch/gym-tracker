import {
  getExerciseCatalogEntry,
  getExerciseCatalogSections,
  getStretchCatalogSections,
  type ExerciseCatalogEntry,
} from "@/lib/trainingCatalog";
import {
  findCustomExerciseEntry,
  getCustomExerciseLibraryEntries,
  type CustomExerciseLibraryEntry,
} from "@/lib/exerciseLibrary";

export function getExerciseLibrary() {
  return getExerciseLibraryWithOptions();
}

export function getExerciseLibraryWithOptions(options?: {
  includeArchived?: boolean;
}) {
  const systemItems = getExerciseCatalogSections()
    .flatMap((section) =>
      section.items.map((entry) => ({
        value: entry.id,
        label: entry.label,
        category: section.category,
      }))
    );
  const customItems = getCustomExerciseLibraryEntries({
    includeArchived: options?.includeArchived ?? false,
  }).map((entry) => ({
    value: entry.id,
    label: entry.label,
    category: entry.category,
  }));

  return [...systemItems, ...customItems]
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));
}

export function getExerciseLibraryGroups() {
  return getExerciseLibraryGroupsWithOptions();
}

export function getExerciseLibraryGroupsWithOptions(options?: {
  includeArchived?: boolean;
}) {
  const systemGroups: Array<{
    category: string;
    items: Array<{ value: string; label: string }>;
  }> = getExerciseCatalogSections().map((section) => ({
    category: section.category,
    items: section.items.map((entry) => ({
      value: entry.id,
      label: entry.label,
    })),
  }));
  const customEntries = getCustomExerciseLibraryEntries({
    includeArchived: options?.includeArchived ?? false,
  });
  const customGroups = new Map<string, CustomExerciseLibraryEntry[]>();
  customEntries.forEach((entry) => {
    const group = customGroups.get(entry.category) ?? [];
    group.push(entry);
    customGroups.set(entry.category, group);
  });

  customGroups.forEach((entries, category) => {
    const existing = systemGroups.find((group) => group.category === category);
    const customItems = entries.map((entry) => ({
      value: entry.id,
      label: entry.label,
    }));

    if (existing) {
      existing.items = [...existing.items, ...customItems].sort((a, b) =>
        a.label.localeCompare(b.label, "de-DE")
      );
      return;
    }

    systemGroups.push({
      category,
      items: customItems.sort((a, b) => a.label.localeCompare(b.label, "de-DE")),
    });
  });

  return systemGroups.sort((a, b) => a.category.localeCompare(b.category, "de-DE"));
}

export const EXERCISE_LIBRARY = getExerciseLibrary();
export const EXERCISE_LIBRARY_GROUPS = getExerciseLibraryGroups();

export const STRETCH_LIBRARY = getStretchCatalogSections()
  .flatMap((section) =>
    section.items.map((entry) => ({
      value: entry.id,
      label: entry.label,
      category: section.category,
    }))
  )
  .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));

export const STRETCH_LIBRARY_GROUPS = getStretchCatalogSections().map(
  (section) => ({
    category: section.category,
    items: section.items.map((entry) => ({
      value: entry.id,
      label: entry.label,
    })),
  })
);

export function getExerciseLabel(exercise: string) {
  return (
    getExerciseCatalogEntry(exercise)?.label ??
    findCustomExerciseEntry(exercise)?.label ??
    fallbackLabel(exercise)
  );
}

export function getExerciseMeta(
  exercise: string
): ExerciseCatalogEntry | CustomExerciseLibraryEntry | null {
  return getExerciseCatalogEntry(exercise) ?? findCustomExerciseEntry(exercise);
}

function fallbackLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

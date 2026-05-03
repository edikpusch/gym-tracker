import {
  getExerciseCatalogEntry,
  getExerciseCatalogSections,
  getStretchCatalogSections,
  type ExerciseCatalogEntry,
} from "@/lib/trainingCatalog";

export const EXERCISE_LABELS: Record<string, string> = Object.fromEntries(
  getExerciseCatalogSections()
    .flatMap((section) => section.items)
    .map((entry) => [entry.id, entry.label])
);

export const EXERCISE_LIBRARY = getExerciseCatalogSections()
  .flatMap((section) =>
    section.items.map((entry) => ({
      value: entry.id,
      label: entry.label,
      category: section.category,
    }))
  )
  .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));

export const EXERCISE_LIBRARY_GROUPS = getExerciseCatalogSections().map(
  (section) => ({
    category: section.category,
    items: section.items.map((entry) => ({
      value: entry.id,
      label: entry.label,
    })),
  })
);

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
  return EXERCISE_LABELS[exercise] ?? fallbackLabel(exercise);
}

export function getExerciseMeta(exercise: string): ExerciseCatalogEntry | null {
  return getExerciseCatalogEntry(exercise);
}

function fallbackLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

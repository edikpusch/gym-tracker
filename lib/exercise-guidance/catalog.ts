import type { ExerciseGuidance } from "@/lib/exercise-guidance/types";

// Content is intentionally empty until motion style, assets and coaching depth
// have been defined. New guides can be added without changing workout logic.
const GUIDANCE_CATALOG: readonly ExerciseGuidance[] = [];

export function getPublishedExerciseGuidance(key?: string) {
  if (!key) return null;
  return GUIDANCE_CATALOG.find(
    (guide) => guide.key === key && guide.status === "published"
  ) ?? null;
}

export function getExerciseGuidanceCatalog() {
  return GUIDANCE_CATALOG;
}

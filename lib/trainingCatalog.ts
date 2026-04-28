export type ExerciseKind = "compound" | "isolation" | "stretch";
export type ExerciseCategory =
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

export type ExerciseCatalogEntry = {
  id: string;
  label: string;
  category: ExerciseCategory;
  kind: ExerciseKind;
  supportsAssistanceWeight?: boolean;
};

export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  { id: "benchpress", label: "Bankdrücken", category: "Brust", kind: "compound" },
  {
    id: "incline_benchpress",
    label: "Schrägbankdrücken",
    category: "Brust",
    kind: "compound",
  },
  { id: "pullups", label: "Klimmzüge", category: "Rücken", kind: "compound", supportsAssistanceWeight: true },
  {
    id: "pullups_wide",
    label: "Klimmzüge breit",
    category: "Rücken",
    kind: "compound",
    supportsAssistanceWeight: true,
  },
  { id: "shoulderpress", label: "Schulterdrücken", category: "Schultern", kind: "compound" },
  { id: "dips", label: "Dips", category: "Brust", kind: "compound", supportsAssistanceWeight: true },
  { id: "bulgarian", label: "Bulgarische Split Squats", category: "Beine", kind: "compound" },
  { id: "core", label: "Core", category: "Core", kind: "isolation" },
  { id: "rows", label: "Rudern", category: "Rücken", kind: "compound" },
  { id: "latpulldown", label: "Latzug", category: "Rücken", kind: "compound" },
  { id: "biceps", label: "Bizeps Curls", category: "Arme", kind: "isolation" },
  { id: "triceps", label: "Trizeps", category: "Arme", kind: "isolation" },
  { id: "rear_delt", label: "Hintere Schulter", category: "Schultern", kind: "isolation" },
  { id: "squat", label: "Kniebeugen", category: "Beine", kind: "compound" },
  { id: "legpress", label: "Beinpresse", category: "Beine", kind: "compound" },
  { id: "legcurl", label: "Beinbeuger", category: "Beine", kind: "isolation" },
  { id: "calves", label: "Waden", category: "Beine", kind: "isolation" },
  { id: "lunges", label: "Ausfallschritte", category: "Beine", kind: "compound" },
  { id: "lateral_raise", label: "Seitheben", category: "Schultern", kind: "isolation" },
  { id: "pushups", label: "Push-ups", category: "Brust", kind: "compound", supportsAssistanceWeight: true },
  {
    id: "romanian_deadlift",
    label: "Rumänisches Kreuzheben",
    category: "Beine",
    kind: "compound",
  },
  { id: "face_pulls", label: "Face Pulls", category: "Schultern", kind: "isolation" },
  { id: "walking_lunges", label: "Walking Lunges", category: "Beine", kind: "compound" },
  { id: "hanging_leg_raises", label: "Hanging Leg Raises", category: "Core", kind: "isolation" },
  {
    id: "shoulderpress_pushups",
    label: "Schulterdrücken + Push-ups",
    category: "Ganzkörper",
    kind: "compound",
    supportsAssistanceWeight: true,
  },
  { id: "chest_stretch", label: "Brustdehnung", category: "Brust", kind: "stretch" },
  { id: "lat_stretch", label: "Lat-Dehnung", category: "Rücken", kind: "stretch" },
  { id: "shoulder_mobility", label: "Schulter-Mobilität", category: "Mobilität", kind: "stretch" },
  { id: "thoracic_rotation", label: "Brustwirbelsäulen-Rotation", category: "Mobilität", kind: "stretch" },
  { id: "hip_flexor_stretch", label: "Hüftbeuger-Dehnung", category: "Hüfte", kind: "stretch" },
  { id: "hamstring_stretch", label: "Hamstring-Dehnung", category: "Unterkörper", kind: "stretch" },
  { id: "quad_stretch", label: "Quadrizeps-Dehnung", category: "Unterkörper", kind: "stretch" },
  { id: "glute_stretch", label: "Gesäß-Dehnung", category: "Hüfte", kind: "stretch" },
];

export const TRAINING_EXERCISE_CATALOG = EXERCISE_CATALOG.filter(
  (entry) => entry.kind !== "stretch"
);

export const STRETCH_CATALOG = EXERCISE_CATALOG.filter(
  (entry) => entry.kind === "stretch"
);

export function getExerciseCatalogEntry(exerciseId: string) {
  return EXERCISE_CATALOG.find((entry) => entry.id === exerciseId) ?? null;
}

export function getExerciseCatalogSections() {
  return groupCatalogByCategory(TRAINING_EXERCISE_CATALOG);
}

export function getStretchCatalogSections() {
  return groupCatalogByCategory(STRETCH_CATALOG);
}

function groupCatalogByCategory(entries: ExerciseCatalogEntry[]) {
  const groups = new Map<ExerciseCategory, ExerciseCatalogEntry[]>();

  entries.forEach((entry) => {
    const current = groups.get(entry.category) ?? [];
    current.push(entry);
    groups.set(entry.category, current);
  });

  return Array.from(groups.entries())
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.label.localeCompare(b.label, "de-DE")),
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "de-DE"));
}

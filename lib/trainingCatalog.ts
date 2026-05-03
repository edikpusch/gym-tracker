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
  defaults?: {
    sets: number;
    minReps: number;
    maxReps: number;
    restSeconds: number;
  };
};

export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  { id: "benchpress", label: "Bankdrücken", category: "Brust", kind: "compound" },
  {
    id: "incline_benchpress",
    label: "Schrägbankdrücken",
    category: "Brust",
    kind: "compound",
  },
  { id: "chest_press", label: "Chest Press", category: "Brust", kind: "compound" },
  { id: "cable_fly", label: "Cable Fly", category: "Brust", kind: "isolation" },
  { id: "pec_deck", label: "Pec Deck", category: "Brust", kind: "isolation" },
  { id: "smith_benchpress", label: "Smith-Bankdrücken", category: "Brust", kind: "compound" },
  { id: "incline_chest_press", label: "Schräge Chest Press", category: "Brust", kind: "compound" },
  { id: "pushups", label: "Push-ups", category: "Brust", kind: "compound", supportsAssistanceWeight: true },
  { id: "dips", label: "Dips", category: "Brust", kind: "compound", supportsAssistanceWeight: true },

  { id: "pullups", label: "Klimmzüge", category: "Rücken", kind: "compound", supportsAssistanceWeight: true },
  {
    id: "pullups_wide",
    label: "Klimmzüge breit",
    category: "Rücken",
    kind: "compound",
    supportsAssistanceWeight: true,
  },
  { id: "chinups", label: "Chin-ups", category: "Rücken", kind: "compound", supportsAssistanceWeight: true },
  { id: "rows", label: "Rudern", category: "Rücken", kind: "compound" },
  { id: "seated_row", label: "Kabelrudern", category: "Rücken", kind: "compound" },
  { id: "chest_supported_row", label: "Chest Supported Row", category: "Rücken", kind: "compound" },
  { id: "t_bar_row", label: "T-Bar Row", category: "Rücken", kind: "compound" },
  { id: "machine_row", label: "Maschinenrudern", category: "Rücken", kind: "compound" },
  { id: "latpulldown", label: "Latzug", category: "Rücken", kind: "compound" },
  { id: "single_arm_row", label: "Einarmiges Rudern", category: "Rücken", kind: "compound" },
  { id: "close_grip_latpulldown", label: "Enger Latzug", category: "Rücken", kind: "compound" },
  { id: "back_extension", label: "Back Extension", category: "Rücken", kind: "isolation" },

  { id: "shoulderpress", label: "Schulterdrücken", category: "Schultern", kind: "compound" },
  { id: "machine_shoulder_press", label: "Maschinen-Schulterdrücken", category: "Schultern", kind: "compound" },
  { id: "rear_delt", label: "Hintere Schulter", category: "Schultern", kind: "isolation" },
  { id: "lateral_raise", label: "Seitheben", category: "Schultern", kind: "isolation" },
  { id: "machine_lateral_raise", label: "Maschinen-Seitheben", category: "Schultern", kind: "isolation" },
  { id: "front_raise", label: "Frontheben", category: "Schultern", kind: "isolation" },
  { id: "face_pulls", label: "Face Pulls", category: "Schultern", kind: "isolation" },
  { id: "reverse_fly", label: "Reverse Fly", category: "Schultern", kind: "isolation" },
  { id: "upright_row", label: "Aufrechtes Rudern", category: "Schultern", kind: "isolation" },

  { id: "biceps", label: "Bizeps Curls", category: "Arme", kind: "isolation" },
  { id: "hammer_curls", label: "Hammer Curls", category: "Arme", kind: "isolation" },
  { id: "preacher_curl", label: "Preacher Curl", category: "Arme", kind: "isolation" },
  { id: "triceps", label: "Trizeps", category: "Arme", kind: "isolation" },
  { id: "triceps_pushdown", label: "Trizeps Pushdown", category: "Arme", kind: "isolation" },
  { id: "overhead_triceps_extension", label: "Overhead Trizeps Extension", category: "Arme", kind: "isolation" },
  { id: "cable_curl", label: "Cable Curl", category: "Arme", kind: "isolation" },
  { id: "machine_dip", label: "Maschinen-Dips", category: "Arme", kind: "compound", supportsAssistanceWeight: true },

  { id: "squat", label: "Kniebeugen", category: "Beine", kind: "compound" },
  { id: "hack_squat", label: "Hack Squat", category: "Beine", kind: "compound" },
  { id: "deadlift", label: "Kreuzheben", category: "Beine", kind: "compound" },
  {
    id: "romanian_deadlift",
    label: "Rumänisches Kreuzheben",
    category: "Beine",
    kind: "compound",
  },
  { id: "legpress", label: "Beinpresse", category: "Beine", kind: "compound" },
  { id: "smith_squat", label: "Smith-Kniebeuge", category: "Beine", kind: "compound" },
  { id: "pendulum_squat", label: "Pendulum Squat", category: "Beine", kind: "compound" },
  { id: "bulgarian", label: "Bulgarische Split Squats", category: "Beine", kind: "compound" },
  { id: "lunges", label: "Ausfallschritte", category: "Beine", kind: "compound" },
  { id: "walking_lunges", label: "Walking Lunges", category: "Beine", kind: "compound" },
  { id: "hip_thrust", label: "Hip Thrust", category: "Beine", kind: "compound" },
  { id: "glute_bridge", label: "Glute Bridge", category: "Beine", kind: "compound" },
  { id: "legcurl", label: "Beinbeuger", category: "Beine", kind: "isolation" },
  { id: "seated_legcurl", label: "Sitzender Beinbeuger", category: "Beine", kind: "isolation" },
  { id: "leg_extension", label: "Beinstrecker", category: "Beine", kind: "isolation" },
  { id: "calves", label: "Waden", category: "Beine", kind: "isolation" },
  { id: "seated_calf_raise", label: "Sitzendes Wadenheben", category: "Beine", kind: "isolation" },
  { id: "abductor_machine", label: "Abduktoren-Maschine", category: "Beine", kind: "isolation" },
  { id: "adductor_machine", label: "Adduktoren-Maschine", category: "Beine", kind: "isolation" },

  { id: "core", label: "Core", category: "Core", kind: "isolation" },
  { id: "hanging_leg_raises", label: "Hanging Leg Raises", category: "Core", kind: "isolation" },
  { id: "crunch_machine", label: "Crunch-Maschine", category: "Core", kind: "isolation" },
  { id: "plank", label: "Plank", category: "Core", kind: "isolation" },
  { id: "cable_crunch", label: "Cable Crunch", category: "Core", kind: "isolation" },
  { id: "russian_twist", label: "Russian Twist", category: "Core", kind: "isolation" },

  {
    id: "shoulderpress_pushups",
    label: "Schulterdrücken + Push-ups",
    category: "Ganzkörper",
    kind: "compound",
    supportsAssistanceWeight: true,
  },

  { id: "chest_stretch", label: "Brustdehnung", category: "Brust", kind: "stretch" },
  { id: "doorway_chest_stretch", label: "Türrahmen-Brustdehnung", category: "Brust", kind: "stretch" },
  { id: "lat_stretch", label: "Lat-Dehnung", category: "Rücken", kind: "stretch" },
  { id: "child_pose", label: "Child Pose", category: "Rücken", kind: "stretch" },
  { id: "shoulder_mobility", label: "Schulter-Mobilität", category: "Mobilität", kind: "stretch" },
  { id: "thoracic_rotation", label: "Brustwirbelsäulen-Rotation", category: "Mobilität", kind: "stretch" },
  { id: "ankle_mobility", label: "Sprunggelenk-Mobilität", category: "Mobilität", kind: "stretch" },
  { id: "cat_cow", label: "Cat-Cow", category: "Mobilität", kind: "stretch" },
  { id: "worlds_greatest_stretch", label: "World's Greatest Stretch", category: "Mobilität", kind: "stretch" },
  { id: "band_shoulder_mobility", label: "Band-Schulter-Mobilität", category: "Mobilität", kind: "stretch" },
  { id: "deep_squat_hold", label: "Tiefe Hocke halten", category: "Mobilität", kind: "stretch" },
  { id: "hip_flexor_stretch", label: "Hüftbeuger-Dehnung", category: "Hüfte", kind: "stretch" },
  { id: "couch_stretch", label: "Couch Stretch", category: "Hüfte", kind: "stretch" },
  { id: "glute_stretch", label: "Gesäß-Dehnung", category: "Hüfte", kind: "stretch" },
  { id: "piriformis_stretch", label: "Piriformis-Dehnung", category: "Hüfte", kind: "stretch" },
  { id: "figure_four_stretch", label: "Figure-Four-Stretch", category: "Hüfte", kind: "stretch" },
  { id: "hamstring_stretch", label: "Hamstring-Dehnung", category: "Unterkörper", kind: "stretch" },
  { id: "quad_stretch", label: "Quadrizeps-Dehnung", category: "Unterkörper", kind: "stretch" },
  { id: "adductor_stretch", label: "Adduktoren-Dehnung", category: "Unterkörper", kind: "stretch" },
  { id: "calf_stretch", label: "Wadendehnung", category: "Unterkörper", kind: "stretch" },
  { id: "toe_touch_hold", label: "Vorbeuge halten", category: "Unterkörper", kind: "stretch" },
];

export const TRAINING_EXERCISE_CATALOG = EXERCISE_CATALOG.filter(
  (entry) => entry.kind !== "stretch"
);

export const STRETCH_CATALOG = EXERCISE_CATALOG.filter(
  (entry) => entry.kind === "stretch"
);

const EXERCISE_DEFAULTS: Record<
  string,
  { sets: number; minReps: number; maxReps: number; restSeconds: number }
> = {
  benchpress: { sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
  incline_benchpress: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  chest_press: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  cable_fly: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  pec_deck: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  smith_benchpress: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  incline_chest_press: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  pushups: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  dips: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },

  pullups: { sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
  pullups_wide: { sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
  chinups: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  rows: { sets: 3, minReps: 6, maxReps: 9, restSeconds: 180 },
  seated_row: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  chest_supported_row: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  t_bar_row: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  machine_row: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  latpulldown: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  single_arm_row: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  close_grip_latpulldown: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  back_extension: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },

  shoulderpress: { sets: 3, minReps: 6, maxReps: 9, restSeconds: 150 },
  machine_shoulder_press: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  rear_delt: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  lateral_raise: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  machine_lateral_raise: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  front_raise: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  face_pulls: { sets: 3, minReps: 12, maxReps: 15, restSeconds: 75 },
  reverse_fly: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  upright_row: { sets: 3, minReps: 10, maxReps: 12, restSeconds: 75 },

  biceps: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  hammer_curls: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  preacher_curl: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  triceps: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  triceps_pushdown: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  overhead_triceps_extension: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  cable_curl: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  machine_dip: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },

  squat: { sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
  hack_squat: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  deadlift: { sets: 3, minReps: 3, maxReps: 6, restSeconds: 180 },
  romanian_deadlift: { sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
  legpress: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 120 },
  smith_squat: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  pendulum_squat: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 },
  bulgarian: { sets: 3, minReps: 6, maxReps: 9, restSeconds: 120 },
  lunges: { sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
  walking_lunges: { sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
  hip_thrust: { sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
  glute_bridge: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  legcurl: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
  seated_legcurl: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
  leg_extension: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  calves: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  seated_calf_raise: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  abductor_machine: { sets: 3, minReps: 12, maxReps: 20, restSeconds: 60 },
  adductor_machine: { sets: 3, minReps: 12, maxReps: 20, restSeconds: 60 },

  core: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
  hanging_leg_raises: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
  crunch_machine: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  plank: { sets: 3, minReps: 30, maxReps: 60, restSeconds: 60 },
  cable_crunch: { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
  russian_twist: { sets: 3, minReps: 12, maxReps: 20, restSeconds: 60 },

  shoulderpress_pushups: { sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 },
};

export function getExerciseCatalogEntry(exerciseId: string) {
  return EXERCISE_CATALOG.find((entry) => entry.id === exerciseId) ?? null;
}

export function getExerciseCatalogSections() {
  return groupCatalogByCategory(TRAINING_EXERCISE_CATALOG);
}

export function getStretchCatalogSections() {
  return groupCatalogByCategory(STRETCH_CATALOG);
}

export function getSuggestedExerciseSetup(exerciseId: string) {
  const entry = getExerciseCatalogEntry(exerciseId);
  const defaults = EXERCISE_DEFAULTS[exerciseId];

  if (defaults) {
    return defaults;
  }

  return getFallbackExerciseSetup(entry);
}

function getFallbackExerciseSetup(entry: ExerciseCatalogEntry | null) {
  if (!entry) {
    return {
      sets: 3,
      minReps: 8,
      maxReps: 12,
      restSeconds: 90,
    };
  }

  if (entry.kind === "stretch") {
    return {
      sets: 1,
      minReps: 30,
      maxReps: 45,
      restSeconds: 30,
    };
  }

  if (entry.kind === "isolation") {
    if (entry.category === "Core") {
      return {
        sets: 3,
        minReps: 10,
        maxReps: 15,
        restSeconds: 75,
      };
    }

    return {
      sets: 3,
      minReps: 10,
      maxReps: 15,
      restSeconds: 75,
    };
  }

  if (entry.category === "Brust" || entry.category === "Schultern") {
    return {
      sets: 3,
      minReps: 6,
      maxReps: 10,
      restSeconds: 150,
    };
  }

  if (entry.category === "Rücken") {
    return entry.supportsAssistanceWeight
      ? {
          sets: 3,
          minReps: 5,
          maxReps: 8,
          restSeconds: 180,
        }
      : {
          sets: 3,
          minReps: 6,
          maxReps: 10,
          restSeconds: 150,
        };
  }

  if (entry.category === "Beine") {
    return {
      sets: 3,
      minReps: 6,
      maxReps: 10,
      restSeconds: 150,
    };
  }

  if (entry.category === "Ganzkörper") {
    return {
      sets: 3,
      minReps: 6,
      maxReps: 10,
      restSeconds: 150,
    };
  }

  return {
    sets: 3,
    minReps: 8,
    maxReps: 12,
    restSeconds: 90,
  };
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

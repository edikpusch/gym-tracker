import { getExerciseCatalogEntry, getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import {
  buildExerciseBlock,
  buildWarmupBlock,
  type NotePlanBlock,
  syncDayBlocks,
  type PausePlanBlock,
  type StretchPlanBlock,
  type TrainingPlanBlock,
} from "@/lib/trainingModel";

export type PlanRouteSlot = "push" | "pull" | "mixed";

export type TrainingExercise = {
  id: string;
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

export type TrainingDay = {
  id: string;
  name: string;
  slot: PlanRouteSlot;
  color: string;
  exercises: TrainingExercise[];
  blocks?: TrainingPlanBlock[];
};

export type TrainingPlan = {
  id: string;
  name: string;
  description: string;
  accent: string;
  origin: "template" | "custom";
  days: TrainingDay[];
};

export const ACTIVE_PLAN_KEY = "gym-tracker-active-plan";
export const CUSTOM_PLANS_KEY = "gym-tracker-custom-plans";
export const DEFAULT_PLAN_ID = "my-plan";

function normalizeTrainingExercise(exercise: TrainingExercise): TrainingExercise {
  return {
    ...exercise,
    sets: Math.max(1, Math.round(Number(exercise.sets) || 1)),
    minReps: Math.max(1, Number(exercise.minReps) || 1),
    maxReps: Math.max(Math.max(1, Number(exercise.minReps) || 1), Number(exercise.maxReps) || Number(exercise.minReps) || 1),
    restSeconds: Math.max(15, Math.round(Number(exercise.restSeconds) || 60)),
  };
}

function normalizeTrainingDay(day: TrainingDay): TrainingDay {
  const exercises = day.exercises.map(normalizeTrainingExercise);

  return {
    ...day,
    exercises,
    blocks: syncDayBlocks(exercises, day.blocks),
  };
}

function normalizeTrainingPlan(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    days: plan.days.map(normalizeTrainingDay),
  };
}

type TemplateExtraBlock = {
  placement: "start" | "end" | `after:${string}`;
  block: StretchPlanBlock | PausePlanBlock;
};

function buildTemplateDayBlocks(
  exercises: TrainingExercise[],
  extras: TemplateExtraBlock[] = []
) {
  const blocks: TrainingPlanBlock[] = [];
  const startExtras = extras.filter((entry) => entry.placement === "start");
  const endExtras = extras.filter((entry) => entry.placement === "end");

  blocks.push(...startExtras.map((entry) => entry.block));

  exercises.forEach((exercise) => {
    const exerciseBlock = buildExerciseBlock(exercise);
    const warmupBlock = buildWarmupBlock(exerciseBlock);

    if (warmupBlock) {
      blocks.push(warmupBlock);
    }

    blocks.push(exerciseBlock);

    const afterExtras = extras.filter(
      (entry) => entry.placement === `after:${exercise.id}`
    );
    blocks.push(...afterExtras.map((entry) => entry.block));
  });

  blocks.push(...endExtras.map((entry) => entry.block));

  return blocks;
}

function createTemplateDay(
  config: Omit<TrainingDay, "blocks"> & { extras?: TemplateExtraBlock[] }
): TrainingDay {
  return {
    id: config.id,
    name: config.name,
    slot: config.slot,
    color: config.color,
    exercises: config.exercises,
    blocks: buildTemplateDayBlocks(config.exercises, config.extras ?? []),
  };
}

const defaultTrainingPlansSource: TrainingPlan[] = [
  {
    id: "my-plan",
    name: "Mein Plan",
    description: "Push / Pull / Mixed",
    accent: "#111827",
    origin: "template",
    days: [
      createTemplateDay({
        id: "push-focus",
        name: "Push",
        slot: "push",
        color: "#dc2626",
        exercises: [
          { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "pullups_wide", name: "pullups_wide", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 9, restSeconds: 150 },
          { id: "dips", name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 6, maxReps: 9, restSeconds: 120 },
          { id: "hanging_leg_raises", name: "hanging_leg_raises", sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:push-focus:chest",
              type: "stretch",
              label: "Brust öffnen",
              stretchId: "doorway_chest_stretch",
              category: "Brust",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:shoulderpress",
            block: {
              id: "pause:push-focus:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "pull-focus",
        name: "Pull",
        slot: "pull",
        color: "#2563eb",
        exercises: [
          { id: "chest_supported_row", name: "chest_supported_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "pushups", name: "pushups", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
          { id: "face_pulls", name: "face_pulls", sets: 3, minReps: 12, maxReps: 15, restSeconds: 105 },
          { id: "walking_lunges", name: "walking_lunges", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
          { id: "hanging_leg_raises", name: "hanging_leg_raises", sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:pull-focus:lat",
              type: "stretch",
              label: "Lat mobilisieren",
              stretchId: "lat_stretch",
              category: "Rücken",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:romanian_deadlift",
            block: {
              id: "pause:pull-focus:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "mixed-day",
        name: "Mixed",
        slot: "mixed",
        color: "#16a34a",
        exercises: [
          { id: "squat", name: "squat", sets: 3, minReps: 6, maxReps: 9, restSeconds: 180 },
          { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 9, restSeconds: 180 },
          { id: "shoulderpress_pushups", name: "shoulderpress_pushups", sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 7, maxReps: 10, restSeconds: 120 },
          { id: "core", name: "core", sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:mixed-day:mobility",
              type: "stretch",
              label: "Tiefer Start",
              stretchId: "deep_squat_hold",
              category: "Mobilität",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:romanian_deadlift",
            block: {
              id: "pause:mixed-day:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 90,
              scope: "workout",
            },
          },
        ],
      }),
    ],
  },
  {
    id: "split-2",
    name: "2er Split",
    description: "Tag A / Tag B",
    accent: "#7c3aed",
    origin: "template",
    days: [
      createTemplateDay({
        id: "tag-a",
        name: "Tag A",
        slot: "push",
        color: "#7c3aed",
        exercises: [
          { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "machine_row", name: "machine_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
          { id: "seated_legcurl", name: "seated_legcurl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
          { id: "cable_crunch", name: "cable_crunch", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:tag-a:ankle",
              type: "stretch",
              label: "Sprunggelenk",
              stretchId: "ankle_mobility",
              category: "Mobilität",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:shoulderpress",
            block: {
              id: "pause:tag-a:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "tag-b",
        name: "Tag B",
        slot: "pull",
        color: "#8b5cf6",
        exercises: [
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
          { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "incline_chest_press", name: "incline_chest_press", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
          { id: "hammer_curls", name: "hammer_curls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "dips", name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:tag-b:hip",
              type: "stretch",
              label: "Hüfte vorbereiten",
              stretchId: "hip_flexor_stretch",
              category: "Hüfte",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:incline_chest_press",
            block: {
              id: "pause:tag-b:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
    ],
  },
  {
    id: "split-3",
    name: "3er Split",
    description: "Push / Pull / Beine",
    accent: "#0891b2",
    origin: "template",
    days: [
      createTemplateDay({
        id: "push",
        name: "Push",
        slot: "push",
        color: "#dc2626",
        exercises: [
          { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "incline_chest_press", name: "incline_chest_press", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
          { id: "machine_lateral_raise", name: "machine_lateral_raise", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "dips", name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
          { id: "triceps_pushdown", name: "triceps_pushdown", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:split-3-push:chest",
              type: "stretch",
              label: "Brust öffnen",
              stretchId: "doorway_chest_stretch",
              category: "Brust",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:shoulderpress",
            block: {
              id: "pause:split-3-push:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "pull",
        name: "Pull",
        slot: "pull",
        color: "#2563eb",
        exercises: [
          { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "t_bar_row", name: "t_bar_row", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
          { id: "close_grip_latpulldown", name: "close_grip_latpulldown", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "face_pulls", name: "face_pulls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "hammer_curls", name: "hammer_curls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "reverse_fly", name: "reverse_fly", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:split-3-pull:lat",
              type: "stretch",
              label: "Rücken vorbereiten",
              stretchId: "lat_stretch",
              category: "Rücken",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:close_grip_latpulldown",
            block: {
              id: "pause:split-3-pull:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "legs",
        name: "Beine",
        slot: "mixed",
        color: "#16a34a",
        exercises: [
          { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
          { id: "legpress", name: "legpress", sets: 3, minReps: 10, maxReps: 15, restSeconds: 120 },
          { id: "seated_legcurl", name: "seated_legcurl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
          { id: "seated_calf_raise", name: "seated_calf_raise", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:split-3-legs:ankle",
              type: "stretch",
              label: "Unterkörper aktivieren",
              stretchId: "deep_squat_hold",
              category: "Mobilität",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:bulgarian",
            block: {
              id: "pause:split-3-legs:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 90,
              scope: "workout",
            },
          },
        ],
      }),
    ],
  },
  {
    id: "push-pull-legs",
    name: "Push Pull Legs",
    description: "Klassischer PPL",
    accent: "#2563eb",
    origin: "template",
    days: [
      createTemplateDay({
        id: "push",
        name: "Push",
        slot: "push",
        color: "#dc2626",
        exercises: [
          { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 9, restSeconds: 150 },
          { id: "incline_chest_press", name: "incline_chest_press", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "dips", name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
          { id: "machine_lateral_raise", name: "machine_lateral_raise", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "triceps_pushdown", name: "triceps_pushdown", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:ppl-push:chest",
              type: "stretch",
              label: "Brust öffnen",
              stretchId: "doorway_chest_stretch",
              category: "Brust",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:incline_chest_press",
            block: {
              id: "pause:ppl-push:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "pull",
        name: "Pull",
        slot: "pull",
        color: "#2563eb",
        exercises: [
          { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "machine_row", name: "machine_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "close_grip_latpulldown", name: "close_grip_latpulldown", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
          { id: "face_pulls", name: "face_pulls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "hammer_curls", name: "hammer_curls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:ppl-pull:lat",
              type: "stretch",
              label: "Lat mobilisieren",
              stretchId: "lat_stretch",
              category: "Rücken",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:romanian_deadlift",
            block: {
              id: "pause:ppl-pull:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 75,
              scope: "workout",
            },
          },
        ],
      }),
      createTemplateDay({
        id: "legs",
        name: "Legs",
        slot: "mixed",
        color: "#16a34a",
        exercises: [
          { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "legpress", name: "legpress", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
          { id: "seated_legcurl", name: "seated_legcurl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
          { id: "seated_calf_raise", name: "seated_calf_raise", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "cable_crunch", name: "cable_crunch", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
        extras: [
          {
            placement: "start",
            block: {
              id: "stretch:ppl-legs:mobility",
              type: "stretch",
              label: "Beine mobilisieren",
              stretchId: "deep_squat_hold",
              category: "Mobilität",
              holdSeconds: 30,
              rounds: 2,
            },
          },
          {
            placement: "after:bulgarian",
            block: {
              id: "pause:ppl-legs:reset",
              type: "pause",
              label: "Workout-Pause",
              seconds: 90,
              scope: "workout",
            },
          },
        ],
      }),
    ],
  },
  {
    id: "upper-lower",
    name: "Oberkörper Unterkörper",
    description: "OK / UK",
    accent: "#ea580c",
    origin: "template",
    days: [
      {
        id: "upper",
        name: "Oberkörper",
        slot: "push",
        color: "#ea580c",
        exercises: [
          { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "machine_row", name: "machine_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
          { id: "hammer_curls", name: "hammer_curls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "triceps_pushdown", name: "triceps_pushdown", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
      },
      {
        id: "lower",
        name: "Unterkörper",
        slot: "pull",
        color: "#f97316",
        exercises: [
          { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
          { id: "seated_legcurl", name: "seated_legcurl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
          { id: "seated_calf_raise", name: "seated_calf_raise", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "cable_crunch", name: "cable_crunch", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
      },
    ],
  },
  {
    id: "full-body",
    name: "Ganzkörper",
    description: "A / B Rotation",
    accent: "#0f766e",
    origin: "template",
    days: [
      {
        id: "full-body-a",
        name: "Ganzkörper A",
        slot: "push",
        color: "#0f766e",
        exercises: [
          { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "chest_supported_row", name: "chest_supported_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
          { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
          { id: "cable_crunch", name: "cable_crunch", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
        ],
      },
      {
        id: "full-body-b",
        name: "Ganzkörper B",
        slot: "pull",
        color: "#14b8a6",
        exercises: [
          { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
          { id: "incline_chest_press", name: "incline_chest_press", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "close_grip_latpulldown", name: "close_grip_latpulldown", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
          { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
          { id: "face_pulls", name: "face_pulls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          { id: "dips", name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
        ],
      },
    ],
  },
];

function enhanceTemplatePlanBlocks(plan: TrainingPlan): TrainingPlan {
  if (plan.id === "upper-lower") {
    return {
      ...plan,
      days: [
        createTemplateDay({
          id: "upper",
          name: "Oberkörper",
          slot: "push",
          color: "#ea580c",
          exercises: [
            { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
            { id: "machine_row", name: "machine_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
            { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
            { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
            { id: "hammer_curls", name: "hammer_curls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
            { id: "triceps_pushdown", name: "triceps_pushdown", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          ],
          extras: [
            {
              placement: "start",
              block: {
                id: "stretch:upper:shoulder",
                type: "stretch",
                label: "Schulter vorbereiten",
                stretchId: "band_shoulder_mobility",
                category: "Mobilität",
                holdSeconds: 30,
                rounds: 2,
              },
            },
            {
              placement: "after:pullups",
              block: {
                id: "pause:upper:reset",
                type: "pause",
                label: "Workout-Pause",
                seconds: 75,
                scope: "workout",
              },
            },
          ],
        }),
        createTemplateDay({
          id: "lower",
          name: "Unterkörper",
          slot: "pull",
          color: "#f97316",
          exercises: [
            { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
            { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
            { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
            { id: "seated_legcurl", name: "seated_legcurl", sets: 3, minReps: 10, maxReps: 15, restSeconds: 90 },
            { id: "seated_calf_raise", name: "seated_calf_raise", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
            { id: "cable_crunch", name: "cable_crunch", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          ],
          extras: [
            {
              placement: "start",
              block: {
                id: "stretch:lower:ankle",
                type: "stretch",
                label: "Unterkörper vorbereiten",
                stretchId: "ankle_mobility",
                category: "Mobilität",
                holdSeconds: 30,
                rounds: 2,
              },
            },
            {
              placement: "after:bulgarian",
              block: {
                id: "pause:lower:reset",
                type: "pause",
                label: "Workout-Pause",
                seconds: 90,
                scope: "workout",
              },
            },
          ],
        }),
      ],
    };
  }

  if (plan.id === "full-body") {
    return {
      ...plan,
      days: [
        createTemplateDay({
          id: "full-body-a",
          name: "Ganzkörper A",
          slot: "push",
          color: "#0f766e",
          exercises: [
            { id: "squat", name: "squat", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
            { id: "benchpress", name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
            { id: "chest_supported_row", name: "chest_supported_row", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
            { id: "shoulderpress", name: "shoulderpress", sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
            { id: "pullups", name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
            { id: "cable_crunch", name: "cable_crunch", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
          ],
          extras: [
            {
              placement: "start",
              block: {
                id: "stretch:full-a:start",
                type: "stretch",
                label: "Ganzkörper mobilisieren",
                stretchId: "worlds_greatest_stretch",
                category: "Mobilität",
                holdSeconds: 30,
                rounds: 2,
              },
            },
            {
              placement: "after:shoulderpress",
              block: {
                id: "pause:full-a:reset",
                type: "pause",
                label: "Workout-Pause",
                seconds: 75,
                scope: "workout",
              },
            },
          ],
        }),
        createTemplateDay({
          id: "full-body-b",
          name: "Ganzkörper B",
          slot: "pull",
          color: "#14b8a6",
          exercises: [
            { id: "romanian_deadlift", name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
            { id: "incline_chest_press", name: "incline_chest_press", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
            { id: "close_grip_latpulldown", name: "close_grip_latpulldown", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
            { id: "bulgarian", name: "bulgarian", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
            { id: "face_pulls", name: "face_pulls", sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
            { id: "dips", name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
          ],
          extras: [
            {
              placement: "start",
              block: {
                id: "stretch:full-b:start",
                type: "stretch",
                label: "Hüfte und Rücken",
                stretchId: "figure_four_stretch",
                category: "Hüfte",
                holdSeconds: 30,
                rounds: 2,
              },
            },
            {
              placement: "after:bulgarian",
              block: {
                id: "pause:full-b:reset",
                type: "pause",
                label: "Workout-Pause",
                seconds: 75,
                scope: "workout",
              },
            },
          ],
        }),
      ],
    };
  }

  return plan;
}

const defaultTrainingPlans = defaultTrainingPlansSource
  .map(enhanceTemplatePlanBlocks)
  .map(normalizeTrainingPlan);

export const trainingPlans = defaultTrainingPlans;

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function isTrainingExercise(value: unknown): value is TrainingExercise {
  if (!value || typeof value !== "object") {
    return false;
  }

  const exercise = value as Partial<TrainingExercise>;
  return (
    typeof exercise.id === "string" &&
    typeof exercise.name === "string" &&
    typeof exercise.sets === "number" &&
    typeof exercise.minReps === "number" &&
    typeof exercise.maxReps === "number" &&
    typeof exercise.restSeconds === "number"
  );
}

function isTrainingDay(value: unknown): value is TrainingDay {
  if (!value || typeof value !== "object") {
    return false;
  }

  const day = value as Partial<TrainingDay>;
  return (
    typeof day.id === "string" &&
    typeof day.name === "string" &&
    (day.slot === "push" || day.slot === "pull" || day.slot === "mixed") &&
    typeof day.color === "string" &&
    Array.isArray(day.exercises) &&
    day.exercises.every(isTrainingExercise)
  );
}

function isTrainingPlan(value: unknown): value is TrainingPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Partial<TrainingPlan>;
  return (
    typeof plan.id === "string" &&
    typeof plan.name === "string" &&
    typeof plan.description === "string" &&
    typeof plan.accent === "string" &&
    (plan.origin === "template" || plan.origin === "custom") &&
    Array.isArray(plan.days) &&
    plan.days.every(isTrainingDay)
  );
}

function readCustomPlans(): TrainingPlan[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_PLANS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTrainingPlan).map((plan) =>
      normalizeTrainingPlan({
        ...plan,
        origin: "custom",
      })
    );
  } catch (error) {
    console.error("Custom plans could not be read:", error);
    return [];
  }
}

function writeCustomPlans(plans: TrainingPlan[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      CUSTOM_PLANS_KEY,
      JSON.stringify(plans.map(normalizeTrainingPlan))
    );
  } catch (error) {
    console.error("Custom plans could not be written:", error);
  }
}

function clonePlan(plan: TrainingPlan): TrainingPlan {
  return normalizeTrainingPlan(JSON.parse(JSON.stringify(plan)) as TrainingPlan);
}

function createCustomPlanId() {
  return `custom-${Date.now()}`;
}

export function getAllTrainingPlans() {
  return [...defaultTrainingPlans, ...readCustomPlans()].map(normalizeTrainingPlan);
}

export function getTrainingPlan(planId: string | null | undefined) {
  return getAllTrainingPlans().find((plan) => plan.id === planId) ?? defaultTrainingPlans[0];
}

export function getDayForSlot(plan: TrainingPlan, slot: PlanRouteSlot) {
  return plan.days.find((day) => day.slot === slot) ?? null;
}

export function getDayBlocks(day: TrainingDay) {
  return day.blocks ?? syncDayBlocks(day.exercises, day.blocks);
}

export function getPlanPreview(plan: TrainingPlan) {
  return plan.days.map((day) => day.name).join(" / ");
}

export function getActivePlanId() {
  if (typeof window === "undefined") {
    return DEFAULT_PLAN_ID;
  }

  const stored = window.localStorage.getItem(ACTIVE_PLAN_KEY);
  return getTrainingPlan(stored).id;
}

export function setActivePlanId(planId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_PLAN_KEY, getTrainingPlan(planId).id);
}

export function ensureActivePlanSelection() {
  if (!canUseStorage()) {
    return;
  }

  const stored = window.localStorage.getItem(ACTIVE_PLAN_KEY);
  const valid = getAllTrainingPlans().some((plan) => plan.id === stored);

  if (!valid) {
    window.localStorage.setItem(ACTIVE_PLAN_KEY, DEFAULT_PLAN_ID);
  }
}

export function duplicateTrainingPlan(planId: string) {
  const source = getTrainingPlan(planId);
  const customPlans = readCustomPlans();
  const copy = normalizeTrainingPlan(clonePlan(source));

  copy.id = createCustomPlanId();
  copy.name = `${source.name} Kopie`;
  copy.origin = "custom";

  customPlans.unshift(copy);
  writeCustomPlans(customPlans);

  return copy;
}

type NewTrainingDayDraft = {
  name: string;
  slot?: PlanRouteSlot;
  color?: string;
  exercises: ExerciseDraft[];
};

type NewTrainingPlanDraft = {
  name: string;
  accent?: string;
  days: NewTrainingDayDraft[];
};

const DEFAULT_DAY_COLORS: Record<PlanRouteSlot, string> = {
  push: "#dc2626",
  pull: "#2563eb",
  mixed: "#16a34a",
};

export function createTrainingPlan(draft: NewTrainingPlanDraft) {
  const name = draft.name.trim();
  if (!name || !draft.days.length) {
    return null;
  }

  const customPlans = readCustomPlans();
  const newPlanId = createCustomPlanId();

  const nextPlan: TrainingPlan = normalizeTrainingPlan({
    id: newPlanId,
    name,
    description: draft.days.map((day) => day.name.trim()).join(" / "),
    accent: draft.accent ?? "#111827",
    origin: "custom",
    days: draft.days.map((day, index) => {
      const slot: PlanRouteSlot =
        day.slot ?? (index === 0 ? "push" : index === 1 ? "pull" : "mixed");
      const color = day.color ?? DEFAULT_DAY_COLORS[slot];
      const exercises = day.exercises.map((exercise) => {
        const normalized = normalizeExerciseDraft(exercise);
        const suggested = getSuggestedExerciseSetup(normalized.name);

        return {
          id: createExerciseId(normalized.name),
          name: normalized.name,
          sets: normalized.sets || suggested.sets,
          minReps: normalized.minReps || suggested.minReps,
          maxReps: normalized.maxReps || suggested.maxReps,
          restSeconds: normalized.restSeconds || suggested.restSeconds,
        };
      });

      return {
        id: `${newPlanId}-${slot}-${index}`,
        name: day.name.trim() || `Tag ${String.fromCharCode(65 + index)}`,
        slot,
        color,
        exercises,
      };
    }),
  });

  customPlans.unshift(nextPlan);
  writeCustomPlans(customPlans);
  return nextPlan;
}

export function deleteTrainingPlan(planId: string) {
  const customPlans = readCustomPlans();
  const nextPlans = customPlans.filter((plan) => plan.id !== planId);

  if (nextPlans.length === customPlans.length) {
    return false;
  }

  writeCustomPlans(nextPlans);

  if (canUseStorage()) {
    const activePlanId = window.localStorage.getItem(ACTIVE_PLAN_KEY);
    if (activePlanId === planId) {
      window.localStorage.setItem(ACTIVE_PLAN_KEY, DEFAULT_PLAN_ID);
    }
  }

  return true;
}

export function renameTrainingPlan(planId: string, nextName: string) {
  const trimmed = nextName.trim();
  if (!trimmed) {
    return null;
  }

  const customPlans = readCustomPlans();
  const index = customPlans.findIndex((plan) => plan.id === planId);

  if (index === -1) {
    return null;
  }

  const updated = {
    ...customPlans[index],
    name: trimmed,
  };

  customPlans[index] = normalizeTrainingPlan(updated);
  writeCustomPlans(customPlans);

  return updated;
}

export function isCustomTrainingPlan(planId: string) {
  return readCustomPlans().some((plan) => plan.id === planId);
}

function updateCustomPlan(
  planId: string,
  updater: (plan: TrainingPlan) => TrainingPlan | null
) {
  const customPlans = readCustomPlans();
  const index = customPlans.findIndex((plan) => plan.id === planId);

  if (index === -1) {
    return null;
  }

  const updatedPlan = updater(clonePlan(customPlans[index]));
  if (!updatedPlan) {
    return null;
  }

  customPlans[index] = normalizeTrainingPlan(updatedPlan);
  writeCustomPlans(customPlans);
  return updatedPlan;
}

export function renameTrainingDay(
  planId: string,
  dayId: string,
  nextName: string
) {
  const trimmed = nextName.trim();
  if (!trimmed) {
    return null;
  }

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    day.name = trimmed;
    return plan;
  });
}

export function addTrainingDay(
  planId: string,
  draft: { name: string; slot?: PlanRouteSlot; color?: string }
) {
  const trimmed = draft.name.trim();
  if (!trimmed) {
    return null;
  }

  return updateCustomPlan(planId, (plan) => {
    const index = plan.days.length;
    const slot: PlanRouteSlot =
      draft.slot ?? (index === 0 ? "push" : index === 1 ? "pull" : "mixed");
    const color = draft.color ?? DEFAULT_DAY_COLORS[slot];

    plan.days.push({
      id: `${plan.id}-${slot}-${Date.now()}`,
      name: trimmed,
      slot,
      color,
      exercises: [],
    });

    return plan;
  });
}

type ExerciseDraft = {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

function normalizeExerciseDraft(draft: ExerciseDraft) {
  const sets = Math.max(1, Math.round(Number(draft.sets) || 1));
  const minReps = Math.max(1, Number(draft.minReps) || 1);
  const maxReps = Math.max(minReps, Number(draft.maxReps) || minReps);
  const restSeconds = Math.max(15, Math.round(Number(draft.restSeconds) || 60));

  return {
    name: draft.name,
    sets,
    minReps,
    maxReps,
    restSeconds,
  };
}

function createExerciseId(name: string) {
  return `${name}-${Date.now()}`;
}

type WarmupDraft = {
  rounds: number;
  restSeconds: number;
};

type StretchDraft = {
  stretchId: string;
  holdSeconds: number;
  rounds: number;
};

type PauseDraft = {
  label?: string;
  seconds: number;
  scope: "exercise" | "workout";
};

type NoteDraft = {
  label?: string;
  notes: string;
};

function insertBlocksAfter(
  blocks: TrainingPlanBlock[],
  newBlocks: TrainingPlanBlock[],
  insertAfterBlockId?: string | null
) {
  if (!insertAfterBlockId) {
    return [...blocks, ...newBlocks];
  }

  const insertIndex = blocks.findIndex((block) => block.id === insertAfterBlockId);
  if (insertIndex === -1) {
    return [...blocks, ...newBlocks];
  }

  return [
    ...blocks.slice(0, insertIndex + 1),
    ...newBlocks,
    ...blocks.slice(insertIndex + 1),
  ];
}

export function addTrainingExercise(
  planId: string,
  dayId: string,
  draft: ExerciseDraft,
  insertAfterBlockId?: string | null
) {
  if (!draft.name) {
    return null;
  }

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const exercise = {
      id: createExerciseId(draft.name),
      ...normalizeExerciseDraft(draft),
    };
    const insertAfterExerciseId =
      blocks.find(
        (block): block is Extract<TrainingPlanBlock, { type: "exercise" }> =>
          block.type === "exercise" && block.id === insertAfterBlockId
      )?.exerciseId ??
      blocks.find(
        (block): block is Extract<TrainingPlanBlock, { type: "warmup" }> =>
          block.type === "warmup" && block.id === insertAfterBlockId
      )?.parentExerciseId ??
      null;

    const insertAfterExerciseIndex = insertAfterExerciseId
      ? day.exercises.findIndex((entry) => entry.id === insertAfterExerciseId)
      : -1;

    if (insertAfterExerciseIndex >= 0) {
      day.exercises.splice(insertAfterExerciseIndex + 1, 0, exercise);
    } else {
      day.exercises.push(exercise);
    }

    const syncedBlocks = syncDayBlocks(day.exercises, blocks);
    const insertedBlocks = syncedBlocks.filter(
      (block) =>
        (block.type === "exercise" && block.exerciseId === exercise.id) ||
        (block.type === "warmup" && block.parentExerciseId === exercise.id)
    );
    const remainingBlocks = syncedBlocks.filter(
      (block) =>
        !(
          (block.type === "exercise" && block.exerciseId === exercise.id) ||
          (block.type === "warmup" && block.parentExerciseId === exercise.id)
        )
    );

    day.blocks = insertBlocksAfter(
      remainingBlocks,
      insertedBlocks,
      insertAfterBlockId
    );
    return plan;
  });
}

export function updateTrainingExercise(
  planId: string,
  dayId: string,
  exerciseId: string,
  draft: ExerciseDraft
) {
  if (!draft.name) {
    return null;
  }

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const exerciseIndex = day.exercises.findIndex(
      (exercise) => exercise.id === exerciseId
    );
    if (exerciseIndex === -1) {
      return null;
    }

    day.exercises[exerciseIndex] = {
      ...day.exercises[exerciseIndex],
      ...normalizeExerciseDraft(draft),
    };
    return plan;
  });
}

export function removeTrainingExercise(
  planId: string,
  dayId: string,
  exerciseId: string
) {
  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    day.exercises = day.exercises.filter((exercise) => exercise.id !== exerciseId);
    return plan;
  });
}

export function updateWarmupBlock(
  planId: string,
  dayId: string,
  exerciseId: string,
  draft: WarmupDraft
) {
  const rounds = Math.max(0, Math.round(Number(draft.rounds) || 0));
  const restSeconds = Math.max(15, Math.round(Number(draft.restSeconds) || 45));

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const exerciseBlock = blocks.find(
      (block) => block.type === "exercise" && block.exerciseId === exerciseId
    );

    if (!exerciseBlock || exerciseBlock.type !== "exercise") {
      return null;
    }

    exerciseBlock.warmupSets = rounds;

    const warmupBlock = blocks.find(
      (block) => block.type === "warmup" && block.parentExerciseId === exerciseId
    );

    if (warmupBlock && warmupBlock.type === "warmup") {
      warmupBlock.rounds = rounds;
      warmupBlock.restSeconds = restSeconds;
    }

    day.blocks = blocks;
    return plan;
  });
}

export function addStretchBlock(
  planId: string,
  dayId: string,
  draft: StretchDraft,
  insertAfterBlockId?: string | null
) {
  if (!draft.stretchId) {
    return null;
  }

  const entry = getExerciseCatalogEntry(draft.stretchId);
  if (!entry || entry.kind !== "stretch") {
    return null;
  }

  const holdSeconds = Math.max(15, Math.round(Number(draft.holdSeconds) || 30));
  const rounds = Math.max(1, Math.round(Number(draft.rounds) || 1));

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const stretchBlock: StretchPlanBlock = {
      id: `stretch:${draft.stretchId}:${Date.now()}`,
      type: "stretch",
      label: entry.label,
      stretchId: draft.stretchId,
      category: entry.category,
      holdSeconds,
      rounds,
    };

    day.blocks = insertBlocksAfter(blocks, [stretchBlock], insertAfterBlockId);
    return plan;
  });
}

export function updateStretchBlock(
  planId: string,
  dayId: string,
  blockId: string,
  draft: StretchDraft
) {
  if (!draft.stretchId) {
    return null;
  }

  const entry = getExerciseCatalogEntry(draft.stretchId);
  if (!entry || entry.kind !== "stretch") {
    return null;
  }

  const holdSeconds = Math.max(15, Math.round(Number(draft.holdSeconds) || 30));
  const rounds = Math.max(1, Math.round(Number(draft.rounds) || 1));

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const index = blocks.findIndex(
      (block) => block.type === "stretch" && block.id === blockId
    );

    if (index === -1) {
      return null;
    }

    blocks[index] = {
      id: blockId,
      type: "stretch",
      label: entry.label,
      stretchId: draft.stretchId,
      category: entry.category,
      holdSeconds,
      rounds,
    };

    day.blocks = blocks;
    return plan;
  });
}

export function addPauseBlock(
  planId: string,
  dayId: string,
  draft: PauseDraft,
  insertAfterBlockId?: string | null
) {
  const seconds = Math.max(15, Math.round(Number(draft.seconds) || 60));

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const pauseBlock: PausePlanBlock = {
      id: `pause:${Date.now()}`,
      type: "pause",
      label:
        draft.label?.trim() ||
        (draft.scope === "workout" ? "Workout-Pause" : "Pause"),
      seconds,
      scope: draft.scope,
    };

    day.blocks = insertBlocksAfter(blocks, [pauseBlock], insertAfterBlockId);
    return plan;
  });
}

export function updatePauseBlock(
  planId: string,
  dayId: string,
  blockId: string,
  draft: PauseDraft
) {
  const seconds = Math.max(15, Math.round(Number(draft.seconds) || 60));

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const index = blocks.findIndex(
      (block) => block.type === "pause" && block.id === blockId
    );

    if (index === -1) {
      return null;
    }

    blocks[index] = {
      id: blockId,
      type: "pause",
      label:
        draft.label?.trim() ||
        (draft.scope === "workout" ? "Workout-Pause" : "Pause"),
      seconds,
      scope: draft.scope,
    };

    day.blocks = blocks;
    return plan;
  });
}

export function addNoteBlock(
  planId: string,
  dayId: string,
  draft: NoteDraft,
  insertAfterBlockId?: string | null
) {
  if (!draft.notes.trim()) {
    return null;
  }

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const noteBlock: NotePlanBlock = {
      id: `note:${Date.now()}`,
      type: "note",
      label: draft.label?.trim() || "Hinweis",
      notes: draft.notes.trim(),
    };

    day.blocks = insertBlocksAfter(blocks, [noteBlock], insertAfterBlockId);
    return plan;
  });
}

export function updateNoteBlock(
  planId: string,
  dayId: string,
  blockId: string,
  draft: NoteDraft
) {
  if (!draft.notes.trim()) {
    return null;
  }

  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const index = blocks.findIndex(
      (block) => block.type === "note" && block.id === blockId
    );

    if (index === -1) {
      return null;
    }

    blocks[index] = {
      id: blockId,
      type: "note",
      label: draft.label?.trim() || "Hinweis",
      notes: draft.notes.trim(),
    };

    day.blocks = blocks;
    return plan;
  });
}

export function removeDayBlock(
  planId: string,
  dayId: string,
  blockId: string
) {
  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    day.blocks = blocks.filter((block) => block.id !== blockId);
    return plan;
  });
}

export function moveDayBlock(
  planId: string,
  dayId: string,
  blockId: string,
  direction: "up" | "down"
) {
  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = [...(day.blocks ?? syncDayBlocks(day.exercises))];
    const index = blocks.findIndex((block) => block.id === blockId);

    if (index === -1) {
      return null;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return plan;
    }

    const [moved] = blocks.splice(index, 1);
    blocks.splice(targetIndex, 0, moved);
    day.blocks = blocks;
    return plan;
  });
}

export function duplicateDayBlock(
  planId: string,
  dayId: string,
  blockId: string
) {
  return updateCustomPlan(planId, (plan) => {
    const day = plan.days.find((entry) => entry.id === dayId);
    if (!day) {
      return null;
    }

    const blocks = day.blocks ?? syncDayBlocks(day.exercises);
    const sourceBlock = blocks.find((block) => block.id === blockId);

    if (!sourceBlock || sourceBlock.type === "warmup") {
      return null;
    }

    if (sourceBlock.type === "exercise") {
      const sourceExercise = day.exercises.find(
        (exercise) => exercise.id === sourceBlock.exerciseId
      );

      if (!sourceExercise) {
        return null;
      }

      const duplicatedExercise = {
        ...sourceExercise,
        id: createExerciseId(sourceExercise.name),
      };

      day.exercises.push(duplicatedExercise);

      const syncedBlocks = syncDayBlocks(day.exercises, blocks);
      const duplicatedBlocks = syncedBlocks.filter(
        (block) =>
          (block.type === "exercise" &&
            block.exerciseId === duplicatedExercise.id) ||
          (block.type === "warmup" &&
            block.parentExerciseId === duplicatedExercise.id)
      );
      const remainingBlocks = syncedBlocks.filter(
        (block) =>
          !(
            (block.type === "exercise" &&
              block.exerciseId === duplicatedExercise.id) ||
            (block.type === "warmup" &&
              block.parentExerciseId === duplicatedExercise.id)
          )
      );

      day.blocks = insertBlocksAfter(remainingBlocks, duplicatedBlocks, blockId);
      return plan;
    }

    if (sourceBlock.type === "stretch") {
      const duplicateStretch: StretchPlanBlock = {
        ...sourceBlock,
        id: `stretch:${sourceBlock.stretchId}:${Date.now()}`,
      };

      day.blocks = insertBlocksAfter(blocks, [duplicateStretch], blockId);
      return plan;
    }

    if (sourceBlock.type === "note") {
      const duplicateNote: NotePlanBlock = {
        ...sourceBlock,
        id: `note:${Date.now()}`,
      };

      day.blocks = insertBlocksAfter(blocks, [duplicateNote], blockId);
      return plan;
    }

    const duplicatePause: PausePlanBlock = {
      ...sourceBlock,
      id: `pause:${Date.now()}`,
    };

    day.blocks = insertBlocksAfter(blocks, [duplicatePause], blockId);
    return plan;
  });
}

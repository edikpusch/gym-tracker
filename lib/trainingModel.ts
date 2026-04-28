import { getExerciseCatalogEntry, type ExerciseKind } from "@/lib/trainingCatalog";

export type PlanBlockType = "exercise" | "warmup" | "stretch" | "pause";

export type WeightStep = 5 | 2.5 | 1 | 0.5;

export type WeightConfig = {
  unit: "kg";
  allowNegative: boolean;
  min: number;
  max: number | null;
  quickSteps: WeightStep[];
};

export type ExerciseDefinition = {
  id: string;
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

export type ExercisePlanBlock = {
  id: string;
  type: "exercise";
  label: string;
  exerciseId: string;
  exerciseKind: ExerciseKind;
  category: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  warmupSets: number;
  weight: WeightConfig;
};

export type WarmupPlanBlock = {
  id: string;
  type: "warmup";
  label: string;
  parentExerciseId: string;
  rounds: number;
  restSeconds: number;
};

export type StretchPlanBlock = {
  id: string;
  type: "stretch";
  label: string;
  stretchId: string;
  category: string;
  holdSeconds: number;
  rounds: number;
};

export type PausePlanBlock = {
  id: string;
  type: "pause";
  label: string;
  seconds: number;
  scope: "exercise" | "workout";
};

export type TrainingPlanBlock =
  | ExercisePlanBlock
  | WarmupPlanBlock
  | StretchPlanBlock
  | PausePlanBlock;

export const DEFAULT_WEIGHT_STEPS: WeightStep[] = [5, 2.5, 1, 0.5];
export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  unit: "kg",
  allowNegative: false,
  min: 0,
  max: null,
  quickSteps: DEFAULT_WEIGHT_STEPS,
};

export function getDefaultWarmupSets(kind: ExerciseKind) {
  if (kind === "compound") {
    return 3;
  }

  if (kind === "isolation") {
    return 1;
  }

  return 0;
}

export function getDefaultWeightConfig(exerciseName: string): WeightConfig {
  const entry = getExerciseCatalogEntry(exerciseName);
  const allowNegative = !!entry?.supportsAssistanceWeight;

  return {
    unit: "kg",
    allowNegative,
    min: allowNegative ? -100 : 0,
    max: null,
    quickSteps: DEFAULT_WEIGHT_STEPS,
  };
}

export function buildExerciseBlock(
  exercise: ExerciseDefinition,
  existingBlock?: ExercisePlanBlock | null
): ExercisePlanBlock {
  const entry = getExerciseCatalogEntry(exercise.name);
  const exerciseKind = entry?.kind ?? "compound";
  const category = entry?.category ?? "Ganzkörper";

  return {
    id: `exercise:${exercise.id}`,
    type: "exercise",
    label: entry?.label ?? exercise.name,
    exerciseId: exercise.id,
    exerciseKind,
    category,
    sets: exercise.sets,
    minReps: exercise.minReps,
    maxReps: exercise.maxReps,
    restSeconds: exercise.restSeconds,
    warmupSets: existingBlock?.warmupSets ?? getDefaultWarmupSets(exerciseKind),
    weight: existingBlock?.weight ?? getDefaultWeightConfig(exercise.name),
  };
}

export function buildWarmupBlock(
  exerciseBlock: ExercisePlanBlock,
  existingBlock?: WarmupPlanBlock | null
): WarmupPlanBlock | null {
  if (exerciseBlock.warmupSets <= 0) {
    return null;
  }

  return {
    id: `warmup:${exerciseBlock.exerciseId}`,
    type: "warmup",
    label: `${exerciseBlock.label} Aufwärmen`,
    parentExerciseId: exerciseBlock.exerciseId,
    rounds: exerciseBlock.warmupSets,
    restSeconds:
      existingBlock?.restSeconds ??
      Math.max(45, Math.round(exerciseBlock.restSeconds / 2)),
  };
}

export function buildDayBlocks(exercises: ExerciseDefinition[]) {
  const blocks: TrainingPlanBlock[] = [];

  exercises.forEach((exercise) => {
    const exerciseBlock = buildExerciseBlock(exercise);
    const warmupBlock = buildWarmupBlock(exerciseBlock);

    if (warmupBlock) {
      blocks.push(warmupBlock);
    }

    blocks.push(exerciseBlock);
  });

  return blocks;
}

export function syncDayBlocks(
  exercises: ExerciseDefinition[],
  existingBlocks: TrainingPlanBlock[] = []
) {
  const blocks: TrainingPlanBlock[] = [];
  const consumedExerciseIds = new Set<string>();
  const consumedWarmupIds = new Set<string>();

  function buildBlocksForExercise(exerciseId: string) {
    const exercise = exercises.find((entry) => entry.id === exerciseId);
    if (!exercise) {
      return { exerciseBlock: null, warmupBlock: null };
    }

    const existingExerciseBlock = existingBlocks.find(
      (block): block is ExercisePlanBlock =>
        block.type === "exercise" && block.exerciseId === exercise.id
    );
    const exerciseBlock = buildExerciseBlock(exercise, existingExerciseBlock);
    const existingWarmupBlock = existingBlocks.find(
      (block): block is WarmupPlanBlock =>
        block.type === "warmup" && block.parentExerciseId === exercise.id
    );
    const warmupBlock = buildWarmupBlock(exerciseBlock, existingWarmupBlock);

    return { exerciseBlock, warmupBlock };
  }

  existingBlocks.forEach((block) => {
    if (block.type === "stretch" || block.type === "pause") {
      blocks.push(block);
      return;
    }

    if (block.type === "warmup") {
      if (consumedWarmupIds.has(block.parentExerciseId)) {
        return;
      }

      const { warmupBlock } = buildBlocksForExercise(block.parentExerciseId);
      if (warmupBlock) {
        blocks.push(warmupBlock);
        consumedWarmupIds.add(block.parentExerciseId);
      }
      return;
    }

    if (consumedExerciseIds.has(block.exerciseId)) {
      return;
    }

    const { exerciseBlock } = buildBlocksForExercise(block.exerciseId);
    if (exerciseBlock) {
      blocks.push(exerciseBlock);
      consumedExerciseIds.add(block.exerciseId);
    }
  });

  exercises.forEach((exercise) => {
    const { exerciseBlock, warmupBlock } = buildBlocksForExercise(exercise.id);

    if (warmupBlock && !consumedWarmupIds.has(exercise.id)) {
      blocks.push(warmupBlock);
      consumedWarmupIds.add(exercise.id);
    }

    if (exerciseBlock && !consumedExerciseIds.has(exercise.id)) {
      blocks.push(exerciseBlock);
      consumedExerciseIds.add(exercise.id);
    }
  });

  return blocks;
}

import { getExerciseCatalogEntry, type ExerciseKind } from "@/lib/trainingCatalog";
import type { LoadKind, WeightUnit } from "@/lib/workout-domain/types";

export type PlanBlockType =
  | "exercise"
  | "warmup"
  | "stretch"
  | "pause"
  | "note";

export type WeightStep = number;

export type WeightConfig = {
  unit: WeightUnit;
  loadKind: LoadKind;
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
  loadKind?: LoadKind;
  weightUnit?: WeightUnit;
  weightStep?: number;
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

export type NotePlanBlock = {
  id: string;
  type: "note";
  label: string;
  notes: string;
};

export type TrainingPlanBlock =
  | ExercisePlanBlock
  | WarmupPlanBlock
  | StretchPlanBlock
  | PausePlanBlock
  | NotePlanBlock;

export type PlanBlock = TrainingPlanBlock;

export const DEFAULT_WEIGHT_STEPS: WeightStep[] = [5, 2.5, 1, 0.5];
export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  unit: "kg",
  loadKind: "external",
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
    loadKind: allowNegative ? "bodyweight" : "external",
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
    warmupSets: existingBlock?.warmupSets ?? 0,
    weight: {
      ...(existingBlock?.weight ?? getDefaultWeightConfig(exercise.name)),
      unit: exercise.weightUnit ?? existingBlock?.weight.unit ?? "kg",
      loadKind: exercise.loadKind ?? existingBlock?.weight.loadKind ?? (existingBlock?.weight.allowNegative ? "bodyweight" : "external"),
      quickSteps: exercise.weightStep ? [exercise.weightStep] : existingBlock?.weight.quickSteps ?? DEFAULT_WEIGHT_STEPS,
    },
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
  return exercises.map((exercise) => buildExerciseBlock(exercise));
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
    const existingWarmupBlock = existingBlocks.find(
      (block): block is WarmupPlanBlock =>
        block.type === "warmup" && block.parentExerciseId === exercise.id
    );
    const exerciseBlock = buildExerciseBlock(exercise, existingExerciseBlock);
    const warmupRounds = existingWarmupBlock?.rounds ?? 0;

    if (warmupRounds > 0) {
      exerciseBlock.warmupSets = warmupRounds;
    }

    const warmupBlock = existingWarmupBlock
      ? buildWarmupBlock(
          {
            ...exerciseBlock,
            warmupSets: warmupRounds,
          },
          existingWarmupBlock
        )
      : null;

    return { exerciseBlock, warmupBlock };
  }

  existingBlocks.forEach((block) => {
    if (
      block.type === "stretch" ||
      block.type === "pause" ||
      block.type === "note"
    ) {
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

export function reorderDayExerciseBlocks(
  exercises: ExerciseDefinition[],
  existingBlocks: TrainingPlanBlock[] = []
) {
  const synced = syncDayBlocks(exercises, existingBlocks);
  const optionalByBoundary = new Map<number, TrainingPlanBlock[]>();
  let exerciseBoundary = 0;

  synced.forEach((block) => {
    if (block.type === "exercise") {
      exerciseBoundary += 1;
      return;
    }
    if (block.type === "warmup") return;
    const boundary = Math.min(exercises.length, exerciseBoundary);
    optionalByBoundary.set(boundary, [...(optionalByBoundary.get(boundary) ?? []), block]);
  });

  const exerciseBlocks = new Map(
    synced.filter((block): block is ExercisePlanBlock => block.type === "exercise").map((block) => [block.exerciseId, block])
  );
  const warmupBlocks = new Map(
    synced.filter((block): block is WarmupPlanBlock => block.type === "warmup").map((block) => [block.parentExerciseId, block])
  );
  const result: TrainingPlanBlock[] = [...(optionalByBoundary.get(0) ?? [])];

  exercises.forEach((exercise, index) => {
    const warmup = warmupBlocks.get(exercise.id);
    const exerciseBlock = exerciseBlocks.get(exercise.id);
    if (warmup) result.push(warmup);
    if (exerciseBlock) result.push(exerciseBlock);
    result.push(...(optionalByBoundary.get(index + 1) ?? []));
  });

  return result;
}

export function placeOptionalBlockAtExerciseBoundary(
  exercises: ExerciseDefinition[],
  existingBlocks: TrainingPlanBlock[],
  blockId: string,
  boundary: number
) {
  const ordered = reorderDayExerciseBlocks(exercises, existingBlocks);
  const target = ordered.find((block) => block.id === blockId);
  if (!target || target.type === "exercise" || target.type === "warmup") return ordered;
  const withoutTarget = ordered.filter((block) => block.id !== blockId);
  const clampedBoundary = Math.min(exercises.length, Math.max(0, Math.round(boundary)));
  if (clampedBoundary === 0) return [target, ...withoutTarget];
  let seenExercises = 0;
  const insertAfter = withoutTarget.findIndex((block) => {
    if (block.type === "exercise") seenExercises += 1;
    return seenExercises === clampedBoundary && block.type === "exercise";
  });
  if (insertAfter < 0) return [...withoutTarget, target];
  return [...withoutTarget.slice(0, insertAfter + 1), target, ...withoutTarget.slice(insertAfter + 1)];
}

export function materializeLegacyWarmupBlocks(
  exercises: ExerciseDefinition[],
  existingBlocks: TrainingPlanBlock[] = []
) {
  if (existingBlocks.length === 0) {
    return existingBlocks;
  }

  const hasLegacyWarmupState = existingBlocks.some(
    (block) => block.type === "exercise" && block.warmupSets > 0
  );

  if (!hasLegacyWarmupState) {
    return existingBlocks;
  }

  const blocks: TrainingPlanBlock[] = [];
  const seenWarmups = new Set<string>();

  existingBlocks.forEach((block) => {
    if (block.type === "warmup") {
      seenWarmups.add(block.parentExerciseId);
      blocks.push(block);
      return;
    }

    if (
      block.type === "exercise" &&
      block.warmupSets > 0 &&
      !seenWarmups.has(block.exerciseId)
    ) {
      const warmupBlock = buildWarmupBlock(block);
      if (warmupBlock) {
        blocks.push(warmupBlock);
        seenWarmups.add(block.exerciseId);
      }
    }

    blocks.push(block);
  });

  return blocks;
}

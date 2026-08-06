import type { TrainingDay, TrainingPlan } from "@/lib/trainingPlans";
import { getDayBlocks } from "@/lib/trainingPlans";
import { getExerciseLabel } from "@/lib/workoutUi";
import { WORKOUT_SCHEMA_VERSION, type PlannedSet, type WorkoutSnapshot } from "@/lib/workout-domain/types";

export function createWorkoutSnapshotFromPlan(
  plan: TrainingPlan,
  day: TrainingDay,
  capturedAt = Date.now()
): WorkoutSnapshot {
  const blocks = getDayBlocks(day);
  const toWorkoutExercise = (exercise: TrainingDay["exercises"][number]) => {
    const exerciseBlock = blocks.find(
      (block) => block.type === "exercise" && block.exerciseId === exercise.id
    );
    const warmupBlock = blocks.find(
      (block) => block.type === "warmup" && block.parentExerciseId === exercise.id
    );
    const configuredUnit = exercise.weightUnit ?? (exerciseBlock?.type === "exercise" ? exerciseBlock.weight.unit : "kg");
    const warmupSets: PlannedSet[] = Array.from({
      length: warmupBlock?.type === "warmup" ? warmupBlock.rounds : 0,
    }).map((_, index) => ({
      id: `${exercise.id}:warmup:${index + 1}`,
      kind: "warmup",
      targetReps: { min: 1, max: 10 },
      restSeconds:
        warmupBlock?.type === "warmup"
          ? warmupBlock.restSeconds
          : Math.max(30, Math.round(exercise.restSeconds / 2)),
      targetLoad: { value: 0, unit: configuredUnit },
    }));
    const workSets: PlannedSet[] = Array.from({ length: exercise.sets }).map(
      (_, index) => ({
        id: `${exercise.id}:workset:${index + 1}`,
        kind: "workset",
        targetReps: { min: exercise.minReps, max: exercise.maxReps },
        restSeconds: exercise.restSeconds,
        targetLoad: { value: 0, unit: configuredUnit },
      })
    );

    return {
        id: exercise.id,
        exerciseId: exercise.id,
        guidanceKey: exercise.name,
        name: getExerciseLabel(exercise.name),
        loadKind:
          exercise.loadKind ?? (exerciseBlock?.type === "exercise" ? exerciseBlock.weight.loadKind ?? (exerciseBlock.weight.allowNegative ? "bodyweight" as const : "external" as const) : "external" as const),
        weightStep:
          exercise.weightStep ?? (exerciseBlock?.type === "exercise"
            ? Math.min(...exerciseBlock.weight.quickSteps)
            : 2.5),
        weightUnit: configuredUnit,
        sets: [...warmupSets, ...workSets],
    };
  };

  const consumedGroupIds = new Set<string>();
  const consumedExerciseIds = new Set<string>();
  const steps: WorkoutSnapshot["steps"] = [];

  function addExerciseStep(exercise: TrainingDay["exercises"][number]) {
    if (consumedExerciseIds.has(exercise.id)) return;
    if (!exercise.group) {
      consumedExerciseIds.add(exercise.id);
      steps.push({
        id: `step:${exercise.id}`,
        type: "exercise" as const,
        exercise: toWorkoutExercise(exercise),
      });
      return;
    }

    if (consumedGroupIds.has(exercise.group.id)) {
      return;
    }

    consumedGroupIds.add(exercise.group.id);
    const members = day.exercises.filter(
      (candidate) => candidate.group?.id === exercise.group?.id
    );
    members.forEach((member) => consumedExerciseIds.add(member.id));

    steps.push({
      id: `step:${exercise.group.id}`,
      type: exercise.group.type,
      label: exercise.group.label,
      rounds: exercise.group.rounds,
      transitionSeconds: exercise.group.transitionSeconds,
      roundRestSeconds: exercise.group.roundRestSeconds,
      exercises: members.map(toWorkoutExercise),
    });
  }

  blocks.forEach((block) => {
    if (block.type === "warmup") return;
    if (block.type === "exercise") {
      const exercise = day.exercises.find((entry) => entry.id === block.exerciseId);
      if (exercise) addExerciseStep(exercise);
      return;
    }
    if (block.type === "pause") {
      steps.push({ id: `step:${block.id}`, type: "pause", label: block.label, seconds: block.seconds });
      return;
    }
    if (block.type === "stretch") {
      steps.push({ id: `step:${block.id}`, type: "mobility", label: block.label, durationSeconds: block.holdSeconds, rounds: block.rounds, mediaId: block.stretchId });
      return;
    }
    steps.push({ id: `step:${block.id}`, type: "note", label: block.label, text: block.notes });
  });

  day.exercises.forEach(addExerciseStep);

  return {
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    planId: plan.id,
    planName: plan.name,
    workoutId: day.id,
    workoutName: day.name,
    capturedAt,
    steps,
  };
}

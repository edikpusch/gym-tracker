import type {
  PlannedSet,
  WorkoutExercise,
  WorkoutQueueItem,
  WorkoutSnapshot,
} from "@/lib/workout-domain/types";

function queueItemId(
  stepId: string,
  exercise: WorkoutExercise,
  set: PlannedSet,
  round?: number
) {
  return [stepId, exercise.id, set.id, round == null ? null : `r${round}`]
    .filter(Boolean)
    .join(":");
}

function toQueueItem({
  stepId,
  exercise,
  set,
  restSeconds,
  groupId,
  groupType,
  round,
}: {
  stepId: string;
  exercise: WorkoutExercise;
  set: PlannedSet;
  restSeconds: number;
  groupId?: string;
  groupType?: "superset" | "circuit";
  round?: number;
}): WorkoutQueueItem {
  return {
    id: queueItemId(stepId, exercise, set, round),
    stepId,
    groupId,
    groupType,
    round,
    exercise,
    plannedSet: set,
    restSeconds,
  };
}

function buildGroupedQueue(
  step: Extract<WorkoutSnapshot["steps"][number], { type: "superset" | "circuit" }>
) {
  const queue: WorkoutQueueItem[] = [];

  // Warm-ups happen before the alternating group rounds.
  step.exercises.forEach((exercise) => {
    exercise.sets
      .filter((set) => set.kind === "warmup")
      .forEach((set) => {
        queue.push(
          toQueueItem({
            stepId: step.id,
            groupId: step.id,
            groupType: step.type,
            exercise,
            set,
            restSeconds: set.restSeconds,
          })
        );
      });
  });

  const workSets = new Map(
    step.exercises.map((exercise) => [
      exercise.id,
      exercise.sets.filter((set) => set.kind !== "warmup"),
    ])
  );

  for (let round = 0; round < step.rounds; round += 1) {
    step.exercises.forEach((exercise, exerciseIndex) => {
      const set = workSets.get(exercise.id)?.[round];
      if (!set) return;

      const isLastExercise = exerciseIndex === step.exercises.length - 1;
      queue.push(
        toQueueItem({
          stepId: step.id,
          groupId: step.id,
          groupType: step.type,
          round: round + 1,
          exercise,
          set,
          restSeconds: isLastExercise
            ? step.roundRestSeconds
            : step.transitionSeconds,
        })
      );
    });
  }

  return queue;
}

export function buildWorkoutQueue(snapshot: WorkoutSnapshot) {
  return snapshot.steps.flatMap<WorkoutQueueItem>((step) => {
    if (step.type === "exercise") {
      return step.exercise.sets.map((set) =>
        toQueueItem({
          stepId: step.id,
          exercise: step.exercise,
          set,
          restSeconds: set.restSeconds,
        })
      );
    }

    if (step.type === "superset" || step.type === "circuit") {
      return buildGroupedQueue(step);
    }

    if (step.type === "pause" || step.type === "mobility" || step.type === "note") {
      const durationSeconds = step.type === "pause"
        ? step.seconds
        : step.type === "mobility"
          ? step.durationSeconds * step.rounds
          : undefined;
      const exercise: WorkoutExercise = {
        id: `activity:${step.id}`,
        exerciseId: `activity:${step.id}`,
        name: step.label,
        loadKind: "bodyweight",
        weightStep: 1,
        sets: [],
      };
      return [{
        id: `queue:${step.id}`,
        stepId: step.id,
        exercise,
        plannedSet: {
          id: `activity-set:${step.id}`,
          kind: "warmup",
          targetReps: { min: 1, max: 1 },
          restSeconds: 0,
        },
        restSeconds: 0,
        activity: {
          type: step.type,
          label: step.label,
          text: step.type === "note" ? step.text : undefined,
          durationSeconds,
          rounds: step.type === "mobility" ? step.rounds : undefined,
        },
      }];
    }

    return [];
  });
}

export type WorkoutType = "push" | "pull" | "mixed";

export type WorkoutExercise = {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

export const workoutPlans: Record<WorkoutType, WorkoutExercise[]> = {
  push: [
    { name: "benchpress", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
    { name: "pullups_wide", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
    { name: "shoulderpress", sets: 3, minReps: 6, maxReps: 9, restSeconds: 150 },
    { name: "dips", sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
    { name: "bulgarian", sets: 3, minReps: 6, maxReps: 9, restSeconds: 120 },
    { name: "hanging_leg_raises", sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
  ],
  pull: [
    { name: "rows", sets: 3, minReps: 6, maxReps: 9, restSeconds: 180 },
    { name: "pushups", sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
    { name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 8, restSeconds: 180 },
    { name: "face_pulls", sets: 3, minReps: 12, maxReps: 15, restSeconds: 105 },
    { name: "walking_lunges", sets: 3, minReps: 8, maxReps: 10, restSeconds: 120 },
    { name: "hanging_leg_raises", sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
  ],
  mixed: [
    { name: "squat", sets: 3, minReps: 6, maxReps: 9, restSeconds: 180 },
    { name: "pullups", sets: 3, minReps: 5, maxReps: 8, restSeconds: 180 },
    { name: "romanian_deadlift", sets: 3, minReps: 6, maxReps: 9, restSeconds: 180 },
    { name: "shoulderpress_pushups", sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 },
    { name: "bulgarian", sets: 3, minReps: 7, maxReps: 10, restSeconds: 120 },
    { name: "core", sets: 3, minReps: 8, maxReps: 12, restSeconds: 105 },
  ],
};

export function getWorkoutLabel(type: WorkoutType) {
  if (type === "push") return "Push Workout";
  if (type === "pull") return "Pull Workout";
  return "Mixed Workout";
}

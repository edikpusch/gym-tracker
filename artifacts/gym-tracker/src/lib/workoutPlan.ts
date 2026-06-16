import {
  getTrainingPlan,
  trainingPlans,
  type TrainingDay,
  type TrainingExercise,
} from "@/lib/trainingPlans";

export type WorkoutType = string;
export type WorkoutExercise = TrainingExercise;

const defaultPlan = getTrainingPlan("my-plan");

export const workoutPlans = {
  push: defaultPlan.days.find((day) => day.slot === "push")?.exercises ?? [],
  pull: defaultPlan.days.find((day) => day.slot === "pull")?.exercises ?? [],
  mixed: defaultPlan.days.find((day) => day.slot === "mixed")?.exercises ?? [],
};

export function getWorkoutLabel(type: WorkoutType) {
  if (type === "push") return "Push Workout";
  if (type === "pull") return "Pull Workout";
  if (type === "mixed") return "Mixed Workout";
  return "Workout";
}

export function getAllWorkoutDays() {
  return trainingPlans.flatMap((plan) => plan.days);
}

export function getDayByType(type: WorkoutType): TrainingDay | null {
  return getAllWorkoutDays().find((day) => day.id === type) ?? null;
}

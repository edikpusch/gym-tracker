import {
  ACTIVE_WORKOUT_KEY,
  ACTIVE_WORKOUT_SNAPSHOT_KEY,
} from "@/lib/activeWorkout";
import { APP_PREFERENCES_KEY } from "@/lib/appPreferences";
import { BODY_WEIGHT_KEY } from "@/lib/bodyWeight";
import { CUSTOM_EXERCISE_LIBRARY_KEY } from "@/lib/exerciseLibrary";
import { EXERCISE_FAVORITES_KEY } from "@/lib/exerciseFavorites";
import {
  ACTIVE_PLAN_KEY,
  CUSTOM_PLANS_KEY,
  RECENT_PLAN_EXERCISES_KEY,
} from "@/lib/trainingPlans";
import {
  PLAN_VERSION_KEY,
  WORKOUT_LOG_KEY,
} from "@/lib/workoutEngine";

export const APP_STORAGE_KEYS = [
  APP_PREFERENCES_KEY,
  BODY_WEIGHT_KEY,
  CUSTOM_EXERCISE_LIBRARY_KEY,
  EXERCISE_FAVORITES_KEY,
  ACTIVE_PLAN_KEY,
  CUSTOM_PLANS_KEY,
  RECENT_PLAN_EXERCISES_KEY,
  WORKOUT_LOG_KEY,
  PLAN_VERSION_KEY,
  ACTIVE_WORKOUT_KEY,
  ACTIVE_WORKOUT_SNAPSHOT_KEY,
] as const;



import { PlanWorkoutPage } from "@/components/plan-workout-page";
import { createSplitWorkoutTheme } from "@/lib/theme";

export default function LegsWorkout() {
  return <PlanWorkoutPage slot="mixed" theme={createSplitWorkoutTheme("mixed")} />;
}

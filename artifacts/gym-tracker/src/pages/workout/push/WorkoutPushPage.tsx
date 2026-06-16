

import { PlanWorkoutPage } from "@/components/plan-workout-page";
import { createSplitWorkoutTheme } from "@/lib/theme";

export default function PushWorkout() {
  return <PlanWorkoutPage slot="push" theme={createSplitWorkoutTheme("push")} />;
}

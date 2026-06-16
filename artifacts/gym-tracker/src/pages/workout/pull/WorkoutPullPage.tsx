

import { PlanWorkoutPage } from "@/components/plan-workout-page";
import { createSplitWorkoutTheme } from "@/lib/theme";

export default function PullWorkout() {
  return <PlanWorkoutPage slot="pull" theme={createSplitWorkoutTheme("pull")} />;
}

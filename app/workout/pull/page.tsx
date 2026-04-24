"use client";

import { WorkoutScreen } from "@/components/workout-screen";
import { workoutPlans } from "@/lib/workoutPlan";

export default function PullWorkout() {
  return (
    <WorkoutScreen
      workoutType="pull"
      workoutLabel="PULL WORKOUT"
      exercises={workoutPlans.pull}
      theme={{
        screenBadge: "#1565c0",
        badgeBackground: "#eef5ff",
        accent: "#1452b8",
        border: "rgba(33, 99, 235, 0.16)",
        shadow: "0 24px 60px rgba(29, 78, 216, 0.12)",
        progressTrack: "#dce8ff",
        progressFill: "linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)",
        restFill: "linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)",
        background:
          "radial-gradient(circle at top, #d9ebff 0%, #eef6ff 38%, #f7f8fb 100%)",
      }}
    />
  );
}

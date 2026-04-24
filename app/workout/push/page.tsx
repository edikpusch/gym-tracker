"use client";

import { WorkoutScreen } from "@/components/workout-screen";
import { workoutPlans } from "@/lib/workoutPlan";

export default function PushWorkout() {
  return (
    <WorkoutScreen
      workoutType="push"
      workoutLabel="PUSH WORKOUT"
      exercises={workoutPlans.push}
      theme={{
        screenBadge: "#c62828",
        badgeBackground: "#fff5f4",
        accent: "#991b1b",
        border: "rgba(201, 43, 43, 0.16)",
        shadow: "0 24px 60px rgba(125, 21, 21, 0.12)",
        progressTrack: "#ffe1dc",
        progressFill: "linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)",
        restFill: "linear-gradient(90deg, #f97316 0%, #ef4444 100%)",
        background:
          "radial-gradient(circle at top, #ffd8d3 0%, #fff3f1 36%, #f7f8fb 100%)",
      }}
    />
  );
}

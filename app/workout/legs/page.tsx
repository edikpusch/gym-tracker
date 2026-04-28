"use client";

import { PlanWorkoutPage } from "@/components/plan-workout-page";

export default function LegsWorkout() {
  return (
    <PlanWorkoutPage
      slot="mixed"
      theme={{
        screenBadge: "#2e7d32",
        badgeBackground: "#effcf2",
        accent: "#1f6b31",
        border: "rgba(46, 125, 50, 0.16)",
        shadow: "0 24px 60px rgba(22, 101, 52, 0.12)",
        progressTrack: "#dbf1df",
        progressFill: "linear-gradient(90deg, #4ade80 0%, #15803d 100%)",
        restFill: "linear-gradient(90deg, #86efac 0%, #16a34a 100%)",
        background:
          "radial-gradient(circle at top, #ddf8e5 0%, #f0fff4 38%, #f7f8fb 100%)",
      }}
    />
  );
}

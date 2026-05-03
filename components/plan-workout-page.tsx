"use client";

import { useEffect, useState } from "react";

import { WorkoutScreen } from "@/components/workout-screen";
import {
  getActivePlanId,
  getDayBlocks,
  getDayForSlot,
  getTrainingPlan,
  type PlanRouteSlot,
  type TrainingDay,
} from "@/lib/trainingPlans";

const slotHref = {
  push: "/workout/push/index.html",
  pull: "/workout/pull/index.html",
  mixed: "/workout/legs/index.html",
} as const;

type WorkoutTheme = {
  screenBadge: string;
  badgeBackground: string;
  accent: string;
  border: string;
  shadow: string;
  progressTrack: string;
  progressFill: string;
  restFill: string;
  background: string;
};

type PlanWorkoutPageProps = {
  slot: PlanRouteSlot;
  theme: WorkoutTheme;
};

export function PlanWorkoutPage({
  slot,
  theme,
}: PlanWorkoutPageProps) {
  const [day, setDay] = useState<TrainingDay | null>(null);
  const [planId, setPlanId] = useState("");
  const [planName, setPlanName] = useState("");

  useEffect(() => {
    const activePlan = getTrainingPlan(getActivePlanId());
    setPlanId(activePlan.id);
    setPlanName(activePlan.name);
    setDay(getDayForSlot(activePlan, slot));
  }, [slot]);

  if (!day) {
    return (
      <div style={emptyScreen}>
        <div style={emptyCard}>
          <div style={emptyTitle}>Kein Training hinterlegt</div>
          <a href="/index.html" style={emptyLink}>
            ← Start
          </a>
        </div>
      </div>
    );
  }

  return (
    <WorkoutScreen
      workoutType={`${planId}:${day.id}`}
      workoutLabel={day.name.toUpperCase()}
      exercises={day.exercises}
      dayBlocks={getDayBlocks(day)}
      planId={planId}
      planName={planName}
      dayId={day.id}
      dayName={day.name}
      resumeHref={slotHref[slot]}
      theme={theme}
    />
  );
}

const emptyScreen = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background:
    "radial-gradient(circle at top, #e7eefb 0%, #f4f6fb 34%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
};

const emptyCard = {
  width: "100%",
  maxWidth: 360,
  padding: "24px 20px",
  borderRadius: 24,
  background: "rgba(255,255,255,0.96)",
  textAlign: "center" as const,
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
};

const emptyTitle = {
  fontSize: 20,
  fontWeight: "bold",
  color: "#111827",
};

const emptyLink = {
  marginTop: 12,
  display: "inline-block",
  textDecoration: "none",
  color: "#2563eb",
  fontWeight: "bold",
};

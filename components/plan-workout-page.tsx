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

export function PlanWorkoutPage({ slot, theme }: PlanWorkoutPageProps) {
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
      theme={buildThemeFromDayColor(day.color, theme)}
    />
  );
}

function buildThemeFromDayColor(
  color: string,
  fallback: WorkoutTheme
): WorkoutTheme {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return fallback;
  }

  const [r, g, b] = rgb;
  const accent = color;
  const screenBadge = darken(color, 0.2);

  return {
    ...fallback,
    screenBadge,
    badgeBackground: `rgba(${r}, ${g}, ${b}, 0.1)`,
    accent,
    border: `rgba(${r}, ${g}, ${b}, 0.18)`,
    shadow: `0 24px 60px rgba(${r}, ${g}, ${b}, 0.14)`,
    progressTrack: `rgba(${r}, ${g}, ${b}, 0.16)`,
    progressFill: `linear-gradient(90deg, ${lighten(color, 0.18)} 0%, ${accent} 100%)`,
    restFill: `linear-gradient(90deg, ${lighten(color, 0.26)} 0%, ${accent} 100%)`,
    background: `radial-gradient(circle at top, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.07) 36%, #f7f8fb 100%)`,
  };
}

function hexToRgb(color: string): [number, number, number] | null {
  const value = color.replace("#", "");
  if (value.length !== 6) return null;

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  if ([r, g, b].some((part) => Number.isNaN(part))) {
    return null;
  }

  return [r, g, b];
}

function lighten(color: string, amount: number) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const [r, g, b] = rgb.map((part) =>
    Math.round(part + (255 - part) * amount)
  );

  return rgbToHex(r, g, b);
}

function darken(color: string, amount: number) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const [r, g, b] = rgb.map((part) => Math.round(part * (1 - amount)));
  return rgbToHex(r, g, b);
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

const emptyScreen = {
  minHeight: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box" as const,
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

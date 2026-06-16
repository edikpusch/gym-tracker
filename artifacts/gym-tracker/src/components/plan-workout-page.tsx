

import { Link } from "wouter";

import { WorkoutScreen } from "@/components/workout-screen";
import {
  appPalette,
  createWorkoutTheme,
  splitThemes,
  type WorkoutTheme,
  withAlpha,
} from "@/lib/theme";
import {
  getActivePlanId,
  getDayBlocks,
  getDayForSlot,
  getTrainingPlan,
  type PlanRouteSlot,
  type TrainingDay,
} from "@/lib/trainingPlans";

const slotHref = {
  push: "/workout/push",
  pull: "/workout/pull",
  mixed: "/workout/legs",
} as const;

type PlanWorkoutPageProps = {
  slot: PlanRouteSlot;
  theme: WorkoutTheme;
};

export function PlanWorkoutPage({ slot, theme }: PlanWorkoutPageProps) {
  const activePlan = getTrainingPlan(getActivePlanId());
  const day: TrainingDay | null = getDayForSlot(activePlan, slot);

  if (!day) {
    return (
      <div style={emptyScreen}>
        <div style={emptyCard}>
          <div style={emptyTitle}>Kein Training hinterlegt</div>
          <Link href="/" style={emptyLink}>
            ← Start
          </Link>
        </div>
      </div>
    );
  }

  return (
    <WorkoutScreen
      workoutType={`${activePlan.id}:${day.id}`}
      workoutLabel={day.name.toUpperCase()}
      exercises={day.exercises}
      dayBlocks={getDayBlocks(day)}
      planId={activePlan.id}
      planName={activePlan.name}
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
  return createWorkoutTheme(color, fallback);
}

const emptyScreen = {
  minHeight: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box" as const,
  background: `radial-gradient(circle at top, ${withAlpha(splitThemes.pull.primary, 0.12)} 0%, ${appPalette.surfaceSoft} 34%, ${appPalette.backgroundBase} 100%)`,
  fontFamily: "sans-serif",
};

const emptyCard = {
  width: "100%",
  maxWidth: 360,
  padding: "24px 20px",
  borderRadius: 24,
  background: withAlpha(appPalette.surface, 0.96),
  textAlign: "center" as const,
  boxShadow: `0 24px 60px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
};

const emptyTitle = {
  fontSize: 20,
  fontWeight: "bold",
  color: appPalette.textStrong,
};

const emptyLink = {
  marginTop: 12,
  display: "inline-block",
  textDecoration: "none",
  color: splitThemes.pull.primary,
  fontWeight: "bold",
};

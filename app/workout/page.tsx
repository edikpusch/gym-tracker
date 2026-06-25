"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTrainingPlan, getActivePlanId } from "@/lib/trainingPlans";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/db";

export default function WorkoutRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      // 1. Active workout running? Resume it.
      const db = getDb();
      const active = await db.activeWorkout.toCollection().first();
      if (active?.dayId) {
        router.replace(`/workout/${active.dayId}`);
        return;
      }

      // 2. Last used day?
      const lastDayId = await getSetting("lastWorkoutDayId");
      if (lastDayId) {
        router.replace(`/workout/${lastDayId}`);
        return;
      }

      // 3. Today's matching day
      const plan = getTrainingPlan(getActivePlanId());
      const todayDay = getTodaysDayId(plan.days);
      router.replace(`/workout/${todayDay}`);
    }
    void redirect();
  }, [router]);

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--c-text-3)", fontSize: 14 }}>Lädt…</p>
    </div>
  );
}

function getTodaysDayId(days: { id: string; slot: string }[]): string {
  const dow = new Date().getDay(); // 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
  // Map weekday to slot
  const slotMap: Record<number, string> = { 1: "push", 3: "pull", 5: "mixed" };
  const todaySlot = slotMap[dow];
  if (todaySlot) {
    const match = days.find((d) => d.slot === todaySlot);
    if (match) return match.id;
  }
  // Fallback: next upcoming slot in week order push→pull→mixed
  const order = ["push", "pull", "mixed"];
  const nextSlotIndex = dow <= 1 ? 0 : dow <= 3 ? 1 : 2;
  for (let i = nextSlotIndex; i < order.length; i++) {
    const match = days.find((d) => d.slot === order[i]);
    if (match) return match.id;
  }
  return days[0].id;
}

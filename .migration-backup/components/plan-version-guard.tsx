"use client";

import { useEffect } from "react";

import { ensureCurrentPlanStorage } from "@/lib/workoutEngine";
import { ensureActivePlanSelection } from "@/lib/trainingPlans";

export function PlanVersionGuard() {
  useEffect(() => {
    ensureCurrentPlanStorage();
    ensureActivePlanSelection();
  }, []);

  return null;
}

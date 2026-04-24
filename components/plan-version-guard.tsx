"use client";

import { useEffect } from "react";

import { ensureCurrentPlanStorage } from "@/lib/workoutEngine";

export function PlanVersionGuard() {
  useEffect(() => {
    ensureCurrentPlanStorage();
  }, []);

  return null;
}

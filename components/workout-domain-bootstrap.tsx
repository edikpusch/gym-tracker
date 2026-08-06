"use client";

import { useEffect } from "react";
import { migrateLegacyWorkoutData } from "@/lib/workout-domain/migration";

export function WorkoutDomainBootstrap() {
  useEffect(() => {
    void migrateLegacyWorkoutData().catch((error) => {
      console.error("Workout data migration failed:", error);
    });
  }, []);

  return null;
}

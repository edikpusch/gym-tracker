"use client";

import { WorkoutScreenV3 } from "@/components/workout-screen-v3";
import { use } from "react";

export default function WorkoutPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = use(params);
  return <WorkoutScreenV3 dayId={dayId} />;
}

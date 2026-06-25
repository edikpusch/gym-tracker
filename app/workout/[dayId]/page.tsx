"use client";

import { WorkoutScreen } from "@/components/workout-screen-v2";
import { use } from "react";

export default function WorkoutPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = use(params);
  return <WorkoutScreen dayId={dayId} />;
}

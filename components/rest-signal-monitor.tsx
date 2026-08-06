"use client";

import { useEffect } from "react";
import { clearRestNotification, scheduleRestNotification } from "@/lib/restNotifications";
import { emitRestWarningOnce, REST_WARNING_LEAD_MS } from "@/lib/workout-domain/restSignals";
import { dispatchActiveWorkoutAction, getActiveWorkoutSession } from "@/lib/workout-domain/storage";

export function RestSignalMonitor() {
  useEffect(() => {
    let stopped = false;
    let scheduledEnd: number | null = null;

    async function inspect() {
      const session = await getActiveWorkoutSession();
      if (stopped) return;
      if (session?.phase !== "resting" || session.clock.restPlannedEndsAt == null) {
        if (scheduledEnd != null) void clearRestNotification();
        scheduledEnd = null;
        return;
      }

      const end = session.clock.restPlannedEndsAt;
      if (scheduledEnd !== end) {
        scheduledEnd = end;
        const next = session.queue[session.queueIndex];
        void scheduleRestNotification(next?.exercise.name ?? "Nächster Satz", end);
      }
      const remaining = end - Date.now();
      if (remaining > 0 && remaining <= REST_WARNING_LEAD_MS) {
        void emitRestWarningOnce(session.clock.restStartedAt);
      } else if (remaining <= 0) {
        await dispatchActiveWorkoutAction({ type: "finish_rest", now: Date.now() });
      }
    }

    void inspect();
    const timer = window.setInterval(() => void inspect(), 500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}

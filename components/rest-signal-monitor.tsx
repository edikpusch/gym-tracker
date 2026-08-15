"use client";

import { useEffect } from "react";
import { clearRestNotification, scheduleRestNotification } from "@/lib/restNotifications";
import { emitRestWarningOnce, REST_WARNING_LEAD_MS } from "@/lib/workout-domain/restSignals";
import { dispatchActiveWorkoutAction, getActiveWorkoutSession } from "@/lib/workout-domain/storage";

/**
 * Obergrenze für einen laufenden Satz. Kein Satz dauert 20 Minuten; ein so
 * alter Startzeitpunkt bedeutet, dass das Gerät zwischendurch geschlafen hat
 * oder die App im Hintergrund lag.
 */
const MAX_PLAUSIBLE_SET_MS = 20 * 60_000;

export function RestSignalMonitor() {
  useEffect(() => {
    let stopped = false;
    let scheduledEnd: number | null = null;

    async function inspect() {
      const session = await getActiveWorkoutSession();
      if (stopped) return;

      // Der Satztimer lief gegen die Wanduhr weiter, wenn man das Workout über
      // "Minimieren" verließ: Der visibilitychange-Listener hing am
      // Workout-Screen und verschwand mit ihm. Dieser Monitor läuft app-weit
      // und fängt den Fall auf.
      if (
        session?.phase === "active_set" &&
        session.clock.currentSetStartedAt != null &&
        Date.now() - session.clock.currentSetStartedAt > MAX_PLAUSIBLE_SET_MS
      ) {
        await dispatchActiveWorkoutAction({ type: "app_hidden", now: Date.now() });
        return;
      }

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

    // App-weit registriert, nicht am Workout-Screen: Ein laufender Satz wird
    // zuverlässig angehalten, egal von welcher Seite aus die App in den
    // Hintergrund geht.
    async function pauseRunningSet() {
      if (typeof document !== "undefined" && document.visibilityState !== "hidden") return;
      const session = await getActiveWorkoutSession();
      if (session?.phase !== "active_set") return;
      await dispatchActiveWorkoutAction({ type: "app_hidden", now: Date.now() });
    }

    const onVisibilityChange = () => void pauseRunningSet();

    void inspect();
    const timer = window.setInterval(() => void inspect(), 500);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onVisibilityChange);
    };
  }, []);

  return null;
}

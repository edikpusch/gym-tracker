"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { getAllTrainingPlans, getActivePlanId, getTrainingPlan, type TrainingPlan } from "@/lib/trainingPlans";
import { getRecentSessions, getSetsForSession, type WorkoutSession } from "@/lib/db";

type RecentSession = WorkoutSession & { setCount: number; volume: number };

function formatRelativeDate(ts: number) {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `Vor ${days} Tagen`;
  return new Date(ts).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function formatDuration(startedAt: number, endedAt?: number) {
  const ms = (endedAt ?? Date.now()) - startedAt;
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const DAY_COLORS: Record<string, string> = {
  push: "#6366f1",
  pull: "#0ea5e9",
  mixed: "#10b981",
};

export default function Home() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activePlan = getTrainingPlan(getActivePlanId());
    setPlan(activePlan);

    getRecentSessions(5).then(async (sessions) => {
      const enriched: RecentSession[] = await Promise.all(
        sessions.map(async (s) => {
          const sets = await getSetsForSession(s.sessionId);
          const workSets = sets.filter((x) => x.setType === "workset");
          const volume = workSets.reduce((sum, x) => sum + x.weight * x.reps, 0);
          return { ...s, setCount: workSets.length, volume };
        })
      );
      setRecentSessions(enriched);
      setLoading(false);
    });
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  })();

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom))" }}>

      {/* Header */}
      <div style={{
        paddingTop: "calc(20px + var(--safe-area-top))",
        paddingLeft: "calc(20px + var(--safe-area-left))",
        paddingRight: "calc(20px + var(--safe-area-right))",
        paddingBottom: 20,
      }}>
        <p style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 500, marginBottom: 2, textTransform: "capitalize" }}>{today}</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--c-text)", lineHeight: 1.1 }}>{greeting}</h1>
      </div>

      <div style={{ paddingLeft: "calc(16px + var(--safe-area-left))", paddingRight: "calc(16px + var(--safe-area-right))" }}>

        {/* Plan Section */}
        {plan && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase" }}>
                {plan.name}
              </h2>
              <Link href="/settings" style={{ fontSize: 12, color: "var(--c-accent)", textDecoration: "none", fontWeight: 500 }}>
                Pläne
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {plan.days.map((day, i) => {
                const color = DAY_COLORS[day.slot] ?? "var(--c-accent)";
                const exerciseCount = day.exercises.length;
                const estimatedMin = exerciseCount * 9;
                return (
                  <Link
                    key={day.id}
                    href={`/workout/${day.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      background: i === 0 ? color : "var(--c-surface)",
                      border: `1px solid ${i === 0 ? "transparent" : "var(--c-border)"}`,
                      borderRadius: 16,
                      padding: "16px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                      <div>
                        <p style={{ fontSize: 11, color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--c-text-3)", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>
                          {day.slot.toUpperCase()}
                        </p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? "#fff" : "var(--c-text)", marginBottom: 4 }}>{day.name}</p>
                        <p style={{ fontSize: 12, color: i === 0 ? "rgba(255,255,255,0.65)" : "var(--c-text-3)" }}>
                          {exerciseCount} Übungen · ~{estimatedMin} Min
                        </p>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? "rgba(255,255,255,0.7)" : "var(--c-text-3)"} strokeWidth={2} strokeLinecap="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent Sessions */}
        {!loading && recentSessions.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase" }}>
                Letzte Einheiten
              </h2>
              <Link href="/history" style={{ fontSize: 12, color: "var(--c-accent)", textDecoration: "none", fontWeight: 500 }}>
                Alle
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentSessions.map((session) => (
                <Link key={session.sessionId} href="/history" style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                    borderRadius: 12,
                    padding: "13px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>
                        {session.dayName ?? "Workout"}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                        {formatRelativeDate(session.startedAt)} · {formatDuration(session.startedAt, session.endedAt)}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)" }}>
                        {(session.volume / 1000).toFixed(1)} t
                      </p>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>{session.setCount} Sätze</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loading && recentSessions.length === 0 && (
          <div style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            borderRadius: 16,
            padding: "32px 20px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>💪</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", marginBottom: 6 }}>Erste Einheit starten</p>
            <p style={{ fontSize: 13, color: "var(--c-text-3)", lineHeight: 1.5 }}>
              Wähle oben einen Plan und leg los.
            </p>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}

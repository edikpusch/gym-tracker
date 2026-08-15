"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { formatVolume } from "@/components/workout-session-summary";
import { APP_VERSION } from "@/lib/version";
import { getActivePlanId, getTrainingPlan, type TrainingDay, type TrainingPlan } from "@/lib/trainingPlans";
import { getWorkoutHistory, type HistorySession } from "@/lib/workout-domain/analytics";
import { getActiveWorkoutSession } from "@/lib/workout-domain/storage";
import type { WorkoutRuntimeState } from "@/lib/workout-domain/types";
import { getLatestSessionsByWorkout, getRecommendedWorkout, getWorkoutDaySummary } from "@/lib/workout-start";

type HubData = {
  plan: TrainingPlan;
  sessions: HistorySession[];
  activeWorkout: WorkoutRuntimeState | null;
};

function relativeDate(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `Vor ${days} Tagen`;
  return new Date(timestamp).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function WorkoutFacts({ plan, day }: { plan: TrainingPlan; day: TrainingDay }) {
  const summary = getWorkoutDaySummary(plan, day);
  return <p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 5 }}>{summary.exerciseCount} Übungen · {summary.workSetCount} Arbeitssätze · ca. {summary.estimatedMinutes} Min</p>;
}

function ResumeCard({ workout }: { workout: WorkoutRuntimeState }) {
  const completed = workout.results.filter((result) => result.status === "completed").length + workout.completedActivityIds.length;
  return <Link href={`/workout/${workout.snapshot.workoutId}`} style={{ display: "block", padding: "17px", borderRadius: 17, background: "var(--c-accent-dim)", border: "1px solid var(--c-accent-border)", textDecoration: "none" }}><div style={{ display: "flex", alignItems: "center", gap: 13 }}><div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--c-accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 20 }}>▶</div><div style={{ flex: 1, minWidth: 0 }}><p style={{ color: "var(--c-accent)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8 }}>Workout fortsetzen</p><p style={{ color: "var(--c-text)", fontSize: 18, fontWeight: 800, marginTop: 3 }}>{workout.snapshot.workoutName}</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 3 }}>{completed} von {workout.queue.length} Schritten erledigt</p></div><span aria-hidden="true" style={{ color: "var(--c-accent)", fontSize: 22 }}>›</span></div></Link>;
}

function RecommendationCard({ plan, day, reason }: { plan: TrainingPlan; day: TrainingDay; reason: string }) {
  const summary = getWorkoutDaySummary(plan, day);
  return <section style={{ padding: 18, borderRadius: 18, background: `linear-gradient(145deg, ${day.color || plan.accent}, var(--c-accent))`, color: "#fff" }}><p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .9, opacity: .78 }}>Empfohlen</p><h2 style={{ fontSize: 24, lineHeight: 1.15, marginTop: 7 }}>{day.name}</h2><p style={{ fontSize: 12, opacity: .78, marginTop: 5 }}>{reason}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 15 }}>{[`${summary.exerciseCount} Übungen`, `${summary.workSetCount} Arbeitssätze`, `ca. ${summary.estimatedMinutes} Min`].map((fact) => <span key={fact} style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,.14)", fontSize: 11, fontWeight: 700 }}>{fact}</span>)}</div><Link href={`/workout/${day.id}`} style={{ display: "block", marginTop: 17, padding: "14px", borderRadius: 13, background: "#fff", color: "#111827", textAlign: "center", textDecoration: "none", fontWeight: 850 }}>Workout ansehen</Link></section>;
}

function WorkoutRow({ plan, day, latest }: { plan: TrainingPlan; day: TrainingDay; latest?: HistorySession }) {
  return <Link href={`/workout/${day.id}`} style={{ display: "block", padding: "14px 15px", borderRadius: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)", textDecoration: "none" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 10, height: 42, borderRadius: 999, background: day.color || plan.accent, flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><p style={{ color: "var(--c-text)", fontSize: 15, fontWeight: 750 }}>{day.name}</p><WorkoutFacts plan={plan} day={day} />{latest && <p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 4 }}>Zuletzt {relativeDate(latest.startedAt)}</p>}</div><span aria-hidden="true" style={{ color: "var(--c-text-3)", fontSize: 22 }}>›</span></div></Link>;
}

function RecentSessions({ sessions }: { sessions: HistorySession[] }) {
  const recent = sessions.slice(0, 2);
  if (!recent.length) return null;
  return <section><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8 }}>Zuletzt trainiert</p><Link href="/history" style={{ color: "var(--c-accent)", fontSize: 12, textDecoration: "none" }}>Alle</Link></div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{recent.map((session) => <Link key={session.id} href="/history" style={{ padding: "12px 14px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)", textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 12 }}><div><p style={{ color: "var(--c-text)", fontSize: 14, fontWeight: 700 }}>{session.workoutName}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>{relativeDate(session.startedAt)} · {session.workSetCount} {session.workSetCount === 1 ? "Arbeitssatz" : "Arbeitssätze"}</p></div><p style={{ color: "var(--c-text-2)", fontSize: 13, fontWeight: 750 }}>{formatVolume(session.volumeKg)}</p></Link>)}</div></section>;
}

export function WorkoutStartHub({ mode }: { mode: "home" | "picker" }) {
  const [data, setData] = useState<HubData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const plan = getTrainingPlan(getActivePlanId());
    void Promise.all([getWorkoutHistory(100), getActiveWorkoutSession()]).then(([sessions, activeWorkout]) => {
      if (!cancelled) setData({ plan, sessions, activeWorkout });
    });
    return () => { cancelled = true; };
  }, []);

  const recommendation = useMemo(() => data ? getRecommendedWorkout(data.plan, data.sessions) : null, [data]);
  const latestByWorkout = useMemo(() => data ? getLatestSessionsByWorkout(data.sessions) : new Map<string, HistorySession>(), [data]);

  if (!data) return <div style={{ minHeight: "100dvh", background: "var(--c-bg)", display: "grid", placeItems: "center", color: "var(--c-text-3)" }}>Lädt …</div>;

  const otherDays = data.plan.days.filter((day) => day.id !== recommendation?.day?.id);
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  return <div style={{ minHeight: "100dvh", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 24px)" }}>
    <header style={{ padding: "calc(20px + var(--safe-area-top)) 20px 17px" }}>
      {mode === "home" ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div><p style={{ color: "var(--c-text-3)", fontSize: 12, textTransform: "capitalize" }}>{today}</p><h1 style={{ fontSize: 27, marginTop: 2 }}>{greeting()}</h1></div><span style={{ color: "var(--c-text-2)", fontSize: 12 }}>v{APP_VERSION}</span></div> : <><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>{data.plan.name}</p><h1 style={{ fontSize: 27, marginTop: 2 }}>Workout wählen</h1><p style={{ color: "var(--c-text-3)", fontSize: 13, marginTop: 6 }}>Öffne zuerst die Übersicht. Das Training startet erst nach deiner Bestätigung.</p></>}
    </header>
    <main style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 21 }}>
      {data.activeWorkout && <ResumeCard workout={data.activeWorkout} />}
      {!data.activeWorkout && recommendation?.day && <RecommendationCard plan={data.plan} day={recommendation.day} reason={recommendation.reason} />}
      {data.activeWorkout ? <p style={{ padding: "13px 14px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-3)", fontSize: 12, lineHeight: 1.5 }}>Ein neues Workout kann gestartet werden, sobald die laufende Einheit abgeschlossen oder verworfen wurde.</p> : otherDays.length > 0 && <section><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8 }}>Weitere Workouts</p><Link href="/plans" style={{ color: "var(--c-accent)", fontSize: 12, textDecoration: "none" }}>Plan bearbeiten</Link></div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{otherDays.map((day) => <WorkoutRow key={day.id} plan={data.plan} day={day} latest={latestByWorkout.get(day.id)} />)}</div></section>}
      {mode === "home" && <RecentSessions sessions={data.sessions} />}
    </main>
    <BottomNav />
  </div>;
}

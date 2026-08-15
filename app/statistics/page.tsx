"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { formatVolume } from "@/components/workout-session-summary";
import { getExerciseBests, getExerciseProgress, getWorkoutHistory, type ExerciseBest, type HistorySession, type HistorySet } from "@/lib/workout-domain/analytics";

function shortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function loadLabel(set: Pick<HistorySet, "weight" | "unit" | "bodyWeight" | "loadKind">) {
  if (set.loadKind === "bodyweight") return `${set.bodyWeight ?? set.weight} ${set.unit} Körpergewicht`;
  if (set.loadKind === "bodyweight-plus") return `Körpergewicht + ${set.weight} ${set.unit}`;
  if (set.loadKind === "assisted") return `Körpergewicht − ${set.weight} ${set.unit}`;
  if (set.loadKind === "per-side") return `${set.weight} ${set.unit} je Seite`;
  return `${set.weight} ${set.unit}`;
}

function MiniBars({ values, labels, color = "var(--c-accent)" }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...values, 1);
  const width = 320;
  const chartHeight = 96;
  const gap = 6;
  const barWidth = Math.max(8, (width - gap * Math.max(0, values.length - 1)) / Math.max(1, values.length));
  return <svg role="img" aria-label="Verlauf der letzten Einheiten" viewBox={`0 0 ${width} 118`} style={{ width: "100%", display: "block" }}>{values.map((value, index) => { const height = Math.max(4, value / max * chartHeight); const x = index * (barWidth + gap); return <g key={`${labels[index]}:${index}`}><rect x={x} y={chartHeight - height} width={barWidth} height={height} rx={4} fill={color} opacity={index === values.length - 1 ? 1 : .42} /><text x={x + barWidth / 2} y={113} textAnchor="middle" fontSize="8" fill="var(--c-text-3)">{labels[index]}</text></g>; })}</svg>;
}

export default function StatisticsPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [bests, setBests] = useState<ExerciseBest[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getWorkoutHistory().then((history) => {
      const nextBests = getExerciseBests(history);
      setSessions(history);
      setBests(nextBests);
      setSelectedExerciseId(nextBests[0]?.exerciseId ?? "");
      setLoading(false);
    });
  }, []);

  const recent = sessions.slice(0, 10).reverse();
  const progress = useMemo(() => selectedExerciseId ? getExerciseProgress(sessions, selectedExerciseId).slice(-10) : [], [selectedExerciseId, sessions]);
  const totalVolume = sessions.reduce((sum, session) => sum + session.volumeKg, 0);
  const totalSets = sessions.reduce((sum, session) => sum + session.workSetCount, 0);
  const avgDuration = sessions.length ? sessions.reduce((sum, session) => sum + session.durationMs, 0) / sessions.length : 0;
  const avgActive = sessions.length ? sessions.reduce((sum, session) => sum + session.activeDurationMs, 0) / sessions.length : 0;
  const progressDelta = progress.length > 1 ? progress.at(-1)!.bestEstimatedOneRepMaxKg - progress[0].bestEstimatedOneRepMaxKg : null;
  const latestProgress = progress.at(-1);

  return <div style={{ minHeight: "100dvh", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 20px)" }}>
    <header style={{ padding: "calc(20px + var(--safe-area-top)) 20px 16px" }}><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>Nur abgeschlossene Arbeitssätze</p><h1 style={{ fontSize: 27, marginTop: 2 }}>Fortschritt</h1></header>
    <main style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      {loading ? <p style={{ color: "var(--c-text-3)", textAlign: "center", paddingTop: 40 }}>Lädt …</p> : !sessions.length ? <div style={{ padding: "42px 20px", borderRadius: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)", textAlign: "center" }}><p style={{ fontSize: 32 }}>↗</p><h2 style={{ fontSize: 17, marginTop: 12 }}>Noch keine Statistik</h2><p style={{ color: "var(--c-text-3)", fontSize: 13, marginTop: 6 }}>Nach dem ersten abgeschlossenen Workout wird dein Fortschritt sichtbar.</p></div> : <>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>{[["Workouts", String(sessions.length)], ["Arbeitssätze", String(totalSets)], ["Gesamtvolumen", formatVolume(totalVolume)], ["Ø aktiv / gesamt", `${Math.round(avgActive / 60_000)} / ${Math.round(avgDuration / 60_000)} Min`]].map(([label, value]) => <div key={label} style={{ padding: 14, borderRadius: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}><p style={{ fontSize: 20, fontWeight: 800 }}>{value}</p><p style={{ color: "var(--c-text-3)", fontSize: 10, textTransform: "uppercase", marginTop: 4 }}>{label}</p></div>)}</section>

        <section style={{ padding: "15px 14px 8px", borderRadius: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 750, textTransform: "uppercase", marginBottom: 10 }}>Trainingsvolumen · letzte Einheiten</p><MiniBars values={recent.map((session) => session.volumeKg)} labels={recent.map((session) => shortDate(session.startedAt))} /></section>

        {bests.length > 0 && <section><div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 10, marginBottom: 10 }}><div><p style={{ fontWeight: 750 }}>Übungsfortschritt</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 2 }}>Stärkster Satz je Einheit</p></div>{progressDelta != null && <span style={{ color: progressDelta >= 0 ? "var(--c-success)" : "var(--c-danger)", fontSize: 12, fontWeight: 800 }}>{progressDelta >= 0 ? "+" : ""}{progressDelta.toFixed(1)} kg</span>}</div><select aria-label="Übung für Fortschritt" value={selectedExerciseId} onChange={(event) => setSelectedExerciseId(event.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", color: "var(--c-text)", marginBottom: 9 }}>{bests.map((best) => <option key={best.exerciseId} value={best.exerciseId}>{best.exerciseName}</option>)}</select>{latestProgress && <div style={{ padding: "12px 13px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)", marginBottom: 9 }}><p style={{ color: "var(--c-text-3)", fontSize: 10, textTransform: "uppercase", fontWeight: 750 }}>Letzter stärkster Satz</p><p style={{ fontWeight: 800, marginTop: 4 }}>{loadLabel(latestProgress.bestSet)} × {latestProgress.bestSet.reps}</p></div>}<div style={{ padding: "14px 12px 6px", borderRadius: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}><MiniBars color="#22d3ee" values={progress.map((entry) => entry.bestEstimatedOneRepMaxKg)} labels={progress.map((entry) => shortDate(entry.date))} /></div><p style={{ color: "var(--c-text-3)", fontSize: 11, lineHeight: 1.45, marginTop: 7 }}>Die Kurve nutzt einen geschätzten Leistungswert aus Last und Wiederholungen. Sie ist ein Trend, kein gemessener 1RM-Test.</p></section>}

        {bests.length > 0 && <section><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 750, textTransform: "uppercase", marginBottom: 9 }}>Stärkste protokollierte Sätze</p><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{bests.map((best) => <div key={best.exerciseId} style={{ padding: "13px 14px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between", gap: 12 }}><div><p style={{ fontWeight: 700, fontSize: 14 }}>{best.exerciseName}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>{shortDate(best.date)} · geschätzter Wert {best.estimatedOneRepMaxKg.toFixed(1)} kg</p></div><div style={{ textAlign: "right", flexShrink: 0 }}><p style={{ color: "var(--c-accent)", fontWeight: 800 }}>{loadLabel(best)}</p><p style={{ color: "var(--c-text-3)", fontSize: 11 }}>× {best.reps}</p></div></div>)}</div></section>}
      </>}
    </main>
    <BottomNav />
  </div>;
}

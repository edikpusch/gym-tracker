"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/ui/BottomNav";
import {
  getActivePlanId,
  getTrainingPlan,
  type TrainingDay,
  type TrainingPlan,
} from "@/lib/trainingPlans";
import { createWorkoutSnapshotFromPlan } from "@/lib/workout-domain/planAdapter";
import { getWorkoutTimes } from "@/lib/workout-domain/stateMachine";
import {
  createOrResumeWorkoutSession,
  dispatchActiveWorkoutAction,
  getActiveWorkoutSession,
  getMatchingSetSuggestion,
} from "@/lib/workout-domain/storage";
import type {
  SessionSetRecord,
  SetDraft,
  WorkoutQueueItem,
  WorkoutRuntimeState,
} from "@/lib/workout-domain/types";
import { crossedRestWarning, emitRestWarningOnce, getRestVisualStage, prepareRestSignals } from "@/lib/workout-domain/restSignals";
import { getAppPreferences } from "@/lib/appPreferences";
import { getBodyWeightEntries } from "@/lib/bodyWeight";
import { getPublishedExerciseGuidance } from "@/lib/exercise-guidance/catalog";
import { ExerciseGuidanceSheet } from "@/components/exercise-guidance-sheet";
import { historySessionFromRuntime } from "@/lib/workout-domain/analytics";
import { WorkoutExerciseSummary, WorkoutSessionMetrics } from "@/components/workout-session-summary";
import { getWorkoutDaySummary } from "@/lib/workout-start";

function formatTime(ms: number, includeHours = false) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (includeHours || hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

const KG_PER_LB = 0.45359237;

function convertWeight(value: number, from: SetDraft["unit"], to: SetDraft["unit"]) {
  if (from === to) return value;
  const converted = from === "kg" ? value / KG_PER_LB : value * KG_PER_LB;
  return Math.round(converted * 10) / 10;
}

function convertSuggestion(record: SessionSetRecord, unit: SetDraft["unit"]): SessionSetRecord {
  if (record.unit === unit) return record;
  return {
    ...record,
    weight: convertWeight(record.weight, record.unit, unit),
    bodyWeight: record.bodyWeight == null ? undefined : convertWeight(record.bodyWeight, record.unit, unit),
    unit,
  };
}

function recordLoadLabel(record: SessionSetRecord, kind: WorkoutQueueItem["exercise"]["loadKind"]) {
  if (kind === "bodyweight") return `${record.bodyWeight ?? 0} ${record.unit} Körpergewicht`;
  if (kind === "bodyweight-plus") return `${record.bodyWeight ?? 0} + ${record.weight} ${record.unit}`;
  if (kind === "assisted") return `${record.bodyWeight ?? 0} − ${record.weight} ${record.unit} Unterstützung`;
  if (kind === "per-side") return `${record.weight} ${record.unit} je Seite`;
  return `${record.weight} ${record.unit}`;
}

function setLabel(state: WorkoutRuntimeState, item: WorkoutQueueItem) {
  const matching = state.queue.filter(
    (candidate) =>
      candidate.exercise.exerciseId === item.exercise.exerciseId &&
      candidate.plannedSet.kind === item.plannedSet.kind
  );
  const index = matching.findIndex((candidate) => candidate.id === item.id) + 1;
  const label = item.plannedSet.kind === "warmup" ? "Aufwärmsatz" : item.plannedSet.kind === "dropset" ? "Dropsatz" : "Satz";
  return `${label} ${index} von ${matching.length}`;
}

function weightStep(weight: number) {
  return weight >= 80 ? 5 : weight >= 20 ? 2.5 : weight >= 5 ? 1 : 0.5;
}

function Adjuster({
  label,
  value,
  suffix,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", marginBottom: 8 }}>{label}</p>
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 16, minHeight: 76 }}>
        <button aria-label={`${label} verringern`} onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))} style={{ height: "100%", color: "var(--c-text-2)", fontSize: 22 }}>−</button>
        <button onClick={() => undefined} style={{ color: "var(--c-text)", fontWeight: 750, fontSize: 24, fontVariantNumeric: "tabular-nums" }}>{value}<span style={{ fontSize: 11, color: "var(--c-text-3)", marginLeft: 4 }}>{suffix}</span></button>
        <button aria-label={`${label} erhöhen`} onClick={() => onChange(Math.round((value + step) * 10) / 10)} style={{ height: "100%", color: "var(--c-text-2)", fontSize: 22 }}>+</button>
      </div>
    </div>
  );
}

function CompactAdjuster({ label, value, suffix, step, onChange }: { label: string; value: number; suffix: string; step: number; onChange: (value: number) => void }) {
  return <div style={{ padding: "10px 12px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10 }}><div style={{ flex: 1 }}><p style={{ color: "var(--c-text-3)", fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>{label}</p><p style={{ fontWeight: 800, marginTop: 2 }}>{value.toFixed(1)} <span style={{ color: "var(--c-text-3)", fontSize: 11 }}>{suffix}</span></p></div><button aria-label={`${label} verringern`} onClick={() => onChange(Math.max(0, Math.round((value - step) * 10) / 10))} style={{ width: 38, height: 38, borderRadius: 10, background: "var(--c-surface-2)", color: "var(--c-text-2)", fontSize: 19 }}>−</button><button aria-label={`${label} erhöhen`} onClick={() => onChange(Math.round((value + step) * 10) / 10)} style={{ width: 38, height: 38, borderRadius: 10, background: "var(--c-surface-2)", color: "var(--c-text-2)", fontSize: 19 }}>+</button></div>;
}

function LoadInputs({ item, draft, onDraft }: { item: WorkoutQueueItem; draft: SetDraft; onDraft: (draft: Partial<SetDraft>) => void }) {
  const kind = item.exercise.loadKind;
  const unit = draft.unit;
  const bodyStep = unit === "lb" ? 1 : .5;
  const loadStep = item.exercise.weightStep || (unit === "lb" ? 5 : 2.5);
  const needsBodyWeight = kind === "bodyweight" || kind === "bodyweight-plus" || kind === "assisted";
  const loadLabel = kind === "machine" ? "Maschinengewicht" : kind === "bodyweight-plus" ? "Zusatzgewicht" : kind === "assisted" ? "Unterstützung" : kind === "per-side" ? "Gewicht / Seite" : "Gewicht";
  const bodyWeight = draft.bodyWeight ?? 0;
  const effectiveLoad = kind === "bodyweight" ? bodyWeight : kind === "bodyweight-plus" ? bodyWeight + draft.weight : kind === "assisted" ? Math.max(0, bodyWeight - Math.abs(draft.weight)) : kind === "per-side" ? draft.weight * 2 : draft.weight;

  return <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
    {needsBodyWeight && kind !== "bodyweight" && <CompactAdjuster label="Körpergewicht" value={bodyWeight} suffix={unit} step={bodyStep} onChange={(value) => onDraft({ bodyWeight: value })} />}
    <div style={{ display: "flex", gap: 10 }}>
      {kind === "bodyweight" ? <Adjuster label="Körpergewicht" value={bodyWeight} suffix={unit} step={bodyStep} min={0} onChange={(value) => onDraft({ bodyWeight: value })} /> : <Adjuster label={loadLabel} value={Math.abs(draft.weight)} suffix={unit} step={loadStep} min={0} onChange={(value) => onDraft({ weight: value })} />}
      <Adjuster label="Wiederholungen" value={draft.reps} suffix="Wdh." step={1} min={1} onChange={(reps) => onDraft({ reps })} />
    </div>
    {(needsBodyWeight || kind === "per-side") && <p style={{ color: "var(--c-text-3)", fontSize: 11, textAlign: "center" }}>Berechnete Last: {effectiveLoad.toFixed(1)} {unit}{kind === "per-side" ? " gesamt" : ""}</p>}
  </div>;
}

function Preview({
  plan,
  day,
  onStart,
}: {
  plan: TrainingPlan;
  day: TrainingDay;
  onStart: () => void;
}) {
  const summary = getWorkoutDaySummary(plan, day);
  const previewSteps = createWorkoutSnapshotFromPlan(plan, day, 0).steps;

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 28px)" }}>
      <header style={{ padding: "calc(18px + var(--safe-area-top)) 20px 18px" }}>
        <p style={{ fontSize: 12, color: "var(--c-accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.9 }}>{plan.name}</p>
        <h1 style={{ fontSize: 28, lineHeight: 1.15, marginTop: 5 }}>{day.name}</h1>
        <p style={{ color: "var(--c-text-3)", fontSize: 13, marginTop: 7 }}>{summary.exerciseCount} Übungen · {summary.workSetCount} Arbeitssätze · ungefähr {summary.estimatedMinutes} Min.</p>
      </header>

      <main style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {previewSteps.map((step, index) => {
            const exercise = step.type === "exercise" ? step.exercise : null;
            const group = step.type === "superset" || step.type === "circuit" ? step : null;
            const activityLabel = step.type === "pause" ? `${step.seconds}s Pause` : step.type === "mobility" ? `${step.durationSeconds}s × ${step.rounds}` : step.type === "note" ? step.text : null;
            const title = exercise?.name ?? group?.label ?? (step.type === "pause" || step.type === "mobility" || step.type === "note" ? step.label : "");
            return <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--c-accent-dim)", color: "var(--c-accent)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>{index + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700 }}>{title}</p>
                {exercise && <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 3 }}>{exercise.sets.filter((set) => set.kind === "workset").length} Sätze</p>}
                {group && <p style={{ fontSize: 12, color: group.type === "superset" ? "#a78bfa" : "#22d3ee", marginTop: 3 }}>{group.exercises.map((entry) => entry.name).join(" · ")} · {group.rounds} Runden</p>}
                {activityLabel && <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 3 }}>{activityLabel}</p>}
              </div>
              <span style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 750, textTransform: "uppercase" }}>{step.type === "exercise" ? "Übung" : step.type === "superset" ? "Supersatz" : step.type === "circuit" ? "Zirkel" : step.type === "mobility" ? "Mobilität" : step.type === "pause" ? "Pause" : "Hinweis"}</span>
            </div>
          })}
        </div>

        <button onClick={onStart} style={{ position: "sticky", bottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 12px)", width: "100%", marginTop: 18, padding: "16px", borderRadius: 15, background: "var(--c-accent)", color: "#fff", fontWeight: 800, fontSize: 16, boxShadow: "0 12px 30px rgba(0,0,0,.35)" }}>Workout starten</button>
      </main>
      <BottomNav />
    </div>
  );
}

function ActiveHeader({ state, now, onOverview, onMinimize, onMenu }: { state: WorkoutRuntimeState; now: number; onOverview: () => void; onMinimize: () => void; onMenu: () => void }) {
  const times = getWorkoutTimes(state, now);
  const completed = state.results.filter((result) => result.status === "completed").length + (state.completedActivityIds?.length ?? 0);
  return (
    <header style={{ padding: "calc(12px + var(--safe-area-top)) 16px 12px", borderBottom: "1px solid var(--c-border)", background: "var(--c-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onMinimize} style={{ width: 38, height: 38, borderRadius: 12, background: "var(--c-surface)", color: "var(--c-text-2)", fontSize: 18 }}>⌄</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: "var(--c-accent)", fontWeight: 750, textTransform: "uppercase", letterSpacing: 0.7 }}>{state.snapshot.workoutName}</p>
          <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>{completed}/{state.queue.length} Schritte · Gesamt {formatTime(times.elapsedWorkoutMs)}</p>
        </div>
        <button onClick={onOverview} style={{ padding: "9px 11px", borderRadius: 12, background: "var(--c-surface)", color: "var(--c-text-2)", fontSize: 12, fontWeight: 700 }}>Übersicht</button>
        {state.phase !== "review" && state.phase !== "workout_paused" && <button aria-label="Workout-Menü" onClick={onMenu} style={{ width: 38, height: 38, borderRadius: 12, background: "var(--c-surface)", color: "var(--c-text-2)", fontSize: 20 }}>•••</button>}
      </div>
      <div style={{ height: 3, borderRadius: 2, background: "var(--c-surface-2)", overflow: "hidden", marginTop: 12 }}>
        <div style={{ width: `${state.queue.length ? completed / state.queue.length * 100 : 0}%`, height: "100%", background: "var(--c-accent)", transition: "width .2s" }} />
      </div>
    </header>
  );
}

function ExerciseOverview({ state, onClose, onSelect, onDefer, onSkip }: { state: WorkoutRuntimeState; onClose: () => void; onSelect: (index: number) => void; onDefer: (exerciseId: string) => void; onSkip: (exerciseId: string) => void }) {
  const exercises = Array.from(new Map(state.queue.filter((item) => !item.activity).map((item) => [item.exercise.exerciseId, item.exercise])).values());
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--c-bg)", overflowY: "auto", padding: "calc(16px + var(--safe-area-top)) 16px calc(24px + var(--safe-area-bottom))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><p style={{ fontSize: 12, color: "var(--c-accent)", fontWeight: 700, textTransform: "uppercase" }}>Workout</p><h2 style={{ fontSize: 24, marginTop: 3 }}>Alle Übungen</h2></div>
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 14, background: "var(--c-surface)", color: "var(--c-text)", fontSize: 22 }}>×</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {exercises.map((exercise, exerciseIndex) => {
          const items = state.queue.filter((item) => item.exercise.exerciseId === exercise.exerciseId);
          const completed = items.filter((item) => state.results.some((result) => result.queueItemId === item.id && result.status === "completed")).length;
          const nextIndex = state.queue.findIndex((item) => item.exercise.exerciseId === exercise.exerciseId && !state.results.some((result) => result.queueItemId === item.id && result.status === "completed"));
          const isCurrent = state.queue[state.queueIndex]?.exercise.exerciseId === exercise.exerciseId;
          const status = state.exerciseStatus[exercise.exerciseId];
          return (
            <div key={exercise.exerciseId} style={{ borderRadius: 15, background: isCurrent ? "var(--c-accent-dim)" : "var(--c-surface)", border: `1px solid ${isCurrent ? "var(--c-accent-border)" : "var(--c-border)"}`, overflow: "hidden", opacity: nextIndex < 0 ? .68 : 1 }}>
              <button disabled={nextIndex < 0 || status === "skipped"} onClick={() => onSelect(nextIndex)} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "15px", textAlign: "left" }}>
                <div style={{ width: 32, height: 32, borderRadius: 11, background: completed === items.length ? "var(--c-success)" : "var(--c-surface-2)", color: completed === items.length ? "#fff" : "var(--c-text-2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>{completed === items.length ? "✓" : exerciseIndex + 1}</div>
                <div style={{ flex: 1 }}><p style={{ color: "var(--c-text)", fontSize: 15, fontWeight: 700 }}>{exercise.name}</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 3 }}>{completed}/{items.length} Sätze{status === "deferred" ? " · später" : status === "skipped" ? " · übersprungen" : ""}</p></div>
                {isCurrent && <span style={{ color: "var(--c-accent)", fontSize: 11, fontWeight: 800 }}>AKTUELL</span>}
              </button>
              {completed < items.length && status !== "skipped" && <div style={{ display: "flex", borderTop: "1px solid var(--c-border)" }}>
                <button onClick={() => onDefer(exercise.exerciseId)} style={{ flex: 1, padding: "10px", color: "var(--c-text-3)", fontSize: 12, fontWeight: 700 }}>Später</button>
                <button onClick={() => onSkip(exercise.exerciseId)} style={{ flex: 1, padding: "10px", color: "var(--c-danger)", fontSize: 12, fontWeight: 700, borderLeft: "1px solid var(--c-border)" }}>Überspringen</button>
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RestScreen({ state, now, onAction, onDraft, onEditLast, onUndoLast }: { state: WorkoutRuntimeState; now: number; onAction: (type: "finish_rest" | "skip_rest" | "adjust_rest", deltaMs?: number) => void; onDraft: (draft: Partial<SetDraft>) => void; onEditLast: (weight: number, reps: number) => void; onUndoLast: () => void }) {
  const [editingLast, setEditingLast] = useState(false);
  const previousRemainingRef = useRef<number | null>(null);
  const warnedRestRef = useRef<number | null>(null);
  const remaining = Math.max(0, (state.clock.restPlannedEndsAt ?? now) - now);
  const next = state.queue[state.queueIndex];
  const last = state.results[state.results.length - 1];
  const lastItem = last ? state.queue.find((item) => item.id === last.queueItemId) : undefined;
  const total = last ? Math.max(1, (next ? (state.clock.restPlannedEndsAt ?? now) - (state.clock.restStartedAt ?? now) : 1)) : 1;
  const progress = Math.min(1, 1 - remaining / total);
  const visualStage = getRestVisualStage(remaining);
  const countdownEnabled = getAppPreferences().countdownOverlay;

  useEffect(() => {
    const restKey = state.clock.restStartedAt;
    if (warnedRestRef.current !== restKey && crossedRestWarning(previousRemainingRef.current, remaining)) {
      warnedRestRef.current = restKey;
      void emitRestWarningOnce(restKey);
    }
    previousRemainingRef.current = remaining;
  }, [remaining, state.clock.restStartedAt]);

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px calc(24px + var(--safe-area-bottom))", overflowY: "auto" }}>
      <div style={{ padding: "12px 14px", borderRadius: 13, background: "var(--c-success-dim)", border: "1px solid rgba(16,185,129,.25)" }}>
        <p style={{ color: "var(--c-success)", fontWeight: 800, fontSize: 13 }}>{last ? `${last.exerciseName} gespeichert` : "Satz gespeichert"}</p>
        {last && <p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 3 }}>{recordLoadLabel(last, lastItem?.exercise.loadKind ?? "external")} × {last.reps}</p>}
        {last && <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
          <button onClick={() => setEditingLast((value) => !value)} style={{ color: "var(--c-success)", fontSize: 12, fontWeight: 750 }}>{editingLast ? "Fertig" : "Bearbeiten"}</button>
          <button onClick={onUndoLast} style={{ color: "var(--c-danger)", fontSize: 12, fontWeight: 750 }}>Rückgängig</button>
        </div>}
      </div>

      {editingLast && last && <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <Adjuster label="Letztes Gewicht" value={last.weight} suffix={last.unit} step={weightStep(last.weight)} min={-200} onChange={(weight) => onEditLast(weight, last.reps)} />
        <Adjuster label="Letzte Wdh." value={last.reps} suffix="Wdh." step={1} min={1} onChange={(reps) => onEditLast(last.weight, reps)} />
      </div>}

      <div style={{ width: 210, height: 210, borderRadius: "50%", margin: "30px auto 24px", display: "grid", placeItems: "center", background: `conic-gradient(${visualStage.type === "countdown" ? "var(--c-warning)" : "var(--c-accent)"} ${progress * 360}deg, var(--c-surface-2) 0)`, position: "relative", boxShadow: visualStage.type === "countdown" ? "0 0 42px rgba(245,158,11,.2)" : undefined }}>
        <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "var(--c-bg)", display: "grid", placeItems: "center", textAlign: "center" }}><div>{countdownEnabled && visualStage.type === "countdown" ? <p key={visualStage.value} style={{ fontSize: 88, lineHeight: 1, fontWeight: 900, color: "var(--c-warning)", animation: "rest-countdown-pop .55s ease-out" }}>{visualStage.value}</p> : visualStage.type === "ready" ? <p style={{ fontSize: 27, fontWeight: 900, color: "var(--c-success)" }}>BEREIT</p> : <p style={{ fontSize: 45, lineHeight: 1, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatTime(remaining)}</p>}<p style={{ color: visualStage.type === "warning" || visualStage.type === "countdown" ? "var(--c-warning)" : "var(--c-text-3)", fontSize: 11, letterSpacing: 1.2, fontWeight: 800, marginTop: 8 }}>{visualStage.type === "warning" ? "GLEICH BEREIT" : "PAUSE"}</p></div></div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={() => onAction("adjust_rest", -15_000)} style={{ padding: "10px 14px", borderRadius: 12, background: "var(--c-surface)", color: "var(--c-text-2)", fontWeight: 700 }}>−15 Sek.</button>
        <button onClick={() => onAction("adjust_rest", 30_000)} style={{ padding: "10px 14px", borderRadius: 12, background: "var(--c-surface)", color: "var(--c-text-2)", fontWeight: 700 }}>+30 Sek.</button>
      </div>

      {next && <div style={{ marginTop: "auto" }}>
        <p style={{ textAlign: "center", color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .9, marginBottom: 5 }}>Nächster Satz</p>
        <p style={{ textAlign: "center", fontWeight: 750, marginBottom: 16 }}>{next.activity ? next.activity.label : `${next.exercise.name} · ${setLabel(state, next)}`}</p>
        {!next.activity && <LoadInputs item={next} draft={state.draft} onDraft={onDraft} />}
      </div>}
      <button onClick={() => onAction("skip_rest")} style={{ width: "100%", padding: "15px", marginTop: 16, borderRadius: 14, border: "1px solid var(--c-border-strong)", color: "var(--c-text-2)", fontWeight: 750 }}>Pause überspringen</button>
    </main>
  );
}

function ActivityScreen({ state, now, onStart, onComplete }: { state: WorkoutRuntimeState; now: number; onStart: () => void; onComplete: () => void }) {
  const item = state.queue[state.queueIndex];
  if (!item?.activity) return null;
  const activity = item.activity;
  const timed = state.phase === "timed_activity";
  const remaining = timed ? Math.max(0, (state.clock.restPlannedEndsAt ?? now) - now) : (activity.durationSeconds ?? 0) * 1000;
  const color = activity.type === "pause" ? "var(--c-warning)" : activity.type === "mobility" ? "#22d3ee" : "var(--c-accent)";
  return <main style={{ flex: 1, padding: "28px 20px calc(24px + var(--safe-area-bottom))", display: "flex", flexDirection: "column", overflowY: "auto" }}>
    <p style={{ color, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>{activity.type === "pause" ? "Geplante Pause" : activity.type === "mobility" ? "Mobilität" : "Hinweis"}</p>
    <h1 style={{ fontSize: 30, lineHeight: 1.15, marginTop: 8 }}>{activity.label}</h1>
    {activity.text && <p style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", lineHeight: 1.55 }}>{activity.text}</p>}
    {activity.durationSeconds ? <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: 250 }}><div style={{ width: 215, height: 215, borderRadius: "50%", background: `conic-gradient(${color} ${timed ? Math.max(0, 1 - remaining / (activity.durationSeconds * 1000)) * 360 : 0}deg, var(--c-surface-2) 0)`, display: "grid", placeItems: "center" }}><div style={{ width: 185, height: 185, borderRadius: "50%", background: "var(--c-bg)", display: "grid", placeItems: "center", textAlign: "center" }}><div><p style={{ fontSize: 48, fontWeight: 850, fontVariantNumeric: "tabular-nums" }}>{formatTime(remaining)}</p>{activity.rounds && <p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 6 }}>{activity.rounds} Runden gesamt</p>}</div></div></div></div> : <div style={{ flex: 1 }} />}
    <button onClick={activity.durationSeconds && !timed ? onStart : onComplete} style={{ width: "100%", padding: 17, borderRadius: 15, background: timed ? "var(--c-surface-2)" : color, color: activity.type === "pause" ? "#111827" : "white", fontWeight: 850 }}>{activity.durationSeconds ? timed ? "Jetzt weiter" : "Timer starten" : "Gelesen · weiter"}</button>
  </main>;
}

function WorkoutMenu({ onClose, onPause, onReview, onDiscard }: { onClose: () => void; onPause: () => void; onReview: () => void; onDiscard: () => void }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-label="Workout-Menü" style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.62)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", padding: "20px 16px calc(20px + var(--safe-area-bottom))", borderRadius: "24px 24px 0 0", background: "var(--c-surface)", borderTop: "1px solid var(--c-border-strong)" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><h2 style={{ fontSize: 20 }}>Workout</h2><button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, background: "var(--c-surface-2)", color: "var(--c-text)", fontSize: 20 }}>×</button></div>
        {!confirmDiscard ? <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={onPause} style={{ width: "100%", padding: "15px", borderRadius: 14, background: "var(--c-surface-2)", color: "var(--c-text)", textAlign: "left", fontWeight: 750 }}>Workout bewusst pausieren</button>
          <button onClick={onReview} style={{ width: "100%", padding: "15px", borderRadius: 14, background: "var(--c-surface-2)", color: "var(--c-text)", textAlign: "left", fontWeight: 750 }}>Mit bisherigen Sätzen beenden</button>
          <button onClick={() => setConfirmDiscard(true)} style={{ width: "100%", padding: "15px", borderRadius: 14, background: "var(--c-danger-dim)", color: "var(--c-danger)", textAlign: "left", fontWeight: 750 }}>Workout verwerfen</button>
        </div> : <div>
          <p style={{ color: "var(--c-text-2)", lineHeight: 1.5 }}>Alle Aufzeichnungen dieses laufenden Workouts werden verworfen. Möchtest du das wirklich?</p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}><button onClick={() => setConfirmDiscard(false)} style={{ flex: 1, padding: "14px", borderRadius: 14, background: "var(--c-surface-2)", color: "var(--c-text)", fontWeight: 750 }}>Abbrechen</button><button onClick={onDiscard} style={{ flex: 1, padding: "14px", borderRadius: 14, background: "var(--c-danger)", color: "#fff", fontWeight: 800 }}>Verwerfen</button></div>
        </div>}
      </div>
    </div>
  );
}

function SetScreen({ state, now, suggestion, onStart, onComplete, onDraft }: { state: WorkoutRuntimeState; now: number; suggestion: SessionSetRecord | null; onStart: () => void; onComplete: () => void; onDraft: (draft: Partial<SetDraft>) => void }) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const item = state.queue[state.queueIndex];
  if (!item) return null;
  const guidance = getPublishedExerciseGuidance(item.exercise.guidanceKey);
  const active = state.phase === "active_set";
  const times = getWorkoutTimes(state, now);
  const justReady = !active && state.clock.lastRestCompletedAt != null && now - state.clock.lastRestCompletedAt < 2_500;

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 16px calc(24px + var(--safe-area-bottom))", overflowY: "auto" }}>
      <div>
        <p style={{ color: justReady ? "var(--c-success)" : item.plannedSet.kind === "warmup" ? "var(--c-warning)" : "var(--c-accent)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .9, animation: justReady ? "scale-in .35s ease-out" : undefined }}>{justReady ? "Bereit · " : ""}{item.groupType ? `${item.groupType === "superset" ? "Supersatz" : "Zirkel"} · Runde ${item.round ?? "Aufwärmen"} · ` : ""}{setLabel(state, item)}</p>
        <h1 style={{ fontSize: 29, lineHeight: 1.12, marginTop: 7 }}>{item.exercise.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}><p style={{ flex: 1, color: "var(--c-text-3)", fontSize: 13 }}>Ziel: {item.plannedSet.targetReps.min}–{item.plannedSet.targetReps.max} Wiederholungen</p>{guidance && <button onClick={() => setGuidanceOpen(true)} style={{ padding: "8px 10px", borderRadius: 10, background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 11, fontWeight: 750 }}>Ausführung</button>}</div>
      </div>

      {active ? (
        <div style={{ textAlign: "center", margin: "34px 0 28px" }}>
          <p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>Satzzeit</p>
          <p style={{ fontSize: 68, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3, fontVariantNumeric: "tabular-nums", marginTop: 8 }}>{formatTime(times.setMs)}</p>
        </div>
      ) : (
        <div style={{ margin: "24px 0", padding: "13px 14px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
          <p style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Letztes Training</p>
          <p style={{ color: "var(--c-text-2)", fontSize: 13, marginTop: 5 }}>{suggestion ? `${recordLoadLabel(suggestion, item.exercise.loadKind)} × ${suggestion.reps} Wdh.` : "Für diesen Satz liegt noch kein passender Vergleich vor."}</p>
        </div>
      )}

      <LoadInputs item={item} draft={state.draft} onDraft={onDraft} />

      <button onClick={active ? onComplete : onStart} style={{ width: "100%", padding: "17px", marginTop: 18, borderRadius: 15, background: active ? "var(--c-success)" : "var(--c-accent)", color: "#fff", fontSize: 16, fontWeight: 850 }}>{active ? "Satz speichern" : "Satz starten"}</button>
      {guidanceOpen && guidance && <ExerciseGuidanceSheet guide={guidance} onClose={() => setGuidanceOpen(false)} />}
    </main>
  );
}

function ReviewScreen({ state, now, onFinish, onOverview }: { state: WorkoutRuntimeState; now: number; onFinish: () => void; onOverview: () => void }) {
  const session = historySessionFromRuntime(state, now);
  const unfinished = state.queue.filter((item) => item.activity ? !(state.completedActivityIds ?? []).includes(item.id) : !state.results.some((result) => result.queueItemId === item.id && result.status === "completed")).length;
  return (
    <main style={{ flex: 1, padding: "24px 16px calc(24px + var(--safe-area-bottom))", display: "flex", flexDirection: "column", gap: 22, overflowY: "auto" }}>
      <div><div style={{ width: 54, height: 54, borderRadius: 18, background: "var(--c-success-dim)", color: "var(--c-success)", display: "grid", placeItems: "center", fontSize: 26 }}>✓</div><h1 style={{ fontSize: 29, marginTop: 18 }}>Workout bereit zum Abschluss</h1><p style={{ color: "var(--c-text-3)", fontSize: 13, marginTop: 8 }}>{unfinished > 0 ? `${unfinished} geplante Schritte sind noch offen.` : "Alle geplanten Schritte sind abgeschlossen."}</p></div>
      <WorkoutSessionMetrics session={session} />
      <WorkoutExerciseSummary session={session} />
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, position: "sticky", bottom: 0, paddingTop: 18, background: "linear-gradient(transparent, var(--c-bg) 18%)" }}>
        {unfinished > 0 && <button onClick={onOverview} style={{ width: "100%", padding: "15px", borderRadius: 14, background: "var(--c-surface)", color: "var(--c-text)", border: "1px solid var(--c-border-strong)", fontWeight: 750 }}>Offene Sätze ansehen</button>}
        <button onClick={onFinish} style={{ width: "100%", padding: "17px", borderRadius: 15, background: "var(--c-success)", color: "#fff", fontSize: 16, fontWeight: 850 }}>Workout abschließen</button>
      </div>
    </main>
  );
}

export function WorkoutScreenV3({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [day, setDay] = useState<TrainingDay | null>(null);
  const [state, setState] = useState<WorkoutRuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<SessionSetRecord | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    async function load() {
      const selectedPlan = getTrainingPlan(getActivePlanId());
      const selectedDay = selectedPlan.days.find((entry) => entry.id === dayId) ?? selectedPlan.days[0] ?? null;
      const active = await getActiveWorkoutSession();
      setPlan(selectedPlan);
      setDay(selectedDay);
      setState(active);
      setLoading(false);
    }
    void load();
  }, [dayId]);

  useEffect(() => {
    const recentReady = state?.phase === "ready" && state.clock.lastRestCompletedAt != null && Date.now() - state.clock.lastRestCompletedAt < 2_500;
    if (!state || (state.phase !== "active_set" && state.phase !== "resting" && state.phase !== "timed_activity" && !recentReady)) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (state.phase === "ready" && state.clock.lastRestCompletedAt != null && current - state.clock.lastRestCompletedAt >= 2_500) window.clearInterval(timer);
    }, 200);
    return () => window.clearInterval(timer);
  }, [state]);

  const dispatch = useCallback(async (action: Parameters<typeof dispatchActiveWorkoutAction>[0]) => {
    const next = await dispatchActiveWorkoutAction(action);
    if (next) setState(next);
    setNow(action.now);
    return next;
  }, []);

  const updateDraft = useCallback((draft: Partial<SetDraft>) => {
    void dispatch({ type: "update_draft", draft, now: Date.now() });
  }, [dispatch]);

  const currentQueueItem = state?.queue[state.queueIndex] ?? null;
  useEffect(() => {
    if (!state || !currentQueueItem || currentQueueItem.activity || (state.phase !== "ready" && state.phase !== "resting")) {
      return;
    }

    const runtime = state;
    const queueItem = currentQueueItem;
    let cancelled = false;
    async function loadSuggestion() {
      const matching = await getMatchingSetSuggestion(runtime, queueItem);
      if (cancelled) return;
      const desiredUnit = queueItem.exercise.weightUnit ?? runtime.draft.unit;
      const converted = matching ? convertSuggestion(matching, desiredUnit) : null;
      setSuggestion(converted);
      if (converted) {
        await dispatch({
          type: "update_draft",
          draft: {
            weight: converted.weight,
            reps: converted.reps,
            bodyWeight: converted.bodyWeight ?? runtime.draft.bodyWeight,
            unit: desiredUnit,
          },
          now: Date.now(),
        });
      }
    }
    void loadSuggestion();
    return () => {
      cancelled = true;
    };
  // The queue item identity deliberately controls when stored suggestions are applied.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQueueItem?.id]);

  useEffect(() => {
    if (!state || !currentQueueItem || currentQueueItem.activity) return;
    if (state.phase !== "ready" && state.phase !== "resting") return;
    const loadKind = currentQueueItem.exercise.loadKind;
    const needsBodyWeight = loadKind === "bodyweight" || loadKind === "bodyweight-plus" || loadKind === "assisted";
    if (!needsBodyWeight || state.draft.bodyWeight != null) return;
    const latestKg = getBodyWeightEntries()[0]?.weight;
    if (latestKg == null) return;
    const unit = currentQueueItem.exercise.weightUnit ?? state.draft.unit;
    updateDraft({ bodyWeight: convertWeight(latestKg, "kg", unit), unit });
  }, [currentQueueItem, state, updateDraft]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden" && state?.phase === "active_set") {
        void dispatch({ type: "app_hidden", now: Date.now() });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [dispatch, state?.phase]);

  useEffect(() => {
    if (state?.phase !== "resting" || state.clock.restPlannedEndsAt == null || now < state.clock.restPlannedEndsAt) return;
    const timeout = window.setTimeout(() => {
      void dispatch({ type: "finish_rest", now: Date.now() });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [dispatch, now, state]);

  useEffect(() => {
    if (state?.phase !== "timed_activity" || state.clock.restPlannedEndsAt == null || now < state.clock.restPlannedEndsAt) return;
    const timeout = window.setTimeout(() => void dispatch({ type: "complete_activity", now: Date.now() }), 0);
    return () => window.clearTimeout(timeout);
  }, [dispatch, now, state]);

  const startWorkout = useCallback(async () => {
    if (!plan || !day) return;
    await prepareRestSignals();
    const runtime = await createOrResumeWorkoutSession({ snapshot: createWorkoutSnapshotFromPlan(plan, day) });
    setState(runtime);
    setNow(Date.now());
  }, [day, plan]);

  const selectQueueItem = useCallback((queueIndex: number) => {
    void dispatch({ type: "select_queue_item", queueIndex, now: Date.now() }).then(() => setOverviewOpen(false));
  }, [dispatch]);

  const changeExerciseStatus = useCallback((type: "defer_exercise" | "skip_exercise", exerciseId: string) => {
    void dispatch({ type, exerciseId, now: Date.now() }).then(() => setOverviewOpen(false));
  }, [dispatch]);

  const uniqueExerciseCount = useMemo(() => state ? new Set(state.queue.filter((item) => !item.activity).map((item) => item.exercise.exerciseId)).size : 0, [state]);

  if (loading || !plan || !day) {
    return <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", display: "grid", placeItems: "center", color: "var(--c-text-3)" }}>Lädt…</div>;
  }

  if (!state) return <Preview plan={plan} day={day} onStart={startWorkout} />;

  if (state.status === "completed") {
    const completedSession = historySessionFromRuntime(state);
    return <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", padding: "calc(24px + var(--safe-area-top)) 16px calc(24px + var(--safe-area-bottom))" }}><main style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}><div><div style={{ width: 54, height: 54, borderRadius: 18, background: "var(--c-success-dim)", color: "var(--c-success)", display: "grid", placeItems: "center", fontSize: 26 }}>✓</div><h1 style={{ fontSize: 29, marginTop: 18 }}>Workout abgeschlossen</h1><p style={{ color: "var(--c-text-3)", marginTop: 7 }}>Gespeichert. Hier ist das Wesentliche aus deiner Einheit.</p></div><WorkoutSessionMetrics session={completedSession} /><WorkoutExerciseSummary session={completedSession} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}><button onClick={() => router.push("/history")} style={{ padding: "14px 12px", borderRadius: 14, background: "var(--c-surface)", color: "var(--c-text)", border: "1px solid var(--c-border-strong)", fontWeight: 800 }}>Im Verlauf</button><button onClick={() => router.push("/")} style={{ padding: "14px 12px", borderRadius: 14, background: "var(--c-accent)", color: "#fff", fontWeight: 800 }}>Fertig</button></div></main></div>;
  }

  if (state.status === "discarded") {
    return <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}><div><h1>Workout verworfen</h1><p style={{ color: "var(--c-text-3)", marginTop: 8 }}>Die laufende Session wird nicht als abgeschlossenes Training gewertet.</p><button onClick={() => router.push("/")} style={{ marginTop: 24, padding: "14px 24px", borderRadius: 14, background: "var(--c-surface)", color: "var(--c-text)", fontWeight: 800 }}>Zur Startseite</button></div></div>;
  }

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", height: "var(--app-viewport-height)", background: "var(--c-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ActiveHeader state={state} now={now} onOverview={() => setOverviewOpen(true)} onMinimize={() => router.push("/")} onMenu={() => setMenuOpen(true)} />
      {state.phase === "resting" ? (
        <RestScreen state={state} now={now} onDraft={updateDraft} onEditLast={(weight, reps) => void dispatch({ type: "edit_last_set", weight, reps, now: Date.now() })} onUndoLast={() => void dispatch({ type: "undo_last_set", now: Date.now() })} onAction={(type, deltaMs) => void dispatch(type === "adjust_rest" ? { type, deltaMs: deltaMs ?? 0, now: Date.now() } : { type, now: Date.now() })} />
      ) : currentQueueItem?.activity && (state.phase === "ready" || state.phase === "timed_activity") ? (
        <ActivityScreen state={state} now={now} onStart={() => void dispatch({ type: "start_activity", now: Date.now() })} onComplete={() => void dispatch({ type: "complete_activity", now: Date.now() })} />
      ) : state.phase === "interrupted" ? (
        <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}><div><p style={{ color: "var(--c-accent)", fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>Satz pausiert</p><h1 style={{ fontSize: 30, marginTop: 8 }}>Bereit fortzufahren?</h1><p style={{ color: "var(--c-text-3)", marginTop: 8 }}>Nur die Satzzeit wurde angehalten. Die gesamte Workout-Zeit läuft weiter.</p><button onClick={() => void dispatch({ type: "resume_interrupted_set", now: Date.now() })} style={{ width: "100%", marginTop: 24, padding: "17px", borderRadius: 15, background: "var(--c-accent)", color: "#fff", fontWeight: 850 }}>Satz fortsetzen</button></div></main>
      ) : state.phase === "workout_paused" ? (
        <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}><div><p style={{ color: "var(--c-warning)", fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>Workout pausiert</p><h1 style={{ fontSize: 30, marginTop: 8 }}>Nimm dir die Zeit</h1><p style={{ color: "var(--c-text-3)", marginTop: 8 }}>Aktive Zeiten und Pausentimer sind angehalten. Nur die gesamte Workout-Zeit läuft weiter.</p><button onClick={() => void dispatch({ type: "resume_workout", now: Date.now() })} style={{ width: "100%", marginTop: 24, padding: "17px", borderRadius: 15, background: "var(--c-accent)", color: "#fff", fontWeight: 850 }}>Workout fortsetzen</button></div></main>
      ) : state.phase === "review" ? (
        <ReviewScreen state={state} now={now} onOverview={() => setOverviewOpen(true)} onFinish={() => void dispatch({ type: "finish_workout", now: Date.now() })} />
      ) : (
        <SetScreen state={state} now={now} suggestion={suggestion} onDraft={updateDraft} onStart={() => { void prepareRestSignals(); void dispatch({ type: "start_set", now: Date.now() }); }} onComplete={() => void dispatch({ type: "complete_set", now: Date.now() })} />
      )}
      {overviewOpen && <ExerciseOverview state={state} onClose={() => setOverviewOpen(false)} onSelect={selectQueueItem} onDefer={(exerciseId) => changeExerciseStatus("defer_exercise", exerciseId)} onSkip={(exerciseId) => changeExerciseStatus("skip_exercise", exerciseId)} />}
      {menuOpen && <WorkoutMenu onClose={() => setMenuOpen(false)} onPause={() => { setMenuOpen(false); void dispatch({ type: "pause_workout", now: Date.now() }); }} onReview={() => { setMenuOpen(false); void dispatch({ type: "review_workout", now: Date.now() }); }} onDiscard={() => { setMenuOpen(false); void dispatch({ type: "discard_workout", now: Date.now() }); }} />}
      <span style={{ position: "fixed", left: -9999 }}>{uniqueExerciseCount} Übungen</span>
    </div>
  );
}

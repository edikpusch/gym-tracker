"use client";

import { useOverlay } from "@/lib/useOverlay";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { TrainingDay, TrainingPlan, TrainingExercise } from "@/lib/trainingPlans";
import { getExerciseLibraryWithOptions, getExerciseLabel, getExerciseMeta } from "@/lib/workoutUi";
import { placeOptionalBlockAtExerciseBoundary, reorderDayExerciseBlocks, syncDayBlocks, type TrainingPlanBlock } from "@/lib/trainingModel";
import { getAppPreferences } from "@/lib/appPreferences";
import { createWorkoutSnapshotFromPlan } from "@/lib/workout-domain/planAdapter";
import { buildWorkoutQueue } from "@/lib/workout-domain/queue";
import { groupExercisesContiguously, validatePlanDraft, type PlanEditorIssue } from "@/lib/planEditorLogic";

type Props = {
  initialPlan: TrainingPlan;
  initiallyUnsaved?: boolean;
  onCancel: () => void;
  onSave: (plan: TrainingPlan) => void;
};

const fieldStyle = {
  width: "100%",
  minWidth: 0,
  color: "var(--c-text)",
  background: "var(--c-surface-2)",
  border: "1px solid var(--c-border-strong)",
  borderRadius: 10,
  padding: "10px 11px",
} as const;

const smallButton = {
  minWidth: 44,
  minHeight: 44,
  color: "var(--c-text-2)",
  background: "var(--c-surface-2)",
  border: "1px solid var(--c-border)",
  borderRadius: 10,
  fontWeight: 700,
} as const;

function StepperField({ label, value, min, max, step = 1, disabled = false, onChange }: { label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; onChange: (value: number) => void }) {
  function commit(next: number) {
    if (!Number.isFinite(next)) return;
    onChange(Math.min(max, Math.max(min, Math.round(next * 10) / 10)));
  }
  return <div style={{ minWidth: 0, opacity: disabled ? .45 : 1 }}><p style={{ color: "var(--c-text-3)", fontSize: 10, fontWeight: 750, textTransform: "uppercase", letterSpacing: .5, marginBottom: 5 }}>{label}</p><div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) 40px", minHeight: 44, borderRadius: 11, background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", overflow: "hidden" }}><button disabled={disabled || value <= min} aria-label={`${label} verringern`} onClick={() => commit(value - step)} style={{ color: "var(--c-text-2)", fontSize: 19, borderRight: "1px solid var(--c-border)" }}>−</button><input disabled={disabled} aria-label={label} type="number" inputMode="numeric" value={value} min={min} max={max} step={step} onChange={(event) => commit(Number(event.target.value))} style={{ width: "100%", minWidth: 0, textAlign: "center", color: "var(--c-text)", background: "transparent", fontSize: 16, fontWeight: 800 }} /><button disabled={disabled || value >= max} aria-label={`${label} erhöhen`} onClick={() => commit(value + step)} style={{ color: "var(--c-text-2)", fontSize: 19, borderLeft: "1px solid var(--c-border)" }}>+</button></div></div>;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function duplicateDayDraft(source: TrainingDay, position: number): TrainingDay {
  const exerciseIds = new Map(source.exercises.map((exercise) => [exercise.id, id("exercise")]));
  const groupIds = new Map<string, string>();
  source.exercises.forEach((exercise) => {
    if (exercise.group && !groupIds.has(exercise.group.id)) groupIds.set(exercise.group.id, id(exercise.group.type));
  });
  const exercises = source.exercises.map((exercise) => ({
    ...structuredClone(exercise),
    id: exerciseIds.get(exercise.id)!,
    group: exercise.group ? { ...exercise.group, id: groupIds.get(exercise.group.id)! } : undefined,
  }));
  const blocks = (source.blocks ?? syncDayBlocks(source.exercises)).map((block): TrainingPlanBlock => {
    if (block.type === "exercise") return { ...structuredClone(block), id: `exercise:${exerciseIds.get(block.exerciseId)!}`, exerciseId: exerciseIds.get(block.exerciseId)! };
    if (block.type === "warmup") return { ...structuredClone(block), id: `warmup:${exerciseIds.get(block.parentExerciseId)!}`, parentExerciseId: exerciseIds.get(block.parentExerciseId)! };
    return { ...structuredClone(block), id: id(block.type) };
  });
  return { ...structuredClone(source), id: id("day"), name: `${source.name} Kopie`, exercises, blocks: syncDayBlocks(exercises, blocks), color: source.color || (position % 2 ? "#7c3aed" : "#16a34a") };
}

export function PlanEditor({ initialPlan, initiallyUnsaved = false, onCancel, onSave }: Props) {
  const [initialFingerprint] = useState(() => initiallyUnsaved ? "" : JSON.stringify(initialPlan));
  const [draft, setDraft] = useState<TrainingPlan>(() => structuredClone(initialPlan));
  const [dayId, setDayId] = useState(initialPlan.days[0]?.id ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(initialPlan.days[0]?.exercises[0]?.id ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDayDelete, setConfirmDayDelete] = useState(false);
  const [confirmExerciseDelete, setConfirmExerciseDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [reorderOpen, setReorderOpen] = useState(false);

  // Ein Hook für alle drei Sheets: sperrt den Hintergrund-Scroll, Escape und die
  // Android-Zurückgeste schließen das Sheet, statt den Editor zu verlassen.
  const closeAllSheets = useCallback(() => {
    setLibraryOpen(false);
    setReorderOpen(false);
    setPreviewOpen(false);
  }, []);
  useOverlay(libraryOpen || reorderOpen || previewOpen, closeAllSheets);
  const [validationOpen, setValidationOpen] = useState(true);
  const day = draft.days.find((entry) => entry.id === dayId) ?? draft.days[0];
  const isDirty = JSON.stringify(draft) !== initialFingerprint;
  const categories = useMemo(() => ["Alle", ...new Set(getExerciseLibraryWithOptions().map((item) => item.category))], []);
  const library = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    return getExerciseLibraryWithOptions().filter((item) =>
      (category === "Alle" || item.category === category) && (!normalized || `${item.label} ${item.category}`.toLocaleLowerCase("de-DE").includes(normalized))
    );
  }, [category, query]);
  const previewQueue = useMemo(() => day ? buildWorkoutQueue(createWorkoutSnapshotFromPlan(draft, day, 0)) : [], [day, draft]);
  const previewSteps = useMemo(() => day ? createWorkoutSnapshotFromPlan(draft, day, 0).steps : [], [day, draft]);
  const validationIssues = useMemo(() => validatePlanDraft(draft), [draft]);
  const blockingIssues = validationIssues.filter((issue) => issue.tone === "error");

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  function updateDay(updater: (current: NonNullable<typeof day>) => NonNullable<typeof day>) {
    if (!day) return;
    setDraft((current) => ({
      ...current,
      days: current.days.map((entry) => entry.id === day.id ? updater(structuredClone(entry)) : entry),
    }));
  }

  function updateExercise(exerciseId: string, patch: Partial<TrainingExercise>) {
    updateDay((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, ...patch } : exercise),
    }));
  }

  function updateExerciseMetric(exercise: TrainingExercise, key: "sets" | "restSeconds" | "minReps" | "maxReps", value: number) {
    if (key === "sets" && exercise.group) {
      updateGroup(exercise.group.id, { rounds: value });
      return;
    }
    if (key === "minReps") {
      updateExercise(exercise.id, { minReps: value, maxReps: Math.max(value, exercise.maxReps) });
      return;
    }
    if (key === "maxReps") {
      updateExercise(exercise.id, { maxReps: Math.max(exercise.minReps, value) });
      return;
    }
    updateExercise(exercise.id, { [key]: value });
  }

  function moveExercise(index: number, offset: number) {
    updateDay((current) => {
      const next = [...current.exercises];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, exercises: next, blocks: reorderDayExerciseBlocks(next, current.blocks) };
    });
  }

  function duplicateExercise(exercise: TrainingExercise) {
    updateDay((current) => {
      const index = current.exercises.findIndex((entry) => entry.id === exercise.id);
      const copy = { ...structuredClone(exercise), id: id("exercise"), group: undefined };
      const exercises = [...current.exercises];
      exercises.splice(index + 1, 0, copy);
      return { ...current, exercises, blocks: syncDayBlocks(exercises, current.blocks) };
    });
  }

  function removeExercise(exerciseId: string) {
    updateDay((current) => {
      const removed = current.exercises.find((entry) => entry.id === exerciseId);
      let exercises = current.exercises.filter((entry) => entry.id !== exerciseId);
      if (removed?.group && exercises.filter((entry) => entry.group?.id === removed.group?.id).length < 2) {
        exercises = exercises.map((entry) => entry.group?.id === removed.group?.id ? { ...entry, group: undefined } : entry);
      }
      return { ...current, exercises, blocks: syncDayBlocks(exercises, current.blocks) };
    });
    setSelected((current) => {
      const next = new Set(current);
      next.delete(exerciseId);
      return next;
    });
    setConfirmExerciseDelete(null);
  }

  function addExercise(reference: string) {
    const meta = getExerciseMeta(reference);
    const defaults = meta?.defaults ?? { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 };
    const exercise: TrainingExercise = { id: id("exercise"), name: reference, ...defaults, loadKind: meta?.supportsAssistanceWeight ? "bodyweight" : "external", weightUnit: getAppPreferences().weightUnit, weightStep: getAppPreferences().weightUnit === "lb" ? 5 : 2.5 };
    updateDay((current) => {
      const exercises = [...current.exercises, exercise];
      return { ...current, exercises, blocks: syncDayBlocks(exercises, current.blocks) };
    });
    setExpandedId(exercise.id);
    setLibraryOpen(false);
    setQuery("");
    setCategory("Alle");
  }

  function updateWarmup(exerciseId: string, rounds: number, restSeconds?: number) {
    updateDay((current) => {
      const existing = current.blocks ?? syncDayBlocks(current.exercises);
      const old = existing.find((block) => block.type === "warmup" && block.parentExerciseId === exerciseId);
      const without = existing.filter((block) => !(block.type === "warmup" && block.parentExerciseId === exerciseId));
      if (rounds > 0) {
        const exercise = current.exercises.find((entry) => entry.id === exerciseId)!;
        const exerciseIndex = without.findIndex((block) => block.type === "exercise" && block.exerciseId === exerciseId);
        const warmup: TrainingPlanBlock = {
          id: `warmup:${exerciseId}`,
          type: "warmup",
          label: `${getExerciseLabel(exercise.name)} Aufwärmen`,
          parentExerciseId: exerciseId,
          rounds,
          restSeconds: restSeconds ?? (old?.type === "warmup" ? old.restSeconds : Math.max(30, Math.round(exercise.restSeconds / 2))),
        };
        without.splice(Math.max(0, exerciseIndex), 0, warmup);
      }
      return { ...current, blocks: syncDayBlocks(current.exercises, without) };
    });
  }

  function addOptionalBlock(type: "pause" | "note" | "stretch") {
    updateDay((current) => {
      const blocks = [...(current.blocks ?? syncDayBlocks(current.exercises))];
      if (type === "pause") blocks.push({ id: id("pause"), type, label: "Geplante Pause", seconds: 120, scope: "workout" });
      if (type === "note") blocks.push({ id: id("note"), type, label: "Trainingshinweis", notes: "" });
      if (type === "stretch") blocks.push({ id: id("mobility"), type, label: "Mobilität", stretchId: "custom_mobility", category: "Mobilität", holdSeconds: 30, rounds: 1 });
      return { ...current, blocks };
    });
  }

  function updateBlock(blockId: string, patch: Partial<TrainingPlanBlock>) {
    updateDay((current) => ({
      ...current,
      blocks: (current.blocks ?? syncDayBlocks(current.exercises)).map((block) => block.id === blockId ? { ...block, ...patch } as TrainingPlanBlock : block),
    }));
  }

  function moveBlock(blockId: string, offset: number) {
    updateDay((current) => {
      const blocks = [...(current.blocks ?? syncDayBlocks(current.exercises))];
      const index = blocks.findIndex((block) => block.id === blockId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= blocks.length) return current;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...current, blocks };
    });
  }

  function removeBlock(blockId: string) {
    updateDay((current) => ({ ...current, blocks: (current.blocks ?? []).filter((block) => block.id !== blockId) }));
  }

  function placeOptionalBlock(blockId: string, boundary: number) {
    updateDay((current) => ({
      ...current,
      blocks: placeOptionalBlockAtExerciseBoundary(current.exercises, current.blocks ?? syncDayBlocks(current.exercises), blockId, boundary),
    }));
  }

  function groupSelection(type: "superset" | "circuit") {
    if (!day) return;
    const members = day.exercises.filter((exercise) => selected.has(exercise.id));
    if (members.length < 2) return;
    const groupId = id(type);
    const rounds = Math.max(...members.map((entry) => entry.sets));
    const group = {
      id: groupId,
      type,
      label: type === "superset" ? "Supersatz" : "Zirkel",
      rounds,
      transitionSeconds: type === "superset" ? 15 : 20,
      roundRestSeconds: 90,
    } as const;
    updateDay((current) => {
      const exercises = groupExercisesContiguously(current.exercises, selected, group);
      return { ...current, exercises, blocks: reorderDayExerciseBlocks(exercises, current.blocks) };
    });
    setSelected(new Set());
  }

  function updateGroup(groupId: string, patch: Partial<NonNullable<TrainingExercise["group"]>>) {
    updateDay((current) => {
      const rounds = patch.rounds == null ? null : Math.max(1, Number(patch.rounds));
      return {
        ...current,
        exercises: current.exercises.map((exercise) => exercise.group?.id === groupId ? {
          ...exercise,
          sets: rounds ?? exercise.sets,
          group: { ...exercise.group, ...patch, ...(rounds == null ? {} : { rounds }) },
        } : exercise),
      };
    });
  }

  function ungroup(groupId: string) {
    updateDay((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => exercise.group?.id === groupId ? { ...exercise, group: undefined } : exercise),
    }));
  }

  function addDay() {
    const nextDay = { id: id("day"), name: `Workout ${String.fromCharCode(65 + draft.days.length)}`, slot: "mixed" as const, color: "#16a34a", exercises: [] };
    setDraft((current) => ({ ...current, days: [...current.days, nextDay] }));
    setDayId(nextDay.id);
    setExpandedId(null);
    setConfirmDayDelete(false);
  }

  function duplicateDay() {
    if (!day) return;
    const copy = duplicateDayDraft(day, draft.days.length);
    const index = draft.days.findIndex((entry) => entry.id === day.id);
    setDraft((current) => {
      const days = [...current.days];
      days.splice(index + 1, 0, copy);
      return { ...current, days };
    });
    setDayId(copy.id);
    setExpandedId(null);
    setSelected(new Set());
    setConfirmDayDelete(false);
  }

  function moveDay(offset: number) {
    const index = draft.days.findIndex((entry) => entry.id === day.id);
    const target = index + offset;
    if (target < 0 || target >= draft.days.length) return;
    setDraft((current) => {
      const days = [...current.days];
      [days[index], days[target]] = [days[target], days[index]];
      return { ...current, days };
    });
  }

  function removeDay() {
    if (!day || draft.days.length <= 1) return;
    if (!confirmDayDelete) {
      setConfirmDayDelete(true);
      return;
    }
    const remaining = draft.days.filter((entry) => entry.id !== day.id);
    setDraft((current) => ({ ...current, days: remaining }));
    setDayId(remaining[0].id);
    setConfirmDayDelete(false);
  }

  function requestClose() {
    if (!isDirty) {
      onCancel();
      return;
    }
    setConfirmCancel(true);
  }

  function focusIssue(issue: PlanEditorIssue) {
    if (issue.dayId) setDayId(issue.dayId);
    if (issue.targetId && draft.days.some((entry) => entry.exercises.some((exercise) => exercise.id === issue.targetId))) setExpandedId(issue.targetId);
    setValidationOpen(false);
  }

  if (!day) return null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--c-bg)", paddingBottom: "calc(28px + var(--safe-area-bottom))" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(11,17,32,.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--c-border)", padding: "calc(12px + var(--safe-area-top)) 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={requestClose} style={smallButton} aria-label="Editor schließen">←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: isDirty ? "var(--c-warning)" : "var(--c-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: .8 }}>{isDirty ? "Ungespeicherte Änderungen" : "Gespeichert"}</p>
          <input aria-label="Planname" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} style={{ ...fieldStyle, background: "transparent", border: 0, padding: 0, fontSize: 18, fontWeight: 750 }} />
        </div>
        <button onClick={() => onSave(draft)} disabled={!draft.name.trim() || !isDirty || blockingIssues.length > 0} style={{ minHeight: 42, padding: "0 16px", borderRadius: 11, background: "var(--c-accent)", color: "white", fontWeight: 750, opacity: draft.name.trim() && isDirty && blockingIssues.length === 0 ? 1 : .4 }}>Speichern</button>
      </header>

      {confirmCancel && <div style={{ margin: "12px 16px 0", padding: 12, borderRadius: 12, background: "var(--c-danger-dim)", color: "var(--c-text)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span>Entwurf verwerfen?</span><div style={{ display: "flex", gap: 8 }}><button onClick={() => setConfirmCancel(false)} style={{ ...smallButton, padding: "0 10px" }}>Nein</button><button onClick={onCancel} style={{ ...smallButton, padding: "0 10px", color: "var(--c-danger)" }}>Verwerfen</button></div></div>}

      <main style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <section style={{ borderRadius: 15, overflow: "hidden", background: "var(--c-surface)", border: `1px solid ${blockingIssues.length ? "rgba(239,68,68,.35)" : validationIssues.some((issue) => issue.tone === "warning") ? "rgba(245,158,11,.3)" : "var(--c-border)"}` }}><button onClick={() => setValidationOpen((current) => !current)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: 13, textAlign: "left" }}><div style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: blockingIssues.length ? "var(--c-danger-dim)" : validationIssues.length ? "var(--c-warning-dim)" : "var(--c-success-dim)", color: blockingIssues.length ? "var(--c-danger)" : validationIssues.length ? "var(--c-warning)" : "var(--c-success)", fontWeight: 900 }}>{blockingIssues.length ? "!" : validationIssues.length ? "i" : "✓"}</div><div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 800 }}>{blockingIssues.length ? `${blockingIssues.length} Fehler vor dem Speichern` : validationIssues.length ? `${validationIssues.length} Hinweise zum Entwurf` : "Plan ist bereit"}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 2 }}>{blockingIssues.length ? "Fehler müssen korrigiert werden; Hinweise bleiben optional." : "Hinweise blockieren das Speichern nicht."}</p></div><span style={{ color: "var(--c-text-3)" }}>{validationOpen ? "⌃" : "⌄"}</span></button>{validationOpen && validationIssues.length > 0 && <div style={{ borderTop: "1px solid var(--c-border)", padding: "6px 10px 10px", display: "flex", flexDirection: "column", gap: 5 }}>{validationIssues.slice(0, 6).map((issue) => <button key={issue.code} onClick={() => focusIssue(issue)} style={{ padding: "9px", borderRadius: 10, textAlign: "left", background: issue.tone === "error" ? "var(--c-danger-dim)" : issue.tone === "warning" ? "var(--c-warning-dim)" : "var(--c-surface-2)" }}><div style={{ display: "flex", gap: 8 }}><span style={{ color: issue.tone === "error" ? "var(--c-danger)" : issue.tone === "warning" ? "var(--c-warning)" : "var(--c-accent)", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{issue.tone === "error" ? "Fehler" : issue.tone === "warning" ? "Prüfen" : "Info"}</span><span style={{ color: "var(--c-text)", fontSize: 12, fontWeight: 750 }}>{issue.title}</span></div><p style={{ color: "var(--c-text-3)", fontSize: 11, lineHeight: 1.4, marginTop: 4 }}>{issue.detail}</p></button>)}{validationIssues.length > 6 && <p style={{ padding: "7px 9px 2px", color: "var(--c-text-3)", fontSize: 11 }}>+ {validationIssues.length - 6} weitere Hinweise auf anderen Tagen</p>}</div>}</section>
        <div className="scroll-x" style={{ display: "flex", gap: 8, paddingBottom: 2, marginInline: -16, paddingInline: 16 }}>
          {draft.days.map((entry) => <button key={entry.id} onClick={() => { setDayId(entry.id); setSelected(new Set()); setConfirmDayDelete(false); }} style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 999, background: entry.id === day.id ? "var(--c-accent)" : "var(--c-surface)", color: entry.id === day.id ? "white" : "var(--c-text-2)", border: "1px solid var(--c-border)", fontWeight: 650 }}>{entry.name}</button>)}
          <button onClick={addDay} style={{ ...smallButton, borderRadius: 999 }}>+</button>
        </div>

        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: 14 }}>
          <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 11, marginBottom: 6, textTransform: "uppercase" }}>Trainingstag</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={day.name} onChange={(event) => updateDay((current) => ({ ...current, name: event.target.value }))} style={fieldStyle} />
            <button onClick={() => moveDay(-1)} disabled={draft.days[0].id === day.id} style={{ ...smallButton, opacity: draft.days[0].id === day.id ? .3 : 1 }} aria-label="Trainingstag nach links">←</button>
            <button onClick={() => moveDay(1)} disabled={draft.days.at(-1)?.id === day.id} style={{ ...smallButton, opacity: draft.days.at(-1)?.id === day.id ? .3 : 1 }} aria-label="Trainingstag nach rechts">→</button>
            <button onClick={duplicateDay} style={smallButton} aria-label="Trainingstag duplizieren">⧉</button>
            {draft.days.length > 1 && <button onClick={removeDay} style={{ ...smallButton, color: "var(--c-danger)", minWidth: confirmDayDelete ? 92 : 40 }} aria-label={confirmDayDelete ? "Tag löschen bestätigen" : "Tag löschen"}>{confirmDayDelete ? "Löschen?" : "×"}</button>}
          </div>
          <button onClick={() => setPreviewOpen(true)} style={{ width: "100%", marginTop: 10, padding: "11px", borderRadius: 11, background: "var(--c-surface-2)", color: "var(--c-text-2)", border: "1px solid var(--c-border)", fontWeight: 700 }}>Workout-Ablauf ansehen</button>
        </section>

        <section style={{ padding: 14, borderRadius: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}><div style={{ flex: 1 }}><p style={{ fontWeight: 750 }}>Ablaufstruktur</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 2 }}>Übungen, Gruppen und Bausteine in Trainingsreihenfolge</p></div><span style={{ color: "var(--c-text-3)", fontSize: 11 }}>{previewSteps.length} Blöcke</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{previewSteps.map((step, index) => {
            const exercise = step.type === "exercise" ? step.exercise : null;
            const group = step.type === "superset" || step.type === "circuit" ? step : null;
            const optional = step.type === "pause" || step.type === "mobility" || step.type === "note" ? step : null;
            const color = group ? (group.type === "superset" ? "#a78bfa" : "#22d3ee") : optional ? (optional.type === "pause" ? "var(--c-warning)" : optional.type === "mobility" ? "#22d3ee" : "var(--c-accent)") : "var(--c-text-2)";
            const title = exercise?.name ?? group?.label ?? optional?.label ?? "";
            const detail = exercise ? `${exercise.sets.filter((set) => set.kind === "workset").length} Arbeitssätze` : group ? `${group.exercises.map((entry) => entry.name).join(" + ")} · ${group.rounds} Runden` : optional?.type === "pause" ? `${optional.seconds}s Pause` : optional?.type === "mobility" ? `${optional.durationSeconds}s · ${optional.rounds} Runden` : "Hinweis";
            return <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 11, background: "var(--c-surface-2)", borderLeft: `3px solid ${color}` }}><span style={{ width: 20, color: "var(--c-text-3)", fontSize: 10, fontWeight: 800 }}>{index + 1}</span><div style={{ flex: 1, minWidth: 0 }}><p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 700 }}>{title}</p><p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--c-text-3)", fontSize: 10, marginTop: 2 }}>{detail}</p></div><span style={{ color, fontSize: 9, fontWeight: 850, textTransform: "uppercase" }}>{group ? (group.type === "superset" ? "Super" : "Zirkel") : optional ? (optional.type === "pause" ? "Pause" : optional.type === "mobility" ? "Mobil" : "Info") : "Übung"}</span></div>;
          })}{!previewSteps.length && <p style={{ padding: 18, textAlign: "center", color: "var(--c-text-3)", fontSize: 12 }}>Der Ablauf entsteht mit der ersten Übung oder einem Baustein.</p>}</div>
        </section>

        {selected.size > 0 && <section style={{ position: "sticky", top: "calc(78px + var(--safe-area-top))", zIndex: 8, display: "flex", gap: 8, padding: 10, borderRadius: 14, background: "var(--c-surface-3)", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}><span style={{ flex: 1, alignSelf: "center", fontSize: 13, color: "var(--c-text-2)" }}>{selected.size} gewählt</span><button disabled={selected.size < 2} onClick={() => groupSelection("superset")} style={{ ...smallButton, padding: "0 10px", opacity: selected.size < 2 ? .4 : 1 }}>Supersatz</button><button disabled={selected.size < 2} onClick={() => groupSelection("circuit")} style={{ ...smallButton, padding: "0 10px", opacity: selected.size < 2 ? .4 : 1 }}>Zirkel</button></section>}

        <section>
          <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 10, marginBottom: 10 }}><div style={{ flex: 1 }}><p style={{ color: "var(--c-text)", fontWeight: 750 }}>Übungen</p><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>Antippen zum Bearbeiten · auswählen zum Gruppieren</p></div>{day.exercises.length > 1 && <button onClick={() => setReorderOpen(true)} style={{ padding: "8px 11px", borderRadius: 10, background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", fontSize: 12, fontWeight: 750 }}>↕ Sortieren</button>}<span style={{ color: "var(--c-text-3)", fontSize: 12 }}>{day.exercises.length}</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {day.exercises.map((exercise) => {
              const expanded = expandedId === exercise.id;
              const warmup = (day.blocks ?? []).find((block) => block.type === "warmup" && block.parentExerciseId === exercise.id);
              const groupMembers = exercise.group ? day.exercises.filter((entry) => entry.group?.id === exercise.group?.id) : [];
              const isGroupLeader = !!exercise.group && groupMembers[0]?.id === exercise.id;
              return <article key={exercise.id} style={{ border: `1px solid ${selected.has(exercise.id) ? "var(--c-accent-border)" : "var(--c-border)"}`, boxShadow: exercise.group ? `inset 3px 0 ${exercise.group.type === "superset" ? "#a78bfa" : "#22d3ee"}` : undefined, borderRadius: 15, background: "var(--c-surface)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
                  <button aria-label={`${getExerciseLabel(exercise.name)} auswählen`} onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(exercise.id)) next.delete(exercise.id); else next.add(exercise.id); return next; })} style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 7, border: `1px solid ${selected.has(exercise.id) ? "var(--c-accent)" : "var(--c-border-strong)"}`, color: "white", background: selected.has(exercise.id) ? "var(--c-accent)" : "transparent" }}>{selected.has(exercise.id) ? "✓" : ""}</button>
                  <button onClick={() => setExpandedId(expanded ? null : exercise.id)} style={{ flex: 1, textAlign: "left", minWidth: 0 }}><p style={{ color: "var(--c-text)", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getExerciseLabel(exercise.name)}</p><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>{exercise.sets} × {exercise.minReps}–{exercise.maxReps} · {exercise.restSeconds}s{warmup?.type === "warmup" ? ` · ${warmup.rounds} Aufwärmsätze` : ""}</p>{exercise.group && <p style={{ color: exercise.group.type === "superset" ? "#a78bfa" : "#22d3ee", fontSize: 11, marginTop: 2 }}>{exercise.group.label} · {groupMembers.length} Übungen</p>}</button>
                  <span aria-hidden="true" style={{ color: "var(--c-text-3)", fontSize: 18, padding: "0 4px" }}>{expanded ? "⌃" : "⌄"}</span>
                </div>
                {expanded && <div style={{ borderTop: "1px solid var(--c-border)", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
                    <StepperField label={exercise.group ? "Runden" : "Sätze"} value={exercise.group?.rounds ?? exercise.sets} min={1} max={20} onChange={(value) => updateExerciseMetric(exercise, "sets", value)} />
                    <StepperField label="Pause (Sek.)" value={exercise.restSeconds} min={15} max={900} step={15} onChange={(value) => updateExerciseMetric(exercise, "restSeconds", value)} />
                    <StepperField label="Wdh. min" value={exercise.minReps} min={1} max={100} onChange={(value) => updateExerciseMetric(exercise, "minReps", value)} />
                    <StepperField label="Wdh. max" value={exercise.maxReps} min={exercise.minReps} max={100} onChange={(value) => updateExerciseMetric(exercise, "maxReps", value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 9 }}><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Lastart<select value={exercise.loadKind ?? "external"} onChange={(event) => updateExercise(exercise.id, { loadKind: event.target.value as NonNullable<TrainingExercise["loadKind"]> })} style={{ ...fieldStyle, marginTop: 5 }}><option value="external">Freies Gewicht</option><option value="machine">Maschine</option><option value="bodyweight">Körpergewicht</option><option value="bodyweight-plus">Körpergewicht + Zusatz</option><option value="assisted">Unterstützt</option><option value="per-side">Gewicht pro Seite</option></select></label><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Einheit<select value={exercise.weightUnit ?? "kg"} onChange={(event) => updateExercise(exercise.id, { weightUnit: event.target.value as "kg" | "lb" })} style={{ ...fieldStyle, marginTop: 5 }}><option value="kg">kg</option><option value="lb">lb</option></select></label><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Schritt<select value={exercise.weightStep ?? 2.5} onChange={(event) => updateExercise(exercise.id, { weightStep: Number(event.target.value) })} style={{ ...fieldStyle, marginTop: 5 }}><option value="0.5">0,5</option><option value="1">1</option><option value="2.5">2,5</option><option value="5">5</option></select></label></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}><StepperField label="Aufwärmsätze" value={warmup?.type === "warmup" ? warmup.rounds : 0} min={0} max={10} onChange={(value) => updateWarmup(exercise.id, value)} /><StepperField label="Aufwärmpause" value={warmup?.type === "warmup" ? warmup.restSeconds : Math.max(30, Math.round(exercise.restSeconds / 2))} min={15} max={300} step={15} disabled={warmup?.type !== "warmup"} onChange={(value) => updateWarmup(exercise.id, warmup?.type === "warmup" ? warmup.rounds : 1, value)} /></div>
                  {exercise.group && isGroupLeader && <div style={{ padding: 10, borderRadius: 11, background: "var(--c-surface-2)" }}><p style={{ color: exercise.group.type === "superset" ? "#a78bfa" : "#22d3ee", fontSize: 10, fontWeight: 850, textTransform: "uppercase", marginBottom: 8 }}>{exercise.group.type === "superset" ? "Supersatz konfigurieren" : "Zirkel konfigurieren"} · {groupMembers.length} Übungen</p><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Gruppenname<input value={exercise.group.label} onChange={(event) => updateGroup(exercise.group!.id, { label: event.target.value })} style={{ ...fieldStyle, marginTop: 5 }} /></label><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 9 }}><StepperField label="Wechselpause" value={exercise.group.transitionSeconds} min={0} max={300} step={5} onChange={(value) => updateGroup(exercise.group!.id, { transitionSeconds: value })} /><StepperField label="Rundenpause" value={exercise.group.roundRestSeconds} min={15} max={600} step={15} onChange={(value) => updateGroup(exercise.group!.id, { roundRestSeconds: value })} /></div><button onClick={() => ungroup(exercise.group!.id)} style={{ marginTop: 10, color: "var(--c-text-2)", fontSize: 12 }}>Gruppe auflösen</button></div>}
                  {exercise.group && !isGroupLeader && <div style={{ padding: 10, borderRadius: 11, background: "var(--c-surface-2)", color: "var(--c-text-3)", fontSize: 11 }}>Gruppeneinstellungen stehen bei {getExerciseLabel(groupMembers[0]?.name ?? exercise.name)}.</div>}
                  <div style={{ display: "flex", gap: 8 }}><button onClick={() => duplicateExercise(exercise)} style={{ ...smallButton, flex: 1 }}>Duplizieren</button><button onClick={() => confirmExerciseDelete === exercise.id ? removeExercise(exercise.id) : setConfirmExerciseDelete(exercise.id)} style={{ ...smallButton, flex: 1, color: "var(--c-danger)" }}>{confirmExerciseDelete === exercise.id ? "Entfernen bestätigen" : "Entfernen"}</button></div>
                </div>}
              </article>;
            })}
            {!day.exercises.length && <div style={{ padding: "28px 18px", textAlign: "center", border: "1px dashed var(--c-border-strong)", borderRadius: 14, color: "var(--c-text-3)", fontSize: 13 }}>Noch keine Übungen in diesem Trainingstag.</div>}
          </div>
          <button onClick={() => setLibraryOpen(true)} style={{ width: "100%", minHeight: 50, marginTop: 10, borderRadius: 14, background: "var(--c-accent-dim)", border: "1px solid var(--c-accent-border)", color: "var(--c-accent)", fontWeight: 750 }}>+ Übung hinzufügen</button>
        </section>

        <section>
          <div style={{ marginBottom: 10 }}><p style={{ color: "var(--c-text)", fontWeight: 750 }}>Optionale Bausteine</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 2 }}>Hinweise und Timer werden im Workout als eigene Schritte gezeigt.</p></div>
          <div style={{ display: "flex", gap: 7, marginBottom: 9 }}><button onClick={() => addOptionalBlock("pause")} style={{ ...smallButton, flex: 1, padding: "0 8px" }}>+ Pause</button><button onClick={() => addOptionalBlock("note")} style={{ ...smallButton, flex: 1, padding: "0 8px" }}>+ Hinweis</button><button onClick={() => addOptionalBlock("stretch")} style={{ ...smallButton, flex: 1, padding: "0 8px" }}>+ Mobilität</button></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(day.blocks ?? []).filter((block) => block.type === "pause" || block.type === "note" || block.type === "stretch").map((block) => {
              const allBlocks = day.blocks ?? [];
              const blockIndex = allBlocks.findIndex((entry) => entry.id === block.id);
              const exercisesBefore = allBlocks.slice(0, blockIndex).filter((entry) => entry.type === "exercise").length;
              const position = exercisesBefore === 0 ? "Vor der ersten Übung" : exercisesBefore >= day.exercises.length ? "Nach der letzten Übung" : `Nach Übung ${exercisesBefore}`;
              return <article key={block.id} style={{ padding: 12, borderRadius: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ flex: 1 }}><p style={{ color: block.type === "pause" ? "var(--c-warning)" : block.type === "stretch" ? "#22d3ee" : "var(--c-accent)", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{block.type === "pause" ? "Pause" : block.type === "stretch" ? "Mobilität" : "Hinweis"}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 2 }}>{position}</p></div><button onClick={() => moveBlock(block.id, -1)} disabled={blockIndex === 0} style={{ ...smallButton, opacity: blockIndex === 0 ? .3 : 1 }}>↑</button><button onClick={() => moveBlock(block.id, 1)} disabled={blockIndex === allBlocks.length - 1} style={{ ...smallButton, opacity: blockIndex === allBlocks.length - 1 ? .3 : 1 }}>↓</button><button onClick={() => removeBlock(block.id)} style={{ ...smallButton, color: "var(--c-danger)" }}>×</button></div>
                <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 11, marginTop: 9 }}>Position im Ablauf<select aria-label={`${block.label} Position`} value={Math.min(day.exercises.length, exercisesBefore)} onChange={(event) => placeOptionalBlock(block.id, Number(event.target.value))} style={{ ...fieldStyle, marginTop: 5 }}><option value={0}>Vor der ersten Übung</option>{day.exercises.map((exercise, index) => <option key={exercise.id} value={index + 1}>{index === day.exercises.length - 1 ? "Nach der letzten Übung" : `Nach ${getExerciseLabel(exercise.name)}`}</option>)}</select></label>
                <input value={block.label} onChange={(event) => updateBlock(block.id, { label: event.target.value } as Partial<TrainingPlanBlock>)} style={{ ...fieldStyle, marginTop: 9 }} />
                {block.type === "pause" && <label style={{ display: "block", color: "var(--c-text-3)", fontSize: 11, marginTop: 8 }}>Dauer in Sekunden<input type="number" value={block.seconds} onChange={(event) => updateBlock(block.id, { seconds: Number(event.target.value) } as Partial<TrainingPlanBlock>)} style={{ ...fieldStyle, marginTop: 5 }} /></label>}
                {block.type === "note" && <textarea value={block.notes} placeholder="Was soll während des Trainings sichtbar sein?" onChange={(event) => updateBlock(block.id, { notes: event.target.value } as Partial<TrainingPlanBlock>)} style={{ ...fieldStyle, minHeight: 80, resize: "vertical", marginTop: 8 }} />}
                {block.type === "stretch" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Sekunden<input type="number" value={block.holdSeconds} onChange={(event) => updateBlock(block.id, { holdSeconds: Number(event.target.value) } as Partial<TrainingPlanBlock>)} style={{ ...fieldStyle, marginTop: 5 }} /></label><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Runden<input type="number" value={block.rounds} onChange={(event) => updateBlock(block.id, { rounds: Number(event.target.value) } as Partial<TrainingPlanBlock>)} style={{ ...fieldStyle, marginTop: 5 }} /></label></div>}
              </article>;
            })}
          </div>
        </section>
      </main>

      {libraryOpen && <div role="dialog" aria-modal="true" aria-label="Übung auswählen" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(3,7,18,.76)", display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", maxHeight: "calc(var(--app-viewport-height) * 0.86)", borderRadius: "22px 22px 0 0", background: "var(--c-surface)", border: "1px solid var(--c-border)", padding: "16px 16px calc(16px + var(--app-bottom-inset))", display: "flex", flexDirection: "column", gap: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ flex: 1 }}><p style={{ fontWeight: 750 }}>Übung auswählen</p><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>{library.length} Treffer</p></div><button aria-label="Übungsauswahl schließen" onClick={() => { setLibraryOpen(false); setQuery(""); setCategory("Alle"); }} style={smallButton}>×</button></div><input autoFocus aria-label="Übungen suchen" placeholder="Suchen …" value={query} onChange={(event) => setQuery(event.target.value)} style={fieldStyle} /><div className="scroll-x" style={{ display: "flex", gap: 7, paddingBottom: 2 }}>{categories.map((entry) => <button key={entry} onClick={() => setCategory(entry)} style={{ flexShrink: 0, padding: "8px 11px", borderRadius: 999, background: category === entry ? "var(--c-accent)" : "var(--c-surface-2)", color: category === entry ? "white" : "var(--c-text-2)", fontSize: 12, fontWeight: 700 }}>{entry}</button>)}</div><div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>{library.map((item) => <button key={item.value} onClick={() => addExercise(item.value)} style={{ padding: "12px", borderRadius: 11, background: "var(--c-surface-2)", textAlign: "left" }}><p style={{ color: "var(--c-text)", fontSize: 14, fontWeight: 650 }}>{item.label}</p><p style={{ color: "var(--c-text-3)", fontSize: 11 }}>{item.category}</p></button>)}{!library.length && <p style={{ padding: 24, textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>Keine passende Übung gefunden.</p>}</div></div></div>}

      {reorderOpen && <div role="dialog" aria-modal="true" aria-label="Übungen sortieren" style={{ position: "fixed", inset: 0, zIndex: 35, background: "rgba(3,7,18,.78)", display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", maxHeight: "calc(var(--app-viewport-height) * 0.88)", overflowY: "auto", overscrollBehavior: "contain", padding: "18px 16px calc(18px + var(--app-bottom-inset))", borderRadius: "24px 24px 0 0", background: "var(--c-surface)", borderTop: "1px solid var(--c-border-strong)" }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}><div style={{ flex: 1 }}><p style={{ fontWeight: 800, fontSize: 18 }}>Übungen sortieren</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 3 }}>Große Pfeile für eine sichere Bedienung während der Planung.</p></div><button aria-label="Sortierung schließen" onClick={() => setReorderOpen(false)} style={smallButton}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{day.exercises.map((exercise, index) => <div key={exercise.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 13, background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}><div style={{ width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--c-accent-dim)", color: "var(--c-accent)", fontSize: 11, fontWeight: 800 }}>{index + 1}</div><div style={{ flex: 1, minWidth: 0 }}><p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 700 }}>{getExerciseLabel(exercise.name)}</p>{exercise.group && <p style={{ color: exercise.group.type === "superset" ? "#a78bfa" : "#22d3ee", fontSize: 10, marginTop: 2 }}>{exercise.group.label}</p>}</div><button disabled={index === 0} aria-label={`${getExerciseLabel(exercise.name)} nach oben`} onClick={() => moveExercise(index, -1)} style={{ ...smallButton, minWidth: 46, minHeight: 46, opacity: index === 0 ? .3 : 1, fontSize: 19 }}>↑</button><button disabled={index === day.exercises.length - 1} aria-label={`${getExerciseLabel(exercise.name)} nach unten`} onClick={() => moveExercise(index, 1)} style={{ ...smallButton, minWidth: 46, minHeight: 46, opacity: index === day.exercises.length - 1 ? .3 : 1, fontSize: 19 }}>↓</button></div>)}</div><button onClick={() => setReorderOpen(false)} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 13, background: "var(--c-accent)", color: "white", fontWeight: 800 }}>Fertig</button></div></div>}

      {previewOpen && <div role="dialog" aria-modal="true" aria-label="Workout-Ablauf" style={{ position: "fixed", inset: 0, zIndex: 40, background: "var(--c-bg)", overflowY: "auto", padding: "calc(16px + var(--safe-area-top)) 16px calc(24px + var(--safe-area-bottom))" }}><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}><div style={{ flex: 1 }}><p style={{ color: "var(--c-accent)", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Vorschau</p><h2 style={{ fontSize: 24, marginTop: 3 }}>{day.name}</h2><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 4 }}>{previewQueue.length} Schritte in geplanter Reihenfolge</p></div><button aria-label="Workout-Ablauf schließen" onClick={() => setPreviewOpen(false)} style={smallButton}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{previewQueue.map((item, index) => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}><div style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: item.activity ? "var(--c-surface-2)" : item.plannedSet.kind === "warmup" ? "var(--c-warning-dim)" : "var(--c-accent-dim)", color: item.plannedSet.kind === "warmup" ? "var(--c-warning)" : "var(--c-accent)", fontSize: 11, fontWeight: 800 }}>{index + 1}</div><div style={{ flex: 1, minWidth: 0 }}><p style={{ fontWeight: 700, fontSize: 14 }}>{item.activity?.label ?? getExerciseLabel(item.exercise.name)}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>{item.activity ? item.activity.type === "pause" ? `${item.activity.durationSeconds}s Pause` : item.activity.type === "mobility" ? `${item.activity.durationSeconds}s Mobilität` : "Hinweis" : `${item.plannedSet.kind === "warmup" ? "Aufwärmsatz" : "Arbeitssatz"} · ${item.plannedSet.targetReps.min}–${item.plannedSet.targetReps.max} Wdh. · ${item.restSeconds}s Pause`}</p></div>{item.groupType && <span style={{ color: item.groupType === "superset" ? "#a78bfa" : "#22d3ee", fontSize: 10, fontWeight: 800 }}>{item.groupType === "superset" ? "SUPER" : "ZIRKEL"} {item.round}</span>}</div>)}{!previewQueue.length && <div style={{ padding: 32, textAlign: "center", color: "var(--c-text-3)", border: "1px dashed var(--c-border-strong)", borderRadius: 14 }}>Noch keine Schritte geplant.</div>}</div><button onClick={() => setPreviewOpen(false)} style={{ position: "sticky", bottom: "calc(24px + var(--safe-area-bottom))", width: "100%", marginTop: 18, padding: 15, borderRadius: 14, background: "var(--c-accent)", color: "white", fontWeight: 800 }}>Zurück zum Editor</button></div>}
    </div>
  );
}

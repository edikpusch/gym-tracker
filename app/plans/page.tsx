"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { PlanEditor } from "@/components/plan-editor";
import {
  cloneTrainingPlan,
  createTrainingPlanDraft,
  deleteTrainingPlan,
  getActivePlanId,
  getAllTrainingPlans,
  saveTrainingPlanDraft,
  setActivePlanId,
  type TrainingPlan,
} from "@/lib/trainingPlans";
import { getActiveWorkoutSession } from "@/lib/workout-domain/storage";

const buttonStyle = { minHeight: 42, padding: "0 13px", borderRadius: 11, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", fontSize: 12, fontWeight: 750 } as const;

function PlanFacts({ plan }: { plan: TrainingPlan }) {
  const exerciseCount = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);
  const setCount = plan.days.reduce((sum, day) => sum + day.exercises.reduce((daySum, exercise) => daySum + exercise.sets, 0), 0);
  return <><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 5 }}>{plan.days.length} {plan.days.length === 1 ? "Workout" : "Workouts"} · {exerciseCount} Übungen · {setCount} Arbeitssätze</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.days.map((day) => day.name).join(" · ")}</p></>;
}

function PlanCard({ plan, active, deletePending, onActivate, onEdit, onDuplicate, onDelete }: { plan: TrainingPlan; active: boolean; deletePending: boolean; onActivate: () => void; onEdit: () => void; onDuplicate?: () => void; onDelete?: () => void }) {
  return <article style={{ padding: 15, borderRadius: 16, background: active ? "var(--c-accent-dim)" : "var(--c-surface)", border: `1px solid ${active ? "var(--c-accent-border)" : "var(--c-border)"}` }}><div style={{ display: "flex", gap: 11, alignItems: "start" }}><div style={{ width: 10, height: 49, borderRadius: 999, background: plan.accent, flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><h2 style={{ fontSize: 16 }}>{plan.name}</h2>{active && <span style={{ padding: "3px 7px", borderRadius: 999, color: "var(--c-accent)", background: "var(--c-surface)", fontSize: 10, fontWeight: 850 }}>AKTIV</span>}<span style={{ color: "var(--c-text-3)", fontSize: 10 }}>{plan.origin === "template" ? "Vorlage" : "Eigener Plan"}</span></div><PlanFacts plan={plan} /></div></div><div style={{ display: "flex", gap: 7, marginTop: 13, flexWrap: "wrap" }}>{!active && <button onClick={onActivate} style={{ ...buttonStyle, color: "white", background: "var(--c-accent)" }}>Aktivieren</button>}<button onClick={onEdit} style={{ ...buttonStyle, color: active ? "var(--c-accent)" : "var(--c-text-2)" }}>{plan.origin === "template" ? "Als Kopie bearbeiten" : "Bearbeiten"}</button>{onDuplicate && <button onClick={onDuplicate} style={buttonStyle}>Duplizieren</button>}{onDelete && <button onClick={onDelete} style={{ ...buttonStyle, color: "var(--c-danger)" }}>{deletePending ? "Löschen bestätigen" : "Löschen"}</button>}</div></article>;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editorPlan, setEditorPlan] = useState<TrainingPlan | null>(null);
  const [editorPlanIsNew, setEditorPlanIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [workoutRunning, setWorkoutRunning] = useState(false);

  function refresh(preferredId?: string) {
    setPlans(getAllTrainingPlans());
    setActiveId(preferredId ?? getActivePlanId());
  }

  useEffect(() => {
    let cancelled = false;
    void getActiveWorkoutSession().then((session) => {
      if (cancelled) return;
      setPlans(getAllTrainingPlans());
      setActiveId(getActivePlanId());
      setWorkoutRunning(session != null);
    });
    return () => { cancelled = true; };
  }, []);

  function activate(plan: TrainingPlan) {
    setActivePlanId(plan.id);
    setActiveId(plan.id);
    setNotice(workoutRunning ? `${plan.name} ist für das nächste Workout aktiv. Die laufende Einheit bleibt unverändert.` : `${plan.name} ist jetzt aktiv.`);
  }

  function edit(plan: TrainingPlan) {
    setEditorPlanIsNew(plan.origin === "template");
    setEditorPlan(plan.origin === "custom" ? cloneTrainingPlan(plan) : createTrainingPlanDraft(plan));
  }

  function createPlan() {
    setEditorPlanIsNew(true);
    setEditorPlan(createTrainingPlanDraft());
  }

  function save(plan: TrainingPlan) {
    const saved = saveTrainingPlanDraft(plan);
    if (!saved) {
      setNotice("Der Plan konnte nicht gespeichert werden.");
      return;
    }
    setActivePlanId(saved.id);
    setEditorPlan(null);
    setEditorPlanIsNew(false);
    refresh(saved.id);
    setNotice(workoutRunning ? "Plan gespeichert und für das nächste Workout aktiviert. Die laufende Einheit bleibt unverändert." : "Plan gespeichert und aktiviert.");
  }

  function duplicate(plan: TrainingPlan) {
    setEditorPlanIsNew(true);
    setEditorPlan(createTrainingPlanDraft(plan));
  }

  function remove(plan: TrainingPlan) {
    if (deleteId !== plan.id) {
      setDeleteId(plan.id);
      return;
    }
    deleteTrainingPlan(plan.id);
    setDeleteId(null);
    refresh();
    setNotice(`${plan.name} wurde gelöscht. Gespeicherte Workouts bleiben im Verlauf erhalten.`);
  }

  if (editorPlan) return <PlanEditor initialPlan={editorPlan} initiallyUnsaved={editorPlanIsNew} onCancel={() => { setEditorPlan(null); setEditorPlanIsNew(false); }} onSave={save} />;
  if (!plans.length) return <div style={{ minHeight: "100dvh", background: "var(--c-bg)", display: "grid", placeItems: "center", color: "var(--c-text-3)" }}>Pläne werden geladen …</div>;

  const activePlan = plans.find((plan) => plan.id === activeId);
  const customPlans = plans.filter((plan) => plan.origin === "custom" && plan.id !== activeId);
  const templates = plans.filter((plan) => plan.origin === "template" && plan.id !== activeId);

  return <div style={{ minHeight: "100dvh", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 22px)" }}><header style={{ padding: "calc(18px + var(--safe-area-top)) 16px 17px" }}><Link href="/settings" style={{ color: "var(--c-text-3)", fontSize: 12, textDecoration: "none" }}>‹ Einstellungen</Link><div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, marginTop: 8 }}><div><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>Training organisieren</p><h1 style={{ fontSize: 27, marginTop: 2 }}>Meine Pläne</h1></div><button onClick={createPlan} style={{ ...buttonStyle, color: "white", background: "var(--c-accent)" }}>+ Neuer Plan</button></div></header><main style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 22 }}>{notice && <button onClick={() => setNotice("")} style={{ padding: 12, borderRadius: 12, background: "var(--c-success-dim)", color: "var(--c-text)", textAlign: "left", fontSize: 12, lineHeight: 1.45 }}>{notice}</button>}{activePlan && <section><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8, marginBottom: 9 }}>Aktiver Plan</p><PlanCard plan={activePlan} active deletePending={deleteId === activePlan.id} onActivate={() => activate(activePlan)} onEdit={() => edit(activePlan)} onDuplicate={activePlan.origin === "custom" ? () => duplicate(activePlan) : undefined} onDelete={activePlan.origin === "custom" ? () => remove(activePlan) : undefined} /></section>}{customPlans.length > 0 && <section><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8, marginBottom: 9 }}>Eigene Pläne</p><div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{customPlans.map((plan) => <PlanCard key={plan.id} plan={plan} active={false} deletePending={deleteId === plan.id} onActivate={() => activate(plan)} onEdit={() => edit(plan)} onDuplicate={() => duplicate(plan)} onDelete={() => remove(plan)} />)}</div></section>}{templates.length > 0 && <section><div style={{ marginBottom: 9 }}><p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8 }}>Vorlagen</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>Vorlagen bleiben unverändert. Beim Bearbeiten entsteht eine eigene Kopie.</p></div><div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{templates.map((plan) => <PlanCard key={plan.id} plan={plan} active={false} deletePending={false} onActivate={() => activate(plan)} onEdit={() => edit(plan)} />)}</div></section>}</main><BottomNav /></div>;
}

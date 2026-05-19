"use client";

import { useEffect, useState } from "react";

import { getActiveWorkoutState, type ActiveWorkoutState } from "@/lib/activeWorkout";
import { getAppPreferences, type MenuSide } from "@/lib/appPreferences";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PlanAccordionCard } from "@/components/PlanAccordionCard";
import { SideMenu } from "@/components/SideMenu";
import { getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import type { ExercisePlanBlock, TrainingPlanBlock } from "@/lib/trainingModel";
import {
  addTrainingExercise,
  addTrainingDay,
  addNoteBlock,
  addPauseBlock,
  addStretchBlock,
  createTrainingPlan,
  deleteTrainingPlan,
  getDayBlocks,
  duplicateTrainingPlan,
  getActivePlanId,
  getAllTrainingPlans,
  moveDayBlock,
  getPlanPreview,
  getTrainingPlan,
  isCustomTrainingPlan,
  removeDayBlock,
  removeTrainingExercise,
  renameTrainingDay,
  renameTrainingPlan,
  setActivePlanId,
  updatePauseBlock,
  updateNoteBlock,
  updateStretchBlock,
  updateWarmupBlock,
  updateTrainingExercise,
  type TrainingExercise,
  type TrainingPlan,
} from "@/lib/trainingPlans";
import {
  EXERCISE_LIBRARY,
  EXERCISE_LIBRARY_GROUPS,
  getExerciseLabel,
  STRETCH_LIBRARY_GROUPS,
  STRETCH_LIBRARY,
} from "@/lib/workoutUi";

const slotHref = {
  push: "/workout/push/index.html",
  pull: "/workout/pull/index.html",
  mixed: "/workout/legs/index.html",
} as const;

type DayEditorState = {
  dayId: string;
  value: string;
};

type NewDayState = {
  value: string;
  slot: "push" | "pull" | "mixed";
};

type ExerciseEditorState = {
  dayId: string;
  exerciseId?: string;
  name: string;
  sets: string;
  minReps: string;
  maxReps: string;
  restSeconds: string;
};

type WarmupEditorState = {
  dayId: string;
  exerciseId: string;
  exerciseLabel: string;
  rounds: string;
  restSeconds: string;
};

type StretchEditorState = {
  dayId: string;
  blockId?: string;
  stretchId: string;
  holdSeconds: string;
  rounds: string;
};

type PauseEditorState = {
  dayId: string;
  blockId?: string;
  label: string;
  seconds: string;
  scope: "exercise" | "workout";
};

type NoteEditorState = {
  dayId: string;
  blockId?: string;
  label: string;
  notes: string;
};

type GuidedPlanExercise = {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

type GuidedPlanDay = {
  name: string;
  exercises: GuidedPlanExercise[];
};

type NewPlanWizardState = {
  step: "name" | "day" | "exercise" | "sets" | "pause";
  planName: string;
  dayName: string;
  exerciseName: string;
  sets: string;
  restSeconds: string;
  days: GuidedPlanDay[];
  exercises: GuidedPlanExercise[];
};

export default function Home() {
  const [availablePlans, setAvailablePlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan>(() =>
    getTrainingPlan("my-plan")
  );
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [activeWorkoutState, setActiveWorkoutState] = useState<ActiveWorkoutState | null>(null);
  const [activeDayTab, setActiveDayTab] = useState<string | null>(null);
  const [newPlanWizard, setNewPlanWizard] = useState<NewPlanWizardState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSide, setMenuSide] = useState<MenuSide>("left");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [deleteCandidatePlan, setDeleteCandidatePlan] = useState<TrainingPlan | null>(null);
  const [showDayEditorBlocks, setShowDayEditorBlocks] = useState(false);

  const [dayEditor, setDayEditor] = useState<DayEditorState | null>(null);
  const [newDayEditor, setNewDayEditor] = useState<NewDayState | null>(null);
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditorState | null>(null);
  const [warmupEditor, setWarmupEditor] = useState<WarmupEditorState | null>(null);
  const [stretchEditor, setStretchEditor] = useState<StretchEditorState | null>(null);
  const [pauseEditor, setPauseEditor] = useState<PauseEditorState | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);
  const [addBlockDayId, setAddBlockDayId] = useState<string | null>(null);
  const [warmupTargetDayId, setWarmupTargetDayId] = useState<string | null>(null);

  useEffect(() => {
    refreshPlans();
    setMenuSide(getAppPreferences().menuSide);
    setActiveWorkoutState(getActiveWorkoutState());
  }, []);

  useEffect(() => {
    function refreshActiveWorkout() {
      setActiveWorkoutState(getActiveWorkoutState());
    }

    refreshActiveWorkout();
    window.addEventListener("focus", refreshActiveWorkout);
    window.addEventListener("storage", refreshActiveWorkout);
    document.addEventListener("visibilitychange", refreshActiveWorkout);

    return () => {
      window.removeEventListener("focus", refreshActiveWorkout);
      window.removeEventListener("storage", refreshActiveWorkout);
      document.removeEventListener("visibilitychange", refreshActiveWorkout);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const sheet = params.get("sheet");

    if (sheet === "plans") {
      setMenuOpen(false);
      setExpandedPlanId(null);
      setShowPlanPicker(true);
      setShowPlanDetail(false);
      return;
    }

    if (sheet === "exercises") {
      setMenuOpen(false);
      setShowPlanPicker(false);
      openPlanDetail();
    }
  }, []);

  useEffect(() => {
    setShowDayEditorBlocks(false);
  }, [activeDayTab, showPlanDetail]);

  function refreshPlans(nextActivePlanId?: string) {
    const plans = getAllTrainingPlans();
    const resolvedPlan = getTrainingPlan(nextActivePlanId || getActivePlanId());
    setAvailablePlans(plans);
    setActivePlan(resolvedPlan);
  }

  function openPlanPicker() {
    refreshPlans();
    setMenuOpen(false);
    setExpandedPlanId(null);
    setShowPlanPicker(true);
  }

  function getDefaultWizardExercise(exerciseName?: string) {
    const nextExerciseName = exerciseName ?? EXERCISE_LIBRARY[0]?.value ?? "benchpress";
    const suggested = getSuggestedExerciseSetup(nextExerciseName);
    return {
      exerciseName: nextExerciseName,
      sets: String(suggested.sets),
      restSeconds: String(suggested.restSeconds),
      minReps: suggested.minReps,
      maxReps: suggested.maxReps,
    };
  }

  function openNewPlanWizard() {
    const defaults = getDefaultWizardExercise();
    setNewPlanWizard({
      step: "name",
      planName: "",
      dayName: "Tag A",
      exerciseName: defaults.exerciseName,
      sets: defaults.sets,
      restSeconds: defaults.restSeconds,
      days: [],
      exercises: [],
    });
  }

  function closeNewPlanWizard() {
    setNewPlanWizard(null);
  }

  function updateWizardExerciseSelection(exerciseName: string) {
    const suggested = getDefaultWizardExercise(exerciseName);
    setNewPlanWizard((current) =>
      current
        ? {
            ...current,
            step: current.step === "exercise" ? "sets" : current.step,
            exerciseName: suggested.exerciseName,
            sets: suggested.sets,
            restSeconds: suggested.restSeconds,
          }
        : current
    );
  }

  function updateWizardExerciseCategory(category: string) {
    const group = EXERCISE_LIBRARY_GROUPS.find((entry) => entry.category === category);
    const firstExercise = group?.items[0]?.value;
    if (!firstExercise) return;
    updateWizardExerciseSelection(firstExercise);
  }

  function continueNewPlanWizard() {
    if (!newPlanWizard) return;

    if (newPlanWizard.step === "name") {
      if (!newPlanWizard.planName.trim()) return;
      setNewPlanWizard({ ...newPlanWizard, step: "day" });
      return;
    }

    if (newPlanWizard.step === "day") {
      if (!newPlanWizard.dayName.trim()) return;
      setNewPlanWizard({ ...newPlanWizard, step: "exercise" });
      return;
    }

    if (newPlanWizard.step === "exercise") {
      setNewPlanWizard({ ...newPlanWizard, step: "sets" });
      return;
    }

    if (newPlanWizard.step === "sets") {
      setNewPlanWizard({ ...newPlanWizard, step: "pause" });
    }
  }

  function selectWizardDayPreset(dayName: string) {
    setNewPlanWizard((current) =>
      current
        ? {
            ...current,
            dayName,
            step: "exercise",
          }
        : current
    );
  }

  function goBackNewPlanWizard() {
    if (!newPlanWizard) return;

    if (newPlanWizard.step === "day") {
      setNewPlanWizard({ ...newPlanWizard, step: "name" });
      return;
    }

    if (newPlanWizard.step === "exercise") {
      setNewPlanWizard({ ...newPlanWizard, step: "day" });
      return;
    }

    if (newPlanWizard.step === "sets") {
      setNewPlanWizard({ ...newPlanWizard, step: "exercise" });
      return;
    }

    if (newPlanWizard.step === "pause") {
      setNewPlanWizard({ ...newPlanWizard, step: "sets" });
    }
  }

  function addGuidedExerciseAndContinue() {
    if (!newPlanWizard) return;
    const nextExercises = [...newPlanWizard.exercises, buildGuidedWizardExercise(newPlanWizard)];
    const defaults = getDefaultWizardExercise();
    setNewPlanWizard({
      ...newPlanWizard,
      step: "exercise",
      exerciseName: defaults.exerciseName,
      sets: defaults.sets,
      restSeconds: defaults.restSeconds,
      exercises: nextExercises,
    });
  }

  function addGuidedDayAndContinue() {
    if (!newPlanWizard) return;

    const nextDays = [
      ...newPlanWizard.days,
      {
        name: newPlanWizard.dayName.trim(),
        exercises: [...newPlanWizard.exercises, buildGuidedWizardExercise(newPlanWizard)],
      },
    ];
    const defaults = getDefaultWizardExercise();
    setNewPlanWizard({
      ...newPlanWizard,
      step: "day",
      dayName: getNextWizardDayName(nextDays.length),
      exerciseName: defaults.exerciseName,
      sets: defaults.sets,
      restSeconds: defaults.restSeconds,
      days: nextDays,
      exercises: [],
    });
  }

  function finishNewPlanWizard() {
    if (!newPlanWizard) return;
    const days = [
      ...newPlanWizard.days,
      {
        name: newPlanWizard.dayName.trim(),
        exercises: [...newPlanWizard.exercises, buildGuidedWizardExercise(newPlanWizard)],
      },
    ];

    const created = createTrainingPlan({
      name: newPlanWizard.planName,
      days,
    });

    if (!created) return;
    setActivePlanId(created.id);
    refreshPlans(created.id);
    setShowPlanPicker(false);
    setActiveDayTab(created.days[0]?.id ?? null);
    setShowPlanDetail(true);
    setNewPlanWizard(null);
  }

  function openPlanDetail() {
    refreshPlans();
    const plan = getTrainingPlan(getActivePlanId());
    setActiveDayTab(plan.days[0]?.id ?? null);
    setMenuOpen(false);
    setShowPlanDetail(true);
  }

  function handlePlanSelect(planId: string) {
    const nextPlan = getTrainingPlan(planId);
    setActivePlanId(nextPlan.id);
    setActivePlan(nextPlan);
    setAvailablePlans(getAllTrainingPlans());
    setShowPlanPicker(false);
  }

  function handleDuplicatePlan(planId: string) {
    const duplicated = duplicateTrainingPlan(planId);
    setActivePlanId(duplicated.id);
    refreshPlans(duplicated.id);
    setShowPlanPicker(false);
    setActiveDayTab(duplicated.days[0]?.id ?? null);
    setShowPlanDetail(true);
  }

  function handleDeletePlan(planId: string) {
    const deleted = deleteTrainingPlan(planId);
    if (!deleted) return;

    const fallbackPlan = getTrainingPlan("my-plan");
    setActivePlanId(fallbackPlan.id);
    setDayEditor(null);
    setExerciseEditor(null);
    setWarmupEditor(null);
    setStretchEditor(null);
    setPauseEditor(null);
    setShowPlanDetail(false);
    refreshPlans(fallbackPlan.id);
    setExpandedPlanId(fallbackPlan.id);
    setDeleteCandidatePlan(null);
  }

  function requestDeletePlan(planId: string) {
    setDeleteCandidatePlan(getTrainingPlan(planId));
  }

  function confirmDeletePlan() {
    if (!deleteCandidatePlan) return;
    handleDeletePlan(deleteCandidatePlan.id);
  }

  function handleRenamePlan(planId: string) {
    const current = getTrainingPlan(planId);
    const nextName = window.prompt("Neuer Planname", current.name);
    if (!nextName) return;

    const renamed = renameTrainingPlan(planId, nextName);
    if (!renamed) return;
    refreshPlans(renamed.id);
  }

  function openDayEditor(dayId: string, currentName: string) {
    setDayEditor({ dayId, value: currentName });
  }

  function saveDayEditor() {
    if (!dayEditor) return;
    const updated = renameTrainingDay(activePlan.id, dayEditor.dayId, dayEditor.value);
    if (!updated) return;
    setDayEditor(null);
    refreshPlans(updated.id);
  }

  function openNewDayEditor() {
    const nextIndex = activePlan.days.length;
    const nextSlot =
      nextIndex === 0 ? "push" : nextIndex === 1 ? "pull" : "mixed";
    const defaultName =
      nextSlot === "push"
        ? "Push"
        : nextSlot === "pull"
          ? "Pull"
          : `Tag ${String.fromCharCode(65 + nextIndex)}`;
    setNewDayEditor({ value: defaultName, slot: nextSlot });
  }

  function saveNewDayEditor() {
    if (!newDayEditor) return;
    const updated = addTrainingDay(activePlan.id, {
      name: newDayEditor.value,
      slot: newDayEditor.slot,
    });
    if (!updated) return;
    const nextDay = updated.days[updated.days.length - 1];
    setNewDayEditor(null);
    setActiveDayTab(nextDay?.id ?? null);
    refreshPlans(updated.id);
  }

  const activePlanDay = activePlan.days.find((day) => day.id === activeDayTab) ?? null;
  const activeDayBlocks = activePlanDay ? getDayBlocks(activePlanDay) : [];

  function openAddExercise(dayId: string) {
    const defaults = getDefaultWizardExercise();
    setExerciseEditor({
      dayId,
      name: defaults.exerciseName,
      sets: defaults.sets,
      minReps: String(defaults.minReps),
      maxReps: String(defaults.maxReps),
      restSeconds: defaults.restSeconds,
    });
  }

  function openEditExercise(dayId: string, exercise: TrainingExercise) {
    setExerciseEditor({
      dayId,
      exerciseId: exercise.id,
      name: exercise.name,
      sets: String(exercise.sets),
      minReps: String(exercise.minReps),
      maxReps: String(exercise.maxReps),
      restSeconds: String(exercise.restSeconds),
    });
  }

  function saveExerciseEditor() {
    if (!exerciseEditor) return;

    const draft = {
      name: exerciseEditor.name,
      sets: Number(exerciseEditor.sets),
      minReps: Number(exerciseEditor.minReps),
      maxReps: Number(exerciseEditor.maxReps),
      restSeconds: Number(exerciseEditor.restSeconds),
    };

    const updated = exerciseEditor.exerciseId
      ? updateTrainingExercise(activePlan.id, exerciseEditor.dayId, exerciseEditor.exerciseId, draft)
      : addTrainingExercise(activePlan.id, exerciseEditor.dayId, draft);

    if (!updated) return;
    setExerciseEditor(null);
    refreshPlans(updated.id);
  }

  function applyExerciseEditorDefaults(exerciseName: string) {
    const suggested = getSuggestedExerciseSetup(exerciseName);
    setExerciseEditor((current) =>
      current
        ? {
            ...current,
            name: exerciseName,
            sets: String(suggested.sets),
            minReps: String(suggested.minReps),
            maxReps: String(suggested.maxReps),
            restSeconds: String(suggested.restSeconds),
          }
        : current
    );
  }

  function handleRemoveExercise(dayId: string, exerciseId: string) {
    const shouldRemove = window.confirm("Diese Übung aus dem Plan entfernen?");
    if (!shouldRemove) return;

    const updated = removeTrainingExercise(activePlan.id, dayId, exerciseId);
    if (!updated) return;
    refreshPlans(updated.id);
  }

  function openWarmupEditor(
    dayId: string,
    exerciseId: string,
    exerciseLabel: string,
    rounds: number,
    restSeconds: number
  ) {
    setWarmupEditor({ dayId, exerciseId, exerciseLabel, rounds: String(rounds), restSeconds: String(restSeconds) });
  }

  function saveWarmupEditor() {
    if (!warmupEditor) return;
    const updated = updateWarmupBlock(activePlan.id, warmupEditor.dayId, warmupEditor.exerciseId, {
      rounds: Number(warmupEditor.rounds),
      restSeconds: Number(warmupEditor.restSeconds),
    });
    if (!updated) return;
    setWarmupEditor(null);
    refreshPlans(updated.id);
  }

  function openStretchEditor(
    dayId: string,
    stretchId?: string,
    holdSeconds?: number,
    rounds?: number,
    blockId?: string
  ) {
    setStretchEditor({
      dayId,
      blockId,
      stretchId: stretchId ?? STRETCH_LIBRARY[0]?.value ?? "chest_stretch",
      holdSeconds: String(holdSeconds ?? 30),
      rounds: String(rounds ?? 1),
    });
  }

  function saveStretchEditor() {
    if (!stretchEditor) return;

    const draft = {
      stretchId: stretchEditor.stretchId,
      holdSeconds: Number(stretchEditor.holdSeconds),
      rounds: Number(stretchEditor.rounds),
    };

    const updated = stretchEditor.blockId
      ? updateStretchBlock(activePlan.id, stretchEditor.dayId, stretchEditor.blockId, draft)
      : addStretchBlock(activePlan.id, stretchEditor.dayId, draft);

    if (!updated) return;
    setStretchEditor(null);
    refreshPlans(updated.id);
  }

  function openPauseEditor(
    dayId: string,
    label?: string,
    seconds?: number,
    scope: "exercise" | "workout" = "exercise",
    blockId?: string
  ) {
    setPauseEditor({ dayId, blockId, label: label ?? "", seconds: String(seconds ?? 60), scope });
  }

  function savePauseEditor() {
    if (!pauseEditor) return;

    const draft = {
      label: pauseEditor.label,
      seconds: Number(pauseEditor.seconds),
      scope: pauseEditor.scope,
    };

    const updated = pauseEditor.blockId
      ? updatePauseBlock(activePlan.id, pauseEditor.dayId, pauseEditor.blockId, draft)
      : addPauseBlock(activePlan.id, pauseEditor.dayId, draft);

    if (!updated) return;
    setPauseEditor(null);
    refreshPlans(updated.id);
  }

  function openNoteEditor(
    dayId: string,
    label = "Hinweis",
    notes = "",
    blockId?: string
  ) {
    setNoteEditor({ dayId, blockId, label, notes });
  }

  function saveNoteEditor() {
    if (!noteEditor) return;

    const draft = {
      label: noteEditor.label,
      notes: noteEditor.notes,
    };

    const updated = noteEditor.blockId
      ? updateNoteBlock(activePlan.id, noteEditor.dayId, noteEditor.blockId, draft)
      : addNoteBlock(activePlan.id, noteEditor.dayId, draft);

    if (!updated) return;
    setNoteEditor(null);
    refreshPlans(updated.id);
  }

  function openAddBlockSheet(dayId: string) {
    setAddBlockDayId(dayId);
    setWarmupTargetDayId(null);
  }

  function handleRemoveBlock(dayId: string, blockId: string) {
    const shouldRemove = window.confirm("Diesen Block aus dem Plan entfernen?");
    if (!shouldRemove) return;

    const updated = removeDayBlock(activePlan.id, dayId, blockId);
    if (!updated) return;
    refreshPlans(updated.id);
  }

  function handleMoveBlock(dayId: string, blockId: string, direction: "up" | "down") {
    const updated = moveDayBlock(activePlan.id, dayId, blockId, direction);
    if (!updated) return;
    refreshPlans(updated.id);
  }

  const canEditActivePlan = isCustomTrainingPlan(activePlan.id);
  const hideMenuButton =
    showPlanPicker ||
    showPlanDetail ||
    Boolean(newPlanWizard) ||
    Boolean(dayEditor) ||
    Boolean(newDayEditor) ||
    Boolean(exerciseEditor) ||
    Boolean(warmupEditor) ||
    Boolean(stretchEditor) ||
    Boolean(pauseEditor) ||
    Boolean(noteEditor) ||
    Boolean(addBlockDayId) ||
    Boolean(warmupTargetDayId);
  const menuItems = [
    { key: "training", label: "Training", icon: "🏋️", active: true, onClick: () => setMenuOpen(false) },
    { key: "plans", label: "Pläne", icon: "📋", onClick: openPlanPicker },
    { key: "exercises", label: "Übungen", icon: "💪", onClick: openPlanDetail },
    { key: "history", label: "Verlauf", icon: "🕘", href: "/history/index.html" },
    { key: "stats", label: "Statistiken", icon: "◔", href: "/statistics/index.html" },
    { key: "progress", label: "Fortschritte", icon: "📈", href: "/progress/index.html" },
    { key: "weight", label: "Gewicht", icon: "⚖️", href: "/weight/index.html" },
    { key: "settings", label: "Einstellungen", icon: "⚙️", href: "/settings/index.html" },
    { key: "support", label: "Hilfe & Support", icon: "❔", href: "/support/index.html" },
  ];

  return (
    <div style={screen}>
        <SideMenu
          open={menuOpen}
          hidden={hideMenuButton}
          onToggle={() => setMenuOpen((current) => !current)}
          onClose={() => setMenuOpen(false)}
          side={menuSide}
          items={menuItems}
        />

      <main style={shell}>
        <div style={topBar}>
          <div style={brandPill}>Gym Tracker</div>
        </div>

        {activeWorkoutState ? (
          <div style={currentPlanCard}>
            <div>
              <div style={sectionTitle}>Training läuft</div>
              <div style={currentPlanName}>{activeWorkoutState.workoutLabel}</div>
              <div style={currentPlanMeta}>
                {[activeWorkoutState.planName, activeWorkoutState.dayName, activeWorkoutState.stateLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div style={currentPlanActions}>
              <a href={activeWorkoutState.href} style={primaryActionButton}>
                Fortsetzen
              </a>
            </div>
          </div>
        ) : null}

        <div
          style={{
            ...dayGrid,
            gridTemplateRows: `repeat(${Math.max(activePlan.days.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {activePlan.days.map((day, index) => (
            <a
              key={day.id}
              href={slotHref[day.slot]}
              style={{
                ...dayCard,
                background: `linear-gradient(135deg, ${day.color} 0%, ${shadeColor(day.color)} 100%)`,
              }}
            >
              <div style={dayCardTop}>
                <span style={dayKicker}>{buildDayKicker(index, activePlan.days.length)}</span>
                <span style={dayStartBadge}>Start</span>
              </div>
              <div style={dayBody}>
                <span style={dayTitle}>{day.name}</span>
                <span style={dayCopy}>{buildExercisePreview(day.exercises)}</span>
              </div>
            </a>
          ))}
        </div>
      </main>

      {/* Plan Picker */}
      {showPlanPicker ? (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Trainingspläne</div>
                <div style={sheetTitle}>Plan wählen</div>
              </div>
              <div style={sheetHeaderActions}>
                <button style={plusButton} onClick={openNewPlanWizard}>+</button>
                <button style={closeButton} onClick={() => setShowPlanPicker(false)}>×</button>
              </div>
            </div>

            <div style={planList}>
              {availablePlans.map((plan) => {
                const isActive = plan.id === activePlan.id;
                const isCustom = isCustomTrainingPlan(plan.id);
                const subtitle = `${plan.days.length} ${plan.days.length === 1 ? "Trainingstag" : "Trainingstage"}`;
                const dayPreviews = plan.days.map((day) => ({
                  id: day.id,
                  name: day.name,
                  color: day.color,
                  preview: buildExercisePreview(day.exercises),
                }));
                const startHref = isActive && plan.days[0] ? slotHref[plan.days[0].slot] : undefined;

                return (
                  <PlanAccordionCard
                    key={plan.id}
                    plan={plan}
                    subtitle={subtitle}
                    isActive={isActive}
                    isCustom={isCustom}
                    expanded={expandedPlanId === plan.id}
                    canDelete={isCustom}
                    startHref={startHref}
                    dayPreviews={dayPreviews}
                    onToggle={() =>
                      setExpandedPlanId((current) => (current === plan.id ? null : plan.id))
                    }
                    onUse={() => handlePlanSelect(plan.id)}
                    onEdit={() => {
                      setShowPlanPicker(false);
                      setActivePlanId(plan.id);
                      refreshPlans(plan.id);
                      setActiveDayTab(plan.days[0]?.id ?? null);
                      setShowPlanDetail(true);
                    }}
                    onDuplicate={() => handleDuplicatePlan(plan.id)}
                    onDelete={() => requestDeletePlan(plan.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(deleteCandidatePlan)}
        title="Plan löschen?"
        body="Möchtest du diesen Plan wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onCancel={() => setDeleteCandidatePlan(null)}
        onConfirm={confirmDeletePlan}
      />

      {/* Plan Detail / Editor */}
      {showPlanDetail ? (
        <div style={overlay}>
          <div style={planDetailSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Plan</div>
                <div style={sheetTitle}>{activePlan.name}</div>
              </div>
              <button style={closeButton} onClick={() => setShowPlanDetail(false)}>×</button>
            </div>

            <div style={planDetailMetaBar}>
              <span style={canEditActivePlan ? customBadge : templateBadge}>
                {canEditActivePlan ? "Eigen" : "Vorlage"}
              </span>
              <div style={miniActionRow}>
                {canEditActivePlan ? (
                  <>
                    <button style={miniActionButton} onClick={() => handleRenamePlan(activePlan.id)}>
                      Umbenennen
                    </button>
                    <button
                      style={{ ...miniActionButton, ...dangerMiniButton }}
                      onClick={() => handleDeletePlan(activePlan.id)}
                    >
                      Löschen
                    </button>
                  </>
                ) : (
                  <button style={miniActionButton} onClick={() => handleDuplicatePlan(activePlan.id)}>
                    Als Kopie
                  </button>
                )}
              </div>
            </div>

            <div style={dayTabsWrap}>
              <div style={dayTabsRow}>
                {activePlan.days.map((day) => (
                  <button
                    key={day.id}
                    style={{
                      ...dayTab,
                      ...(activeDayTab === day.id
                        ? { ...dayTabActive, borderColor: day.color, color: day.color }
                        : null),
                    }}
                    onClick={() => setActiveDayTab(day.id)}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
              {canEditActivePlan ? (
                <button style={addSplitButton} onClick={openNewDayEditor}>
                  + Split
                </button>
              ) : null}
            </div>

            {canEditActivePlan && activePlanDay ? (
              <div style={activeDayActions}>
                <span style={activeDayLabel}>Aktiver Tag: {activePlanDay.name}</span>
                <div style={activeDayActionRow}>
                  <button
                    style={miniActionButton}
                    onClick={() => openDayEditor(activePlanDay.id, activePlanDay.name)}
                  >
                    Umbenennen
                  </button>
                  <button
                    style={miniActionButton}
                    onClick={() => setShowDayEditorBlocks((current) => !current)}
                  >
                    {showDayEditorBlocks ? "Überblick" : "Ablauf bearbeiten"}
                  </button>
                </div>
              </div>
            ) : null}

            {activePlanDay ? (
              <div style={dayOverviewCard}>
                <div style={dayOverviewTop}>
                  <div>
                    <div style={dayOverviewTitle}>Tagesüberblick</div>
                    <div style={dayOverviewMeta}>
                      {activeDayBlocks.filter((block) => block.type === "exercise").length} Übungen ·{" "}
                      {activeDayBlocks.filter((block) => block.type === "warmup").length} Aufwärmen ·{" "}
                      {activeDayBlocks.filter((block) => block.type === "stretch").length} Dehnen ·{" "}
                      {activeDayBlocks.filter((block) => block.type === "pause").length} Pausen
                    </div>
                  </div>
                  {!showDayEditorBlocks ? (
                    <button
                      style={overviewPrimaryButton}
                      onClick={() => setShowDayEditorBlocks(true)}
                    >
                      Ablauf bearbeiten
                    </button>
                  ) : null}
                </div>
                {activeDayBlocks.length > 0 ? (
                  <div style={dayOverviewChips}>
                    {activeDayBlocks.slice(0, 6).map((block) => (
                      <span key={block.id} style={getOverviewChipStyle(block.type)}>
                        {getBlockTitle(block)}
                      </span>
                    ))}
                    {activeDayBlocks.length > 6 ? (
                      <span style={dayOverviewMoreChip}>+{activeDayBlocks.length - 6} weitere</span>
                    ) : null}
                  </div>
                ) : (
                  <div style={emptyDayHint}>
                    Dieser Split ist noch leer. Starte direkt mit `+ Übung`, `+ Dehnen` oder `+ Pause`.
                  </div>
                )}
              </div>
            ) : null}

            {showDayEditorBlocks ? (
            <div style={planBlockList}>
              {(() => {
                const activeDay = activePlanDay;
                if (!activeDay) return null;
                const dayBlocks = activeDayBlocks;

                if (dayBlocks.length === 0) {
                  return null;
                }

                return dayBlocks.map((block, blockIndex) => {
                  const editableExercise = getEditableExerciseForBlock(block, activeDay.exercises);
                  const warmupExercise =
                    block.type === "warmup"
                      ? activeDay.exercises.find((e) => e.id === block.parentExerciseId) ?? null
                      : null;

                  const openEditor = () => {
                    if (editableExercise) {
                      openEditExercise(activeDay.id, editableExercise);
                    } else if (block.type === "warmup" && warmupExercise) {
                      openWarmupEditor(
                        activeDay.id,
                        warmupExercise.id,
                        getExerciseLabel(warmupExercise.name),
                        block.rounds,
                        block.restSeconds
                      );
                    } else if (block.type === "stretch") {
                      openStretchEditor(activeDay.id, block.stretchId, block.holdSeconds, block.rounds, block.id);
                    } else if (block.type === "pause") {
                      openPauseEditor(activeDay.id, block.label, block.seconds, block.scope, block.id);
                    } else if (block.type === "note") {
                      openNoteEditor(activeDay.id, block.label, block.notes, block.id);
                    }
                  };

                  const removeBlock = () => {
                    if (editableExercise) {
                      handleRemoveExercise(activeDay.id, editableExercise.id);
                    } else {
                      handleRemoveBlock(activeDay.id, block.id);
                    }
                  };

                  return (
                    <div key={block.id} style={planBlockRow}>
                      <button style={planBlockMain} onClick={openEditor}>
                        <div style={planBlockNameRow}>
                          <span style={planBlockName}>{getBlockTitle(block)}</span>
                          <span style={getBlockBadgeStyle(block.type)}>
                            {getBlockBadgeLabel(block.type)}
                          </span>
                        </div>
                        <span style={planBlockMeta}>{getBlockMeta(block)}</span>
                      </button>
                      {canEditActivePlan ? (
                        <div style={planBlockActions}>
                          <button
                            style={planBlockIcon}
                            disabled={blockIndex === 0}
                            onClick={() => handleMoveBlock(activeDay.id, block.id, "up")}
                          >
                            ↑ Hoch
                          </button>
                          <button
                            style={planBlockIcon}
                            disabled={blockIndex === dayBlocks.length - 1}
                            onClick={() => handleMoveBlock(activeDay.id, block.id, "down")}
                          >
                            ↓ Runter
                          </button>
                          <button
                            style={{ ...planBlockIcon, color: "#be123c" }}
                            onClick={removeBlock}
                          >
                            Löschen
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>
            ) : null}

            {canEditActivePlan && activeDayTab ? (
              <div style={quickAddDock}>
                <button style={addBlockButton} onClick={() => openAddBlockSheet(activeDayTab)}>
                  + Baustein hinzufügen
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {newPlanWizard ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Neuer Plan</div>
                <div style={sheetTitle}>{getWizardTitle(newPlanWizard.step)}</div>
              </div>
              <button style={closeButton} onClick={closeNewPlanWizard}>×</button>
            </div>

            <div style={wizardStepBar}>
              <span style={wizardStepChip}>{getWizardStepLabel(newPlanWizard.step)}</span>
              {newPlanWizard.days.length > 0 ? (
                <span style={wizardMeta}>{newPlanWizard.days.length} Splits</span>
              ) : null}
              {newPlanWizard.exercises.length > 0 ? (
                <span style={wizardMeta}>{newPlanWizard.exercises.length} Übungen</span>
              ) : null}
            </div>

            {newPlanWizard.days.length > 0 && newPlanWizard.step !== "day" ? (
              <div style={wizardPreviewList}>
                {newPlanWizard.days.map((day, index) => (
                  <div key={`${day.name}-${index}`} style={wizardPreviewItem}>
                    <span style={wizardPreviewName}>{day.name}</span>
                    <span style={wizardPreviewMeta}>{day.exercises.length} Übungen</span>
                  </div>
                ))}
              </div>
            ) : null}

            {newPlanWizard.exercises.length > 0 && newPlanWizard.step === "pause" ? (
              <div style={wizardPreviewList}>
                {newPlanWizard.exercises.map((exercise, index) => (
                  <div key={`${exercise.name}-${index}`} style={wizardPreviewItem}>
                    <span style={wizardPreviewName}>{getExerciseLabel(exercise.name)}</span>
                    <span style={wizardPreviewMeta}>
                      {exercise.sets} Sätze · {formatRest(exercise.restSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {newPlanWizard.step === "name" ? (
              <label style={fieldStack}>
                <span style={fieldLabel}>Planname</span>
                <input
                  style={textInput}
                  value={newPlanWizard.planName}
                  onChange={(event) =>
                    setNewPlanWizard((current) =>
                      current ? { ...current, planName: event.target.value } : current
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      continueNewPlanWizard();
                    }
                  }}
                />
              </label>
            ) : null}

            {newPlanWizard.step === "day" ? (
              <div style={fieldStack}>
                <span style={fieldLabel}>Tag</span>
                <input
                  style={textInput}
                  value={newPlanWizard.dayName}
                  onChange={(event) =>
                    setNewPlanWizard((current) =>
                      current ? { ...current, dayName: event.target.value } : current
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      continueNewPlanWizard();
                    }
                  }}
                />
                <div style={wizardChoiceGridCompact}>
                  {["Tag A", "Tag B", "Tag C", "Push", "Pull", "Mixed"].map((value) => (
                    <button
                      key={value}
                      style={
                        newPlanWizard.dayName === value
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() => selectWizardDayPreset(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {newPlanWizard.step === "exercise" ? (
              <div style={fieldStack}>
                <span style={fieldLabel}>Übung</span>
                <div style={wizardChoiceGridCompact}>
                  {EXERCISE_LIBRARY_GROUPS.slice(0, 6).map((group) => {
                    const isActiveCategory = group.items.some(
                      (item) => item.value === newPlanWizard.exerciseName
                    );
                    return (
                      <button
                        key={group.category}
                        style={isActiveCategory ? wizardChoiceButtonActive : wizardChoiceButton}
                        onClick={() => updateWizardExerciseCategory(group.category)}
                      >
                        {group.category}
                      </button>
                    );
                  })}
                </div>
                <div style={wizardExerciseQuickList}>
                  {(EXERCISE_LIBRARY_GROUPS.find((group) =>
                    group.items.some((item) => item.value === newPlanWizard.exerciseName)
                  )?.items ?? EXERCISE_LIBRARY_GROUPS[0]?.items ?? [])
                    .slice(0, 6)
                    .map((exercise) => (
                      <button
                        key={exercise.value}
                        style={
                          newPlanWizard.exerciseName === exercise.value
                            ? wizardExerciseQuickCardActive
                            : wizardExerciseQuickCard
                        }
                        onClick={() => updateWizardExerciseSelection(exercise.value)}
                      >
                        {exercise.label}
                      </button>
                    ))}
                </div>
                <select
                  style={textInput}
                  value={newPlanWizard.exerciseName}
                  onChange={(event) => updateWizardExerciseSelection(event.target.value)}
                >
                  {EXERCISE_LIBRARY.map((exercise) => (
                    <option key={exercise.value} value={exercise.value}>
                      {exercise.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {newPlanWizard.step === "sets" ? (
              <div style={wizardChoiceGrid}>
                {[2, 3, 4, 5, 6].map((value) => (
                  <button
                    key={value}
                    style={
                      newPlanWizard.sets === String(value)
                        ? wizardChoiceButtonActive
                        : wizardChoiceButton
                    }
                    onClick={() =>
                      setNewPlanWizard((current) =>
                        current
                          ? { ...current, step: "pause", sets: String(value) }
                          : current
                      )
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : null}

            {newPlanWizard.step === "pause" ? (
              <>
                <div style={wizardChoiceGrid}>
                  {[60, 75, 90, 120, 150, 180].map((value) => (
                    <button
                      key={value}
                      style={
                        newPlanWizard.restSeconds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setNewPlanWizard((current) =>
                          current ? { ...current, restSeconds: String(value) } : current
                        )
                      }
                    >
                      {formatRest(value)}
                    </button>
                  ))}
                </div>
                <div style={wizardReadyCard}>
                  <div style={wizardReadyTitle}>
                    {getExerciseLabel(newPlanWizard.exerciseName)}
                  </div>
                  <div style={wizardReadyMeta}>
                    {newPlanWizard.sets} Sätze · {formatRest(Number(newPlanWizard.restSeconds))}
                  </div>
                </div>
              </>
            ) : null}

            <div style={editorActions}>
              <button style={selectButton} onClick={closeNewPlanWizard}>Abbrechen</button>
              {newPlanWizard.step !== "pause" ? (
                <>
                  {newPlanWizard.step === "name" || newPlanWizard.step === "day" ? (
                    <button style={activeSelectButton} onClick={continueNewPlanWizard}>
                      Weiter
                    </button>
                  ) : null}
                  {newPlanWizard.step !== "name" ? (
                    <button style={selectButton} onClick={goBackNewPlanWizard}>
                      Zurück
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <div style={wizardFinalActions}>
                    <button style={wizardOutcomeButton} onClick={addGuidedExerciseAndContinue}>
                      <span style={wizardOutcomeTitle}>+ Übung</span>
                      <span style={wizardOutcomeMeta}>Noch eine Übung in diesem Split</span>
                    </button>
                    <button style={wizardOutcomeButton} onClick={addGuidedDayAndContinue}>
                      <span style={wizardOutcomeTitle}>+ Split</span>
                      <span style={wizardOutcomeMeta}>Diesen Tag abschließen und neuen Tag starten</span>
                    </button>
                    <button style={wizardPrimaryOutcomeButton} onClick={finishNewPlanWizard}>
                      <span style={wizardOutcomeTitle}>Erstellen</span>
                      <span style={wizardOutcomeMeta}>Plan jetzt direkt anlegen</span>
                    </button>
                  </div>
                  <div style={wizardSecondaryActions}>
                    <button style={selectButton} onClick={goBackNewPlanWizard}>
                      Zurück
                    </button>
                    <button style={selectButton} onClick={closeNewPlanWizard}>
                      Abbrechen
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Day Name Editor */}
      {dayEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Tag</div>
                <div style={sheetTitle}>Namen anpassen</div>
              </div>
              <button style={closeButton} onClick={() => setDayEditor(null)}>×</button>
            </div>

            <label style={fieldStack}>
              <span style={fieldLabel}>Name</span>
              <input
                style={textInput}
                value={dayEditor.value}
                onChange={(event) =>
                  setDayEditor((current) =>
                    current ? { ...current, value: event.target.value } : current
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveDayEditor();
                  }
                }}
              />
            </label>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setDayEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveDayEditor}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}

      {newDayEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Neuer Split</div>
                <div style={sheetTitle}>Tag hinzufügen</div>
              </div>
              <button style={closeButton} onClick={() => setNewDayEditor(null)}>×</button>
            </div>

            <div style={fieldGrid}>
              <label style={fieldStack}>
                <span style={fieldLabel}>Tagname</span>
                <input
                  style={textInput}
                  value={newDayEditor.value}
                  onChange={(event) =>
                    setNewDayEditor((current) =>
                      current ? { ...current, value: event.target.value } : current
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveNewDayEditor();
                    }
                  }}
                />
              </label>

              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Typ</span>
                <div style={editorQuickGrid}>
                  {[
                    ["push", "Push"],
                    ["pull", "Pull"],
                    ["mixed", "Mixed"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      style={
                        newDayEditor.slot === value
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setNewDayEditor((current) =>
                          current
                            ? {
                                ...current,
                                slot: value as "push" | "pull" | "mixed",
                                value:
                                  current.value.trim() &&
                                  !["Push", "Pull", "Mixed"].includes(current.value)
                                    ? current.value
                                    : label,
                              }
                            : current
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setNewDayEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveNewDayEditor}>Hinzufügen</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Exercise Editor */}
      {exerciseEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Übung</div>
                <div style={sheetTitle}>
                  {exerciseEditor.exerciseId ? "Übung bearbeiten" : "Übung hinzufügen"}
                </div>
              </div>
              <button style={closeButton} onClick={() => setExerciseEditor(null)}>×</button>
            </div>

            <div style={fieldGrid}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Übung</span>
                <div style={editorQuickGrid}>
                  {EXERCISE_LIBRARY_GROUPS.slice(0, 6).map((group) => {
                    const isActiveCategory = group.items.some(
                      (item) => item.value === exerciseEditor.name
                    );
                    return (
                      <button
                        key={group.category}
                        style={isActiveCategory ? wizardChoiceButtonActive : wizardChoiceButton}
                        onClick={() => {
                          const first = group.items[0]?.value;
                          if (!first) return;
                          applyExerciseEditorDefaults(first);
                        }}
                      >
                        {group.category}
                      </button>
                    );
                  })}
                </div>
                <select
                  style={textInput}
                  value={exerciseEditor.name}
                  onChange={(event) => applyExerciseEditorDefaults(event.target.value)}
                >
                  {EXERCISE_LIBRARY.map((exercise) => (
                    <option key={exercise.value} value={exercise.value}>
                      {exercise.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Sätze</span>
                <div style={editorQuickGridCompact}>
                  {[2, 3, 4, 5, 6].map((value) => (
                    <button
                      key={value}
                      style={
                        exerciseEditor.sets === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setExerciseEditor((current) =>
                          current ? { ...current, sets: String(value) } : current
                        )
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={exerciseEditor.sets}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, sets: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Min. Wdh</span>
                <div style={editorQuickGridCompact}>
                  {[
                    [5, 8],
                    [6, 10],
                    [8, 12],
                    [10, 15],
                  ].map(([min, max]) => (
                    <button
                      key={`${min}-${max}`}
                      style={
                        exerciseEditor.minReps === String(min) &&
                        exerciseEditor.maxReps === String(max)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setExerciseEditor((current) =>
                          current
                            ? { ...current, minReps: String(min), maxReps: String(max) }
                            : current
                        )
                      }
                    >
                      {min}–{max}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={exerciseEditor.minReps}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, minReps: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Max. Wdh</span>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={exerciseEditor.maxReps}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, maxReps: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Pause (Sekunden)</span>
                <div style={editorQuickGridCompact}>
                  {[60, 75, 90, 120, 150, 180].map((value) => (
                    <button
                      key={value}
                      style={
                        exerciseEditor.restSeconds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setExerciseEditor((current) =>
                          current ? { ...current, restSeconds: String(value) } : current
                        )
                      }
                    >
                      {formatRest(value)}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={exerciseEditor.restSeconds}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, restSeconds: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setExerciseEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveExerciseEditor}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Warmup Editor */}
      {warmupEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Aufwärmen</div>
                <div style={sheetTitle}>{warmupEditor.exerciseLabel}</div>
              </div>
              <button style={closeButton} onClick={() => setWarmupEditor(null)}>×</button>
            </div>

            <div style={fieldGrid}>
              <label style={fieldStack}>
                <span style={fieldLabel}>Aufwärmsätze</span>
                <div style={editorQuickGridCompact}>
                  {[0, 1, 3].map((value) => (
                    <button
                      key={value}
                      style={
                        warmupEditor.rounds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setWarmupEditor((current) =>
                          current ? { ...current, rounds: String(value) } : current
                        )
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={warmupEditor.rounds}
                  onChange={(event) =>
                    setWarmupEditor((current) =>
                      current ? { ...current, rounds: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Pause (Sek)</span>
                <div style={editorQuickGridCompact}>
                  {[45, 60, 75, 90].map((value) => (
                    <button
                      key={value}
                      style={
                        warmupEditor.restSeconds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setWarmupEditor((current) =>
                          current ? { ...current, restSeconds: String(value) } : current
                        )
                      }
                    >
                      {formatRest(value)}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={warmupEditor.restSeconds}
                  onChange={(event) =>
                    setWarmupEditor((current) =>
                      current ? { ...current, restSeconds: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>

            <div style={editorHint}>0 Aufwärmsätze blendet den Block aus.</div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setWarmupEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveWarmupEditor}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Stretch Editor */}
      {stretchEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Dehnen</div>
                <div style={sheetTitle}>
                  {stretchEditor.blockId ? "Dehnblock bearbeiten" : "Dehnblock hinzufügen"}
                </div>
              </div>
              <button style={closeButton} onClick={() => setStretchEditor(null)}>×</button>
            </div>

            <div style={fieldGrid}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Dehnung</span>
                <div style={editorQuickGrid}>
                  {STRETCH_LIBRARY_GROUPS.slice(0, 6).map((group) => {
                    const isActiveCategory = group.items.some(
                      (item) => item.value === stretchEditor.stretchId
                    );
                    return (
                      <button
                        key={group.category}
                        style={isActiveCategory ? wizardChoiceButtonActive : wizardChoiceButton}
                        onClick={() => {
                          const first = group.items[0]?.value;
                          if (!first) return;
                          setStretchEditor((current) =>
                            current ? { ...current, stretchId: first } : current
                          );
                        }}
                      >
                        {group.category}
                      </button>
                    );
                  })}
                </div>
                <select
                  style={textInput}
                  value={stretchEditor.stretchId}
                  onChange={(event) =>
                    setStretchEditor((current) =>
                      current ? { ...current, stretchId: event.target.value } : current
                    )
                  }
                >
                  {STRETCH_LIBRARY.map((stretch) => (
                    <option key={stretch.value} value={stretch.value}>
                      {stretch.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Halten (Sek)</span>
                <div style={editorQuickGridCompact}>
                  {[20, 30, 45, 60].map((value) => (
                    <button
                      key={value}
                      style={
                        stretchEditor.holdSeconds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setStretchEditor((current) =>
                          current ? { ...current, holdSeconds: String(value) } : current
                        )
                      }
                    >
                      {value} Sek
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={stretchEditor.holdSeconds}
                  onChange={(event) =>
                    setStretchEditor((current) =>
                      current ? { ...current, holdSeconds: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Runden</span>
                <div style={editorQuickGridCompact}>
                  {[1, 2, 3].map((value) => (
                    <button
                      key={value}
                      style={
                        stretchEditor.rounds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setStretchEditor((current) =>
                          current ? { ...current, rounds: String(value) } : current
                        )
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={stretchEditor.rounds}
                  onChange={(event) =>
                    setStretchEditor((current) =>
                      current ? { ...current, rounds: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setStretchEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveStretchEditor}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pause Editor */}
      {pauseEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Pause</div>
                <div style={sheetTitle}>
                  {pauseEditor.blockId ? "Pausenblock bearbeiten" : "Pausenblock hinzufügen"}
                </div>
              </div>
              <button style={closeButton} onClick={() => setPauseEditor(null)}>×</button>
            </div>

            <div style={fieldGrid}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Name</span>
                <input
                  style={textInput}
                  value={pauseEditor.label}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current ? { ...current, label: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Sekunden</span>
                <div style={editorQuickGridCompact}>
                  {[30, 45, 60, 90, 120, 180].map((value) => (
                    <button
                      key={value}
                      style={
                        pauseEditor.seconds === String(value)
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setPauseEditor((current) =>
                          current ? { ...current, seconds: String(value) } : current
                        )
                      }
                    >
                      {formatRest(value)}
                    </button>
                  ))}
                </div>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={pauseEditor.seconds}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current ? { ...current, seconds: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Typ</span>
                <div style={editorQuickGridCompact}>
                  {[
                    { value: "exercise", label: "Übungspause" },
                    { value: "workout", label: "Workout-Pause" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      style={
                        pauseEditor.scope === option.value
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setPauseEditor((current) =>
                          current
                            ? { ...current, scope: option.value as "exercise" | "workout" }
                            : current
                        )
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <select
                  style={textInput}
                  value={pauseEditor.scope}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current
                        ? { ...current, scope: event.target.value as "exercise" | "workout" }
                        : current
                    )
                  }
                >
                  <option value="exercise">Übungspause</option>
                  <option value="workout">Workout-Pause</option>
                </select>
              </label>
            </div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setPauseEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={savePauseEditor}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}

      {noteEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Notiz</div>
                <div style={sheetTitle}>
                  {noteEditor.blockId ? "Hinweis bearbeiten" : "Hinweis hinzufügen"}
                </div>
              </div>
              <button style={closeButton} onClick={() => setNoteEditor(null)}>×</button>
            </div>

            <div style={fieldGrid}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Titel</span>
                <input
                  style={textInput}
                  value={noteEditor.label}
                  onChange={(event) =>
                    setNoteEditor((current) =>
                      current ? { ...current, label: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Text</span>
                <textarea
                  style={{ ...textInput, minHeight: 132, resize: "vertical" as const }}
                  value={noteEditor.notes}
                  onChange={(event) =>
                    setNoteEditor((current) =>
                      current ? { ...current, notes: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setNoteEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveNoteEditor}>Speichern</button>
            </div>
          </div>
        </div>
      ) : null}

      {addBlockDayId ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Plan-Bausteine</div>
                <div style={sheetTitle}>Baustein hinzufügen</div>
              </div>
              <button
                style={closeButton}
                onClick={() => {
                  setAddBlockDayId(null);
                  setWarmupTargetDayId(null);
                }}
              >
                ×
              </button>
            </div>

            {warmupTargetDayId ? (
              <div style={addPickerList}>
                {(activePlan.days.find((day) => day.id === warmupTargetDayId)?.exercises ?? []).map(
                  (exercise) => (
                    <button
                      key={exercise.id}
                      style={addPickerOption}
                      onClick={() => {
                        setAddBlockDayId(null);
                        setWarmupTargetDayId(null);
                        openWarmupEditor(
                          warmupTargetDayId,
                          exercise.id,
                          getExerciseLabel(exercise.name),
                          1,
                          Math.max(45, Math.round(exercise.restSeconds / 2))
                        );
                      }}
                    >
                      <span style={addPickerEmoji}>🔥</span>
                      <span>
                        <div style={addPickerLabel}>{getExerciseLabel(exercise.name)}</div>
                        <div style={addPickerHint}>Warm-up für diese Übung anpassen</div>
                      </span>
                    </button>
                  )
                )}
              </div>
            ) : (
              <div style={addPickerList}>
                <button
                  style={addPickerOption}
                  onClick={() => {
                    setAddBlockDayId(null);
                    openAddExercise(addBlockDayId);
                  }}
                >
                  <span style={addPickerEmoji}>🏋️</span>
                  <span>
                    <div style={addPickerLabel}>Übung</div>
                    <div style={addPickerHint}>Name, Sätze, Wiederholungen und Pause</div>
                  </span>
                </button>

                <button
                  style={addPickerOption}
                  onClick={() => {
                    const hasExercises =
                      (activePlan.days.find((day) => day.id === addBlockDayId)?.exercises.length ?? 0) > 0;
                    if (!hasExercises) return;
                    setWarmupTargetDayId(addBlockDayId);
                  }}
                >
                  <span style={addPickerEmoji}>🔥</span>
                  <span>
                    <div style={addPickerLabel}>Warm-up</div>
                    <div style={addPickerHint}>Aufwärmen einer Übung festlegen</div>
                  </span>
                </button>

                <button
                  style={addPickerOption}
                  onClick={() => {
                    setAddBlockDayId(null);
                    openStretchEditor(addBlockDayId);
                  }}
                >
                  <span style={addPickerEmoji}>🧘</span>
                  <span>
                    <div style={addPickerLabel}>Dehnen</div>
                    <div style={addPickerHint}>Timer-Block mit Dauer und Runden</div>
                  </span>
                </button>

                <button
                  style={addPickerOption}
                  onClick={() => {
                    setAddBlockDayId(null);
                    openPauseEditor(addBlockDayId);
                  }}
                >
                  <span style={addPickerEmoji}>⏱️</span>
                  <span>
                    <div style={addPickerLabel}>Pause</div>
                    <div style={addPickerHint}>Einfache Übungs- oder Workout-Pause</div>
                  </span>
                </button>

                <button
                  style={addPickerOption}
                  onClick={() => {
                    setAddBlockDayId(null);
                    openNoteEditor(addBlockDayId);
                  }}
                >
                  <span style={addPickerEmoji}>📝</span>
                  <span>
                    <div style={addPickerLabel}>Notiz</div>
                    <div style={addPickerHint}>Hinweistext für diesen Trainingstag</div>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildExercisePreview(exercises: TrainingPlan["days"][number]["exercises"]) {
  const labels = exercises.map((exercise) => getExerciseLabel(exercise.name));
  const preview = labels.slice(0, 2).join(", ");
  const remaining = labels.length - 2;
  return remaining > 0 ? `${preview} +${remaining}` : preview;
}

function buildDayKicker(index: number, totalDays: number) {
  return `Tag ${index + 1} / ${totalDays}`;
}

function shadeColor(color: string) {
  const shades: Record<string, string> = {
    "#111827": "#1f2937",
    "#7c3aed": "#5b21b6",
    "#0891b2": "#0e7490",
    "#2563eb": "#1d4ed8",
    "#ea580c": "#c2410c",
    "#0f766e": "#115e59",
    "#dc2626": "#b91c1c",
    "#16a34a": "#15803d",
    "#f97316": "#ea580c",
    "#14b8a6": "#0f766e",
  };
  return shades[color] ?? color;
}

function formatRest(seconds: number) {
  if (seconds % 60 === 0) return `${seconds / 60} Min`;
  return `${seconds} Sek`;
}

function isExerciseBlock(block: TrainingPlanBlock): block is ExercisePlanBlock {
  return block.type === "exercise";
}

function getEditableExerciseForBlock(
  block: TrainingPlanBlock,
  exercises: TrainingPlan["days"][number]["exercises"]
) {
  if (!isExerciseBlock(block)) return null;
  return exercises.find((exercise) => exercise.id === block.exerciseId) ?? null;
}

function getBlockTitle(block: TrainingPlanBlock) {
  return block.label;
}

function getBlockMeta(block: TrainingPlanBlock) {
  if (block.type === "exercise") {
    return `${block.sets} × ${block.minReps}–${block.maxReps} · ${formatRest(block.restSeconds)}`;
  }
  if (block.type === "warmup") {
    return `${block.rounds} Aufwärmsätze · ${formatRest(block.restSeconds)}`;
  }
  if (block.type === "stretch") {
    return `${block.rounds} Runden · ${block.holdSeconds} Sek halten`;
  }
  if (block.type === "note") {
    const preview = block.notes.trim().replace(/\s+/g, " ");
    return preview.length > 72 ? `${preview.slice(0, 72)}…` : preview;
  }
  return `${formatRest(block.seconds)} · ${block.scope === "workout" ? "Workout-Pause" : "Übungspause"}`;
}

function getBlockBadgeLabel(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return "Übung";
  if (type === "warmup") return "Aufwärmen";
  if (type === "stretch") return "Dehnen";
  if (type === "note") return "Notiz";
  return "Pause";
}

function getBlockBadgeStyle(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return blockBadgeExercise;
  if (type === "warmup") return blockBadgeWarmup;
  if (type === "stretch") return blockBadgeStretch;
  if (type === "note") return blockBadgeNote;
  return blockBadgePause;
}

function getOverviewChipStyle(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return overviewChipExercise;
  if (type === "warmup") return overviewChipWarmup;
  if (type === "stretch") return overviewChipStretch;
  if (type === "note") return overviewChipNote;
  return overviewChipPause;
}

function getWizardTitle(step: NewPlanWizardState["step"]) {
  if (step === "name") return "Planname";
  if (step === "day") return "Tag";
  if (step === "exercise") return "Übung";
  if (step === "sets") return "Sätze";
  return "Pause";
}

function getWizardStepLabel(step: NewPlanWizardState["step"]) {
  if (step === "name") return "1 / 5";
  if (step === "day") return "2 / 5";
  if (step === "exercise") return "3 / 5";
  if (step === "sets") return "4 / 5";
  return "5 / 5";
}

function buildGuidedWizardExercise(wizard: NewPlanWizardState): GuidedPlanExercise {
  const suggested = getSuggestedExerciseSetup(wizard.exerciseName);
  return {
    name: wizard.exerciseName,
    sets: Math.max(1, Number(wizard.sets) || suggested.sets),
    minReps: suggested.minReps,
    maxReps: suggested.maxReps,
    restSeconds: Math.max(15, Number(wizard.restSeconds) || suggested.restSeconds),
  };
}

function getNextWizardDayName(existingDays: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter = letters[existingDays] ?? String(existingDays + 1);
  return `Tag ${letter}`;
}

// Styles

const screen = {
  height: "100dvh",
  display: "flex",
  justifyContent: "center",
  alignItems: "stretch",
  overflow: "hidden" as const,
  padding: "max(8px, env(safe-area-inset-top)) 10px calc(68px + env(safe-area-inset-bottom))",
  background:
    "linear-gradient(180deg, #111827 0px, #111827 56px, #dde6f5 56px, #f3f5f9 136px, #fbfbfd 100%)",
  fontFamily: "sans-serif",
  position: "relative" as const,
  boxSizing: "border-box" as const,
};

const shell = {
  maxWidth: 460,
  flex: 1,
  minHeight: 0,
  height: "100%",
  width: "100%",
  margin: "0 auto",
  padding: "8px 8px 8px",
  borderRadius: 30,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  overflow: "hidden" as const,
  boxSizing: "border-box" as const,
};

const topBar = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  width: "fit-content",
  padding: "7px 13px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 13,
  fontWeight: "bold",
};

const ghostAction = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "rgba(255,255,255,0.96)",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
};

const sectionTitle = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: "#64748b",
  fontWeight: "bold",
};

const activePlanBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 20,
  background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
  border: "1px solid #dfe8f3",
  marginBottom: 12,
  boxShadow: "0 12px 26px rgba(15, 23, 42, 0.05)",
};

const activePlanName = {
  fontSize: 15,
  fontWeight: "bold",
  color: "#111827",
  marginTop: 2,
};

const currentPlanCard = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  borderRadius: 18,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #e2e8f0",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05)",
  flexShrink: 0,
};

const currentPlanName = {
  marginTop: 2,
  fontSize: 17,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#111827",
};

const currentPlanMeta = {
  marginTop: 3,
  fontSize: 10,
  lineHeight: 1.25,
  color: "#64748b",
};

const currentPlanActions = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  flexShrink: 0,
};

const softActionButton = {
  minHeight: 38,
  padding: "9px 13px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const primaryActionButton = {
  minHeight: 36,
  padding: "7px 13px",
  borderRadius: 999,
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(15, 23, 42, 0.16)",
};

const dayGrid = {
  flex: 1,
  display: "grid",
  gap: 6,
  minHeight: 0,
  height: "100%",
  overflow: "hidden" as const,
  alignContent: "stretch" as const,
  paddingRight: 2,
  paddingBottom: 0,
};

const dayCard = {
  borderRadius: 28,
  color: "#fff",
  textDecoration: "none",
  padding: "10px 10px 9px",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  height: "100%",
  minHeight: 0,
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.16)",
};

const dayCardTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const dayBody = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  marginTop: "auto",
};

const dayKicker = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase" as const,
  opacity: 0.82,
  maxWidth: "70%",
  whiteSpace: "nowrap" as const,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
};

const dayStartBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 800,
  backdropFilter: "blur(10px)",
};

const dayTitle = {
  fontSize: 20,
  lineHeight: 0.95,
  fontWeight: 800,
};

const dayCopy = {
  fontSize: 10,
  lineHeight: 1.2,
  fontWeight: 600,
  opacity: 0.92,
};

const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.18) 0%, rgba(15, 23, 42, 0.42) 100%)",
  display: "flex",
  alignItems: "flex-end" as const,
  justifyContent: "center",
  zIndex: 50,
  padding: "0 0 env(safe-area-inset-bottom) 0",
};

const sheet = {
  width: "100%",
  maxWidth: 460,
  maxHeight: "80dvh",
  overflowY: "auto" as const,
  padding: "16px 14px calc(20px + env(safe-area-inset-bottom))",
  borderRadius: "30px 30px 0 0" as const,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #dce5f1",
  borderBottom: "none",
  boxShadow: "0 -20px 60px rgba(15, 23, 42, 0.16)",
};

const planDetailSheet = {
  ...sheet,
  maxHeight: "80dvh",
  display: "flex",
  flexDirection: "column" as const,
  padding: "16px 0 0 0",
  gap: 0,
};

const editorSheet = {
  ...sheet,
  maxWidth: 460,
  paddingBottom: "calc(22px + env(safe-area-inset-bottom))",
};

const sheetHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
  marginBottom: 12,
  padding: "0 4px",
};

const sheetHeaderActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const sheetTitle = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.05,
  color: "#111827",
};

const closeButton = {
  minHeight: 38,
  minWidth: 38,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f8fafc",
  color: "#111827",
  fontSize: 14,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
};

const plusButton = {
  minWidth: 38,
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ef4444",
  color: "#ffffff",
  fontSize: 20,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(239, 68, 68, 0.24)",
};

const planList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const planListCard = {
  borderRadius: 22,
  border: "1.5px solid #e5ebf4",
  background: "#ffffff",
  overflow: "hidden" as const,
  display: "flex",
  alignItems: "stretch",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
};

const planListCardActive = {
  background: "#f8fbff",
  boxShadow: "0 16px 32px rgba(37, 99, 235, 0.12)",
};

const planListMain = {
  flex: 1,
  padding: "16px 16px",
  textAlign: "left" as const,
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const planListHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const planListName = {
  fontSize: 17,
  fontWeight: 800,
  color: "#111827",
  lineHeight: 1.1,
};

const planListBadges = {
  display: "flex",
  gap: 5,
  flexShrink: 0,
};

const activeBadgePill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "3px 8px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 11,
  fontWeight: "bold",
};

const planDayList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 7,
};

const planDayRow = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const planDayDot = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const planDayLabel = {
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
  minWidth: 44,
};

const planDayExercises = {
  fontSize: 12,
  color: "#6b7280",
  flex: 1,
  lineHeight: 1.35,
  whiteSpace: "normal" as const,
  overflow: "hidden" as const,
};

const planCardActionRow = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  flexWrap: "wrap" as const,
};

const planActionButton = {
  minHeight: 36,
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const activePlanActionButton = {
  ...planActionButton,
  background: "#111827",
  color: "#ffffff",
  border: "1px solid #111827",
};

const planSecondaryActionButton = {
  ...planActionButton,
  color: "#475569",
};

const planDetailMetaBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px 14px",
  borderBottom: "1px solid #edf2f7",
  flexWrap: "wrap" as const,
};

const dayTabsRow = {
  display: "flex",
  gap: 8,
  overflowX: "auto" as const,
  flexShrink: 0,
  flex: 1,
};

const dayTabsWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 16px",
  borderBottom: "1px solid #edf2f7",
};

const addSplitButton = {
  minHeight: 38,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1.5px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
};

const activeDayActions = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px 0",
  flexWrap: "wrap" as const,
};

const activeDayLabel = {
  fontSize: 13,
  fontWeight: 700,
  color: "#64748b",
};

const activeDayActionRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};

const dayOverviewCard = {
  margin: "10px 16px 0",
  padding: "14px",
  borderRadius: 22,
  background: "#ffffff",
  border: "1px solid #e7edf6",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.04)",
  display: "grid",
  gap: 12,
};

const dayOverviewTop = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const dayOverviewTitle = {
  fontSize: 16,
  fontWeight: 800,
  color: "#111827",
};

const dayOverviewMeta = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
  fontWeight: 700,
};

const overviewPrimaryButton = {
  minHeight: 38,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#111827",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
};

const dayOverviewChips = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const overviewChipBase = {
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const overviewChipExercise = {
  ...overviewChipBase,
  background: "#eef4ff",
  color: "#2563eb",
};

const overviewChipWarmup = {
  ...overviewChipBase,
  background: "#fff7ed",
  color: "#ea580c",
};

const overviewChipStretch = {
  ...overviewChipBase,
  background: "#ecfeff",
  color: "#0f766e",
};

const overviewChipPause = {
  ...overviewChipBase,
  background: "#f3f4f6",
  color: "#475569",
};

const overviewChipNote = {
  ...overviewChipBase,
  background: "#eef2ff",
  color: "#4338ca",
};

const dayOverviewMoreChip = {
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const dayTab = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 38,
  padding: "8px 15px",
  borderRadius: 999,
  border: "1.5px solid #d7e1ef",
  background: "#f8fafc",
  color: "#374151",
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
};

const dayTabActive = {
  background: "#fff",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
};

const tabEditIcon = {
  fontSize: 12,
  opacity: 0.5,
  cursor: "pointer",
};

const planBlockList = {
  flex: 1,
  overflowY: "auto" as const,
  padding: "10px 16px 14px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  minHeight: 0,
};

const planBlockRow = {
  display: "grid",
  gap: 10,
  padding: "14px 14px",
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e7edf6",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.04)",
};

const planBlockMain = {
  flex: 1,
  background: "none",
  border: "none",
  textAlign: "left" as const,
  cursor: "pointer",
  padding: 0,
  display: "flex",
  flexDirection: "column" as const,
  gap: 3,
};

const planBlockNameRow = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap" as const,
};

const planBlockName = {
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
};

const planBlockMeta = {
  fontSize: 13,
  color: "#64748b",
};

const planBlockActions = {
  display: "flex",
  justifyContent: "flex-end",
  flexWrap: "wrap" as const,
  gap: 6,
};

const planBlockIcon = {
  minHeight: 34,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#374151",
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
};

const emptyDayHint = {
  fontSize: 13,
  color: "#94a3b8",
  textAlign: "center" as const,
  padding: "20px 0",
};

const quickAddDock = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  padding: "12px 16px calc(20px + env(safe-area-inset-bottom))",
  borderTop: "1px solid #edf2f7",
  flexShrink: 0,
};

const quickAddButton = {
  minHeight: 50,
  borderRadius: 18,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
};

const addBlockButton = {
  ...quickAddButton,
  gridColumn: "1 / -1",
  border: "1.5px dashed #bfd0e6",
  background: "#f0f6ff",
  color: "#1d4ed8",
};

const addPickerList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  marginTop: 6,
};

const addPickerOption = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "18px 18px",
  borderRadius: 22,
  border: "1px solid #e5ebf4",
  background: "#ffffff",
  cursor: "pointer",
  textAlign: "left" as const,
  width: "100%",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const addPickerEmoji = {
  fontSize: 28,
  flexShrink: 0,
};

const addPickerLabel = {
  fontSize: 16,
  fontWeight: "bold",
  color: "#111827",
};

const addPickerHint = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 2,
};

const selectButton = {
  minHeight: 56,
  padding: "13px 16px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  width: "100%",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
};

const activeSelectButton = {
  ...selectButton,
  background: "#111827",
  color: "#ffffff",
  border: "1px solid #111827",
  boxShadow: "0 14px 28px rgba(17, 24, 39, 0.18)",
};

const templateBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const customBadge = {
  ...templateBadge,
  background: "#ecfdf3",
  color: "#15803d",
};

const miniActionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const miniActionButton = {
  minHeight: 32,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerMiniButton = {
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#be123c",
};

const blockBadgeBase = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  minHeight: 20,
  padding: "2px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const blockBadgeExercise = { ...blockBadgeBase, background: "#eef4ff", color: "#1d4ed8" };
const blockBadgeWarmup = { ...blockBadgeBase, background: "#fff7ed", color: "#c2410c" };
const blockBadgeStretch = { ...blockBadgeBase, background: "#ecfeff", color: "#0f766e" };
const blockBadgePause = { ...blockBadgeBase, background: "#f3f4f6", color: "#374151" };
const blockBadgeNote = { ...blockBadgeBase, background: "#eef2ff", color: "#4338ca" };

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
};

const fieldStack = {
  display: "grid",
  gap: 10,
  padding: "0 14px",
};

const fieldLabel = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#475569",
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const editorQuickGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const editorQuickGridCompact = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const textInput = {
  width: "100%",
  minHeight: 56,
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 16,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.03)",
};

const editorActions = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 18,
  padding: "0 14px",
};

const wizardStepBar = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap" as const,
  padding: "0 14px",
  marginBottom: 16,
};

const wizardStepChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 9px",
  borderRadius: 999,
  background: "#111827",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: "bold",
};

const wizardMeta = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 9px",
  borderRadius: 999,
  background: "#eef4ff",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: "bold",
};

const wizardPreviewList = {
  display: "grid",
  gap: 12,
  padding: "0 14px",
  marginBottom: 16,
};

const wizardPreviewItem = {
  display: "grid",
  gap: 4,
  padding: "14px 16px",
  borderRadius: 18,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e5ebf4",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.04)",
};

const wizardPreviewName = {
  fontSize: 14,
  fontWeight: "bold",
  color: "#111827",
};

const wizardPreviewMeta = {
  fontSize: 12,
  color: "#64748b",
};

const wizardChoiceGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  padding: "0 14px",
};

const wizardChoiceGridCompact = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const wizardExerciseQuickList = {
  display: "grid",
  gap: 10,
};

const wizardExerciseQuickCard = {
  minHeight: 58,
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 16,
  fontWeight: 700,
  textAlign: "left" as const,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.04)",
};

const wizardExerciseQuickCardActive = {
  ...wizardExerciseQuickCard,
  border: "1px solid #111827",
  background: "#f8fafc",
};

const wizardChoiceButton = {
  minHeight: 58,
  borderRadius: 20,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.04)",
};

const wizardChoiceButtonActive = {
  ...wizardChoiceButton,
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
};

const wizardFinalActions = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  gridColumn: "1 / -1",
};

const wizardSecondaryActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  gridColumn: "1 / -1",
};

const wizardReadyCard = {
  display: "grid",
  gap: 4,
  margin: "14px 14px 0",
  padding: "14px 16px",
  borderRadius: 18,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e5ebf4",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.04)",
};

const wizardReadyTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const wizardReadyMeta = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 700,
};

const wizardOutcomeButton = {
  display: "grid",
  gap: 4,
  minHeight: 74,
  padding: "14px 16px",
  borderRadius: 20,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  textAlign: "left" as const,
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
  cursor: "pointer",
};

const wizardPrimaryOutcomeButton = {
  ...wizardOutcomeButton,
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  boxShadow: "0 14px 28px rgba(17, 24, 39, 0.18)",
};

const wizardOutcomeTitle = {
  fontSize: 18,
  fontWeight: 800,
};

const wizardOutcomeMeta = {
  fontSize: 13,
  lineHeight: 1.35,
  opacity: 0.82,
};

const editorHint = {
  marginTop: 10,
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.4,
};

function getPlanCardText(plan: TrainingPlan) {
  const preview = getPlanPreview(plan);
  if (!plan.description || preview === plan.description) return preview;
  if (preview.includes(plan.description) || plan.description.includes(preview)) {
    return preview.length <= plan.description.length ? preview : plan.description;
  }
  return plan.description;
}


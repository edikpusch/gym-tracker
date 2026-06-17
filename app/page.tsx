"use client";

import { useEffect, useState } from "react";

import { getActiveWorkoutState, type ActiveWorkoutState } from "@/lib/activeWorkout";
import { getAppPreferences, type MenuSide } from "@/lib/appPreferences";
import {
  getFavoriteExerciseIds,
  isExerciseFavorite,
  setExerciseFavorite,
} from "@/lib/exerciseFavorites";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PlanAccordionCard } from "@/components/PlanAccordionCard";
import { PlanBuilder } from "@/components/PlanBuilder";
import { SideMenu } from "@/components/SideMenu";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { TextPromptDialog } from "@/components/ui/TextPromptDialog";
import { getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import type { ExercisePlanBlock, TrainingPlanBlock } from "@/lib/trainingModel";
import {
  addTrainingExercise,
  addTrainingDay,
  addNoteBlock,
  addPauseBlock,
  addStretchBlock,
  addWarmupBlock,
  createTrainingPlan,
  deleteTrainingPlan,
  getDayBlocks,
  duplicateTrainingPlan,
  getActivePlanId,
  getAllTrainingPlans,
  moveDayBlock,
  moveDayBlockRelative,
  getRecentPlanExerciseRefs,
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
  getExerciseLibrary,
  getExerciseLibraryGroups,
  getExerciseLabel,
  STRETCH_LIBRARY_GROUPS,
  STRETCH_LIBRARY,
} from "@/lib/workoutUi";
import {
  appChromeBackground,
  appPalette,
  splitThemes,
  withAlpha,
} from "@/lib/theme";

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
  blockId?: string;
  insertAfterBlockId?: string | null;
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

type AddBlockContextState = {
  dayId: string;
  insertAfterBlockId?: string | null;
};

type NewPlanWizardState = {
  step: "name" | "day";
  planName: string;
  dayName: string;
  daySlot: "push" | "pull" | "mixed";
};

type RenamePlanState = {
  planId: string;
  value: string;
};

type RemoveExerciseState = {
  dayId: string;
  exerciseId: string;
};

type RemoveBlockState = {
  dayId: string;
  blockId: string;
};

type HomeInitialState = {
  activePlan: TrainingPlan;
  activeWorkoutState: ActiveWorkoutState | null;
  availablePlans: TrainingPlan[];
  menuSide: MenuSide;
  showPlanDetail: boolean;
  showPlanPicker: boolean;
  activeDayTab: string | null;
};

function getInitialHomeState(): HomeInitialState {
  const fallbackPlan = getTrainingPlan(getActivePlanId());
  const searchParams =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search);
  const sheet = searchParams?.get("sheet") ?? null;
  const requestedPlanId = searchParams?.get("plan") ?? null;
  const requestedDayId = searchParams?.get("day") ?? null;
  const activePlan = requestedPlanId
    ? getTrainingPlan(requestedPlanId)
    : fallbackPlan;
  const requestedDayExists = requestedDayId
    ? activePlan.days.some((day) => day.id === requestedDayId)
    : false;

  return {
    activePlan,
    activeWorkoutState: getActiveWorkoutState(),
    availablePlans: getAllTrainingPlans(),
    menuSide: getAppPreferences().menuSide,
    showPlanDetail: sheet === "exercises",
    showPlanPicker: sheet === "plans",
    activeDayTab:
      sheet === "exercises"
        ? requestedDayExists
          ? requestedDayId
          : activePlan.days[0]?.id ?? null
        : null,
  };
}

export default function Home() {
  const exerciseLibrary = getExerciseLibrary();
  const exerciseLibraryGroups = getExerciseLibraryGroups();
  const favoriteExerciseIds = getFavoriteExerciseIds();
  const favoriteExercises = exerciseLibrary.filter((exercise) =>
    favoriteExerciseIds.includes(exercise.value)
  );
  const recentPlanExercises = getRecentPlanExerciseRefs(6)
    .map((reference) => exerciseLibrary.find((exercise) => exercise.value === reference))
    .filter((exercise): exercise is NonNullable<(typeof exerciseLibrary)[number]> => Boolean(exercise));
  const [initialHomeState] = useState(getInitialHomeState);
  const [availablePlans, setAvailablePlans] = useState<TrainingPlan[]>(
    initialHomeState.availablePlans
  );
  const [activePlan, setActivePlan] = useState<TrainingPlan>(initialHomeState.activePlan);
  const [showPlanPicker, setShowPlanPicker] = useState(initialHomeState.showPlanPicker);
  const [showPlanDetail, setShowPlanDetail] = useState(initialHomeState.showPlanDetail);
  const [activeWorkoutState, setActiveWorkoutState] = useState<ActiveWorkoutState | null>(
    initialHomeState.activeWorkoutState
  );
  const [activeDayTab, setActiveDayTab] = useState<string | null>(initialHomeState.activeDayTab);
  const [newPlanWizard, setNewPlanWizard] = useState<NewPlanWizardState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSide] = useState<MenuSide>(initialHomeState.menuSide);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [deleteCandidatePlan, setDeleteCandidatePlan] = useState<TrainingPlan | null>(null);
  const [renamePlanState, setRenamePlanState] = useState<RenamePlanState | null>(null);
  const [removeExerciseState, setRemoveExerciseState] = useState<RemoveExerciseState | null>(null);
  const [removeBlockState, setRemoveBlockState] = useState<RemoveBlockState | null>(null);

  const [dayEditor, setDayEditor] = useState<DayEditorState | null>(null);
  const [newDayEditor, setNewDayEditor] = useState<NewDayState | null>(null);
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditorState | null>(null);
  const [warmupEditor, setWarmupEditor] = useState<WarmupEditorState | null>(null);
  const [stretchEditor, setStretchEditor] = useState<StretchEditorState | null>(null);
  const [pauseEditor, setPauseEditor] = useState<PauseEditorState | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);
  const [addBlockContext, setAddBlockContext] = useState<AddBlockContextState | null>(null);
  const [warmupTargetDayId, setWarmupTargetDayId] = useState<string | null>(null);

  function refreshPlans(nextActivePlanId?: string) {
    const plans = getAllTrainingPlans();
    const resolvedPlan = getTrainingPlan(nextActivePlanId || getActivePlanId());
    setAvailablePlans(plans);
    setActivePlan(resolvedPlan);
  }

  function openPlanDetail() {
    refreshPlans();
    const plan = getTrainingPlan(getActivePlanId());
    setActiveDayTab(plan.days[0]?.id ?? null);
    setMenuOpen(false);
    setShowPlanDetail(true);
  }

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

  function openPlanPicker() {
    refreshPlans();
    setMenuOpen(false);
    setExpandedPlanId(null);
    setShowPlanPicker(true);
  }

  function openNewPlanWizard() {
    setNewPlanWizard({
      step: "name",
      planName: "",
      dayName: "Tag A",
      daySlot: "push",
    });
  }

  function closeNewPlanWizard() {
    setNewPlanWizard(null);
  }

  function continueNewPlanWizard() {
    if (!newPlanWizard) return;

    if (newPlanWizard.step === "name") {
      if (!newPlanWizard.planName.trim()) return;
      setNewPlanWizard({ ...newPlanWizard, step: "day" });
      return;
    }

    if (newPlanWizard.step === "day") {
      finishNewPlanWizard();
    }
  }

  function selectWizardDayPreset(dayName: string, slot?: "push" | "pull" | "mixed") {
    setNewPlanWizard((current) =>
      current
        ? {
            ...current,
            dayName,
            daySlot: slot ?? deriveSlotFromDayName(dayName),
          }
        : current
    );
  }

  function goBackNewPlanWizard() {
    if (!newPlanWizard) return;

    if (newPlanWizard.step === "day") {
      setNewPlanWizard({ ...newPlanWizard, step: "name" });
    }
  }

  function finishNewPlanWizard() {
    if (!newPlanWizard) return;

    const created = createTrainingPlan({
      name: newPlanWizard.planName,
      days: [
        {
          name: newPlanWizard.dayName.trim(),
          slot: newPlanWizard.daySlot,
          exercises: [],
        },
      ],
    });

    if (!created) return;
    setActivePlanId(created.id);
    refreshPlans(created.id);
    setShowPlanPicker(false);
    setActiveDayTab(created.days[0]?.id ?? null);
    setShowPlanDetail(true);
    setNewPlanWizard(null);
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
    const current = renamePlanState ?? {
      planId,
      value: getTrainingPlan(planId).name,
    };
    const nextName = current.value.trim();
    if (!nextName) return;

    const renamed = renameTrainingPlan(current.planId, nextName);
    if (!renamed) return;
    setRenamePlanState(null);
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
    setExerciseEditor({
      dayId,
      name: "",
      sets: "3",
      minReps: "8",
      maxReps: "12",
      restSeconds: "90",
    });
  }

  function openAddExerciseWithName(dayId: string, exerciseName: string) {
    const resolvedName = resolveExerciseNameInput(exerciseName);
    const suggested = getSuggestedExerciseSetup(resolvedName);
    setExerciseEditor({
      dayId,
      name: exerciseName,
      sets: String(suggested.sets),
      minReps: String(suggested.minReps),
      maxReps: String(suggested.maxReps),
      restSeconds: String(suggested.restSeconds),
    });
  }

  function openEditExercise(dayId: string, exercise: TrainingExercise) {
    setExerciseEditor({
      dayId,
      exerciseId: exercise.id,
      name: getExerciseLabel(exercise.name),
      sets: String(exercise.sets),
      minReps: String(exercise.minReps),
      maxReps: String(exercise.maxReps),
      restSeconds: String(exercise.restSeconds),
    });
  }

  function saveExerciseEditor() {
    if (!exerciseEditor) return;
    const resolvedName = resolveExerciseNameInput(exerciseEditor.name);
    if (!resolvedName) return;

    const draft = {
      name: resolvedName,
      sets: Number(exerciseEditor.sets),
      minReps: Number(exerciseEditor.minReps),
      maxReps: Number(exerciseEditor.maxReps),
      restSeconds: Number(exerciseEditor.restSeconds),
    };

    const updated = exerciseEditor.exerciseId
      ? updateTrainingExercise(activePlan.id, exerciseEditor.dayId, exerciseEditor.exerciseId, draft)
      : addTrainingExercise(
          activePlan.id,
          exerciseEditor.dayId,
          draft,
          addBlockContext?.dayId === exerciseEditor.dayId
            ? addBlockContext.insertAfterBlockId ?? null
            : null
        );

    if (!updated) return;
    setExerciseEditor(null);
    setAddBlockContext(null);
    refreshPlans(updated.id);
  }

  function applyExerciseEditorDefaults(exerciseName: string) {
    const resolvedName = resolveExerciseNameInput(exerciseName);
    const suggested = getSuggestedExerciseSetup(resolvedName);
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

  function toggleExerciseEditorFavorite() {
    if (!exerciseEditor) return;

    const resolvedName = resolveExerciseNameInput(exerciseEditor.name);
    const fallbackName = exerciseEditor.name.trim();
    const targetValue = resolvedName || fallbackName;
    if (!targetValue) return;

    const nextFavorite = !isExerciseFavorite(targetValue);
    const reference = setExerciseFavorite(targetValue, nextFavorite, {
      sets: Number(exerciseEditor.sets) || 3,
      minReps: Number(exerciseEditor.minReps) || 8,
      maxReps: Number(exerciseEditor.maxReps) || 12,
      restSeconds: Number(exerciseEditor.restSeconds) || 90,
    });

    if (!reference) return;

    setExerciseEditor((current) =>
      current
        ? {
            ...current,
            name: getExerciseLabel(reference),
          }
        : current
    );
  }

  function handleRemoveExercise(dayId: string, exerciseId: string) {
    const updated = removeTrainingExercise(activePlan.id, dayId, exerciseId);
    if (!updated) return;
    setRemoveExerciseState(null);
    refreshPlans(updated.id);
  }

  function openWarmupEditor(
    dayId: string,
    exerciseId: string,
    exerciseLabel: string,
    rounds: number,
    restSeconds: number,
    blockId?: string,
    insertAfterBlockId?: string | null
  ) {
    setWarmupEditor({
      dayId,
      exerciseId,
      exerciseLabel,
      blockId,
      insertAfterBlockId,
      rounds: String(rounds),
      restSeconds: String(restSeconds),
    });
  }

  function saveWarmupEditor() {
    if (!warmupEditor) return;
    const draft = {
      rounds: Number(warmupEditor.rounds),
      restSeconds: Number(warmupEditor.restSeconds),
    };
    const updated = warmupEditor.blockId
      ? updateWarmupBlock(activePlan.id, warmupEditor.dayId, warmupEditor.exerciseId, draft)
      : addWarmupBlock(
          activePlan.id,
          warmupEditor.dayId,
          {
            exerciseId: warmupEditor.exerciseId,
            ...draft,
          },
          warmupEditor.insertAfterBlockId ?? null
        );
    if (!updated) return;
    setWarmupEditor(null);
    setAddBlockContext(null);
    setWarmupTargetDayId(null);
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
      : addStretchBlock(
          activePlan.id,
          stretchEditor.dayId,
          draft,
          addBlockContext?.dayId === stretchEditor.dayId
            ? addBlockContext.insertAfterBlockId ?? null
            : null
        );

    if (!updated) return;
    setStretchEditor(null);
    setAddBlockContext(null);
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
      : addPauseBlock(
          activePlan.id,
          pauseEditor.dayId,
          draft,
          addBlockContext?.dayId === pauseEditor.dayId
            ? addBlockContext.insertAfterBlockId ?? null
            : null
        );

    if (!updated) return;
    setPauseEditor(null);
    setAddBlockContext(null);
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
      : addNoteBlock(
          activePlan.id,
          noteEditor.dayId,
          draft,
          addBlockContext?.dayId === noteEditor.dayId
            ? addBlockContext.insertAfterBlockId ?? null
            : null
        );

    if (!updated) return;
    setNoteEditor(null);
    setAddBlockContext(null);
    refreshPlans(updated.id);
  }

  function openAddBlockSheet(dayId: string, insertAfterBlockId?: string | null) {
    setAddBlockContext({ dayId, insertAfterBlockId: insertAfterBlockId ?? null });
    setWarmupTargetDayId(null);
  }

  function handleRemoveBlock(dayId: string, blockId: string) {
    const updated = removeDayBlock(activePlan.id, dayId, blockId);
    if (!updated) return;
    setRemoveBlockState(null);
    refreshPlans(updated.id);
  }

  function handleMoveBlock(dayId: string, blockId: string, direction: "up" | "down") {
    const updated = moveDayBlock(activePlan.id, dayId, blockId, direction);
    if (!updated) return;
    refreshPlans(updated.id);
  }

  function handleReorderBlock(
    dayId: string,
    blockId: string,
    targetBlockId: string,
    position: "before" | "after"
  ) {
    const updated = moveDayBlockRelative(
      activePlan.id,
      dayId,
      blockId,
      targetBlockId,
      position
    );
    if (!updated) return;
    refreshPlans(updated.id);
  }

  const exerciseEditorFavoriteActive = exerciseEditor
    ? isExerciseFavorite(
        resolveExerciseNameInput(exerciseEditor.name) || exerciseEditor.name
      )
    : false;

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
    Boolean(addBlockContext) ||
    Boolean(warmupTargetDayId);
  const menuItems = [
    { key: "training", section: "Training", label: "Training", icon: "🏋️", active: true, onClick: () => setMenuOpen(false) },
    { key: "plans", section: "Training", label: "Pläne", icon: "📋", onClick: openPlanPicker },
    { key: "exercises", section: "Training", label: "Übungen", icon: "💪", onClick: openPlanDetail },
    { key: "history", section: "Analyse", label: "Verlauf", icon: "🕘", href: "/history/index.html" },
    { key: "stats", section: "Analyse", label: "Statistiken", icon: "◔", href: "/statistics/index.html" },
    { key: "progress", section: "Analyse", label: "Fortschritte", icon: "📈", href: "/progress/index.html" },
    { key: "weight", section: "Analyse", label: "Gewicht", icon: "⚖️", href: "/weight/index.html" },
    { key: "settings", section: "System", label: "Einstellungen", icon: "⚙️", href: "/settings/index.html" },
    { key: "support", section: "System", label: "Hilfe & Support", icon: "❔", href: "/support/index.html" },
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
          <AppCard variant="default" style={currentPlanCard}>
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
              <AppButton
                href={activeWorkoutState.href}
                variant="primary"
                size="compact"
                style={primaryActionButton}
              >
                Fortsetzen
              </AppButton>
            </div>
          </AppCard>
        ) : null}

        <div
          style={{
            ...dayGrid,
            gridTemplateRows: `repeat(${Math.max(activePlan.days.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {activePlan.days.map((day, index) => (
            <a key={day.id} href={slotHref[day.slot]} style={dayCardLink}>
              <AppCard
                interactive
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
              </AppCard>
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
                <AppButton variant="danger" size="compact" style={sheetPlusButton} onClick={openNewPlanWizard}>
                  +
                </AppButton>
                <AppButton
                  variant="secondary"
                  size="compact"
                  style={sheetCloseButton}
                  onClick={() => setShowPlanPicker(false)}
                >
                  ×
                </AppButton>
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

      <ConfirmDeleteDialog
        open={Boolean(removeExerciseState)}
        title="Übung löschen?"
        body="Möchtest du diese Übung wirklich aus dem Plan entfernen?"
        onCancel={() => setRemoveExerciseState(null)}
        onConfirm={() =>
          removeExerciseState &&
          handleRemoveExercise(removeExerciseState.dayId, removeExerciseState.exerciseId)
        }
      />

      <ConfirmDeleteDialog
        open={Boolean(removeBlockState)}
        title="Block löschen?"
        body="Möchtest du diesen Block wirklich aus dem Plan entfernen?"
        onCancel={() => setRemoveBlockState(null)}
        onConfirm={() =>
          removeBlockState &&
          handleRemoveBlock(removeBlockState.dayId, removeBlockState.blockId)
        }
      />

      <TextPromptDialog
        open={Boolean(renamePlanState)}
        title="Plan umbenennen"
        label="Planname"
        value={renamePlanState?.value ?? ""}
        confirmLabel="Speichern"
        cancelLabel="Abbrechen"
        confirmDisabled={!renamePlanState?.value.trim()}
        onChange={(value) =>
          setRenamePlanState((current) =>
            current
              ? {
                  ...current,
                  value,
                }
              : current
          )
        }
        onCancel={() => setRenamePlanState(null)}
        onConfirm={() => renamePlanState && handleRenamePlan(renamePlanState.planId)}
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
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setShowPlanDetail(false)}
              >
                ×
              </AppButton>
            </div>

            <div style={planDetailMetaBar}>
              <span style={canEditActivePlan ? customBadge : templateBadge}>
                {canEditActivePlan ? "Eigen" : "Vorlage"}
              </span>
              <div style={miniActionRow}>
                {canEditActivePlan ? (
                  <>
                    <AppButton
                      variant="secondary"
                      size="compact"
                      style={miniActionButton}
                      onClick={() =>
                        setRenamePlanState({
                          planId: activePlan.id,
                          value: activePlan.name,
                        })
                      }
                    >
                      Umbenennen
                    </AppButton>
                    <button
                      style={{ ...miniActionButton, ...dangerMiniButton }}
                      onClick={() => requestDeletePlan(activePlan.id)}
                    >
                      Löschen
                    </button>
                  </>
                ) : (
                  <AppButton variant="secondary" size="compact" style={miniActionButton} onClick={() => handleDuplicatePlan(activePlan.id)}>
                    Als Kopie
                  </AppButton>
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

            {activePlanDay ? (
              <PlanBuilder
                dayName={activePlanDay?.name ?? "Tag"}
                dayBlocks={activeDayBlocks}
                canEdit={canEditActivePlan}
                onEditDay={() => openDayEditor(activePlanDay.id, activePlanDay.name)}
                onAddBlock={() => activeDayTab && openAddBlockSheet(activeDayTab)}
                onAddAfterBlock={(block) => {
                  if (!activePlanDay) return;
                  openAddBlockSheet(activePlanDay.id, block.id);
                }}
                onMoveBlock={(block, direction) =>
                  activePlanDay && handleMoveBlock(activePlanDay.id, block.id, direction)
                }
                onReorderBlock={(block, targetBlock, position) =>
                  activePlanDay &&
                  handleReorderBlock(activePlanDay.id, block.id, targetBlock.id, position)
                }
                onDeleteBlock={(block) => {
                  if (!activePlanDay) return;
                  const editableExercise = getEditableExerciseForBlock(block, activePlanDay.exercises);
                  if (editableExercise) {
                    setRemoveExerciseState({
                      dayId: activePlanDay.id,
                      exerciseId: editableExercise.id,
                    });
                    return;
                  }
                  setRemoveBlockState({
                    dayId: activePlanDay.id,
                    blockId: block.id,
                  });
                }}
                onEditBlock={(block) => {
                  if (!activePlanDay) return;
                  const editableExercise = getEditableExerciseForBlock(block, activePlanDay.exercises);
                  const warmupExercise =
                    block.type === "warmup"
                      ? activePlanDay.exercises.find((exercise) => exercise.id === block.parentExerciseId) ?? null
                      : null;

                  if (editableExercise) {
                    openEditExercise(activePlanDay.id, editableExercise);
                    return;
                  }

                  if (block.type === "warmup" && warmupExercise) {
                    openWarmupEditor(
                      activePlanDay.id,
                      warmupExercise.id,
                      getExerciseLabel(warmupExercise.name),
                      block.rounds,
                      block.restSeconds,
                      block.id
                    );
                    return;
                  }

                  if (block.type === "stretch") {
                    openStretchEditor(activePlanDay.id, block.stretchId, block.holdSeconds, block.rounds, block.id);
                    return;
                  }

                  if (block.type === "pause") {
                    openPauseEditor(activePlanDay.id, block.label, block.seconds, block.scope, block.id);
                    return;
                  }

                  if (block.type === "note") {
                    openNoteEditor(activePlanDay.id, block.label, block.notes, block.id);
                  }
                }}
              />
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
              <AppButton variant="secondary" size="compact" style={sheetCloseButton} onClick={closeNewPlanWizard}>
                ×
              </AppButton>
            </div>

            <div style={wizardStepBar}>
              <span style={wizardStepChip}>{getWizardStepLabel(newPlanWizard.step)}</span>
              <span style={wizardMeta}>Direkt danach im visuellen Builder</span>
            </div>

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
                  {[
                    { value: "Tag A", slot: "push" as const },
                    { value: "Tag B", slot: "pull" as const },
                    { value: "Tag C", slot: "mixed" as const },
                  ].map((option) => (
                    <button
                      key={option.value}
                      style={
                        newPlanWizard.dayName === option.value
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() => selectWizardDayPreset(option.value, option.slot)}
                    >
                      {option.value}
                    </button>
                  ))}
                </div>
                <div style={sectionTitle}>Split</div>
                <div style={wizardChoiceGridCompact}>
                  {[
                    { value: "push", label: "Push" },
                    { value: "pull", label: "Pull" },
                    { value: "mixed", label: "Mixed" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      style={
                        newPlanWizard.daySlot === option.value
                          ? wizardChoiceButtonActive
                          : wizardChoiceButton
                      }
                      onClick={() =>
                        setNewPlanWizard((current) =>
                          current
                            ? {
                                ...current,
                                daySlot: option.value as "push" | "pull" | "mixed",
                              }
                            : current
                        )
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div style={editorHint}>Ein Name, ein Split, dann direkt in den Builder.</div>
              </div>
            ) : null}

            <div style={editorActions}>
              <AppButton variant="secondary" block onClick={closeNewPlanWizard}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={continueNewPlanWizard}>
                {newPlanWizard.step === "name" ? "Weiter" : "Builder öffnen"}
              </AppButton>
              {newPlanWizard.step !== "name" ? (
                <AppButton variant="secondary" block onClick={goBackNewPlanWizard}>
                  Zurück
                </AppButton>
              ) : null}
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
              <AppButton variant="secondary" size="compact" style={sheetCloseButton} onClick={() => setDayEditor(null)}>
                ×
              </AppButton>
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
              <AppButton variant="secondary" block onClick={() => setDayEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={saveDayEditor}>Speichern</AppButton>
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
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setNewDayEditor(null)}
              >
                ×
              </AppButton>
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
              <AppButton variant="secondary" block onClick={() => setNewDayEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={saveNewDayEditor}>Hinzufügen</AppButton>
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
                <div style={sheetSubtext}>Ein paar schnelle Entscheidungen und die Übung sitzt direkt im Ablauf.</div>
              </div>
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setExerciseEditor(null)}
              >
                ×
              </AppButton>
            </div>

            <div style={fieldGridCompact}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <div style={fieldLabelRow}>
                  <span style={fieldLabel}>Übung</span>
                  <button
                    style={
                      exerciseEditorFavoriteActive
                        ? favoriteToggleButtonActive
                        : favoriteToggleButton
                    }
                    onClick={toggleExerciseEditorFavorite}
                  >
                    {exerciseEditorFavoriteActive ? "★ Favorit" : "☆ Favorit"}
                  </button>
                </div>
                {favoriteExercises.length > 0 ? (
                  <div style={favoriteQuickRow}>
                    {favoriteExercises.slice(0, 6).map((exercise) => {
                      const isActiveFavorite =
                        resolveExerciseNameInput(exerciseEditor.name) === exercise.value ||
                        exercise.label.toLowerCase() === exerciseEditor.name.trim().toLowerCase();

                      return (
                        <button
                          key={exercise.value}
                          style={
                            isActiveFavorite ? favoriteQuickButtonActive : favoriteQuickButton
                          }
                          onClick={() => applyExerciseEditorDefaults(exercise.label)}
                        >
                          ★ {exercise.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {recentPlanExercises.length > 0 ? (
                  <div style={recentQuickSection}>
                    <div style={recentQuickLabel}>Zuletzt verwendet</div>
                    <div style={favoriteQuickRow}>
                      {recentPlanExercises.map((exercise) => {
                        const isActiveRecent =
                          resolveExerciseNameInput(exerciseEditor.name) === exercise.value ||
                          exercise.label.toLowerCase() === exerciseEditor.name.trim().toLowerCase();

                        return (
                          <button
                            key={`recent-${exercise.value}`}
                            style={
                              isActiveRecent ? favoriteQuickButtonActive : favoriteQuickButton
                            }
                            onClick={() => applyExerciseEditorDefaults(exercise.label)}
                          >
                            ↺ {exercise.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div style={editorQuickGrid}>
                  {exerciseLibraryGroups.slice(0, 6).map((group) => {
                    const isActiveCategory = group.items.some(
                      (item) =>
                        item.value === resolveExerciseNameInput(exerciseEditor.name) ||
                        item.label.toLowerCase() === exerciseEditor.name.trim().toLowerCase()
                    );
                    return (
                      <button
                        key={group.category}
                        style={isActiveCategory ? wizardChoiceButtonActive : wizardChoiceButton}
                        onClick={() => {
                          const first = group.items[0]?.label;
                          if (!first) return;
                          applyExerciseEditorDefaults(first);
                        }}
                      >
                        {group.category}
                      </button>
                    );
                  })}
                </div>
                <input
                  style={textInput}
                  list="exercise-suggestions"
                  value={exerciseEditor.name}
                  placeholder="z. B. Bankdrücken oder eigene Übung"
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                  onBlur={(event) => {
                    if (!event.target.value.trim()) return;
                    applyExerciseEditorDefaults(event.target.value);
                  }}
                />
                <datalist id="exercise-suggestions">
                  {exerciseLibrary.map((exercise) => (
                    <option key={exercise.value} value={exercise.label} />
                  ))}
                </datalist>
                <div style={editorHint}>
                  Eigene Übungen frei eintippen. Bekannte Übungen ziehen passende Standardwerte.
                </div>
              </label>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Sätze</div>
                <div style={compactChoiceGrid}>
                  {[2, 3, 4, 5, 6].map((value) => (
                    <button
                      key={value}
                      style={
                        exerciseEditor.sets === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={exerciseEditor.sets}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, sets: event.target.value } : current
                    )
                  }
                />
              </div>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Wdh.-Bereich</div>
                <div style={compactChoiceGrid}>
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
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                <div style={compactDualInputs}>
                  <input
                    style={compactInput}
                    inputMode="numeric"
                    value={exerciseEditor.minReps}
                    onChange={(event) =>
                      setExerciseEditor((current) =>
                        current ? { ...current, minReps: event.target.value } : current
                      )
                    }
                  />
                  <input
                    style={compactInput}
                    inputMode="numeric"
                    value={exerciseEditor.maxReps}
                    onChange={(event) =>
                      setExerciseEditor((current) =>
                        current ? { ...current, maxReps: event.target.value } : current
                      )
                    }
                  />
                </div>
              </div>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Pause</div>
                <div style={compactChoiceGrid}>
                  {[60, 75, 90, 120, 150, 180].map((value) => (
                    <button
                      key={value}
                      style={
                        exerciseEditor.restSeconds === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={exerciseEditor.restSeconds}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, restSeconds: event.target.value } : current
                    )
                  }
                />
              </div>
            </div>

            <div style={editorActions}>
              <AppButton variant="secondary" block onClick={() => setExerciseEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={saveExerciseEditor}>Speichern</AppButton>
            </div>

            <div style={builderSheetPreview}>
              <div style={builderSheetPreviewLabel}>Live-Vorschau</div>
              <div style={builderSheetPreviewTitle}>
                {exerciseEditor.name.trim() || "Eigene Übung"}
              </div>
              <div style={builderSheetPreviewMeta}>
                {Math.max(1, Number(exerciseEditor.sets) || 1)} × {Math.max(1, Number(exerciseEditor.minReps) || 1)}–
                {Math.max(Math.max(1, Number(exerciseEditor.minReps) || 1), Number(exerciseEditor.maxReps) || Number(exerciseEditor.minReps) || 1)} ·{" "}
                {formatRest(Math.max(15, Number(exerciseEditor.restSeconds) || 60))}
              </div>
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
                <div style={sheetSubtext}>Warm-up bleibt als echter Block direkt vor der Übung sichtbar.</div>
              </div>
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setWarmupEditor(null)}
              >
                ×
              </AppButton>
            </div>

            <div style={fieldGridCompact}>
              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Aufwärmsätze</div>
                <div style={compactChoiceGrid}>
                  {[0, 1, 2, 3].map((value) => (
                    <button
                      key={value}
                      style={
                        warmupEditor.rounds === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={warmupEditor.rounds}
                  onChange={(event) =>
                    setWarmupEditor((current) =>
                      current ? { ...current, rounds: event.target.value } : current
                    )
                  }
                />
              </div>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Pause</div>
                <div style={compactChoiceGrid}>
                  {[45, 60, 75, 90].map((value) => (
                    <button
                      key={value}
                      style={
                        warmupEditor.restSeconds === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={warmupEditor.restSeconds}
                  onChange={(event) =>
                    setWarmupEditor((current) =>
                      current ? { ...current, restSeconds: event.target.value } : current
                    )
                  }
                />
              </div>
            </div>

            <div style={editorHint}>0 Aufwärmsätze blendet den Block aus.</div>

            <div style={editorActions}>
              <AppButton variant="secondary" block onClick={() => setWarmupEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={saveWarmupEditor}>Speichern</AppButton>
            </div>

            <div style={builderSheetPreview}>
              <div style={builderSheetPreviewLabel}>Live-Vorschau</div>
              <div style={builderSheetPreviewTitle}>
                {warmupEditor.exerciseLabel} Aufwärmen
              </div>
              <div style={builderSheetPreviewMeta}>
                {Math.max(0, Number(warmupEditor.rounds) || 0)} Sätze ·{" "}
                {formatRest(Math.max(15, Number(warmupEditor.restSeconds) || 45))}
              </div>
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
                <div style={sheetSubtext}>Dehnen bleibt als echter Teil des Trainingsflusses sichtbar.</div>
              </div>
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setStretchEditor(null)}
              >
                ×
              </AppButton>
            </div>

            <div style={fieldGridCompact}>
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
                  style={compactInput}
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

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Halten</div>
                <div style={compactChoiceGrid}>
                  {[20, 30, 45, 60].map((value) => (
                    <button
                      key={value}
                      style={
                        stretchEditor.holdSeconds === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={stretchEditor.holdSeconds}
                  onChange={(event) =>
                    setStretchEditor((current) =>
                      current ? { ...current, holdSeconds: event.target.value } : current
                    )
                  }
                />
              </div>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Runden</div>
                <div style={compactChoiceGrid}>
                  {[1, 2, 3].map((value) => (
                    <button
                      key={value}
                      style={
                        stretchEditor.rounds === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={stretchEditor.rounds}
                  onChange={(event) =>
                    setStretchEditor((current) =>
                      current ? { ...current, rounds: event.target.value } : current
                    )
                  }
                />
              </div>
            </div>

            <div style={editorActions}>
              <AppButton variant="secondary" block onClick={() => setStretchEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={saveStretchEditor}>Speichern</AppButton>
            </div>

            <div style={builderSheetPreview}>
              <div style={builderSheetPreviewLabel}>Live-Vorschau</div>
              <div style={builderSheetPreviewTitle}>
                {STRETCH_LIBRARY.find((stretch) => stretch.value === stretchEditor.stretchId)?.label ?? "Dehnen"}
              </div>
              <div style={builderSheetPreviewMeta}>
                {Math.max(15, Number(stretchEditor.holdSeconds) || 30)} Sek ·{" "}
                {Math.max(1, Number(stretchEditor.rounds) || 1)} Runden
              </div>
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
                <div style={sheetSubtext}>Pausen werden als echter Block direkt im Ablauf gespeichert.</div>
              </div>
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setPauseEditor(null)}
              >
                ×
              </AppButton>
            </div>

            <div style={fieldGridCompact}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Name</span>
                <input
                  style={compactInput}
                  value={pauseEditor.label}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current ? { ...current, label: event.target.value } : current
                    )
                  }
                />
              </label>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Sekunden</div>
                <div style={compactChoiceGrid}>
                  {[30, 45, 60, 90, 120, 180].map((value) => (
                    <button
                      key={value}
                      style={
                        pauseEditor.seconds === String(value)
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
                  inputMode="numeric"
                  value={pauseEditor.seconds}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current ? { ...current, seconds: event.target.value } : current
                    )
                  }
                />
              </div>

              <div style={compactEditorRow}>
                <div style={compactEditorLabel}>Typ</div>
                <div style={compactChoiceGrid}>
                  {[
                    { value: "exercise", label: "Übungspause" },
                    { value: "workout", label: "Workout-Pause" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      style={
                        pauseEditor.scope === option.value
                          ? compactChoiceButtonActive
                          : compactChoiceButton
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
                  style={compactInput}
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
              </div>
            </div>

            <div style={editorActions}>
              <AppButton variant="secondary" block onClick={() => setPauseEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={savePauseEditor}>Speichern</AppButton>
            </div>

            <div style={builderSheetPreview}>
              <div style={builderSheetPreviewLabel}>Live-Vorschau</div>
              <div style={builderSheetPreviewTitle}>
                {pauseEditor.label.trim() || (pauseEditor.scope === "workout" ? "Workout-Pause" : "Pause")}
              </div>
              <div style={builderSheetPreviewMeta}>
                {formatRest(Math.max(15, Number(pauseEditor.seconds) || 60))} ·{" "}
                {pauseEditor.scope === "workout" ? "Workout-Pause" : "Übungspause"}
              </div>
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
                <div style={sheetSubtext}>Kurze Hinweise sitzen direkt sichtbar in der Planstruktur.</div>
              </div>
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => setNoteEditor(null)}
              >
                ×
              </AppButton>
            </div>

            <div style={fieldGridCompact}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Titel</span>
                <input
                  style={compactInput}
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
                  style={{ ...compactInput, minHeight: 110, resize: "vertical" as const }}
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
              <AppButton variant="secondary" block onClick={() => setNoteEditor(null)}>Abbrechen</AppButton>
              <AppButton variant="primary" block onClick={saveNoteEditor}>Speichern</AppButton>
            </div>

            <div style={builderSheetPreview}>
              <div style={builderSheetPreviewLabel}>Live-Vorschau</div>
              <div style={builderSheetPreviewTitle}>
                {noteEditor.label.trim() || "Hinweis"}
              </div>
              <div style={builderSheetPreviewMeta}>
                {(noteEditor.notes.trim() || "Dein Hinweistext erscheint hier als kompakter Trainingsblock.")
                  .replace(/\s+/g, " ")
                  .slice(0, 120)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {addBlockContext ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Plan-Bausteine</div>
                <div style={sheetTitle}>Block hinzufügen</div>
                {(() => {
                  const targetDay =
                    activePlan.days.find((day) => day.id === addBlockContext.dayId) ?? null;
                  const dayBlocks = targetDay ? getDayBlocks(targetDay) : [];
                  const insertAfterBlock = addBlockContext.insertAfterBlockId
                    ? dayBlocks.find((block) => block.id === addBlockContext.insertAfterBlockId) ?? null
                    : null;

                  return insertAfterBlock ? (
                    <div style={sheetSubtext}>Wird nach „{insertAfterBlock.label}“ eingefügt.</div>
                  ) : null;
                })()}
              </div>
              <AppButton
                variant="secondary"
                size="compact"
                style={sheetCloseButton}
                onClick={() => {
                  setAddBlockContext(null);
                  setWarmupTargetDayId(null);
                }}
              >
                ×
              </AppButton>
            </div>

            {warmupTargetDayId ? (
              <div style={addPickerList}>
                {(activePlan.days.find((day) => day.id === warmupTargetDayId)?.exercises ?? []).map(
                  (exercise) => (
                    <button
                      key={exercise.id}
                      style={addPickerOption}
                      onClick={() => {
                        const insertAfterBlockId = addBlockContext?.insertAfterBlockId ?? null;
                        setAddBlockContext(null);
                        setWarmupTargetDayId(null);
                        openWarmupEditor(
                          warmupTargetDayId,
                          exercise.id,
                          getExerciseLabel(exercise.name),
                          1,
                          Math.max(45, Math.round(exercise.restSeconds / 2)),
                          undefined,
                          insertAfterBlockId
                        );
                      }}
                    >
                      <span style={addPickerEmoji}>🔥</span>
                      <span>
                        <div style={addPickerLabel}>{getExerciseLabel(exercise.name)}</div>
                        <div style={addPickerHint}>Warm-up-Block für diese Übung einfügen</div>
                      </span>
                    </button>
                  )
                )}
              </div>
            ) : (
              (() => {
                const targetDay =
                  activePlan.days.find((day) => day.id === addBlockContext.dayId) ?? null;
                const dayBlocks = targetDay ? getDayBlocks(targetDay) : [];
                const hasExercises = (targetDay?.exercises.length ?? 0) > 0;
                const insertAfterBlock = addBlockContext.insertAfterBlockId
                  ? dayBlocks.find((block) => block.id === addBlockContext.insertAfterBlockId) ?? null
                  : null;
                const recommendedExerciseId =
                  insertAfterBlock?.type === "exercise"
                    ? insertAfterBlock.exerciseId
                    : insertAfterBlock?.type === "warmup"
                      ? insertAfterBlock.parentExerciseId
                      : null;
                const recommendedExercise =
                  recommendedExerciseId && targetDay
                    ? targetDay.exercises.find((exercise) => exercise.id === recommendedExerciseId) ?? null
                    : null;
                const recommendedOptions = getRecommendedAddOptions(dayBlocks, insertAfterBlock ?? undefined);
                const allOptions = [
                  {
                    key: "exercise",
                    icon: "🏋️",
                    label: "Übung",
                    hint: "Übung oder eigene Übung hinzufügen",
                    onClick: () => {
                      openAddExercise(addBlockContext.dayId);
                    },
                    accent: "#feecec",
                    disabled: false,
                  },
                  {
                    key: "warmup",
                    icon: "🔥",
                    label: "Warm-up",
                    hint: "Warm-up als echten Block einfügen",
                    onClick: () => {
                      if (!hasExercises) return;
                      if (recommendedExercise) {
                        const insertAfterBlockId = addBlockContext.insertAfterBlockId ?? null;
                        setAddBlockContext(null);
                        openWarmupEditor(
                          addBlockContext.dayId,
                          recommendedExercise.id,
                          getExerciseLabel(recommendedExercise.name),
                          1,
                          Math.max(45, Math.round(recommendedExercise.restSeconds / 2)),
                          undefined,
                          insertAfterBlockId
                        );
                        return;
                      }
                      setWarmupTargetDayId(addBlockContext.dayId);
                    },
                    accent: "#fff4e8",
                    disabled: !hasExercises,
                  },
                  {
                    key: "stretch",
                    icon: "🧘",
                    label: "Dehnen",
                    hint: "Dehnblock in den Ablauf einfügen",
                    onClick: () => {
                      openStretchEditor(addBlockContext.dayId);
                    },
                    accent: "#ecfdf5",
                    disabled: false,
                  },
                  {
                    key: "pause",
                    icon: "⏱️",
                    label: "Pause",
                    hint: "Pause als Block einfügen",
                    onClick: () => {
                      openPauseEditor(addBlockContext.dayId);
                    },
                    accent: "#eff5ff",
                    disabled: false,
                  },
                  {
                    key: "note",
                    icon: "📝",
                    label: "Notiz",
                    hint: "Kurzen Hinweis ergänzen",
                    onClick: () => {
                      openNoteEditor(addBlockContext.dayId);
                    },
                    accent: "#f5f3ff",
                    disabled: false,
                  },
                ] as const;

                const recommendedEntries = recommendedOptions.reduce<(typeof allOptions)[number][]>((list, key) => {
                  const match = allOptions.find((entry) => entry.key === key);
                  if (match) {
                    list.push(match);
                  }
                  return list;
                }, []);
                const recommendedSet = new Set<string>(recommendedOptions);
                const orderedOptions = [
                  ...recommendedEntries,
                  ...allOptions.filter((option) => !recommendedSet.has(option.key)),
                ];
                const quickTemplates = [
                  {
                    key: "exercise-start",
                    label: "Direkt mit Übung",
                    detail: "Öffnet sofort den kompakten Übungseditor.",
                    disabled: false,
                    onClick: () => openAddExercise(addBlockContext.dayId),
                  },
                  {
                    key: "warmup-start",
                    label: "Warm-up vor Übung",
                    detail: hasExercises
                      ? "Fügt vor einer Zielübung direkt einen echten Warm-up-Block ein."
                      : "Lege zuerst eine Übung an, damit ein Warm-up sauber verknüpft werden kann.",
                    disabled: !hasExercises,
                    onClick: () => {
                      if (!hasExercises) return;
                      if (recommendedExercise) {
                        const insertAfterBlockId = addBlockContext.insertAfterBlockId ?? null;
                        setAddBlockContext(null);
                        openWarmupEditor(
                          addBlockContext.dayId,
                          recommendedExercise.id,
                          getExerciseLabel(recommendedExercise.name),
                          1,
                          Math.max(45, Math.round(recommendedExercise.restSeconds / 2)),
                          undefined,
                          insertAfterBlockId
                        );
                        return;
                      }
                      setWarmupTargetDayId(addBlockContext.dayId);
                    },
                  },
                  {
                    key: "mobility-start",
                    label: "Mobiler Einstieg",
                    detail: "Startet mit Stretch/Mobility und hält den Tag als Fluss sichtbar.",
                    disabled: false,
                    onClick: () => openStretchEditor(addBlockContext.dayId),
                  },
                ];

                return (
                  <div style={addSheetStack}>
                    <div style={sectionTitle}>Schnellstart</div>
                    <div style={templateCardGrid}>
                      {quickTemplates.map((template) => (
                        <button
                          key={template.key}
                          style={{
                            ...templateCard,
                            opacity: template.disabled ? 0.55 : 1,
                          }}
                          disabled={template.disabled}
                          onClick={template.onClick}
                        >
                          <div style={templateTitle}>{template.label}</div>
                          <div style={templateDetail}>{template.detail}</div>
                        </button>
                      ))}
                    </div>
                    {recentPlanExercises.length > 0 ? (
                      <>
                        <div style={sectionTitle}>Zuletzt verwendet</div>
                        <div style={favoriteQuickRow}>
                          {recentPlanExercises.map((exercise) => (
                            <button
                              key={`sheet-recent-${exercise.value}`}
                              style={favoriteQuickButton}
                              onClick={() => openAddExerciseWithName(addBlockContext.dayId, exercise.label)}
                            >
                              ↺ {exercise.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <div style={sectionTitle}>Nächster Block</div>
                    <div style={addPickerList}>
                      {orderedOptions.map((option) => (
                        <button
                          key={option.key}
                          style={{
                            ...addPickerOption,
                            background: option.accent,
                            opacity: option.disabled ? 0.55 : 1,
                          }}
                          disabled={option.disabled}
                          onClick={option.onClick}
                        >
                          <span style={addPickerEmoji}>{option.icon}</span>
                          <span style={addOptionTextWrap}>
                            <div style={addOptionLabelRow}>
                              <div style={addPickerLabel}>{option.label}</div>
                              {recommendedSet.has(option.key) ? (
                                <span style={recommendedPill}>Empfohlen</span>
                              ) : null}
                            </div>
                            <div style={addPickerHint}>{option.hint}</div>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()
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

function getWizardTitle(step: NewPlanWizardState["step"]) {
  if (step === "name") return "Planname";
  return "Tag";
}

function getWizardStepLabel(step: NewPlanWizardState["step"]) {
  if (step === "name") return "1 / 2";
  return "2 / 2";
}

function deriveSlotFromDayName(value: string): "push" | "pull" | "mixed" {
  const lowered = value.trim().toLowerCase();
  if (lowered.includes("pull")) return "pull";
  if (lowered.includes("mixed")) return "mixed";
  return "push";
}

function resolveExerciseNameInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const exerciseLibrary = getExerciseLibrary();
  const exactValueMatch = exerciseLibrary.find(
    (exercise) => exercise.value.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactValueMatch) {
    return exactValueMatch.value;
  }

  const exactLabelMatch = exerciseLibrary.find(
    (exercise) => exercise.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactLabelMatch) {
    return exactLabelMatch.value;
  }

  return trimmed;
}

function getRecommendedAddOptions(
  dayBlocks: TrainingPlanBlock[],
  insertAfterBlock?: TrainingPlanBlock
) {
  const anchorBlock = insertAfterBlock ?? dayBlocks[dayBlocks.length - 1];
  if (!anchorBlock) {
    return ["stretch", "exercise", "pause"] as const;
  }

  if (anchorBlock.type === "stretch") {
    return ["warmup", "exercise", "pause"] as const;
  }

  if (anchorBlock.type === "exercise") {
    return ["pause", "exercise", "warmup"] as const;
  }

  if (anchorBlock.type === "pause") {
    return ["exercise", "stretch", "note"] as const;
  }

  if (anchorBlock.type === "warmup") {
    return ["exercise", "pause", "note"] as const;
  }

  return ["exercise", "pause", "stretch"] as const;
}

// Styles

const screen = {
  height: "var(--app-viewport-height, 100dvh)",
  display: "flex",
  justifyContent: "center",
  alignItems: "stretch",
  overflow: "hidden" as const,
  padding:
    "calc(8px + env(safe-area-inset-top)) 8px calc(100px + var(--app-bottom-inset))",
  background: appChromeBackground,
  fontFamily: "sans-serif",
  position: "relative" as const,
  boxSizing: "border-box" as const,
};

const shell = {
  maxWidth: 460,
  flex: 1,
  minHeight: 0,
  width: "100%",
  margin: "0 auto",
  padding: "4px",
  borderRadius: 28,
  background: withAlpha(appPalette.surface, 0.96),
  boxShadow: `0 24px 60px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
  border: `1px solid ${withAlpha(appPalette.borderDefault, 0.14)}`,
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  overflow: "hidden" as const,
  boxSizing: "border-box" as const,
};

const topBar = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
  minHeight: 34,
};

const sheetSubtext = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.35,
  color: withAlpha(appPalette.textDefault, 0.95),
  fontWeight: 600,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  width: "fit-content",
  padding: "6px 13px",
  borderRadius: 999,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  fontSize: 12,
  fontWeight: "bold",
};

const ghostAction = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: withAlpha(appPalette.surface, 0.96),
  color: appPalette.textStrong,
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
};

const sectionTitle = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: appPalette.textMuted,
  fontWeight: "bold",
};

const activePlanBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 20,
  background: `linear-gradient(180deg, ${appPalette.surfaceMuted} 0%, ${appPalette.surface} 100%)`,
  border: `1px solid ${appPalette.borderSoft}`,
  marginBottom: 6,
  boxShadow: `0 12px 26px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const activePlanName = {
  fontSize: 15,
  fontWeight: "bold",
  color: appPalette.textStrong,
  marginTop: 2,
};

const currentPlanCard = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 16,
  background: `linear-gradient(180deg, ${appPalette.surface} 0%, ${appPalette.surfaceMuted} 100%)`,
  border: `1px solid ${appPalette.borderDefault}`,
  boxShadow: `0 14px 28px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
  flexShrink: 0,
};

const currentPlanName = {
  marginTop: 2,
  fontSize: 15,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const currentPlanMeta = {
  marginTop: 3,
  fontSize: 10,
  lineHeight: 1.25,
  color: appPalette.textMuted,
};

const currentPlanActions = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  flexShrink: 0,
};

const primaryActionButton = {
  minWidth: 124,
  padding: "0 16px",
  fontSize: 11,
  letterSpacing: 0.2,
};

const dayGrid = {
  flex: 1,
  display: "grid",
  gap: 6,
  minHeight: 0,
  height: "100%",
  overflow: "hidden" as const,
  alignContent: "stretch" as const,
  paddingRight: 1,
  paddingBottom: 0,
};

const dayCardLink = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  minHeight: 0,
  height: "100%",
};

const dayCard = {
  borderRadius: 26,
  color: appPalette.surface,
  padding: "10px 12px 10px",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  height: "100%",
  minHeight: 0,
  border: "none",
  overflow: "hidden" as const,
  boxShadow: `0 20px 40px ${withAlpha(appPalette.surfaceDark, 0.16)}`,
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
  minHeight: 26,
  padding: "4px 10px",
  borderRadius: 999,
  background: withAlpha(appPalette.surface, 0.16),
  border: `1px solid ${withAlpha(appPalette.surface, 0.22)}`,
  color: appPalette.surface,
  fontSize: 11,
  fontWeight: 800,
  backdropFilter: "blur(10px)",
};

const dayTitle = {
  fontSize: 18,
  lineHeight: 0.96,
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
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surfaceDark, 0.18)} 0%, ${withAlpha(appPalette.surfaceDark, 0.42)} 100%)`,
  display: "flex",
  alignItems: "flex-end" as const,
  justifyContent: "center",
  zIndex: 50,
  padding: "max(12px, env(safe-area-inset-top)) 0 var(--app-bottom-inset) 0",
};

const sheet = {
  width: "100%",
  maxWidth: 460,
  maxHeight:
    "calc(var(--app-viewport-height, 100dvh) - max(12px, env(safe-area-inset-top)) - 8px)",
  overflowY: "auto" as const,
  padding: "12px 12px calc(16px + var(--app-bottom-inset))",
  borderRadius: "30px 30px 0 0" as const,
  background: `linear-gradient(180deg, ${appPalette.surface} 0%, ${appPalette.surfaceMuted} 100%)`,
  border: `1px solid ${appPalette.borderDefault}`,
  borderBottom: "none",
  boxShadow: `0 -20px 60px ${withAlpha(appPalette.surfaceDark, 0.16)}`,
};

const planDetailSheet = {
  ...sheet,
  maxHeight: "78dvh",
  display: "flex",
  flexDirection: "column" as const,
  padding: "12px 0 0 0",
  gap: 0,
};

const editorSheet = {
  ...sheet,
  maxWidth: 460,
  paddingBottom: "calc(18px + var(--app-bottom-inset))",
  background: `linear-gradient(180deg, ${appPalette.surface} 0%, ${appPalette.surfaceMuted} 100%)`,
};

const sheetHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
  marginBottom: 8,
  padding: "0 4px",
};

const sheetHeaderActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const sheetTitle = {
  marginTop: 4,
  fontSize: 21,
  fontWeight: 800,
  lineHeight: 1.05,
  color: appPalette.textStrong,
};

const sheetCloseButton = {
  minWidth: 42,
  width: 42,
  padding: 0,
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1,
};

const sheetPlusButton = {
  minWidth: 42,
  width: 42,
  padding: 0,
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1,
};

const planList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const planListCard = {
  borderRadius: 22,
  border: `1.5px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  overflow: "hidden" as const,
  display: "flex",
  alignItems: "stretch",
  boxShadow: `0 12px 24px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
};

const planListCardActive = {
  background: appPalette.surfaceMuted,
  boxShadow: `0 16px 32px ${withAlpha(appPalette.surfaceDark, 0.12)}`,
};

const planListMain = {
  flex: 1,
  padding: "14px 14px",
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
  color: appPalette.textStrong,
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
  background: appPalette.surfaceDark,
  color: appPalette.surface,
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
  color: appPalette.textDefault,
  minWidth: 44,
};

const planDayExercises = {
  fontSize: 12,
  color: appPalette.textMuted,
  flex: 1,
  lineHeight: 1.35,
  whiteSpace: "normal" as const,
  overflow: "hidden" as const,
};

const planCardActionRow = {
  display: "flex",
  gap: 8,
  marginTop: 10,
  flexWrap: "wrap" as const,
};

const planActionButton = {
  minHeight: 36,
  padding: "7px 12px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const activePlanActionButton = {
  ...planActionButton,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  border: `1px solid ${appPalette.surfaceDark}`,
};

const planSecondaryActionButton = {
  ...planActionButton,
  color: appPalette.textDefault,
};

const planDetailMetaBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px 14px",
  borderBottom: `1px solid ${appPalette.borderSoft}`,
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
  padding: "10px 16px",
  borderBottom: `1px solid ${appPalette.borderSoft}`,
};

const addSplitButton = {
  minHeight: 36,
  padding: "7px 13px",
  borderRadius: 999,
  border: `1.5px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
  boxShadow: `0 4px 12px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const dayTab = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 36,
  padding: "7px 14px",
  borderRadius: 999,
  border: `1.5px solid ${appPalette.borderDefault}`,
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
};

const dayTabActive = {
  background: appPalette.surface,
  boxShadow: `0 4px 12px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
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
  background: `linear-gradient(180deg, ${appPalette.surface} 0%, ${appPalette.surfaceMuted} 100%)`,
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: `0 10px 20px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
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
  color: appPalette.textStrong,
};

const planBlockMeta = {
  fontSize: 13,
  color: appPalette.textMuted,
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
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textDefault,
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: `0 8px 18px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const quickAddDock = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  padding: "12px 16px calc(20px + var(--app-bottom-inset))",
  borderTop: `1px solid ${appPalette.borderSoft}`,
  flexShrink: 0,
};

const quickAddButton = {
  minHeight: 50,
  borderRadius: 18,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 10px 22px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const addBlockButton = {
  ...quickAddButton,
  gridColumn: "1 / -1",
  border: `1.5px dashed ${withAlpha("#2563eb", 0.28)}`,
  background: withAlpha("#2563eb", 0.08),
  color: splitThemes.pull.primary,
};

const addPickerList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  marginTop: 0,
};

const addPickerOption = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 20,
  border: `1px solid ${appPalette.borderSoft}`,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.98)} 0%, ${withAlpha(appPalette.surfaceMuted, 0.96)} 100%)`,
  cursor: "pointer",
  textAlign: "left" as const,
  width: "100%",
  boxShadow: `0 12px 28px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
};

const addSheetStack = {
  display: "grid",
  gap: 10,
};

const templateCardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const templateCard = {
  padding: "12px 12px 13px",
  borderRadius: 18,
  border: `1px solid ${appPalette.borderSoft}`,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.98)} 0%, ${withAlpha(appPalette.surfaceMuted, 0.98)} 100%)`,
  textAlign: "left" as const,
  display: "grid",
  gap: 5,
  cursor: "pointer",
  boxShadow: `0 10px 24px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const templateTitle = {
  fontSize: 13,
  fontWeight: 800,
  color: appPalette.textStrong,
  lineHeight: 1.25,
};

const templateDetail = {
  fontSize: 11,
  lineHeight: 1.4,
  color: appPalette.textMuted,
};

const addPickerEmoji = {
  fontSize: 24,
  flexShrink: 0,
};

const addPickerLabel = {
  fontSize: 15,
  fontWeight: "bold",
  color: appPalette.textStrong,
};

const addPickerHint = {
  fontSize: 12,
  color: appPalette.textMuted,
  marginTop: 2,
};

const addOptionTextWrap = {
  display: "grid",
  gap: 4,
  flex: 1,
  minWidth: 0,
};

const addOptionLabelRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap" as const,
};

const recommendedPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "3px 8px",
  borderRadius: 999,
  background: withAlpha(appPalette.surfaceDark, 0.08),
  color: appPalette.textDefault,
  fontSize: 11,
  fontWeight: 800,
};

const selectButton = {
  minHeight: 56,
  padding: "13px 16px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  width: "100%",
  boxShadow: `0 10px 22px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const activeSelectButton = {
  ...selectButton,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  border: `1px solid ${appPalette.surfaceDark}`,
  boxShadow: `0 14px 28px ${withAlpha(appPalette.surfaceDark, 0.18)}`,
};

const templateBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 999,
  background: withAlpha(splitThemes.pull.primary, 0.12),
  color: splitThemes.pull.primary,
  fontSize: 11,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const customBadge = {
  ...templateBadge,
  background: withAlpha(appPalette.success, 0.12),
  color: appPalette.success,
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
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerMiniButton = {
  background: withAlpha(appPalette.danger, 0.08),
  border: `1px solid ${withAlpha(appPalette.danger, 0.25)}`,
  color: appPalette.danger,
};

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
  padding: "16px 14px",
  borderRadius: 24,
  border: `1px solid ${appPalette.borderSoft}`,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.98)} 0%, ${withAlpha(appPalette.surfaceMuted, 0.98)} 100%)`,
  boxShadow: `0 12px 28px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const fieldGridCompact = {
  ...fieldGrid,
  gap: 12,
  padding: "12px 12px",
};

const fieldStack = {
  display: "grid",
  gap: 8,
};

const fieldLabel = {
  fontSize: 12,
  fontWeight: "bold",
  color: appPalette.textDefault,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const fieldLabelRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap" as const,
};

const favoriteToggleButton = {
  minHeight: 34,
  padding: "6px 12px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textDefault,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 8px 18px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const favoriteToggleButtonActive = {
  ...favoriteToggleButton,
  border: `1px solid ${withAlpha(appPalette.warning, 0.35)}`,
  background: withAlpha(appPalette.warning, 0.12),
  color: appPalette.warning,
};

const favoriteQuickRow = {
  display: "flex",
  gap: 8,
  overflowX: "auto" as const,
  paddingBottom: 2,
};

const recentQuickSection = {
  display: "grid",
  gap: 6,
};

const recentQuickLabel = {
  fontSize: 11,
  letterSpacing: 0.8,
  textTransform: "uppercase" as const,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const favoriteQuickButton = {
  minHeight: 38,
  padding: "8px 14px",
  borderRadius: 14,
  border: `1px solid ${withAlpha(appPalette.warning, 0.28)}`,
  background: withAlpha(appPalette.warning, 0.08),
  color: appPalette.warning,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  boxShadow: `0 8px 18px ${withAlpha(appPalette.warning, 0.08)}`,
};

const favoriteQuickButtonActive = {
  ...favoriteQuickButton,
  border: `1px solid ${appPalette.warning}`,
  background: appPalette.warning,
  color: appPalette.surface,
};

const editorQuickGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const editorQuickGridCompact = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const compactEditorRow = {
  display: "grid",
  gap: 8,
};

const compactEditorLabel = {
  fontSize: 12,
  fontWeight: "bold",
  color: appPalette.textDefault,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const compactChoiceGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const compactChoiceButton = {
  minHeight: 44,
  borderRadius: 16,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 8px 18px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const compactChoiceButtonActive = {
  ...compactChoiceButton,
  border: `1px solid ${appPalette.surfaceDark}`,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  boxShadow: `0 12px 24px ${withAlpha(appPalette.surfaceDark, 0.16)}`,
};

const compactInput = {
  width: "100%",
  minHeight: 44,
  padding: "9px 12px",
  borderRadius: 14,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 15,
  boxShadow: `0 8px 20px ${withAlpha(appPalette.surfaceDark, 0.03)}`,
};

const compactDualInputs = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const textInput = {
  width: "100%",
  minHeight: 50,
  padding: "12px 14px",
  borderRadius: 16,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 15,
  boxShadow: `0 8px 20px ${withAlpha(appPalette.surfaceDark, 0.03)}`,
};

const editorActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 14,
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
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  fontSize: 11,
  fontWeight: "bold",
};

const wizardMeta = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 9px",
  borderRadius: 999,
  background: withAlpha(splitThemes.pull.primary, 0.12),
  color: splitThemes.pull.primary,
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
  background: `linear-gradient(180deg, ${appPalette.surface} 0%, ${appPalette.surfaceMuted} 100%)`,
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: `0 10px 20px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const wizardPreviewName = {
  fontSize: 14,
  fontWeight: "bold",
  color: appPalette.textStrong,
};

const wizardPreviewMeta = {
  fontSize: 12,
  color: appPalette.textMuted,
};

const wizardChoiceGridCompact = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const wizardChoiceButton = {
  minHeight: 48,
  borderRadius: 18,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 10px 22px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const wizardChoiceButtonActive = {
  ...wizardChoiceButton,
  border: `1px solid ${appPalette.surfaceDark}`,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
};


const editorHint = {
  marginTop: 6,
  fontSize: 11,
  color: appPalette.textDefault,
  lineHeight: 1.4,
};

const builderSheetPreview = {
  marginTop: 12,
  padding: "14px 14px",
  borderRadius: 20,
  background: `linear-gradient(180deg, ${withAlpha("#2563eb", 0.08)} 0%, ${appPalette.surface} 100%)`,
  border: `1px solid ${withAlpha("#2563eb", 0.16)}`,
  boxShadow: `0 16px 32px ${withAlpha(appPalette.surfaceDark, 0.07)}`,
  display: "grid",
  gap: 8,
};

const builderSheetPreviewLabel = {
  fontSize: 11,
  letterSpacing: 1.1,
  textTransform: "uppercase" as const,
  color: appPalette.textSoft,
  fontWeight: "bold",
};

const builderSheetPreviewTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: appPalette.textStrong,
  lineHeight: 1.15,
};

const builderSheetPreviewMeta = {
  fontSize: 13,
  lineHeight: 1.45,
  color: appPalette.textDefault,
  fontWeight: 700,
};

function getPlanCardText(plan: TrainingPlan) {
  const preview = getPlanPreview(plan);
  if (!plan.description || preview === plan.description) return preview;
  if (preview.includes(plan.description) || plan.description.includes(preview)) {
    return preview.length <= plan.description.length ? preview : plan.description;
  }
  return plan.description;
}


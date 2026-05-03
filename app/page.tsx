"use client";

import { Fragment, useEffect, useState } from "react";
import {
  getActiveWorkoutState,
  type ActiveWorkoutState,
} from "@/lib/activeWorkout";

import type { ExercisePlanBlock, TrainingPlanBlock } from "@/lib/trainingModel";
import {
  addTrainingExercise,
  addPauseBlock,
  addStretchBlock,
  deleteTrainingPlan,
  duplicateDayBlock,
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
  updateStretchBlock,
  updateWarmupBlock,
  updateTrainingExercise,
  type TrainingExercise,
  type TrainingPlan,
} from "@/lib/trainingPlans";
import {
  getExerciseCatalogEntry,
  getSuggestedExerciseSetup,
} from "@/lib/trainingCatalog";
import {
  EXERCISE_LIBRARY,
  EXERCISE_LIBRARY_GROUPS,
  getExerciseLabel,
  STRETCH_LIBRARY,
  STRETCH_LIBRARY_GROUPS,
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

type ExerciseEditorState = {
  dayId: string;
  exerciseId?: string;
  insertAfterBlockId?: string | null;
  category: string;
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
  insertAfterBlockId?: string | null;
  category: string;
  stretchId: string;
  holdSeconds: string;
  rounds: string;
};

type PauseEditorState = {
  dayId: string;
  blockId?: string;
  insertAfterBlockId?: string | null;
  label: string;
  seconds: string;
  scope: "exercise" | "workout";
};

function buildExerciseEditorState(
  dayId: string,
  exerciseId?: string,
  insertAfterBlockId?: string | null
): ExerciseEditorState {
  const selectedExerciseId = exerciseId ?? EXERCISE_LIBRARY[0]?.value ?? "benchpress";
  const selectedMeta = getExerciseCatalogEntry(selectedExerciseId);
  const defaults = getSuggestedExerciseSetup(selectedExerciseId);

  return {
    dayId,
    insertAfterBlockId: insertAfterBlockId ?? null,
    category: selectedMeta?.category ?? EXERCISE_LIBRARY_GROUPS[0]?.category ?? "Brust",
    name: selectedExerciseId,
    sets: String(defaults.sets),
    minReps: String(defaults.minReps),
    maxReps: String(defaults.maxReps),
    restSeconds: String(defaults.restSeconds),
  };
}

export default function Home() {
  const [availablePlans, setAvailablePlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan>(() =>
    getTrainingPlan("my-plan")
  );
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [dayEditor, setDayEditor] = useState<DayEditorState | null>(null);
  const [exerciseEditor, setExerciseEditor] =
    useState<ExerciseEditorState | null>(null);
  const [warmupEditor, setWarmupEditor] = useState<WarmupEditorState | null>(null);
  const [stretchEditor, setStretchEditor] = useState<StretchEditorState | null>(null);
  const [pauseEditor, setPauseEditor] = useState<PauseEditorState | null>(null);

  useEffect(() => {
    refreshPlans();
  }, []);

  useEffect(() => {
    function refreshActiveWorkout() {
      setActiveWorkout(getActiveWorkoutState());
    }

    refreshActiveWorkout();
    window.addEventListener("focus", refreshActiveWorkout);
    window.addEventListener("visibilitychange", refreshActiveWorkout);

    return () => {
      window.removeEventListener("focus", refreshActiveWorkout);
      window.removeEventListener("visibilitychange", refreshActiveWorkout);
    };
  }, []);

  function refreshPlans(nextActivePlanId?: string) {
    const resolvedPlan = getTrainingPlan(nextActivePlanId || getActivePlanId());
    const plans = sortPlansForPicker(getAllTrainingPlans(), resolvedPlan.id);
    setAvailablePlans(plans);
    setActivePlan(resolvedPlan);
  }

  function openPlanPicker() {
    refreshPlans();
    setShowPlanPicker(true);
  }

  function openPlanDetail() {
    refreshPlans();
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
    setShowPlanDetail(true);
  }

  function handleDeletePlan(planId: string) {
    const plan = getTrainingPlan(planId);
    const shouldDelete = window.confirm(
      `"${plan.name}" wirklich löschen?`
    );

    if (!shouldDelete) {
      return;
    }

    const deleted = deleteTrainingPlan(planId);
    if (!deleted) {
      return;
    }

    const fallbackPlan = getTrainingPlan("my-plan");
    setActivePlanId(fallbackPlan.id);
    setDayEditor(null);
    setExerciseEditor(null);
    setWarmupEditor(null);
    setStretchEditor(null);
    setPauseEditor(null);
    setShowPlanDetail(false);
    refreshPlans(fallbackPlan.id);
  }

  function handleRenamePlan(planId: string) {
    const current = getTrainingPlan(planId);
    const nextName = window.prompt("Neuer Planname", current.name);

    if (!nextName) {
      return;
    }

    const renamed = renameTrainingPlan(planId, nextName);
    if (!renamed) {
      return;
    }

    refreshPlans(renamed.id);
  }

  function openDayEditor(dayId: string, currentName: string) {
    setDayEditor({
      dayId,
      value: currentName,
    });
  }

  function saveDayEditor() {
    if (!dayEditor) {
      return;
    }

    const updated = renameTrainingDay(activePlan.id, dayEditor.dayId, dayEditor.value);
    if (!updated) {
      return;
    }

    setDayEditor(null);
    refreshPlans(updated.id);
  }

  function openAddExercise(dayId: string, insertAfterBlockId?: string | null) {
    setExerciseEditor(buildExerciseEditorState(dayId, undefined, insertAfterBlockId));
  }

  function openAddExercisePreset(
    dayId: string,
    kind: "compound" | "isolation",
    insertAfterBlockId?: string | null
  ) {
    const presetExercise = EXERCISE_LIBRARY.find((exercise) => {
      const meta = getExerciseCatalogEntry(exercise.value);
      return meta?.kind === kind;
    });

    setExerciseEditor(
      buildExerciseEditorState(dayId, presetExercise?.value, insertAfterBlockId)
    );
  }

  function openEditExercise(dayId: string, exercise: TrainingExercise) {
    const selectedMeta = getExerciseCatalogEntry(exercise.name);

    setExerciseEditor({
      dayId,
      exerciseId: exercise.id,
      category: selectedMeta?.category ?? EXERCISE_LIBRARY_GROUPS[0]?.category ?? "Brust",
      name: exercise.name,
      sets: String(exercise.sets),
      minReps: String(exercise.minReps),
      maxReps: String(exercise.maxReps),
      restSeconds: String(exercise.restSeconds),
    });
  }

  function applySuggestedExerciseSetup(exerciseId: string) {
    const selectedMeta = getExerciseCatalogEntry(exerciseId);
    const defaults = getSuggestedExerciseSetup(exerciseId);

    setExerciseEditor((current) =>
      current
        ? {
            ...current,
            category: selectedMeta?.category ?? current.category,
            name: exerciseId,
            sets: String(defaults.sets),
            minReps: String(defaults.minReps),
            maxReps: String(defaults.maxReps),
            restSeconds: String(defaults.restSeconds),
          }
        : current
    );
  }

  function saveExerciseEditor() {
    if (!exerciseEditor) {
      return;
    }

    const draft = {
      name: exerciseEditor.name,
      sets: Number(exerciseEditor.sets),
      minReps: Number(exerciseEditor.minReps),
      maxReps: Number(exerciseEditor.maxReps),
      restSeconds: Number(exerciseEditor.restSeconds),
    };

    const updated = exerciseEditor.exerciseId
      ? updateTrainingExercise(
          activePlan.id,
          exerciseEditor.dayId,
          exerciseEditor.exerciseId,
          draft
        )
      : addTrainingExercise(
          activePlan.id,
          exerciseEditor.dayId,
          draft,
          exerciseEditor.insertAfterBlockId
        );

    if (!updated) {
      return;
    }

    setExerciseEditor(null);
    refreshPlans(updated.id);
  }

  function handleRemoveExercise(dayId: string, exerciseId: string) {
    const shouldRemove = window.confirm("Diese Übung aus dem Plan entfernen?");
    if (!shouldRemove) {
      return;
    }

    const updated = removeTrainingExercise(activePlan.id, dayId, exerciseId);
    if (!updated) {
      return;
    }

    refreshPlans(updated.id);
  }

  function openWarmupEditor(
    dayId: string,
    exerciseId: string,
    exerciseLabel: string,
    rounds: number,
    restSeconds: number
  ) {
    setWarmupEditor({
      dayId,
      exerciseId,
      exerciseLabel,
      rounds: String(rounds),
      restSeconds: String(restSeconds),
    });
  }

  function saveWarmupEditor() {
    if (!warmupEditor) {
      return;
    }

    const updated = updateWarmupBlock(
      activePlan.id,
      warmupEditor.dayId,
      warmupEditor.exerciseId,
      {
        rounds: Number(warmupEditor.rounds),
        restSeconds: Number(warmupEditor.restSeconds),
      }
    );

    if (!updated) {
      return;
    }

    setWarmupEditor(null);
    refreshPlans(updated.id);
  }

  function openStretchEditor(
    dayId: string,
    stretchId?: string,
    holdSeconds?: number,
    rounds?: number,
    blockId?: string,
    insertAfterBlockId?: string | null
  ) {
    const selectedStretchId = stretchId ?? STRETCH_LIBRARY[0]?.value ?? "chest_stretch";
    const selectedMeta = getExerciseCatalogEntry(selectedStretchId);

    setStretchEditor({
      dayId,
      blockId,
      insertAfterBlockId: insertAfterBlockId ?? null,
      category: selectedMeta?.category ?? STRETCH_LIBRARY_GROUPS[0]?.category ?? "Mobilität",
      stretchId: selectedStretchId,
      holdSeconds: String(holdSeconds ?? 30),
      rounds: String(rounds ?? 1),
    });
  }

  function applyStretchCategory(category: string) {
    const nextGroup = STRETCH_LIBRARY_GROUPS.find((group) => group.category === category);
    const nextStretchId = nextGroup?.items[0]?.value;

    setStretchEditor((current) =>
      current
        ? {
            ...current,
            category,
            stretchId: nextStretchId ?? current.stretchId,
          }
        : current
    );
  }

  function saveStretchEditor() {
    if (!stretchEditor) {
      return;
    }

    const draft = {
      stretchId: stretchEditor.stretchId,
      holdSeconds: Number(stretchEditor.holdSeconds),
      rounds: Number(stretchEditor.rounds),
    };

    const updated = stretchEditor.blockId
      ? updateStretchBlock(
          activePlan.id,
          stretchEditor.dayId,
          stretchEditor.blockId,
          draft
        )
      : addStretchBlock(
          activePlan.id,
          stretchEditor.dayId,
          draft,
          stretchEditor.insertAfterBlockId
        );

    if (!updated) {
      return;
    }

    setStretchEditor(null);
    refreshPlans(updated.id);
  }

  function openPauseEditor(
    dayId: string,
    label?: string,
    seconds?: number,
    scope: "exercise" | "workout" = "exercise",
    blockId?: string,
    insertAfterBlockId?: string | null
  ) {
    setPauseEditor({
      dayId,
      blockId,
      insertAfterBlockId: insertAfterBlockId ?? null,
      label: label ?? "",
      seconds: String(seconds ?? 60),
      scope,
    });
  }

  function savePauseEditor() {
    if (!pauseEditor) {
      return;
    }

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
          pauseEditor.insertAfterBlockId
        );

    if (!updated) {
      return;
    }

    setPauseEditor(null);
    refreshPlans(updated.id);
  }

  function handleRemoveBlock(dayId: string, blockId: string) {
    const shouldRemove = window.confirm("Diesen Block aus dem Plan entfernen?");
    if (!shouldRemove) {
      return;
    }

    const updated = removeDayBlock(activePlan.id, dayId, blockId);
    if (!updated) {
      return;
    }

    refreshPlans(updated.id);
  }

  function handleMoveBlock(
    dayId: string,
    blockId: string,
    direction: "up" | "down"
  ) {
    const updated = moveDayBlock(activePlan.id, dayId, blockId, direction);
    if (!updated) {
      return;
    }

    refreshPlans(updated.id);
  }

  function handleDuplicateBlock(dayId: string, blockId: string) {
    const updated = duplicateDayBlock(activePlan.id, dayId, blockId);
    if (!updated) {
      return;
    }

    refreshPlans(updated.id);
  }

  const canEditActivePlan = isCustomTrainingPlan(activePlan.id);

  return (
    <div style={screen}>
      <main style={shell}>
        <div style={topBar}>
          <div style={brandPill}>Gym Tracker</div>
          <a href="/history/index.html" style={historyLink}>
            ◷ Verlauf
          </a>
        </div>

        {activeWorkout ? (
          <a href={activeWorkout.href} style={resumeCard}>
            <div>
              <div style={resumeKicker}>Training läuft</div>
              <div style={resumeTitle}>
                {activeWorkout.dayName || activeWorkout.workoutLabel}
              </div>
              <div style={resumeCopy}>
                {[activeWorkout.planName, activeWorkout.stateLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span style={resumeButton}>Fortsetzen</span>
          </a>
        ) : null}

        <div style={heroCard}>
          <div style={heroTopRow}>
            <div>
              <div style={sectionTitle}>Aktiver Plan</div>
              <div style={heroTitle}>{activePlan.name}</div>
              <div style={heroMeta}>
                {activePlan.days.length} Tage ·{" "}
                {canEditActivePlan ? "Eigener Plan" : "Vorlage"}
              </div>
            </div>
            <div style={heroActions}>
              <button style={ghostAction} onClick={openPlanPicker}>
                Pläne
              </button>
              <button style={ghostAction} onClick={openPlanDetail}>
                Details
              </button>
            </div>
          </div>
          <div style={heroCopy}>{getPlanPreview(activePlan)}</div>
        </div>

        <div
          style={{
            ...dayGrid,
            gridTemplateRows: `repeat(${Math.max(
              activePlan.days.length,
              1
            )}, minmax(0, 1fr))`,
          }}
        >
          {activePlan.days.map((day) => {
            const dayBlocks = getDayBlocks(day);
            const daySummary = getEditorDaySummary(dayBlocks);
            const dayPreview = getEditorDayPreview(dayBlocks);

            return (
              <a
                key={day.id}
                href={slotHref[day.slot]}
                style={{
                  ...dayCard,
                  background: `linear-gradient(135deg, ${day.color} 0%, ${shadeColor(
                    day.color
                  )} 100%)`,
                }}
              >
                <span style={dayKicker}>{activePlan.name}</span>
                <span style={dayTitle}>{day.name}</span>
                <div style={startDaySummaryStack}>
                  <span style={dayCopy}>{daySummary}</span>
                  {dayPreview.length > 0 ? (
                    <div style={startDayPreviewRow}>
                      {dayPreview.map((item) => (
                        <span key={`${day.id}-${item}`} style={startDayPreviewChip}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </a>
            );
          })}
        </div>
      </main>

      {showPlanPicker ? (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Trainingspläne</div>
                <div style={sheetTitle}>Plan wählen</div>
              </div>
              <button style={closeButton} onClick={() => setShowPlanPicker(false)}>
                ← Zurück
              </button>
            </div>

            <div style={planGrid}>
              {availablePlans.map((plan) => {
                const isActive = plan.id === activePlan.id;
                const isCustom = isCustomTrainingPlan(plan.id);

                return (
                  <div
                    key={plan.id}
                    style={{
                      ...planCard,
                      ...(isActive ? activePlanCard : null),
                      ...(isActive ? activePlanCardFeatured : null),
                      borderColor: isActive ? plan.accent : "#e5ebf4",
                    }}
                  >
                    <div style={planCardTop}>
                      <span style={planName}>{plan.name}</span>
                      <span style={isCustom ? customBadge : templateBadge}>
                        {isCustom ? "Eigen" : "Vorlage"}
                      </span>
                    </div>
                    <span style={planCopy}>{getPlanCardText(plan)}</span>

                    <div style={planActions}>
                      <button
                        style={isActive ? activeSelectButton : selectButton}
                        onClick={() => handlePlanSelect(plan.id)}
                      >
                        {isActive ? "Aktiv" : "Nutzen"}
                      </button>
                      <button
                        style={secondaryPlanButton}
                        onClick={() => handleDuplicatePlan(plan.id)}
                      >
                        Kopie
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {showPlanDetail ? (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Plan</div>
                <div style={sheetTitle}>{activePlan.name}</div>
                <div style={detailPreview}>{getPlanPreview(activePlan)}</div>
              </div>
              <button style={closeButton} onClick={() => setShowPlanDetail(false)}>
                ← Zurück
              </button>
            </div>

            <div style={detailMetaRow}>
              <span style={canEditActivePlan ? customBadge : templateBadge}>
                {canEditActivePlan ? "Eigener Plan" : "Vorlage"}
              </span>
              <div style={detailActionRow}>
                {canEditActivePlan ? (
                  <>
                    <button
                      style={detailActionButton}
                      onClick={() => handleRenamePlan(activePlan.id)}
                    >
                      Umbenennen
                    </button>
                    <button
                      style={dangerDetailActionButton}
                      onClick={() => handleDeletePlan(activePlan.id)}
                    >
                      Löschen
                    </button>
                  </>
                ) : (
                  <button
                    style={detailActionButton}
                    onClick={() => handleDuplicatePlan(activePlan.id)}
                  >
                    Kopie
                  </button>
                )}
              </div>
            </div>

            <div style={planDetailStack}>
              {activePlan.days.map((day) => {
                const dayBlocks = getDayBlocks(day);
                const startInsertLabel = getEditorInsertPointLabel(dayBlocks, null);
                const daySummary = getEditorDaySummary(dayBlocks);
                const dayPreview = getEditorDayPreview(dayBlocks);

                return (
                <div key={day.id} style={planDetailCard}>
                  <div style={planDetailTop}>
                    <div
                      style={{
                        ...planDetailDay,
                        color: day.color,
                      }}
                    >
                      {day.name}
                    </div>
                    {canEditActivePlan ? (
                      <div style={dayToolbar}>
                        <button
                          style={secondaryMiniActionButton}
                          onClick={() => openDayEditor(day.id, day.name)}
                        >
                          Tag
                        </button>
                        <button
                          style={secondaryMiniActionButton}
                          onClick={() => openAddExercise(day.id)}
                        >
                          + Übung
                        </button>
                        <button
                          style={quickAddButton}
                          onClick={() => openAddExercisePreset(day.id, "compound")}
                        >
                          + Grund
                        </button>
                        <button
                          style={quickAddButton}
                          onClick={() => openAddExercisePreset(day.id, "isolation")}
                        >
                          + Iso
                        </button>
                        <button
                          style={quickAddButton}
                          onClick={() => openStretchEditor(day.id)}
                        >
                          + Dehnen
                        </button>
                        <button
                          style={quickAddButton}
                          onClick={() => openPauseEditor(day.id)}
                        >
                          + Pause
                        </button>
                        <button
                          style={quickAddButton}
                          onClick={() => openPauseEditor(day.id, "Workout-Pause", 60, "workout")}
                        >
                          + Workout
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div style={daySummaryStack}>
                    <div style={daySummaryLine}>{daySummary}</div>
                    {dayPreview.length > 0 ? (
                      <div style={dayPreviewRow}>
                        {dayPreview.map((item) => (
                          <span key={`${day.id}-${item}`} style={dayPreviewChip}>
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={exerciseList}>
                    {canEditActivePlan ? (
                      <div style={insertRow}>
                        <span style={insertLabel}>{startInsertLabel}</span>
                        <button
                          style={insertActionButton}
                          onClick={() => openAddExercisePreset(day.id, "compound")}
                        >
                          Grund
                        </button>
                        <button
                          style={insertActionButton}
                          onClick={() => openAddExercisePreset(day.id, "isolation")}
                        >
                          Iso
                        </button>
                        <button
                          style={insertActionButton}
                          onClick={() => openStretchEditor(day.id)}
                        >
                          Dehnen
                        </button>
                        <button
                          style={insertActionButton}
                          onClick={() => openPauseEditor(day.id)}
                        >
                          Pause
                        </button>
                      </div>
                    ) : null}
                    {dayBlocks.map((block, blockIndex) => {
                      const editableExercise = getEditableExerciseForBlock(
                        block,
                        day.exercises
                      );
                      const blockSectionLabel = getEditorSectionLabel(
                        dayBlocks,
                        blockIndex
                      );
                      const insertPointLabel = getEditorInsertPointLabel(
                        dayBlocks,
                        block.id
                      );
                      const moveUpLabel = getEditorMoveTargetLabel(
                        dayBlocks,
                        blockIndex,
                        "up"
                      );
                      const moveDownLabel = getEditorMoveTargetLabel(
                        dayBlocks,
                        blockIndex,
                        "down"
                      );
                      const blockContextLabel =
                        block.type === "stretch" || block.type === "pause"
                          ? getEditorBlockContextLabel(dayBlocks, block.id)
                          : "";
                      const warmupExercise =
                        block.type === "warmup"
                          ? day.exercises.find(
                              (exercise) => exercise.id === block.parentExerciseId
                            ) ?? null
                          : null;

                      return (
                        <Fragment key={block.id}>
                          {blockSectionLabel ? (
                            <div style={editorSectionLabel}>{blockSectionLabel}</div>
                          ) : null}
                          <div
                            style={{
                              ...exerciseRow,
                              ...(block.type === "exercise" ? null : nestedBlockRow),
                            }}
                          >
                            <div style={exerciseRowTop}>
                              <div style={blockInfo}>
                                <span style={exerciseName}>{getBlockTitle(block)}</span>
                                <span style={getBlockBadgeStyle(block.type)}>
                                  {getBlockBadgeLabel(block.type)}
                                </span>
                              </div>
                              {canEditActivePlan ? (
                                <div style={blockControlStack}>
                                  <div style={miniActionRow}>
                                    <button
                                      style={miniIconButton}
                                      onClick={() => handleMoveBlock(day.id, block.id, "up")}
                                      disabled={blockIndex === 0}
                                    >
                                      ↑
                                    </button>
                                    <button
                                      style={miniIconButton}
                                      onClick={() => handleMoveBlock(day.id, block.id, "down")}
                                      disabled={blockIndex === dayBlocks.length - 1}
                                    >
                                      ↓
                                    </button>
                                  </div>
                                  <div style={moveHintRow}>
                                    <span style={moveHintText}>↑ {moveUpLabel}</span>
                                    <span style={moveHintText}>↓ {moveDownLabel}</span>
                                  </div>
                                  {editableExercise ? (
                                    <div style={miniActionRow}>
                                      <button
                                        style={miniActionButton}
                                        onClick={() => openEditExercise(day.id, editableExercise)}
                                      >
                                        Bearb.
                                      </button>
                                      <button
                                        style={secondaryMiniActionButton}
                                        onClick={() => handleDuplicateBlock(day.id, block.id)}
                                      >
                                        Kopie
                                      </button>
                                      <button
                                        style={dangerMiniActionButton}
                                        onClick={() =>
                                          handleRemoveExercise(day.id, editableExercise.id)
                                        }
                                      >
                                        Löschen
                                      </button>
                                    </div>
                                  ) : block.type === "warmup" && warmupExercise ? (
                                    <div style={miniActionRow}>
                                      <button
                                        style={miniActionButton}
                                        onClick={() =>
                                          openWarmupEditor(
                                            day.id,
                                            warmupExercise.id,
                                            getExerciseLabel(warmupExercise.name),
                                            block.rounds,
                                            block.restSeconds
                                          )
                                        }
                                      >
                                        Bearb.
                                      </button>
                                    </div>
                                  ) : block.type === "stretch" ? (
                                    <div style={miniActionRow}>
                                      <button
                                        style={miniActionButton}
                                        onClick={() =>
                                          openStretchEditor(
                                            day.id,
                                            block.stretchId,
                                            block.holdSeconds,
                                            block.rounds,
                                            block.id
                                          )
                                        }
                                      >
                                        Bearb.
                                      </button>
                                      <button
                                        style={secondaryMiniActionButton}
                                        onClick={() => handleDuplicateBlock(day.id, block.id)}
                                      >
                                        Kopie
                                      </button>
                                      <button
                                        style={dangerMiniActionButton}
                                        onClick={() => handleRemoveBlock(day.id, block.id)}
                                      >
                                        Löschen
                                      </button>
                                    </div>
                                  ) : block.type === "pause" ? (
                                    <div style={miniActionRow}>
                                      <button
                                        style={miniActionButton}
                                        onClick={() =>
                                          openPauseEditor(
                                            day.id,
                                            block.label,
                                            block.seconds,
                                            block.scope,
                                            block.id
                                          )
                                        }
                                      >
                                        Bearb.
                                      </button>
                                      <button
                                        style={secondaryMiniActionButton}
                                        onClick={() => handleDuplicateBlock(day.id, block.id)}
                                      >
                                        Kopie
                                      </button>
                                      <button
                                        style={dangerMiniActionButton}
                                        onClick={() => handleRemoveBlock(day.id, block.id)}
                                      >
                                        Löschen
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <span style={exerciseMeta}>{getBlockMeta(block)}</span>
                            {blockContextLabel ? (
                              <span style={blockContextMeta}>{blockContextLabel}</span>
                            ) : null}
                          </div>
                          {canEditActivePlan ? (
                            <div style={insertRow}>
                              <span style={insertLabel}>{insertPointLabel}</span>
                              <button
                                style={insertActionButton}
                                onClick={() => openAddExercisePreset(day.id, "compound", block.id)}
                              >
                                Grund
                              </button>
                              <button
                                style={insertActionButton}
                                onClick={() => openAddExercisePreset(day.id, "isolation", block.id)}
                              >
                                Iso
                              </button>
                              <button
                                style={insertActionButton}
                                onClick={() => openStretchEditor(day.id, undefined, undefined, undefined, undefined, block.id)}
                              >
                                Dehnen
                              </button>
                              <button
                                style={insertActionButton}
                                onClick={() => openPauseEditor(day.id, undefined, undefined, "exercise", undefined, block.id)}
                              >
                                Pause
                              </button>
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      ) : null}

      {dayEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Tag</div>
                <div style={sheetTitle}>Namen anpassen</div>
              </div>
              <button style={closeButton} onClick={() => setDayEditor(null)}>
                ← Zurück
              </button>
            </div>

            <label style={fieldStack}>
              <span style={fieldLabel}>Name</span>
              <input
                style={textInput}
                value={dayEditor.value}
                onChange={(event) =>
                  setDayEditor((current) =>
                    current
                      ? {
                          ...current,
                          value: event.target.value,
                        }
                      : current
                  )
                }
              />
            </label>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setDayEditor(null)}>
                Abbrechen
              </button>
              <button style={activeSelectButton} onClick={saveDayEditor}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exerciseEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            {(() => {
              const selectedExerciseMeta = getExerciseCatalogEntry(exerciseEditor.name);
              const visibleExerciseGroups = EXERCISE_LIBRARY_GROUPS.filter(
                (group) => group.category === exerciseEditor.category
              );

              return (
                <>
                  <div style={sheetHeader}>
                    <div>
                      <div style={sectionTitle}>Übung</div>
                      <div style={sheetTitle}>
                        {exerciseEditor.exerciseId ? "Übung bearbeiten" : "Übung hinzufügen"}
                      </div>
                    </div>
                    <button
                      style={closeButton}
                      onClick={() => setExerciseEditor(null)}
                    >
                      ← Zurück
                    </button>
                  </div>

                  <div style={editorContextCard}>
                    <span style={editorContextLabel}>Ablauf</span>
                    <span style={editorContextValue}>
                      {exerciseEditor.exerciseId
                        ? getEditorBlockContextLabel(
                            getDayBlocks(
                              activePlan.days.find((day) => day.id === exerciseEditor.dayId) ??
                                activePlan.days[0]
                            ),
                            `exercise:${exerciseEditor.exerciseId}`
                          ) || "Übungsblock im Ablauf"
                        : getEditorInsertContextLabel(
                            getDayBlocks(
                              activePlan.days.find((day) => day.id === exerciseEditor.dayId) ??
                                activePlan.days[0]
                            ),
                            exerciseEditor.insertAfterBlockId
                          )}
                    </span>
                  </div>

                  <div style={fieldGrid}>
                    <div style={{ ...infoRow, gridColumn: "1 / -1" }}>
                      {EXERCISE_LIBRARY_GROUPS.map((group) => (
                        <button
                          key={group.category}
                          style={
                            group.category === exerciseEditor.category
                              ? activeSelectButton
                              : selectButton
                          }
                          onClick={() => {
                            const nextExerciseId = group.items[0]?.value;
                            if (nextExerciseId) {
                              applySuggestedExerciseSetup(nextExerciseId);
                            }
                          }}
                        >
                          {group.category}
                        </button>
                      ))}
                    </div>

                    <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                      <span style={fieldLabel}>Übung</span>
                      <select
                        style={textInput}
                        value={exerciseEditor.name}
                        onChange={(event) => applySuggestedExerciseSetup(event.target.value)}
                      >
                        {visibleExerciseGroups.map((group) => (
                          <optgroup key={group.category} label={group.category}>
                            {group.items.map((exercise) => (
                              <option key={exercise.value} value={exercise.value}>
                                {exercise.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    {selectedExerciseMeta ? (
                      <div style={{ ...infoRow, gridColumn: "1 / -1" }}>
                        <span style={infoChip}>
                          {selectedExerciseMeta.kind === "compound"
                            ? "Grundübung"
                            : "Isolation"}
                        </span>
                        <span style={infoChip}>{selectedExerciseMeta.category}</span>
                        {selectedExerciseMeta.supportsAssistanceWeight ? (
                          <span style={infoChip}>Unterstützungsgewicht</span>
                        ) : null}
                      </div>
                    ) : null}

                    <div style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                      <span style={fieldLabel}>Schnellwahl</span>
                      <div style={quickValueGrid}>
                        {[3, 4, 5].map((sets) => (
                          <button
                            key={`sets-${sets}`}
                            style={
                              exerciseEditor.sets === String(sets)
                                ? activeQuickValueButton
                                : quickValueButton
                            }
                            onClick={() =>
                              setExerciseEditor((current) =>
                                current ? { ...current, sets: String(sets) } : current
                              )
                            }
                          >
                            {sets} Sätze
                          </button>
                        ))}
                        {[
                          { min: 5, max: 8 },
                          { min: 6, max: 10 },
                          { min: 8, max: 12 },
                          { min: 10, max: 15 },
                        ].map((range) => {
                          const active =
                            exerciseEditor.minReps === String(range.min) &&
                            exerciseEditor.maxReps === String(range.max);

                          return (
                            <button
                              key={`range-${range.min}-${range.max}`}
                              style={active ? activeQuickValueButton : quickValueButton}
                              onClick={() =>
                                setExerciseEditor((current) =>
                                  current
                                    ? {
                                        ...current,
                                        minReps: String(range.min),
                                        maxReps: String(range.max),
                                      }
                                    : current
                                )
                              }
                            >
                              {range.min}-{range.max} Wdh
                            </button>
                          );
                        })}
                        {[60, 75, 90, 120, 150, 180].map((seconds) => (
                          <button
                            key={`rest-${seconds}`}
                            style={
                              exerciseEditor.restSeconds === String(seconds)
                                ? activeQuickValueButton
                                : quickValueButton
                            }
                            onClick={() =>
                              setExerciseEditor((current) =>
                                current
                                  ? { ...current, restSeconds: String(seconds) }
                                  : current
                              )
                            }
                          >
                            {seconds} Sek
                          </button>
                        ))}
                      </div>
                    </div>

                    <label style={fieldStack}>
                      <span style={fieldLabel}>Sätze</span>
                      <input
                        style={textInput}
                        inputMode="numeric"
                        value={exerciseEditor.sets}
                        onChange={(event) =>
                          setExerciseEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  sets: event.target.value,
                                }
                              : current
                          )
                        }
                      />
                    </label>

                    <label style={fieldStack}>
                      <span style={fieldLabel}>Min. Wdh</span>
                      <input
                        style={textInput}
                        inputMode="numeric"
                        value={exerciseEditor.minReps}
                        onChange={(event) =>
                          setExerciseEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  minReps: event.target.value,
                                }
                              : current
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
                            current
                              ? {
                                  ...current,
                                  maxReps: event.target.value,
                                }
                              : current
                          )
                        }
                      />
                    </label>

                    <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                      <span style={fieldLabel}>Pause (Sekunden)</span>
                      <input
                        style={textInput}
                        inputMode="numeric"
                        value={exerciseEditor.restSeconds}
                        onChange={(event) =>
                          setExerciseEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  restSeconds: event.target.value,
                                }
                              : current
                          )
                        }
                      />
                    </label>
                  </div>

                  <div style={editorActions}>
                    <button style={selectButton} onClick={() => setExerciseEditor(null)}>
                      Abbrechen
                    </button>
                    <button
                      style={selectButton}
                      onClick={() => applySuggestedExerciseSetup(exerciseEditor.name)}
                    >
                      Standards
                    </button>
                    <button style={activeSelectButton} onClick={saveExerciseEditor}>
                      Speichern
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {warmupEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Aufwärmen</div>
                <div style={sheetTitle}>{warmupEditor.exerciseLabel}</div>
              </div>
              <button
                style={closeButton}
                onClick={() => setWarmupEditor(null)}
              >
                ← Zurück
              </button>
            </div>

            <div style={fieldGrid}>
              <div style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Schnellwahl</span>
                <div style={quickValueGrid}>
                  {[0, 1, 3].map((rounds) => (
                    <button
                      key={`warmup-rounds-${rounds}`}
                      style={
                        warmupEditor.rounds === String(rounds)
                          ? activeQuickValueButton
                          : quickValueButton
                      }
                      onClick={() =>
                        setWarmupEditor((current) =>
                          current ? { ...current, rounds: String(rounds) } : current
                        )
                      }
                    >
                      {rounds} Sätze
                    </button>
                  ))}
                  {[45, 60, 90].map((seconds) => (
                    <button
                      key={`warmup-rest-${seconds}`}
                      style={
                        warmupEditor.restSeconds === String(seconds)
                          ? activeQuickValueButton
                          : quickValueButton
                      }
                      onClick={() =>
                        setWarmupEditor((current) =>
                          current
                            ? { ...current, restSeconds: String(seconds) }
                            : current
                        )
                      }
                    >
                      {seconds} Sek
                    </button>
                  ))}
                </div>
              </div>

              <label style={fieldStack}>
                <span style={fieldLabel}>Aufwärmsätze</span>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={warmupEditor.rounds}
                  onChange={(event) =>
                    setWarmupEditor((current) =>
                      current
                        ? {
                            ...current,
                            rounds: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Pause (Sekunden)</span>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={warmupEditor.restSeconds}
                  onChange={(event) =>
                    setWarmupEditor((current) =>
                      current
                        ? {
                            ...current,
                            restSeconds: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </label>
            </div>

            <div style={editorHint}>
              <span>0 Aufwärmsätze blendet den Block aus.</span>
            </div>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setWarmupEditor(null)}>
                Abbrechen
              </button>
              <button style={activeSelectButton} onClick={saveWarmupEditor}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stretchEditor ? (
        <div style={overlay}>
          <div style={editorSheet}>
            {(() => {
              const visibleStretchGroups = STRETCH_LIBRARY_GROUPS.filter(
                (group) => group.category === stretchEditor.category
              );

              return (
                <>
                  <div style={sheetHeader}>
                    <div>
                      <div style={sectionTitle}>Dehnen</div>
                      <div style={sheetTitle}>
                        {stretchEditor.blockId ? "Dehnblock bearbeiten" : "Dehnblock hinzufügen"}
                      </div>
                    </div>
                    <button style={closeButton} onClick={() => setStretchEditor(null)}>
                      ← Zurück
                    </button>
                  </div>

                  {stretchEditor.blockId ? (
                    <div style={editorContextCard}>
                      <span style={editorContextLabel}>Ablauf</span>
                      <span style={editorContextValue}>
                        {getEditorBlockContextLabel(
                          getDayBlocks(
                            activePlan.days.find((day) => day.id === stretchEditor.dayId) ??
                              activePlan.days[0]
                          ),
                          stretchEditor.blockId
                        ) || "Zusatzblock im Ablauf"}
                      </span>
                    </div>
                  ) : null}

                  <div style={fieldGrid}>
                    <div style={{ ...infoRow, gridColumn: "1 / -1" }}>
                      {STRETCH_LIBRARY_GROUPS.map((group) => (
                        <button
                          key={group.category}
                          style={
                            group.category === stretchEditor.category
                              ? activeSelectButton
                              : selectButton
                          }
                          onClick={() => applyStretchCategory(group.category)}
                        >
                          {group.category}
                        </button>
                      ))}
                    </div>

                    <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                      <span style={fieldLabel}>Dehnung</span>
                      <select
                        style={textInput}
                        value={stretchEditor.stretchId}
                        onChange={(event) =>
                          setStretchEditor((current) =>
                            current
                              ? { ...current, stretchId: event.target.value }
                              : current
                          )
                        }
                      >
                        {visibleStretchGroups.map((group) => (
                          <optgroup key={group.category} label={group.category}>
                            {group.items.map((stretch) => (
                              <option key={stretch.value} value={stretch.value}>
                                {stretch.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    <div style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                      <span style={fieldLabel}>Schnellwahl</span>
                      <div style={quickValueGrid}>
                        {[20, 30, 45, 60].map((seconds) => (
                          <button
                            key={`stretch-hold-${seconds}`}
                            style={
                              stretchEditor.holdSeconds === String(seconds)
                                ? activeQuickValueButton
                                : quickValueButton
                            }
                            onClick={() =>
                              setStretchEditor((current) =>
                                current
                                  ? { ...current, holdSeconds: String(seconds) }
                                  : current
                              )
                            }
                          >
                            {seconds} Sek
                          </button>
                        ))}
                        {[1, 2, 3].map((rounds) => (
                          <button
                            key={`stretch-rounds-${rounds}`}
                            style={
                              stretchEditor.rounds === String(rounds)
                                ? activeQuickValueButton
                                : quickValueButton
                            }
                            onClick={() =>
                              setStretchEditor((current) =>
                                current ? { ...current, rounds: String(rounds) } : current
                              )
                            }
                          >
                            {rounds} Runden
                          </button>
                        ))}
                      </div>
                    </div>

                    <label style={fieldStack}>
                      <span style={fieldLabel}>Halten (Sekunden)</span>
                      <input
                        style={textInput}
                        inputMode="numeric"
                        value={stretchEditor.holdSeconds}
                        onChange={(event) =>
                          setStretchEditor((current) =>
                            current
                              ? { ...current, holdSeconds: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>

                    <label style={fieldStack}>
                      <span style={fieldLabel}>Runden</span>
                      <input
                        style={textInput}
                        inputMode="numeric"
                        value={stretchEditor.rounds}
                        onChange={(event) =>
                          setStretchEditor((current) =>
                            current
                              ? { ...current, rounds: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                  </div>

                  <div style={editorActions}>
                    <button style={selectButton} onClick={() => setStretchEditor(null)}>
                      Abbrechen
                    </button>
                    <button style={activeSelectButton} onClick={saveStretchEditor}>
                      Speichern
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

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
              <button style={closeButton} onClick={() => setPauseEditor(null)}>
                ← Zurück
              </button>
            </div>

            {pauseEditor.blockId ? (
              <div style={editorContextCard}>
                <span style={editorContextLabel}>Ablauf</span>
                <span style={editorContextValue}>
                  {getEditorBlockContextLabel(
                    getDayBlocks(
                      activePlan.days.find((day) => day.id === pauseEditor.dayId) ??
                        activePlan.days[0]
                    ),
                    pauseEditor.blockId
                  ) || "Zusatzblock im Ablauf"}
                </span>
              </div>
            ) : null}

            <div style={fieldGrid}>
              <div style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Schnellwahl</span>
                <div style={quickValueGrid}>
                  {[
                    { label: "Übung", value: "exercise" },
                    { label: "Workout", value: "workout" },
                  ].map((scope) => (
                    <button
                      key={`pause-scope-${scope.value}`}
                      style={
                        pauseEditor.scope === scope.value
                          ? activeQuickValueButton
                          : quickValueButton
                      }
                      onClick={() =>
                        setPauseEditor((current) =>
                          current
                            ? {
                                ...current,
                                scope: scope.value as "exercise" | "workout",
                              }
                            : current
                        )
                      }
                    >
                      {scope.label}
                    </button>
                  ))}
                  {[30, 45, 60, 90, 120, 180].map((seconds) => (
                    <button
                      key={`pause-seconds-${seconds}`}
                      style={
                        pauseEditor.seconds === String(seconds)
                          ? activeQuickValueButton
                          : quickValueButton
                      }
                      onClick={() =>
                        setPauseEditor((current) =>
                          current ? { ...current, seconds: String(seconds) } : current
                        )
                      }
                    >
                      {seconds} Sek
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Name</span>
                <input
                  style={textInput}
                  value={pauseEditor.label}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current
                        ? { ...current, label: event.target.value }
                        : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Sekunden</span>
                <input
                  style={textInput}
                  inputMode="numeric"
                  value={pauseEditor.seconds}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current
                        ? { ...current, seconds: event.target.value }
                        : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Typ</span>
                <select
                  style={textInput}
                  value={pauseEditor.scope}
                  onChange={(event) =>
                    setPauseEditor((current) =>
                      current
                        ? {
                            ...current,
                            scope: event.target.value as "exercise" | "workout",
                          }
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
              <button style={selectButton} onClick={() => setPauseEditor(null)}>
                Abbrechen
              </button>
              <button style={activeSelectButton} onClick={savePauseEditor}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
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
  if (seconds % 60 === 0) {
    return `${seconds / 60} Min`;
  }

  return `${seconds} Sek`;
}

function sortPlansForPicker(plans: TrainingPlan[], activePlanId: string) {
  return [...plans].sort((left, right) => {
    if (left.id === activePlanId) {
      return -1;
    }

    if (right.id === activePlanId) {
      return 1;
    }

    if (isCustomTrainingPlan(left.id) !== isCustomTrainingPlan(right.id)) {
      return isCustomTrainingPlan(left.id) ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "de");
  });
}

function isExerciseBlock(block: TrainingPlanBlock): block is ExercisePlanBlock {
  return block.type === "exercise";
}

function getEditableExerciseForBlock(
  block: TrainingPlanBlock,
  exercises: TrainingPlan["days"][number]["exercises"]
) {
  if (!isExerciseBlock(block)) {
    return null;
  }

  return exercises.find((exercise) => exercise.id === block.exerciseId) ?? null;
}

function getBlockTitle(block: TrainingPlanBlock) {
  if (block.type === "exercise") {
    return block.label;
  }

  return block.label;
}

function getBlockMeta(block: TrainingPlanBlock) {
  if (block.type === "exercise") {
    return `${block.sets} x ${block.minReps}-${block.maxReps} · ${formatRest(
      block.restSeconds
    )}`;
  }

  if (block.type === "warmup") {
    return `${block.rounds} Aufwärmsätze · ${formatRest(block.restSeconds)}`;
  }

  if (block.type === "stretch") {
    return `${block.rounds} Runden · ${block.holdSeconds} Sek halten`;
  }

  return `${formatRest(block.seconds)} · ${
    block.scope === "workout" ? "Workout-Pause" : "Übungspause"
  }`;
}

function getEditorBlockContextLabel(
  dayBlocks: TrainingPlanBlock[],
  blockId: string
) {
  const blockIndex = dayBlocks.findIndex((block) => block.id === blockId);

  if (blockIndex === -1) {
    return "";
  }

  let previousExerciseLabel: string | null = null;
  for (let index = blockIndex - 1; index >= 0; index -= 1) {
    const block = dayBlocks[index];
    if (block.type === "exercise") {
      previousExerciseLabel = block.label;
      break;
    }
  }

  let nextExerciseLabel: string | null = null;
  for (let index = blockIndex + 1; index < dayBlocks.length; index += 1) {
    const block = dayBlocks[index];
    if (block.type === "exercise") {
      nextExerciseLabel = block.label;
      break;
    }
  }

  if (previousExerciseLabel && nextExerciseLabel) {
    return `Zwischen ${previousExerciseLabel} und ${nextExerciseLabel}`;
  }

  if (nextExerciseLabel) {
    return `Vor ${nextExerciseLabel}`;
  }

  if (previousExerciseLabel) {
    return `Nach ${previousExerciseLabel}`;
  }

  return "";
}

function getEditorInsertContextLabel(
  dayBlocks: TrainingPlanBlock[],
  insertAfterBlockId?: string | null
) {
  if (!insertAfterBlockId) {
    const firstExercise = dayBlocks.find((block) => block.type === "exercise");
    return firstExercise?.type === "exercise"
      ? `Am Anfang · vor ${firstExercise.label}`
      : "Am Anfang des Tages";
  }

  const afterIndex = dayBlocks.findIndex((block) => block.id === insertAfterBlockId);
  if (afterIndex === -1) {
    return "Neue Position im Ablauf";
  }

  const afterBlock = dayBlocks[afterIndex];
  let nextExerciseLabel: string | null = null;

  for (let index = afterIndex + 1; index < dayBlocks.length; index += 1) {
    const block = dayBlocks[index];
    if (block.type === "exercise") {
      nextExerciseLabel = block.label;
      break;
    }
  }

  if (afterBlock.type === "exercise" && nextExerciseLabel) {
    return `Nach ${afterBlock.label} · vor ${nextExerciseLabel}`;
  }

  if (afterBlock.type === "exercise") {
    return `Nach ${afterBlock.label}`;
  }

  return nextExerciseLabel
    ? `Nach ${afterBlock.label} · vor ${nextExerciseLabel}`
    : `Nach ${afterBlock.label}`;
}

function getEditorSectionLabel(
  dayBlocks: TrainingPlanBlock[],
  blockIndex: number
) {
  const block = dayBlocks[blockIndex];

  if (!block) {
    return "";
  }

  if (block.type === "exercise") {
    let exerciseOrder = 0;

    for (let index = 0; index <= blockIndex; index += 1) {
      if (dayBlocks[index]?.type === "exercise") {
        exerciseOrder += 1;
      }
    }

    return `Übung ${exerciseOrder}`;
  }

  if (blockIndex === 0 && (block.type === "stretch" || block.type === "pause")) {
    return "Start";
  }

  return "";
}

function getEditorInsertPointLabel(
  dayBlocks: TrainingPlanBlock[],
  insertAfterBlockId: string | null
) {
  if (!insertAfterBlockId) {
    const firstExerciseIndex = dayBlocks.findIndex(
      (block) => block.type === "exercise"
    );

    if (firstExerciseIndex === -1) {
      return "Start";
    }

    return `Start · vor Übung ${getExerciseSectionNumber(dayBlocks, firstExerciseIndex)}`;
  }

  const blockIndex = dayBlocks.findIndex((block) => block.id === insertAfterBlockId);
  if (blockIndex === -1) {
    return "Danach";
  }

  const nextExerciseIndex = dayBlocks.findIndex(
    (block, index) => index > blockIndex && block.type === "exercise"
  );

  if (nextExerciseIndex === -1) {
    return "Danach · am Ende";
  }

  return `Danach · vor Übung ${getExerciseSectionNumber(dayBlocks, nextExerciseIndex)}`;
}

function getExerciseSectionNumber(
  dayBlocks: TrainingPlanBlock[],
  blockIndex: number
) {
  let exerciseOrder = 0;

  for (let index = 0; index <= blockIndex; index += 1) {
    if (dayBlocks[index]?.type === "exercise") {
      exerciseOrder += 1;
    }
  }

  return exerciseOrder;
}

function getEditorDaySummary(dayBlocks: TrainingPlanBlock[]) {
  const exerciseCount = dayBlocks.filter((block) => block.type === "exercise").length;
  const warmupCount = dayBlocks.filter((block) => block.type === "warmup").length;
  const stretchCount = dayBlocks.filter((block) => block.type === "stretch").length;
  const pauseCount = dayBlocks.filter((block) => block.type === "pause").length;

  const parts = [`${exerciseCount} Übungen`];

  if (warmupCount > 0) {
    parts.push(`${warmupCount} Aufwärmen`);
  }
  if (stretchCount > 0) {
    parts.push(`${stretchCount} Dehnen`);
  }
  if (pauseCount > 0) {
    parts.push(`${pauseCount} Pausen`);
  }

  return parts.join(" · ");
}

function getEditorDayPreview(dayBlocks: TrainingPlanBlock[]) {
  return dayBlocks.slice(0, 5).map((block) => {
    if (block.type === "exercise") {
      return block.label;
    }

    if (block.type === "warmup") {
      return "Aufwärmen";
    }

    if (block.type === "stretch") {
      return "Dehnen";
    }

    return block.scope === "workout" ? "Workout-Pause" : "Pause";
  });
}

function getEditorMoveTargetLabel(
  dayBlocks: TrainingPlanBlock[],
  blockIndex: number,
  direction: "up" | "down"
) {
  const nextIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;

  if (nextIndex < 0) {
    return "Start";
  }

  if (nextIndex >= dayBlocks.length) {
    return "Ende";
  }

  let targetExerciseIndex = -1;

  if (direction === "up") {
    for (let index = nextIndex; index >= 0; index -= 1) {
      if (dayBlocks[index]?.type === "exercise") {
        targetExerciseIndex = index;
        break;
      }
    }
  } else {
    for (let index = nextIndex; index < dayBlocks.length; index += 1) {
      if (dayBlocks[index]?.type === "exercise") {
        targetExerciseIndex = index;
        break;
      }
    }
  }

  if (targetExerciseIndex === -1) {
    return direction === "up" ? "früher" : "später";
  }

  return `zu Übung ${getExerciseSectionNumber(dayBlocks, targetExerciseIndex)}`;
}

function getBlockBadgeLabel(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") {
    return "Übung";
  }

  if (type === "warmup") {
    return "Aufwärmen";
  }

  if (type === "stretch") {
    return "Dehnen";
  }

  return "Pause";
}

function getBlockBadgeStyle(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") {
    return blockBadgeExercise;
  }

  if (type === "warmup") {
    return blockBadgeWarmup;
  }

  if (type === "stretch") {
    return blockBadgeStretch;
  }

  return blockBadgePause;
}

const screen = {
  minHeight: "100dvh",
  padding: "10px",
  background:
    "radial-gradient(circle at top, #dde6f5 0%, #f3f5f9 42%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
  position: "relative" as const,
};

const shell = {
  maxWidth: 460,
  minHeight: "calc(100dvh - 20px)",
  margin: "0 auto",
  padding: "12px",
  borderRadius: 28,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  display: "grid",
  gridTemplateRows: "auto auto 1fr",
  gap: 10,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 13,
  fontWeight: "bold",
};

const historyLink = {
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#1d4ed8",
  background: "#eef4ff",
  border: "1px solid #d7e1ef",
  fontWeight: "bold",
  fontSize: 13,
};

const resumeCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 18,
  textDecoration: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  color: "#ffffff",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  boxShadow: "0 16px 30px rgba(15, 23, 42, 0.16)",
};

const resumeKicker = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "rgba(255,255,255,0.68)",
  fontWeight: "bold",
};

const resumeTitle = {
  marginTop: 3,
  fontSize: 17,
  fontWeight: "bold",
  lineHeight: 1.1,
};

const resumeCopy = {
  marginTop: 4,
  fontSize: 11,
  lineHeight: 1.3,
  color: "rgba(255,255,255,0.78)",
  fontWeight: 600,
};

const resumeButton = {
  minHeight: 30,
  padding: "5px 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const heroCard = {
  padding: "11px 13px",
  borderRadius: 22,
  background: "linear-gradient(135deg, #ffffff 0%, #f6f9ff 100%)",
  border: "1px solid #dde6f3",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
};

const heroTopRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
};

const heroTitle = {
  marginTop: 2,
  fontSize: 18,
  fontWeight: "bold",
  lineHeight: 1.05,
  color: "#111827",
};

const heroMeta = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.2,
  color: "#64748b",
};

const heroActions = {
  display: "flex",
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 6,
  justifyContent: "end",
};

const ghostAction = {
  minHeight: 30,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "rgba(255,255,255,0.96)",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
};

const heroCopy = {
  marginTop: 5,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.3,
  color: "#475569",
};

const sectionTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: "#64748b",
  fontWeight: "bold",
};

const dayGrid = {
  display: "grid",
  gap: 7,
  minHeight: 0,
};

const dayCard = {
  borderRadius: 24,
  color: "#fff",
  textDecoration: "none",
  padding: "11px 13px",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  minHeight: 0,
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.14)",
};

const dayKicker = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  opacity: 0.78,
};

const dayTitle = {
  fontSize: 22,
  lineHeight: 1,
  fontWeight: "bold",
};

const dayCopy = {
  fontSize: 11,
  lineHeight: 1.3,
  fontWeight: 700,
  opacity: 0.94,
};

const startDaySummaryStack = {
  display: "grid",
  gap: 7,
};

const startDayPreviewRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const startDayPreviewChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.16)",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  color: "#ffffff",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  backdropFilter: "blur(6px)",
};

const overlay = {
  position: "fixed" as const,
  inset: 0,
  padding: 16,
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.22) 0%, rgba(15, 23, 42, 0.38) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const sheet = {
  width: "100%",
  maxWidth: 460,
  maxHeight: "88dvh",
  overflowY: "auto" as const,
  padding: 14,
  borderRadius: 26,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #dce5f1",
  boxShadow: "0 30px 80px rgba(15, 23, 42, 0.2)",
};

const editorSheet = {
  ...sheet,
  maxWidth: 420,
};

const sheetHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
  marginBottom: 10,
};

const sheetTitle = {
  marginTop: 4,
  fontSize: 22,
  fontWeight: "bold",
  lineHeight: 1.05,
  color: "#111827",
};

const closeButton = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f8fafc",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
};

const planGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const planCard = {
  padding: "11px 11px 10px",
  borderRadius: 18,
  border: "1px solid #e5ebf4",
  background: "#f8fafc",
  display: "grid",
  gap: 5,
};

const activePlanCard = {
  background: "#eef4ff",
  boxShadow: "0 12px 28px rgba(37, 99, 235, 0.10)",
};

const activePlanCardFeatured = {
  gridColumn: "1 / -1",
};

const planCardTop = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 8,
};

const planName = {
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
  lineHeight: 1.15,
};

const planCopy = {
  fontSize: 11,
  color: "#475569",
  lineHeight: 1.25,
};

const planActions = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 2,
};

const selectButton = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
};

const activeSelectButton = {
  ...selectButton,
  background: "#111827",
  color: "#ffffff",
  border: "1px solid #111827",
};

const secondaryPlanButton = {
  ...selectButton,
  background: "#f3f6fb",
};

const dangerPlanButton = {
  ...selectButton,
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#be123c",
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

const detailMetaRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 10,
  marginBottom: 10,
};

const detailActionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  justifyContent: "end",
};

const detailActionButton = {
  minHeight: 32,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f8fafc",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
};

const dangerDetailActionButton = {
  ...detailActionButton,
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#be123c",
};

const planDetailStack = {
  display: "grid",
  gap: 8,
};

const planDetailCard = {
  padding: "11px 11px 10px",
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5ebf4",
};

const planDetailTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "start",
};

const planDetailDay = {
  fontSize: 17,
  fontWeight: "bold",
  lineHeight: 1.1,
};

const detailPreview = {
  marginTop: 5,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.3,
  color: "#475569",
};

const daySummaryStack = {
  display: "grid",
  gap: 6,
  marginTop: 6,
};

const daySummaryLine = {
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  lineHeight: 1.3,
};

const dayPreviewRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const dayPreviewChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 8px",
  borderRadius: 999,
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  color: "#334155",
  fontSize: 11,
  fontWeight: "bold",
};

const miniActionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const moveHintRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  justifyContent: "end",
};

const moveHintText = {
  fontSize: 10,
  fontWeight: "bold",
  color: "#94a3b8",
  letterSpacing: "0.03em",
};

const dayToolbar = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  justifyContent: "end",
};

const miniActionButton = {
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 11,
  fontWeight: "bold",
};

const secondaryMiniActionButton = {
  ...miniActionButton,
  background: "#f8fafc",
  color: "#475569",
};

const quickAddButton = {
  ...miniActionButton,
  background: "#eef4ff",
  border: "1px solid #dbe7ff",
  color: "#1d4ed8",
};

const dangerMiniActionButton = {
  ...miniActionButton,
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#be123c",
};

const miniIconButton = {
  minHeight: 28,
  minWidth: 28,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  opacity: 0.92,
};

const exerciseList = {
  marginTop: 8,
  display: "grid",
  gap: 6,
};

const exerciseRow = {
  display: "grid",
  gap: 4,
  paddingTop: 6,
  borderTop: "1px solid #e7edf5",
};

const nestedBlockRow = {
  marginLeft: 12,
  paddingLeft: 10,
  borderLeft: "2px solid #e2e8f0",
};

const exerciseRowTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "start",
};

const blockInfo = {
  display: "grid",
  gap: 4,
};

const blockControlStack = {
  display: "grid",
  gap: 6,
  justifyItems: "end" as const,
};

const exerciseName = {
  fontSize: 14,
  fontWeight: "bold",
  color: "#111827",
};

const blockBadgeBase = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  minHeight: 22,
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const blockBadgeExercise = {
  ...blockBadgeBase,
  background: "#eef4ff",
  color: "#1d4ed8",
};

const blockBadgeWarmup = {
  ...blockBadgeBase,
  background: "#fff7ed",
  color: "#c2410c",
};

const blockBadgeStretch = {
  ...blockBadgeBase,
  background: "#ecfeff",
  color: "#0f766e",
};

const blockBadgePause = {
  ...blockBadgeBase,
  background: "#f3f4f6",
  color: "#374151",
};

const exerciseMeta = {
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.3,
};

const blockContextMeta = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 600,
  lineHeight: 1.3,
};

const editorSectionLabel = {
  marginTop: 6,
  fontSize: 11,
  fontWeight: "bold",
  color: "#94a3b8",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const infoRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const infoChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px solid #dbe4f0",
  color: "#334155",
  fontSize: 12,
  fontWeight: "bold",
};

const quickValueGrid = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const quickValueButton = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#475569",
  fontSize: 12,
  fontWeight: "bold",
};

const activeQuickValueButton = {
  ...quickValueButton,
  background: "#eef4ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
};

const insertRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
  padding: "2px 8px 10px",
  alignItems: "center",
};

const insertLabel = {
  fontSize: 11,
  fontWeight: "bold",
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const insertActionButton = {
  ...miniActionButton,
  padding: "4px 9px",
};

const fieldStack = {
  display: "grid",
  gap: 6,
};

const fieldLabel = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#475569",
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const textInput = {
  width: "100%",
  minHeight: 40,
  padding: "9px 11px",
  borderRadius: 14,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
};

const editorActions = {
  display: "flex",
  justifyContent: "end",
  gap: 8,
  marginTop: 16,
};

const editorHint = {
  marginTop: 10,
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.4,
};

const editorContextCard = {
  display: "grid",
  gap: 4,
  marginBottom: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const editorContextLabel = {
  fontSize: 11,
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
  color: "#94a3b8",
};

const editorContextValue = {
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
  lineHeight: 1.3,
};

function getPlanCardText(plan: TrainingPlan) {
  const preview = getPlanPreview(plan);
  if (!plan.description || preview === plan.description) {
    return preview;
  }

  if (preview.includes(plan.description) || plan.description.includes(preview)) {
    return preview.length <= plan.description.length ? preview : plan.description;
  }

  return plan.description;
}


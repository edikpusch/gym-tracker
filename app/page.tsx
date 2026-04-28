"use client";

import { useEffect, useState } from "react";

import type { ExercisePlanBlock, TrainingPlanBlock } from "@/lib/trainingModel";
import {
  addTrainingExercise,
  addPauseBlock,
  addStretchBlock,
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
  updateStretchBlock,
  updateWarmupBlock,
  updateTrainingExercise,
  type TrainingExercise,
  type TrainingPlan,
} from "@/lib/trainingPlans";
import { EXERCISE_LIBRARY, getExerciseLabel, STRETCH_LIBRARY } from "@/lib/workoutUi";

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

export default function Home() {
  const [availablePlans, setAvailablePlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan>(() =>
    getTrainingPlan("my-plan")
  );
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

  function refreshPlans(nextActivePlanId?: string) {
    const plans = getAllTrainingPlans();
    const resolvedPlan = getTrainingPlan(nextActivePlanId || getActivePlanId());
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

  function openAddExercise(dayId: string) {
    setExerciseEditor({
      dayId,
      name: EXERCISE_LIBRARY[0]?.value ?? "benchpress",
      sets: "3",
      minReps: "8",
      maxReps: "12",
      restSeconds: "90",
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
      : addTrainingExercise(activePlan.id, exerciseEditor.dayId, draft);

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
      : addStretchBlock(activePlan.id, stretchEditor.dayId, draft);

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
    blockId?: string
  ) {
    setPauseEditor({
      dayId,
      blockId,
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
      : addPauseBlock(activePlan.id, pauseEditor.dayId, draft);

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

        <div style={heroCard}>
          <div style={heroTopRow}>
            <div>
              <div style={sectionTitle}>Aktiver Plan</div>
              <div style={heroTitle}>{activePlan.name}</div>
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
          {activePlan.days.map((day) => (
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
              <span style={dayCopy}>{buildExercisePreview(day.exercises)}</span>
            </a>
          ))}
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
                      Plan umbenennen
                    </button>
                    <button
                      style={dangerDetailActionButton}
                      onClick={() => handleDeletePlan(activePlan.id)}
                    >
                      Plan löschen
                    </button>
                  </>
                ) : (
                  <button
                    style={detailActionButton}
                    onClick={() => handleDuplicatePlan(activePlan.id)}
                  >
                    Als Kopie speichern
                  </button>
                )}
              </div>
            </div>

            <div style={planDetailStack}>
              {activePlan.days.map((day) => {
                const dayBlocks = getDayBlocks(day);

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
                      <div style={miniActionRow}>
                        <button
                          style={miniActionButton}
                          onClick={() => openDayEditor(day.id, day.name)}
                        >
                          Tag
                        </button>
                        <button
                          style={miniActionButton}
                          onClick={() => openStretchEditor(day.id)}
                        >
                          Dehnen +
                        </button>
                        <button
                          style={miniActionButton}
                          onClick={() => openPauseEditor(day.id)}
                        >
                          Pause +
                        </button>
                        <button
                          style={miniActionButton}
                          onClick={() => openAddExercise(day.id)}
                        >
                          Übung +
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div style={exerciseList}>
                    {dayBlocks.map((block, blockIndex) => {
                      const editableExercise = getEditableExerciseForBlock(
                        block,
                        day.exercises
                      );
                      const warmupExercise =
                        block.type === "warmup"
                          ? day.exercises.find(
                              (exercise) => exercise.id === block.parentExerciseId
                            ) ?? null
                          : null;

                      return (
                        <div key={block.id} style={exerciseRow}>
                          <div style={exerciseRowTop}>
                            <div style={blockInfo}>
                              <span style={exerciseName}>{getBlockTitle(block)}</span>
                              <span style={getBlockBadgeStyle(block.type)}>
                                {getBlockBadgeLabel(block.type)}
                              </span>
                            </div>
                            {canEditActivePlan ? (
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
                            ) : null}
                            {canEditActivePlan && editableExercise ? (
                              <div style={miniActionRow}>
                                <button
                                  style={miniActionButton}
                                  onClick={() => openEditExercise(day.id, editableExercise)}
                                >
                                  Bearbeiten
                                </button>
                                <button
                                  style={miniActionButton}
                                  onClick={() =>
                                    handleRemoveExercise(day.id, editableExercise.id)
                                  }
                                >
                                  Entfernen
                                </button>
                              </div>
                            ) : canEditActivePlan &&
                              block.type === "warmup" &&
                              warmupExercise ? (
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
                                  Bearbeiten
                                </button>
                              </div>
                            ) : canEditActivePlan && block.type === "stretch" ? (
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
                                  Bearbeiten
                                </button>
                                <button
                                  style={miniActionButton}
                                  onClick={() => handleRemoveBlock(day.id, block.id)}
                                >
                                  Entfernen
                                </button>
                              </div>
                            ) : canEditActivePlan && block.type === "pause" ? (
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
                                  Bearbeiten
                                </button>
                                <button
                                  style={miniActionButton}
                                  onClick={() => handleRemoveBlock(day.id, block.id)}
                                >
                                  Entfernen
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <span style={exerciseMeta}>{getBlockMeta(block)}</span>
                        </div>
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

            <div style={fieldGrid}>
              <label style={fieldStack}>
                <span style={fieldLabel}>Übung</span>
                <select
                  style={textInput}
                  value={exerciseEditor.name}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value,
                          }
                        : current
                    )
                  }
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
              <button style={activeSelectButton} onClick={saveExerciseEditor}>
                Speichern
              </button>
            </div>
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

            <div style={fieldGrid}>
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
                  {STRETCH_LIBRARY.map((stretch) => (
                    <option key={stretch.value} value={stretch.value}>
                      {stretch.label}
                    </option>
                  ))}
                </select>
              </label>

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

            <div style={fieldGrid}>
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

function buildExercisePreview(
  exercises: TrainingPlan["days"][number]["exercises"]
) {
  return exercises
    .slice(0, 3)
    .map((exercise) => getExerciseLabel(exercise.name))
    .join(", ");
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

const heroCard = {
  padding: "12px 14px",
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
  marginTop: 3,
  fontSize: 20,
  fontWeight: "bold",
  lineHeight: 1.05,
  color: "#111827",
};

const heroActions = {
  display: "flex",
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 6,
  justifyContent: "end",
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
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
};

const heroCopy = {
  marginTop: 6,
  fontSize: 12,
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
  gap: 8,
  minHeight: 0,
};

const dayCard = {
  borderRadius: 24,
  color: "#fff",
  textDecoration: "none",
  padding: "12px 14px",
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
  fontSize: 24,
  lineHeight: 1,
  fontWeight: "bold",
};

const dayCopy = {
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 600,
  opacity: 0.92,
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
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
};

const detailActionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
  justifyContent: "end",
};

const detailActionButton = {
  minHeight: 34,
  padding: "6px 12px",
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
  padding: "12px 12px 10px",
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5ebf4",
};

const planDetailTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const planDetailDay = {
  fontSize: 18,
  fontWeight: "bold",
  lineHeight: 1.1,
};

const miniActionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const miniActionButton = {
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 11,
  fontWeight: "bold",
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

const exerciseRowTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const blockInfo = {
  display: "grid",
  gap: 4,
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

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
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


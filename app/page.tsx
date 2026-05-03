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
  const [activeDayTab, setActiveDayTab] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [addPickerDayId, setAddPickerDayId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ href: string; dayName: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gym-tracker-sets");
      if (!raw) return;
      const sets = JSON.parse(raw) as Array<{ timestamp?: number; planId?: string; dayId?: string }>;
      if (!Array.isArray(sets) || !sets.length) return;
      const sorted = [...sets].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
      const latest = sorted[0];
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      if (!latest.timestamp || latest.timestamp < fourHoursAgo || !latest.planId || !latest.dayId) return;
      const plan = getTrainingPlan(latest.planId);
      const day = plan.days.find((d) => d.id === latest.dayId);
      if (!day) return;
      setActiveSession({ href: slotHref[day.slot], dayName: day.name });
    } catch {
      // ignore
    }
  }, []);

  const [dayEditor, setDayEditor] = useState<DayEditorState | null>(null);
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditorState | null>(null);
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
    const plan = getTrainingPlan(getActivePlanId());
    setActiveDayTab(plan.days[0]?.id ?? null);
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
    const plan = getTrainingPlan(planId);
    const shouldDelete = window.confirm(`"${plan.name}" wirklich löschen?`);
    if (!shouldDelete) return;

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

  return (
    <div style={screen}>
      <main style={shell}>
        <div style={topBar}>
          <div style={brandPill}>Gym Tracker</div>
          <div style={topIcons}>
            {activeSession ? (
              <a href={activeSession.href} style={activeSessionChip}>
                ▶ {activeSession.dayName}
              </a>
            ) : null}
            <button style={iconButton} onClick={openPlanPicker} title="Pläne">☰</button>
            <a href="/history/index.html" style={iconLink} title="Verlauf">◷</a>
          </div>
        </div>

        <div
          style={{
            ...dayGrid,
            gridTemplateRows: `repeat(${Math.max(activePlan.days.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {activePlan.days.map((day) => (
            <a
              key={day.id}
              href={slotHref[day.slot]}
              style={{
                ...dayCard,
                background: `linear-gradient(135deg, ${day.color} 0%, ${shadeColor(day.color)} 100%)`,
              }}
            >
              <span style={dayKicker}>{activePlan.name}</span>
              <span style={dayTitle}>{day.name}</span>
              <span style={dayCopy}>{buildExercisePreview(day.exercises)}</span>
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
              <button style={closeButton} onClick={() => setShowPlanPicker(false)}>✕</button>
            </div>

            <div style={activePlanBar}>
              <div>
                <div style={sectionTitle}>Aktiver Plan</div>
                <div style={activePlanName}>{activePlan.name}</div>
              </div>
              <button style={ghostAction} onClick={() => { setShowPlanPicker(false); openPlanDetail(); }}>
                Bearbeiten
              </button>
            </div>

            <div style={planList}>
              {availablePlans.map((plan) => {
                const isActive = plan.id === activePlan.id;
                const isCustom = isCustomTrainingPlan(plan.id);

                return (
                  <div
                    key={plan.id}
                    style={{
                      ...planListCard,
                      ...(isActive ? planListCardActive : null),
                      borderColor: isActive ? plan.accent : "#e5ebf4",
                    }}
                  >
                    <button style={planListMain} onClick={() => handlePlanSelect(plan.id)}>
                      <div style={planListHeader}>
                        <span style={planListName}>{plan.name}</span>
                        <div style={planListBadges}>
                          {isActive ? <span style={activeBadgePill}>Aktiv</span> : null}
                          <span style={isCustom ? customBadge : templateBadge}>
                            {isCustom ? "Eigen" : "Vorlage"}
                          </span>
                        </div>
                      </div>
                      <div style={planDayList}>
                        {plan.days.map((day) => (
                          <div key={day.id} style={planDayRow}>
                            <span style={{ ...planDayDot, background: day.color }} />
                            <span style={planDayLabel}>{day.name}</span>
                            <span style={planDayExercises}>
                              {buildExercisePreview(day.exercises)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </button>
                    <button
                      style={planGearButton}
                      onClick={() => handleDuplicatePlan(plan.id)}
                      title="Als Kopie speichern & bearbeiten"
                    >
                      ⚙
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Plan Detail / Editor */}
      {showPlanDetail ? (
        <div style={overlay}>
          <div style={planDetailSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Plan</div>
                <div style={sheetTitle}>{activePlan.name}</div>
              </div>
              <button style={closeButton} onClick={() => setShowPlanDetail(false)}>✕</button>
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
                  {canEditActivePlan && activeDayTab === day.id ? (
                    <span
                      style={tabEditIcon}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDayEditor(day.id, day.name);
                      }}
                    >
                      ✎
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div style={planBlockList}>
              {(() => {
                const activeDay = activePlan.days.find((d) => d.id === activeDayTab);
                if (!activeDay) return null;
                const dayBlocks = getDayBlocks(activeDay);

                if (dayBlocks.length === 0) {
                  return (
                    <div style={emptyDayHint}>
                      Noch keine Einträge. Tippe auf „+ Hinzufügen".
                    </div>
                  );
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
                            ↑
                          </button>
                          <button
                            style={planBlockIcon}
                            disabled={blockIndex === dayBlocks.length - 1}
                            onClick={() => handleMoveBlock(activeDay.id, block.id, "down")}
                          >
                            ↓
                          </button>
                          <button
                            style={{ ...planBlockIcon, color: "#be123c" }}
                            onClick={removeBlock}
                          >
                            ✕
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>

            {canEditActivePlan && activeDayTab ? (
              <button
                style={addBlockButton}
                onClick={() => {
                  setAddPickerDayId(activeDayTab);
                  setShowAddPicker(true);
                }}
              >
                + Hinzufügen
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Add Picker */}
      {showAddPicker && addPickerDayId ? (
        <div style={overlay}>
          <div style={editorSheet}>
            <div style={sheetHeader}>
              <div>
                <div style={sectionTitle}>Block hinzufügen</div>
                <div style={sheetTitle}>Was hinzufügen?</div>
              </div>
              <button style={closeButton} onClick={() => setShowAddPicker(false)}>✕</button>
            </div>
            <div style={addPickerList}>
              <button
                style={addPickerOption}
                onClick={() => { setShowAddPicker(false); openAddExercise(addPickerDayId); }}
              >
                <span style={addPickerEmoji}>💪</span>
                <div>
                  <div style={addPickerLabel}>Übung</div>
                  <div style={addPickerHint}>Kraftübung mit Sätzen und Wiederholungen</div>
                </div>
              </button>
              <button
                style={addPickerOption}
                onClick={() => { setShowAddPicker(false); openStretchEditor(addPickerDayId); }}
              >
                <span style={addPickerEmoji}>🧘</span>
                <div>
                  <div style={addPickerLabel}>Dehnen</div>
                  <div style={addPickerHint}>Stretching mit Haltezeit und Runden</div>
                </div>
              </button>
              <button
                style={addPickerOption}
                onClick={() => { setShowAddPicker(false); openPauseEditor(addPickerDayId); }}
              >
                <span style={addPickerEmoji}>⏸</span>
                <div>
                  <div style={addPickerLabel}>Pause</div>
                  <div style={addPickerHint}>Feste Ruhepause zwischen Übungen</div>
                </div>
              </button>
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
              <button style={closeButton} onClick={() => setDayEditor(null)}>✕</button>
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
              />
            </label>

            <div style={editorActions}>
              <button style={selectButton} onClick={() => setDayEditor(null)}>Abbrechen</button>
              <button style={activeSelectButton} onClick={saveDayEditor}>Speichern</button>
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
              <button style={closeButton} onClick={() => setExerciseEditor(null)}>✕</button>
            </div>

            <div style={fieldGrid}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Übung</span>
                <select
                  style={textInput}
                  value={exerciseEditor.name}
                  onChange={(event) =>
                    setExerciseEditor((current) =>
                      current ? { ...current, name: event.target.value } : current
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
                      current ? { ...current, sets: event.target.value } : current
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
              <button style={closeButton} onClick={() => setWarmupEditor(null)}>✕</button>
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
                      current ? { ...current, rounds: event.target.value } : current
                    )
                  }
                />
              </label>

              <label style={fieldStack}>
                <span style={fieldLabel}>Pause (Sek)</span>
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
              <button style={closeButton} onClick={() => setStretchEditor(null)}>✕</button>
            </div>

            <div style={fieldGrid}>
              <label style={{ ...fieldStack, gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Dehnung</span>
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
              <button style={closeButton} onClick={() => setPauseEditor(null)}>✕</button>
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
    </div>
  );
}

function buildExercisePreview(exercises: TrainingPlan["days"][number]["exercises"]) {
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
  return `${formatRest(block.seconds)} · ${block.scope === "workout" ? "Workout-Pause" : "Übungspause"}`;
}

function getBlockBadgeLabel(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return "Übung";
  if (type === "warmup") return "Aufwärmen";
  if (type === "stretch") return "Dehnen";
  return "Pause";
}

function getBlockBadgeStyle(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return blockBadgeExercise;
  if (type === "warmup") return blockBadgeWarmup;
  if (type === "stretch") return blockBadgeStretch;
  return blockBadgePause;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const screen = {
  height: "100dvh",
  overflow: "hidden" as const,
  padding: "10px",
  background: "radial-gradient(circle at top, #dde6f5 0%, #f3f5f9 42%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
  position: "relative" as const,
};

const shell = {
  maxWidth: 460,
  height: "calc(100dvh - 20px)",
  margin: "0 auto",
  padding: "12px",
  borderRadius: 28,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  overflow: "hidden" as const,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
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

const topIcons = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const iconButton = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f1f5f9",
  color: "#374151",
  fontSize: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconLink = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#eef4ff",
  color: "#1d4ed8",
  fontSize: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};

const activeSessionChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  minHeight: 32,
  padding: "5px 10px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 12,
  fontWeight: "bold",
  textDecoration: "none",
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
  padding: "10px 12px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5ebf4",
  marginBottom: 10,
};

const activePlanName = {
  fontSize: 15,
  fontWeight: "bold",
  color: "#111827",
  marginTop: 2,
};

const dayGrid = {
  flex: 1,
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
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.18) 0%, rgba(15, 23, 42, 0.42) 100%)",
  display: "flex",
  alignItems: "flex-end" as const,
  justifyContent: "center",
  zIndex: 50,
  padding: "0 0 0 0",
};

const sheet = {
  width: "100%",
  maxWidth: 460,
  maxHeight: "88dvh",
  overflowY: "auto" as const,
  padding: "16px 14px 20px",
  borderRadius: "24px 24px 0 0" as const,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #dce5f1",
  borderBottom: "none",
  boxShadow: "0 -16px 48px rgba(15, 23, 42, 0.14)",
};

const planDetailSheet = {
  ...sheet,
  maxHeight: "88dvh",
  display: "flex",
  flexDirection: "column" as const,
  padding: "16px 0 0 0",
  gap: 0,
};

const editorSheet = {
  ...sheet,
  maxWidth: 460,
};

const sheetHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
  marginBottom: 10,
  padding: "0 14px",
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
  cursor: "pointer",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
};

const planList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const planListCard = {
  borderRadius: 18,
  border: "2px solid #e5ebf4",
  background: "#ffffff",
  overflow: "hidden" as const,
  display: "flex",
  alignItems: "stretch",
};

const planListCardActive = {
  background: "#f8fbff",
  boxShadow: "0 8px 24px rgba(37, 99, 235, 0.10)",
};

const planListMain = {
  flex: 1,
  padding: "12px 14px",
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
  fontSize: 15,
  fontWeight: "bold",
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
  gap: 5,
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
  fontWeight: "bold",
  color: "#374151",
  minWidth: 44,
};

const planDayExercises = {
  fontSize: 11,
  color: "#6b7280",
  flex: 1,
  whiteSpace: "nowrap" as const,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
};

const planGearButton = {
  width: 44,
  flexShrink: 0,
  background: "#f8fafc",
  border: "none",
  borderLeft: "1px solid #e5ebf4",
  color: "#6b7280",
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const planDetailMetaBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "8px 14px 10px",
  borderBottom: "1px solid #edf2f7",
};

const dayTabsRow = {
  display: "flex",
  gap: 6,
  padding: "10px 14px",
  overflowX: "auto" as const,
  flexShrink: 0,
  borderBottom: "1px solid #edf2f7",
};

const dayTab = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 34,
  padding: "6px 14px",
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
  padding: "6px 14px 10px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  minHeight: 0,
};

const planBlockRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #edf2f7",
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
  fontSize: 14,
  fontWeight: "bold",
  color: "#111827",
};

const planBlockMeta = {
  fontSize: 12,
  color: "#64748b",
};

const planBlockActions = {
  display: "flex",
  gap: 4,
  flexShrink: 0,
};

const planBlockIcon = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#374151",
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const emptyDayHint = {
  fontSize: 13,
  color: "#94a3b8",
  textAlign: "center" as const,
  padding: "20px 0",
};

const addBlockButton = {
  margin: "10px 14px 14px",
  height: 46,
  borderRadius: 14,
  border: "1.5px dashed #bfd0e6",
  background: "#f0f6ff",
  color: "#1d4ed8",
  fontSize: 14,
  fontWeight: "bold",
  cursor: "pointer",
  flexShrink: 0,
};

const addPickerList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  marginTop: 4,
};

const addPickerOption = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 14px",
  borderRadius: 16,
  border: "1px solid #e5ebf4",
  background: "#f8fafc",
  cursor: "pointer",
  textAlign: "left" as const,
  width: "100%",
};

const addPickerEmoji = {
  fontSize: 24,
  flexShrink: 0,
};

const addPickerLabel = {
  fontSize: 15,
  fontWeight: "bold",
  color: "#111827",
};

const addPickerHint = {
  fontSize: 12,
  color: "#64748b",
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
  cursor: "pointer",
};

const activeSelectButton = {
  ...selectButton,
  background: "#111827",
  color: "#ffffff",
  border: "1px solid #111827",
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
  if (!plan.description || preview === plan.description) return preview;
  if (preview.includes(plan.description) || plan.description.includes(preview)) {
    return preview.length <= plan.description.length ? preview : plan.description;
  }
  return plan.description;
}

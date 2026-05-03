"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getBestMatchingSet,
  getLastSessionForExercise,
  getLastSetForExercise,
  getPreviousMatchingSet,
  getProgress,
  getTopSet,
  saveSet,
  type SetType,
} from "@/lib/workoutEngine";
import {
  clearRestNotification,
  scheduleRestNotification,
} from "@/lib/restNotifications";
import {
  enterRestPictureInPictureNow,
  setRestOverlayState,
  stopRestOverlay,
} from "@/lib/restPictureInPicture";
import { getDefaultWeightConfig } from "@/lib/trainingModel";
import { type WorkoutExercise, type WorkoutType } from "@/lib/workoutPlan";
import { getExerciseLabel } from "@/lib/workoutUi";

type WorkoutTheme = {
  screenBadge: string;
  badgeBackground: string;
  accent: string;
  border: string;
  shadow: string;
  progressTrack: string;
  progressFill: string;
  restFill: string;
  background: string;
};

type WorkoutScreenProps = {
  workoutType: WorkoutType;
  workoutLabel: string;
  exercises: WorkoutExercise[];
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
  theme: WorkoutTheme;
};

export function WorkoutScreen({
  workoutType,
  workoutLabel,
  exercises,
  planId,
  planName,
  dayId,
  dayName,
  theme,
}: WorkoutScreenProps) {
  const router = useRouter();

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [sessionId, setSessionId] = useState(0);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(10);

  const [sessionSets, setSessionSets] = useState<Array<SetType | null>>([]);
  const [loggedSets, setLoggedSets] = useState<SetType[]>([]);
  const [previousSets, setPreviousSets] = useState<Array<SetType | null>>([]);
  const [lastSessionSets, setLastSessionSets] = useState<SetType[]>([]);
  const [lastTrainingSet, setLastTrainingSet] = useState<SetType | null>(null);
  const [bestMatchingSet, setBestMatchingSet] = useState<SetType | null>(null);

  const [loading, setLoading] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [workoutPausedAt, setWorkoutPausedAt] = useState<number | null>(null);

  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [setStartedAt, setSetStartedAt] = useState(0);
  const [compactMode, setCompactMode] = useState(false);
  const lastGetReadySecondRef = useRef<number | null>(null);

  const currentExercise = exercises[exerciseIndex];
  const weightConfig = getDefaultWeightConfig(currentExercise.name);
  const weightSteps = weightConfig.quickSteps;
  const totalSets = currentExercise.sets + 1;
  const previousSet = previousSets[setIndex] ?? null;
  const isWorkoutPaused = workoutPausedAt !== null;

  useEffect(() => {
    const now = Date.now();
    setSessionId(now);
    setStartTime(now);
    setCurrentTime(now);
    setSetStartedAt(now);
    setRestEndsAt(null);
    setWorkoutPausedAt(null);
  }, [exercises]);

  useEffect(() => {
    if (currentTime === 0) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime]);

  useEffect(() => {
    function updateCompactMode() {
      const nextCompactMode =
        window.innerHeight <= 820 || (window.innerHeight <= 900 && window.innerWidth <= 400);
      setCompactMode(nextCompactMode);
    }

    updateCompactMode();
    window.addEventListener("resize", updateCompactMode);

    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  useEffect(() => {
    if (!currentExercise || sessionId === 0) {
      return;
    }

    const activeSessionId = sessionId;

    async function init() {
      const history: Array<SetType | null> = [];

      for (let i = 0; i < totalSets; i += 1) {
        const last = await getLastSetForExercise(
          currentExercise.name,
          i,
          workoutType
        );
        history.push(last);
      }

      const lastSession = await getLastSessionForExercise(
        currentExercise.name,
        activeSessionId,
        workoutType
      );
      const previousMatchingSet = await getPreviousMatchingSet(
        currentExercise.name,
        setIndex,
        workoutType,
        activeSessionId
      );
      const bestSet = await getBestMatchingSet(
        currentExercise.name,
        setIndex,
        workoutType
      );

      setPreviousSets(history);
      setSessionSets([]);
      setLastSessionSets(lastSession);
      setLastTrainingSet(previousMatchingSet);
      setBestMatchingSet(bestSet);

      if (history[0]) {
        setWeight(history[0].weight);
        setReps(history[0].reps);
      } else {
        setWeight(40);
        setReps(getDefaultReps(currentExercise.minReps, currentExercise.maxReps));
      }
    }

    init();
  }, [currentExercise, sessionId, setIndex, totalSets, workoutType]);

  function handleRepsChange(delta: number) {
    if (loading || isResting || isWorkoutPaused) {
      return;
    }

    const newReps = normalizeReps(reps + delta);
    if (newReps < 0.5) {
      return;
    }

    setReps(newReps);
  }

  function changeWeight(delta: number) {
    if (loading || isWorkoutPaused) {
      return;
    }

    setWeight((currentWeight) =>
      normalizeWeight(
        clampWeight(
          currentWeight + delta,
          weightConfig.min,
          weightConfig.max
        )
      )
    );
  }

  function canChangeWeight(delta: number) {
    const nextWeight = clampWeight(weight + delta, weightConfig.min, weightConfig.max);
    return normalizeWeight(nextWeight) !== normalizeWeight(weight);
  }

  function handleNext() {
    if (workoutPausedAt) {
      const resumedAt = Date.now();
      const pausedDuration = resumedAt - workoutPausedAt;
      setStartTime((current) => current + pausedDuration);
      setSetStartedAt((current) => current + pausedDuration);
      setRestEndsAt((current) => (current ? current + pausedDuration : current));
      setCurrentTime(resumedAt);
      setWorkoutPausedAt(null);
    }

    void stopRestOverlay();
    void setRestOverlayState(false);
    void clearRestNotification();
    setIsResting(false);
    setRestEndsAt(null);

    const nextSet = setIndex + 1;

    if (nextSet < totalSets) {
      setSetIndex(nextSet);
      setSetStartedAt(Date.now());
      return;
    }

    if (exerciseIndex < exercises.length - 1) {
      const nextExercise = exercises[exerciseIndex + 1];
      setExerciseIndex((current) => current + 1);
      setSetIndex(0);
      setSetStartedAt(Date.now());
      return;
    }

    if (sessionId === 0) {
      return;
    }

    navigateToSummary(router, sessionId);
  }

  useEffect(() => {
    if (!isResting || !restEndsAt || isWorkoutPaused) {
      return;
    }

    if (currentTime >= restEndsAt) {
      handleNext();
    }
  }, [currentTime, isResting, restEndsAt, isWorkoutPaused]);

  useEffect(() => {
    return () => {
      void stopRestOverlay();
      void setRestOverlayState(false);
      void clearRestNotification();
    };
  }, []);

  useEffect(() => {
    void setRestOverlayState(
      isResting && !!restEndsAt,
      getExerciseLabel(currentExercise.name),
      restEndsAt ?? 0
    );
  }, [currentExercise.name, isResting, restEndsAt]);

  useEffect(() => {
    if (!isResting || !restEndsAt) {
      return;
    }

    function startOverlay() {
      if (document.visibilityState === "hidden") {
        void enterRestPictureInPictureNow(
          getExerciseLabel(currentExercise.name),
          restEndsAt ?? 0
        );
      }
    }

    function stopOverlay() {
      if (document.visibilityState === "visible") {
        void stopRestOverlay();
      }
    }

    document.addEventListener("visibilitychange", startOverlay);
    document.addEventListener("visibilitychange", stopOverlay);
    window.addEventListener("pagehide", startOverlay);
    window.addEventListener("blur", startOverlay);
    window.addEventListener("focus", stopOverlay);

    return () => {
      document.removeEventListener("visibilitychange", startOverlay);
      document.removeEventListener("visibilitychange", stopOverlay);
      window.removeEventListener("pagehide", startOverlay);
      window.removeEventListener("blur", startOverlay);
      window.removeEventListener("focus", stopOverlay);
    };
  }, [currentExercise.name, isResting, restEndsAt]);

  async function save() {
    if (loading || isResting || sessionId === 0 || isWorkoutPaused) {
      return;
    }

    try {
      setLoading(true);
      const savedAt = Date.now();

      await saveSet({
        exercise: currentExercise.name,
        weight,
        reps,
        set: setIndex,
        sessionId,
        type: workoutType,
        planId,
        planName,
        dayId,
        dayName,
      });

      setSessionSets((prev) => {
        const copy = [...prev];
        const savedSet = {
          exercise: currentExercise.name,
          weight,
          reps,
          set: setIndex,
          sessionId,
          timestamp: savedAt,
          type: workoutType,
          planId,
          planName,
          dayId,
          dayName,
        };
        copy[setIndex] = savedSet;
        return copy;
      });
      setLoggedSets((prev) => [
        ...prev,
        {
          exercise: currentExercise.name,
          weight,
          reps,
          set: setIndex,
          sessionId,
          timestamp: savedAt,
          type: workoutType,
          planId,
          planName,
          dayId,
          dayName,
        },
      ]);

      const nextRestEndsAt = savedAt + currentExercise.restSeconds * 1000;
      setRestEndsAt(nextRestEndsAt);
      setIsResting(true);
      await scheduleRestNotification(
        getExerciseLabel(currentExercise.name),
        currentExercise.restSeconds
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleWorkoutPause() {
    if (workoutPausedAt) {
      const resumedAt = Date.now();
      const pausedDuration = resumedAt - workoutPausedAt;
      const remainingRestSeconds =
        isResting && restEndsAt
          ? Math.max(1, Math.ceil((restEndsAt - workoutPausedAt) / 1000))
          : null;

      setStartTime((current) => current + pausedDuration);
      setSetStartedAt((current) => current + pausedDuration);
      setRestEndsAt((current) => (current ? current + pausedDuration : current));
      setCurrentTime(resumedAt);
      setWorkoutPausedAt(null);

      if (remainingRestSeconds) {
        await scheduleRestNotification(
          getExerciseLabel(currentExercise.name),
          remainingRestSeconds
        );
      }
      return;
    }

    const pausedAt = Date.now();
    setWorkoutPausedAt(pausedAt);
    await clearRestNotification();
    await stopRestOverlay();
    await setRestOverlayState(false);
  }

  const validSets = sessionSets.filter((set): set is SetType => set !== null);
  const currentTop = getTopSet(validSets);
  const lastTop = getTopSet(lastSessionSets);
  const progress = getProgress(currentTop, lastTop);
  const effectiveNow = workoutPausedAt ?? currentTime;
  const workoutDuration = formatDuration(Math.max(0, effectiveNow - startTime));
  const activeSetDuration = formatDuration(
    Math.max(0, effectiveNow - setStartedAt)
  );
  const restTime = Math.max(
    0,
    Math.ceil(((restEndsAt ?? effectiveNow) - effectiveNow) / 1000)
  );
  const progressPercent = Math.round(
    (((exerciseIndex * totalSets) + setIndex + 1) /
      (exercises.length * totalSets)) *
      100
  );
  const restProgress = Math.max(
    0,
    Math.min(100, (restTime / currentExercise.restSeconds) * 100)
  );
  const visualCountdown =
    isResting && !isWorkoutPaused && restTime > 0 && restTime <= 3 ? restTime : null;
  const lastSavedSet = loggedSets[loggedSets.length - 1] ?? null;
  const previousExercise = exerciseIndex > 0 ? exercises[exerciseIndex - 1] : null;
  const previousExerciseSets = previousExercise
    ? loggedSets.filter((set) => set.exercise === previousExercise.name)
    : [];
  const previousExerciseTopSet = getTopSet(previousExerciseSets);
  const currentExerciseProgress = exercises[exerciseIndex]
    ? loggedSets.filter((set) => set.exercise === exercises[exerciseIndex].name)
    : [];
  const dayProgress = exercises.map((exercise) => {
    const savedSetsForExercise = loggedSets.filter(
      (set) => set.exercise === exercise.name
    );

    return {
      exercise,
      completed: savedSetsForExercise.length,
      total: exercise.sets + 1,
      topSet: getTopSet(savedSetsForExercise),
    };
  });

  useEffect(() => {
    if (!isResting || isWorkoutPaused) {
      lastGetReadySecondRef.current = null;
      return;
    }

    if (restTime === 10 && lastGetReadySecondRef.current !== restTime) {
      lastGetReadySecondRef.current = restTime;
      playGetReadyTone();
      return;
    }

    if (restTime > 10) {
      lastGetReadySecondRef.current = null;
    }
  }, [isResting, isWorkoutPaused, restTime]);

  const referenceSet = lastTrainingSet ?? previousSet ?? bestMatchingSet;
  const referenceLabel = lastTrainingSet
    ? "Letztes Training"
    : previousSet
    ? "Letzter Satz"
    : bestMatchingSet
    ? "Bester Satz"
    : null;

  const totalCompleted = dayProgress.reduce((s, e) => s + e.completed, 0);
  const totalSetsAll = dayProgress.reduce((s, e) => s + e.total, 0);

  return (
    <div style={{ ...screen, background: theme.background }}>
      <div
        style={{
          ...card,
          ...(compactMode ? compactCard : null),
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        {/* NAV */}
        <div style={topRow}>
          <div style={topActions}>
            <a href="/index.html" style={backLink}>← Home</a>
            <span style={durationChip}>{workoutDuration}</span>
          </div>
          <div style={topActions}>
            <button style={planButton} onClick={() => setShowPlanModal(true)}>
              ☰ {totalCompleted}/{totalSetsAll}
            </button>
            <button style={controlButton} onClick={() => void toggleWorkoutPause()}>
              {isWorkoutPaused ? "▶" : "⏸"}
            </button>
          </div>
        </div>

        {/* FORTSCHRITT */}
        <div style={progressHeader}>
          <div style={{ ...progressMeta, color: theme.accent }}>
            <span>Übung {exerciseIndex + 1} / {exercises.length}</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ ...progressTrack, background: theme.progressTrack }}>
            <div style={{ ...progressFill, width: `${progressPercent}%`, background: theme.progressFill }} />
          </div>
        </div>

        {/* ÜBUNG FOKUS */}
        <div style={exerciseFocus}>
          <div style={{ ...badge, ...(compactMode ? compactBadge : null), background: theme.badgeBackground, color: theme.screenBadge }}>
            {workoutLabel} · {setIndex === 0 ? "Warm-up" : `Satz ${setIndex} / ${currentExercise.sets}`}
          </div>
          <h1 style={{ ...title, ...(compactMode ? compactTitle : null), color: theme.accent }}>
            {getExerciseLabel(currentExercise.name)}
          </h1>
          <div style={exerciseInfoRow}>
            <span>{currentExercise.minReps}–{currentExercise.maxReps} Wdh.</span>
            <span style={exerciseInfoDot}>·</span>
            <span>{formatRest(currentExercise.restSeconds)} Pause</span>
            {referenceSet && referenceLabel ? (
              <>
                <span style={exerciseInfoDot}>·</span>
                <span style={{ color: "#64748b" }}>
                  {referenceLabel}: <strong>{formatWeight(referenceSet.weight)} kg × {formatReps(referenceSet.reps)}</strong>
                </span>
              </>
            ) : null}
            {progress && (progress.weight !== 0 || progress.reps !== 0) ? (
              <>
                <span style={exerciseInfoDot}>·</span>
                <span style={{ color: getDeltaColor(progress.weight || progress.reps), fontWeight: "bold" }}>
                  {formatProgress(progress)}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* PAUSE-HINWEIS */}
        {isWorkoutPaused ? (
          <div style={pausedBanner}>⏸ Pausiert – ▶ oben zum Fortsetzen</div>
        ) : null}

        {/* AKTIV oder REST – füllt den restlichen Platz */}
        {!isResting ? (
          <div style={{ ...activeStack, ...(compactMode ? compactActiveStack : null) }}>
            <div style={{ ...weightBox, ...(compactMode ? compactWeightBox : null) }}>
              {formatWeight(weight)} kg
            </div>
            <div style={sectionLabel}>Gewicht</div>
            <div style={weightControls}>
              <div style={{ ...weightRow, ...(compactMode ? compactWeightRow : null) }}>
                {weightSteps.map((step) => (
                  <button key={`minus-${step}`} style={{ ...miniButton, ...(compactMode ? compactMiniButton : null), ...getWeightStepStyle(step), ...(canChangeWeight(-step) ? null : disabledButton) }} onClick={() => changeWeight(-step)} disabled={!canChangeWeight(-step)}>
                    -{formatWeight(step)}
                  </button>
                ))}
              </div>
              <div style={{ ...weightRow, ...(compactMode ? compactWeightRow : null) }}>
                {weightSteps.slice().reverse().map((step) => (
                  <button key={`plus-${step}`} style={{ ...miniButton, ...(compactMode ? compactMiniButton : null), ...getWeightStepStyle(step), ...(canChangeWeight(step) ? null : disabledButton) }} onClick={() => changeWeight(step)} disabled={!canChangeWeight(step)}>
                    +{formatWeight(step)}
                  </button>
                ))}
              </div>
            </div>
            <div style={sectionLabel}>Wiederholungen</div>
            <div style={{ ...repsGrid, ...(compactMode ? compactRepsGrid : null) }}>
              <button style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }} onClick={() => handleRepsChange(-1)}>-1</button>
              <button style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }} onClick={() => handleRepsChange(-0.5)}>-½</button>
              <button style={{ ...saveButton, ...(compactMode ? compactSaveButton : null) }} onClick={save}>
                <span style={{ ...saveButtonValue, ...(compactMode ? compactSaveButtonValue : null) }}>{formatReps(reps)}</span>
                <span style={{ ...saveButtonLabel, ...(compactMode ? compactSaveButtonLabel : null) }}>Satz speichern</span>
              </button>
              <button style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }} onClick={() => handleRepsChange(0.5)}>+½</button>
              <button style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }} onClick={() => handleRepsChange(1)}>+1</button>
            </div>
          </div>
        ) : (
          <div style={{ ...restCard, ...(compactMode ? compactRestCard : null), background: theme.badgeBackground, border: `1px solid ${theme.border}` }}>
            <div style={{ ...restLabel, color: theme.accent }}>Pause</div>
            <div style={{ ...restTimer, ...(compactMode ? compactRestTimer : null) }}>
              {visualCountdown ? <span style={countdownNumber}>{visualCountdown}</span> : formatRestTimer(restTime)}
            </div>
            <div style={{ ...progressTrack, background: theme.progressTrack }}>
              <div style={{ ...progressFill, width: `${restProgress}%`, background: theme.restFill }} />
            </div>
            {lastSavedSet ? (
              <div style={restSavedRow}>
                <span style={restSavedLabel}>Gespeichert</span>
                <span style={restSavedValue}>
                  {getExerciseLabel(lastSavedSet.exercise)} · {formatWeight(lastSavedSet.weight)} kg × {formatReps(lastSavedSet.reps)}
                </span>
                <div style={restSetRow}>
                  {Array.from({ length: currentExercise.sets + 1 }).map((_, i) => (
                    <span key={`rd-${i}`} style={{ ...restSetDot, ...(i < currentExerciseProgress.length ? restSetDotDone : null) }} />
                  ))}
                </div>
              </div>
            ) : null}
            <div style={restWeightSection}>
              <div style={restWeightLabel}>Nächster Satz · {formatWeight(weight)} kg</div>
              <div style={weightControls}>
                <div style={{ ...restWeightRow, ...(compactMode ? compactRestWeightRow : null) }}>
                  {weightSteps.map((step) => (
                    <button key={`rm-${step}`} style={{ ...restWeightButton, ...(compactMode ? compactRestWeightButton : null), ...(canChangeWeight(-step) ? null : disabledButton) }} onClick={() => changeWeight(-step)} disabled={!canChangeWeight(-step)}>
                      -{formatWeight(step)}
                    </button>
                  ))}
                </div>
                <div style={{ ...restWeightRow, ...(compactMode ? compactRestWeightRow : null) }}>
                  {weightSteps.slice().reverse().map((step) => (
                    <button key={`rp-${step}`} style={{ ...restWeightButton, ...(compactMode ? compactRestWeightButton : null), ...(canChangeWeight(step) ? null : disabledButton) }} onClick={() => changeWeight(step)} disabled={!canChangeWeight(step)}>
                      +{formatWeight(step)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button style={{ ...continueButton, ...(compactMode ? compactContinueButton : null) }} onClick={handleNext}>
              Weiter →
            </button>
          </div>
        )}

        {loading ? <p style={loadingText}>Speichere...</p> : null}
      </div>

      {/* PLAN MODAL */}
      {showPlanModal ? (
        <div style={modalOverlay} onClick={() => setShowPlanModal(false)}>
          <div style={modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <span style={modalTitle}>Heutiger Plan</span>
              <span style={modalMeta}>{totalCompleted} / {totalSetsAll} Sätze</span>
              <button style={modalClose} onClick={() => setShowPlanModal(false)}>✕</button>
            </div>
            <div style={modalList}>
              {dayProgress.map((entry, index) => (
                <div key={`mp-${entry.exercise.id}-${index}`} style={{ ...modalItem, ...(index === exerciseIndex ? modalItemActive : null) }}>
                  <div style={modalItemLeft}>
                    <span style={{ ...modalItemName, ...(index === exerciseIndex ? { color: theme.accent } : null) }}>
                      {index === exerciseIndex ? "▶ " : ""}{getExerciseLabel(entry.exercise.name)}
                    </span>
                    <span style={modalItemMeta}>{entry.completed} / {entry.total} Sätze</span>
                  </div>
                  <div style={modalDots}>
                    {Array.from({ length: entry.total }).map((_, di) => (
                      <span key={`md-${di}`} style={{ ...modalDot, ...(di < entry.completed ? modalDotDone : null), ...(index === exerciseIndex ? { borderColor: theme.border } : null) }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const screen = {
  display: "flex",
  justifyContent: "center",
  height: "100dvh",
  overflow: "hidden" as const,
  padding: "8px",
};

const card = {
  width: "100%",
  maxWidth: 430,
  height: "calc(100dvh - 16px)",
  borderRadius: 28,
  padding: "10px 10px 12px",
  background: "rgba(255,255,255,0.96)",
  backdropFilter: "blur(14px)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  overflow: "hidden" as const,
};

const progressHeader = {
  marginBottom: 0,
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const topActions = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const controlButton = {
  minHeight: 32,
  padding: "6px 12px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #dde5f0",
  background: "#111827",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
};

const backLink = {
  minHeight: 32,
  padding: "6px 11px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  background: "#f1f5f9",
  border: "1px solid #dde5f0",
  color: "#111827",
  fontSize: 13,
  fontWeight: "bold",
};

const durationChip = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#6b7280",
  padding: "4px 8px",
  background: "#f1f5f9",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
};

const planButton = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: "1px solid #dde5f0",
  background: "#f1f5f9",
  color: "#374151",
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
};

const modalOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 100,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

const modalSheet = {
  width: "100%",
  maxWidth: 430,
  maxHeight: "80dvh",
  background: "#fff",
  borderRadius: "24px 24px 0 0",
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden" as const,
};

const modalHeader = {
  display: "flex",
  alignItems: "center",
  padding: "14px 16px 10px",
  borderBottom: "1px solid #f1f5f9",
  gap: 8,
  flexShrink: 0,
};

const modalTitle = {
  fontSize: 15,
  fontWeight: "bold",
  color: "#111827",
  flex: 1,
};

const modalMeta = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: "600",
};

const modalClose = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "none",
  background: "#f1f5f9",
  color: "#374151",
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const modalList = {
  overflowY: "auto" as const,
  padding: "8px 12px 20px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const modalItem = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 10px",
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid transparent",
};

const modalItemActive = {
  background: "#f0f7ff",
  border: "1px solid #bfdbfe",
};

const modalItemLeft = {
  flex: 1,
  minWidth: 0,
};

const modalItemName = {
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
  display: "block",
  whiteSpace: "nowrap" as const,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
};

const modalItemMeta = {
  fontSize: 11,
  color: "#6b7280",
  display: "block",
  marginTop: 2,
};

const modalDots = {
  display: "flex",
  gap: 4,
  flexShrink: 0,
};

const modalDot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#e5e7eb",
  border: "1px solid transparent",
};

const modalDotDone = {
  background: "#22c55e",
};

const pausedBanner = {
  padding: "8px 12px",
  borderRadius: 12,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#c2410c",
  fontSize: 12,
  fontWeight: "bold",
  textAlign: "center" as const,
};

const progressMeta = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  opacity: 0.82,
  marginBottom: 4,
};

const progressTrack = {
  width: "100%",
  height: 8,
  borderRadius: 999,
  overflow: "hidden" as const,
};

const progressFill = {
  height: "100%",
  borderRadius: 999,
};

const exerciseFocus = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const exerciseInfoRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 4,
  fontSize: 12,
  color: "#374151",
  alignItems: "center",
};

const exerciseInfoDot = {
  color: "#d1d5db",
};

const badge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: "bold",
  letterSpacing: 0.8,
  alignSelf: "flex-start" as const,
};

const title = {
  fontSize: 24,
  fontWeight: "bold",
  lineHeight: 1.1,
  margin: 0,
};

const activeStack = {
  display: "grid",
  alignContent: "start" as const,
  gap: 6,
  minHeight: 0,
};

const weightControls = {
  display: "grid",
  gap: 5,
};

const weightBox = {
  fontSize: 38,
  fontWeight: "bold",
  textAlign: "center" as const,
  color: "#111827",
};

const sectionLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: "#6b7280",
  textAlign: "center" as const,
};

const weightRow = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1.15fr 1fr 0.9fr",
  gap: 6,
};

const miniButton = {
  minHeight: 48,
  borderRadius: 15,
  border: "2px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 17,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const repsGrid = {
  display: "grid",
  gridTemplateColumns: "48px 48px minmax(0, 1fr) 48px 48px",
  gap: 6,
  alignItems: "center" as const,
};

const sideButton = {
  minHeight: 58,
  width: "100%",
  borderRadius: 15,
  border: "2px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 15,
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const saveButton = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 96,
  padding: "9px 8px",
  borderRadius: 20,
  background: "#14161a",
  color: "#fff",
  border: "3px solid #fff",
  boxShadow: "0 18px 32px rgba(15, 23, 42, 0.24)",
};

const saveButtonValue = {
  fontSize: 31,
  lineHeight: 1,
};

const saveButtonLabel = {
  marginTop: 3,
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  opacity: 0.74,
};

const restCard = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  padding: "12px 10px",
  borderRadius: 20,
  textAlign: "center" as const,
  flex: 1,
};

const restLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const restTimer = {
  fontSize: 46,
  fontWeight: "bold",
  color: "#111827",
  lineHeight: 1,
};

const countdownNumber = {
  color: "#dc2626",
};

const restSavedRow = {
  padding: "8px 10px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(215,225,239,0.8)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 5,
  textAlign: "left" as const,
};

const restSavedLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#6b7280",
};

const restSavedValue = {
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
};

const restSetRow = {
  display: "flex",
  gap: 5,
  alignItems: "center",
};

const restSetDot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#e5e7eb",
};

const restSetDotDone = {
  background: "#22c55e",
};

const restWeightSection = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
};

const restWeightLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: "#6b7280",
};

const restWeightValue = {
  fontSize: 22,
  fontWeight: "bold",
  color: "#111827",
};

const restWeightRow = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1.15fr 1fr 0.9fr",
  gap: 5,
};

const restWeightButton = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 13,
};

const continueButton = {
  width: "100%",
  padding: "14px",
  borderRadius: 16,
  border: "none",
  background: "#111827",
  color: "#fff",
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};


const compactCard = {
  gap: 6,
};

const compactBadge = {
  fontSize: 10,
  padding: "3px 8px",
};

const compactTitle = {
  fontSize: 20,
};

const compactActiveStack = {
  gap: 4,
};

const compactWeightBox = {
  fontSize: 32,
};

const compactWeightRow = {
  gap: 4,
};

const compactMiniButton = {
  minHeight: 40,
  fontSize: 14,
};

const compactRepsGrid = {
  gridTemplateColumns: "44px 44px minmax(0, 1fr) 44px 44px",
  gap: 4,
};

const compactSideButton = {
  minHeight: 50,
  fontSize: 13,
};

const compactSaveButton = {
  minHeight: 82,
  borderRadius: 16,
};

const compactSaveButtonValue = {
  fontSize: 26,
};

const compactSaveButtonLabel = {
  fontSize: 9,
};

const compactRestCard = {
  gap: 8,
  padding: "10px 9px",
};

const compactRestTimer = {
  fontSize: 38,
};

const compactRestWeightValue = {
  fontSize: 18,
};

const compactRestWeightRow = {
  gap: 4,
};

const compactRestWeightButton = {
  minHeight: 32,
  fontSize: 12,
};

const compactContinueButton = {
  padding: "12px",
  fontSize: 15,
};

const disabledButton = {
  opacity: 0.45,
};

const loadingText = {
  margin: 0,
  textAlign: "center" as const,
  color: "#6b7280",
  fontSize: 13,
};

function getDeltaColor(value: number) {
  if (value > 0) return "#15803d";
  if (value < 0) return "#b91c1c";
  return "#475569";
}

function formatProgress(progress: ReturnType<typeof getProgress>) {
  if (!progress) {
    return "";
  }

  const parts = [];
  if (progress.weight !== 0) {
    parts.push(`${formatDelta(progress.weight)} kg`);
  }
  if (progress.reps !== 0) {
    parts.push(`${formatDelta(progress.reps)} Wdh.`);
  }
  return parts.join(" · ");
}

function formatDelta(value: number) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (value > 0) return `+${formatted}`;
  return formatted;
}

function formatReps(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function formatWeight(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function getDefaultReps(minReps: number, maxReps: number) {
  return Math.round((minReps + maxReps) / 2);
}

function normalizeReps(value: number) {
  return Math.round(value * 2) / 2;
}

function normalizeWeight(value: number) {
  return Math.round(value * 2) / 2;
}

function clampWeight(value: number, min: number, max: number | null) {
  if (max === null) {
    return Math.max(min, value);
  }

  return Math.min(max, Math.max(min, value));
}

function getWeightStepStyle(step: number) {
  if (step === 5) {
    return {
      fontSize: 18,
      fontWeight: "bold",
    };
  }

  if (step === 2.5) {
    return {
      fontSize: 16,
      fontWeight: "bold",
    };
  }

  if (step === 1) {
    return {
      fontSize: 15,
      fontWeight: 700,
    };
  }

  return {
    fontSize: 14,
    fontWeight: 700,
  };
}

function playGetReadyTone() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    ((window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.36);

  oscillator.onended = () => {
    void audioContext.close();
  };
}

function formatRest(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60} Min`;
  }

  return `${seconds} Sek`;
}

function formatRestTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(
    2,
    "0"
  )}`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function navigateToSummary(
  router: ReturnType<typeof useRouter>,
  sessionId: number
) {
  const target = `/workout/summary/index.html?sessionId=${sessionId}`;

  if (typeof window !== "undefined") {
    window.location.assign(target);
    return;
  }

  router.push(target);
}


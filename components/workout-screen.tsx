"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearActiveWorkoutState,
  setActiveWorkoutState,
} from "@/lib/activeWorkout";

import {
  getBestMatchingSet,
  getLastSessionForExercise,
  getLastSetForExercise,
  getPreviousMatchingSet,
  getProgress,
  getTopSet,
  saveSet,
  saveWorkoutEvent,
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
import {
  type ExercisePlanBlock,
  getDefaultWeightConfig,
  type PausePlanBlock,
  type StretchPlanBlock,
  type TrainingPlanBlock,
  type WarmupPlanBlock,
} from "@/lib/trainingModel";
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
  dayBlocks?: TrainingPlanBlock[];
  planId?: string;
  planName?: string;
  dayId?: string;
  dayName?: string;
  resumeHref?: string;
  theme: WorkoutTheme;
};

export function WorkoutScreen({
  workoutType,
  workoutLabel,
  exercises,
  dayBlocks = [],
  planId,
  planName,
  dayId,
  dayName,
  resumeHref,
  theme,
}: WorkoutScreenProps) {
  const router = useRouter();

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [sessionId, setSessionId] = useState(0);

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
  const [activeFlowBlock, setActiveFlowBlock] = useState<
    PausePlanBlock | StretchPlanBlock | null
  >(null);
  const [pendingFlowBlocks, setPendingFlowBlocks] = useState<
    Array<PausePlanBlock | StretchPlanBlock>
  >([]);
  const [flowSequenceIndex, setFlowSequenceIndex] = useState(0);
  const [flowSequenceTotal, setFlowSequenceTotal] = useState(0);
  const [flowBlockEndsAt, setFlowBlockEndsAt] = useState<number | null>(null);
  const [flowNextAction, setFlowNextAction] = useState<
    "start-current" | "next-exercise" | "finish-workout" | null
  >(null);
  const [completedFlowBlockIds, setCompletedFlowBlockIds] = useState<string[]>([]);

  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [setStartedAt, setSetStartedAt] = useState(0);
  const [compactMode, setCompactMode] = useState(false);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const lastGetReadySecondRef = useRef<number | null>(null);

  const currentExercise = exercises[exerciseIndex];
  const currentWarmupRounds = getWarmupRoundsForExercise(
    currentExercise.id,
    dayBlocks
  );
  const currentWarmupRestSeconds = getWarmupRestForExercise(
    currentExercise.id,
    dayBlocks,
    Math.max(45, Math.round(currentExercise.restSeconds / 2))
  );
  const currentTotalSets = currentExercise.sets + currentWarmupRounds;
  const currentSetNumber = getInternalSetNumber(setIndex, currentWarmupRounds);
  const currentSetRestSeconds =
    currentSetNumber <= 0 ? currentWarmupRestSeconds : currentExercise.restSeconds;
  const weightConfig = getDefaultWeightConfig(currentExercise.name);
  const weightSteps = weightConfig.quickSteps;
  const totalSets = currentTotalSets;
  const previousSet = previousSets[setIndex] ?? null;
  const isWorkoutPaused = workoutPausedAt !== null;
  const isFlowBlockActive = activeFlowBlock !== null;
  const activeFlowContext = activeFlowBlock
    ? getFlowBlockExerciseContext(activeFlowBlock.id, dayBlocks)
    : null;
  const activeFlowContextLabel = getFlowBlockContextLabel(activeFlowContext);

  useEffect(() => {
    const now = Date.now();
    setSessionId(now);
    setStartTime(now);
    setCurrentTime(now);
    setSetStartedAt(now);
    setRestEndsAt(null);
    setWorkoutPausedAt(null);
    setActiveFlowBlock(null);
    setPendingFlowBlocks([]);
    setFlowSequenceIndex(0);
    setFlowSequenceTotal(0);
    setFlowBlockEndsAt(null);
    setFlowNextAction(null);
    setCompletedFlowBlockIds([]);
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
        const internalSetNumber = getInternalSetNumber(i, currentWarmupRounds);
        const last = await getLastSetForExercise(
          currentExercise.name,
          internalSetNumber,
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
        currentSetNumber,
        workoutType,
        activeSessionId
      );
      const bestSet = await getBestMatchingSet(
        currentExercise.name,
        currentSetNumber,
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
  }, [
    currentExercise,
    currentSetNumber,
    currentWarmupRounds,
    sessionId,
    totalSets,
    workoutType,
  ]);

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

  function activateFlowBlocks(
    blocks: Array<PausePlanBlock | StretchPlanBlock>,
    nextAction: "start-current" | "next-exercise" | "finish-workout"
  ) {
    if (blocks.length === 0) {
      return false;
    }

    const [firstBlock, ...remainingBlocks] = blocks;
    const now = Date.now();
    const durationSeconds = getFlowBlockDuration(firstBlock);

    setActiveFlowBlock(firstBlock);
    setPendingFlowBlocks(remainingBlocks);
    setFlowSequenceIndex(1);
    setFlowSequenceTotal(blocks.length);
    setFlowNextAction(nextAction);
    setFlowBlockEndsAt(now + durationSeconds * 1000);
    setSetStartedAt(now);
    return true;
  }

  function finishFlowSequence() {
    setActiveFlowBlock(null);
    setPendingFlowBlocks([]);
    setFlowSequenceIndex(0);
    setFlowSequenceTotal(0);
    setFlowBlockEndsAt(null);
    const nextAction = flowNextAction;
    setFlowNextAction(null);
    setCurrentTime(Date.now());

    if (nextAction === "start-current") {
      setSetStartedAt(Date.now());
      return;
    }

    if (nextAction === "next-exercise") {
      if (exerciseIndex < exercises.length - 1) {
        setExerciseIndex((current) => current + 1);
        setSetIndex(0);
        setSetStartedAt(Date.now());
      }
      return;
    }

    if (nextAction === "finish-workout" && sessionId !== 0) {
      navigateToSummary(router, sessionId);
    }
  }

  function advanceFlowBlock() {
    if (!activeFlowBlock) {
      return;
    }

    void saveWorkoutEvent({
      label: activeFlowBlock.label,
      contextLabel: activeFlowContextLabel || undefined,
      durationSeconds: getFlowBlockDuration(activeFlowBlock),
      eventType: activeFlowBlock.type,
      scope: activeFlowBlock.type === "pause" ? activeFlowBlock.scope : undefined,
      sessionId,
      type: workoutType,
      planId,
      planName,
      dayId,
      dayName,
    });

    setCompletedFlowBlockIds((current) =>
      current.includes(activeFlowBlock.id) ? current : [...current, activeFlowBlock.id]
    );

    if (pendingFlowBlocks.length > 0) {
      const [nextBlock, ...remainingBlocks] = pendingFlowBlocks;
      const now = Date.now();
      const durationSeconds = getFlowBlockDuration(nextBlock);
      setActiveFlowBlock(nextBlock);
      setPendingFlowBlocks(remainingBlocks);
      setFlowSequenceIndex((current) => current + 1);
      setFlowBlockEndsAt(now + durationSeconds * 1000);
      setSetStartedAt(now);
      return;
    }

    finishFlowSequence();
  }

  function handleNext() {
    if (isWorkoutPaused) {
      return;
    }

    if (activeFlowBlock) {
      advanceFlowBlock();
      return;
    }

    void stopRestOverlay();
    void setRestOverlayState(false);
    void clearRestNotification();
    setIsResting(false);
    setRestEndsAt(null);

    const nextSet = setIndex + 1;

    if (nextSet < currentTotalSets) {
      setSetIndex(nextSet);
      setSetStartedAt(Date.now());
      return;
    }

    const followingBlocks = getFollowingFlowBlocks(currentExercise.id, dayBlocks);
    const hasNextExercise = exerciseIndex < exercises.length - 1;

    if (
      activateFlowBlocks(
        followingBlocks,
        hasNextExercise ? "next-exercise" : "finish-workout"
      )
    ) {
      return;
    }

    if (hasNextExercise) {
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
    if (sessionId === 0 || activeFlowBlock || isResting) {
      return;
    }

    const leadingBlocks = getLeadingFlowBlocks(dayBlocks);
    if (leadingBlocks.length === 0) {
      return;
    }

    activateFlowBlocks(leadingBlocks, "start-current");
  }, [activeFlowBlock, dayBlocks, isResting, sessionId]);

  useEffect(() => {
    if (!activeFlowBlock || !flowBlockEndsAt || isWorkoutPaused) {
      return;
    }

    if (currentTime >= flowBlockEndsAt) {
      advanceFlowBlock();
    }
  }, [activeFlowBlock, currentTime, flowBlockEndsAt, isWorkoutPaused]);

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
        set: currentSetNumber,
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
          set: currentSetNumber,
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
          set: currentSetNumber,
          sessionId,
          timestamp: savedAt,
          type: workoutType,
          planId,
          planName,
          dayId,
          dayName,
        },
      ]);

      const nextRestEndsAt = savedAt + currentSetRestSeconds * 1000;
      setRestEndsAt(nextRestEndsAt);
      setIsResting(true);
      await scheduleRestNotification(
        getExerciseLabel(currentExercise.name),
        currentSetRestSeconds
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
  const flowBlockTime = Math.max(
    0,
    Math.ceil(((flowBlockEndsAt ?? effectiveNow) - effectiveNow) / 1000)
  );
  const restTime = Math.max(
    0,
    Math.ceil(((restEndsAt ?? effectiveNow) - effectiveNow) / 1000)
  );
  const totalWorkoutSets = exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets + getWarmupRoundsForExercise(exercise.id, dayBlocks),
    0
  );
  const completedSetCountBeforeCurrent = exercises
    .slice(0, exerciseIndex)
    .reduce(
      (sum, exercise) =>
        sum + exercise.sets + getWarmupRoundsForExercise(exercise.id, dayBlocks),
      0
    );
  const progressPercent = Math.round(
    (((completedSetCountBeforeCurrent + setIndex + 1) / totalWorkoutSets) || 0) *
      100
  );
  const restProgress = Math.max(
    0,
    Math.min(100, (restTime / currentSetRestSeconds) * 100)
  );
  const visualCountdown =
    !isWorkoutPaused &&
    ((isResting && restTime > 0 && restTime <= 3 && restTime) ||
      (isFlowBlockActive && flowBlockTime > 0 && flowBlockTime <= 3 && flowBlockTime) ||
      null);
  const lastSavedSet = loggedSets[loggedSets.length - 1] ?? null;
  const previousExercise = exerciseIndex > 0 ? exercises[exerciseIndex - 1] : null;
  const previousExerciseSets = previousExercise
    ? loggedSets.filter((set) => set.exercise === previousExercise.name)
    : [];
  const previousExerciseTopSet = getTopSet(previousExerciseSets);
  const previousExerciseTotalSets = previousExercise
    ? previousExercise.sets + getWarmupRoundsForExercise(previousExercise.id, dayBlocks)
    : 0;
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
      total: exercise.sets + getWarmupRoundsForExercise(exercise.id, dayBlocks),
      topSet: getTopSet(savedSetsForExercise),
    };
  });
  const activeExerciseId = currentExercise?.id ?? null;
  const currentExerciseBlock =
    dayBlocks.find(
      (block): block is ExercisePlanBlock =>
        block.type === "exercise" && block.exerciseId === activeExerciseId
    ) ?? null;
  const activeBlockId =
    activeFlowBlock?.id ??
    ((currentSetNumber <= 0
      ? dayBlocks.find(
          (block) =>
            block.type === "warmup" && block.parentExerciseId === activeExerciseId
        )?.id
      : null) ??
    dayBlocks.find(
      (block) =>
        block.type === "exercise" && block.exerciseId === activeExerciseId
    )?.id ??
    null);
  const dayBlocksProgress = dayBlocks.map((block) => {
    if (block.type === "exercise") {
      const savedSetsForExercise = loggedSets.filter(
        (set) => set.exercise === block.exerciseId && set.set > 0
      );

      return {
        ...block,
        doneLabel: `${savedSetsForExercise.length}/${block.sets}`,
        done: savedSetsForExercise.length > 0,
      };
    }

    if (block.type === "warmup") {
      const parentExercise = exercises.find(
        (exercise) => exercise.id === block.parentExerciseId
      );
      const savedSetsForExercise = parentExercise
        ? loggedSets.filter(
            (set) => set.exercise === parentExercise.name && set.set <= 0
          )
        : [];
      const warmupsDone = Math.min(savedSetsForExercise.length, block.rounds);

      return {
        ...block,
        doneLabel: `${warmupsDone}/${block.rounds}`,
        done: warmupsDone > 0,
      };
    }

    if (block.type === "stretch") {
      return {
        ...block,
        doneLabel: `${block.rounds} Runden`,
        done: completedFlowBlockIds.includes(block.id),
      };
    }

    return {
      ...block,
      doneLabel: formatRest(block.seconds),
      done: completedFlowBlockIds.includes(block.id),
    };
  });
  const shouldShowPlanDetails =
    showPlanDetails || isResting || isFlowBlockActive || isWorkoutPaused;
  const totalCompletedSets = dayProgress.reduce((sum, entry) => sum + entry.completed, 0);
  const totalPlannedSets = dayProgress.reduce((sum, entry) => sum + entry.total, 0);
  const activeDayProgress = dayProgress[exerciseIndex] ?? null;
  const lastLoggedExerciseSet =
    loggedSets
      .filter((set) => set.exercise === currentExercise.name)
      .sort((a, b) => a.timestamp - b.timestamp)
      .at(-1) ?? null;
  const comparisonStageLabel = formatSetStageLabel(
    setIndex,
    currentWarmupRounds,
    currentExercise.sets
  );
  const screenStateLabel = getScreenStateLabel({
    isWorkoutPaused,
    isResting,
    activeFlowBlock,
    currentSetNumber,
  });
  const nextStepLabel = getNextStepLabel({
    isWorkoutPaused,
    isResting,
    activeFlowBlock,
    pendingFlowBlocks,
    flowNextAction,
    setIndex,
    currentWarmupRounds,
    currentExercise,
    currentExerciseIndex: exerciseIndex,
    currentExerciseSetCount: currentExercise.sets,
    currentTotalSets,
    exercises,
    dayBlocks,
  });
  const flowSequenceLabel =
    activeFlowBlock && flowSequenceTotal > 0
      ? `Block ${flowSequenceIndex}/${flowSequenceTotal}`
      : null;
  const upcomingFlowBlocks = pendingFlowBlocks.slice(0, 3);

  useEffect(() => {
    if (!resumeHref || sessionId === 0) {
      return;
    }

    setActiveWorkoutState({
      href: resumeHref,
      workoutLabel,
      planName,
      dayName,
      stateLabel: screenStateLabel,
      updatedAt: Date.now(),
    });
  }, [dayName, planName, resumeHref, screenStateLabel, sessionId, workoutLabel]);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    window.location.href = "/index.html";
  }

  useEffect(() => {
    if ((!isResting && !isFlowBlockActive) || isWorkoutPaused) {
      lastGetReadySecondRef.current = null;
      return;
    }

    const triggerSecond = isFlowBlockActive ? flowBlockTime : restTime;

    if (triggerSecond === 10 && lastGetReadySecondRef.current !== triggerSecond) {
      lastGetReadySecondRef.current = triggerSecond;
      playGetReadyTone();
      return;
    }

    if (triggerSecond > 10) {
      lastGetReadySecondRef.current = null;
    }
  }, [flowBlockTime, isFlowBlockActive, isResting, isWorkoutPaused, restTime]);

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
        <div style={{ ...topRow, ...(compactMode ? compactTopRow : null) }}>
          <div style={topActions}>
            <button style={backButton} onClick={handleBack}>
              ← Zurück
            </button>
          </div>
          <div style={topActions}>
            <a href="/index.html" style={homeLink}>
              Start
            </a>
            <button style={controlButton} onClick={() => void toggleWorkoutPause()}>
              {isWorkoutPaused ? "Training fortsetzen" : "Training pausieren"}
            </button>
          </div>
        </div>

        <div style={{ ...contextRow, ...(compactMode ? compactContextRow : null) }}>
          <div style={contextMeta}>
            <span>{planName ?? workoutLabel}</span>
            <span>{dayName ?? workoutLabel}</span>
          </div>
          <div style={{ ...stateChip, ...(compactMode ? compactStateChip : null) }}>
            {screenStateLabel}
          </div>
        </div>

        {isWorkoutPaused ? (
          <>
            <div style={pausedBanner}>Training pausiert</div>
            <div style={pausedContextCard}>
              <div style={pausedContextLabel}>Fortsetzung</div>
              <div style={pausedContextValue}>{nextStepLabel}</div>
            </div>
          </>
        ) : null}

        <div style={progressHeader}>
          <div style={{ ...progressMeta, color: theme.accent }}>
            <span>Übung {exerciseIndex + 1}/{exercises.length}</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ ...progressTrack, background: theme.progressTrack }}>
            <div
              style={{
                ...progressFill,
                width: `${progressPercent}%`,
                background: theme.progressFill,
              }}
            />
          </div>
        </div>

        <div
          style={{
            ...badge,
            ...(compactMode ? compactBadge : null),
            background: theme.badgeBackground,
            color: theme.screenBadge,
          }}
        >
          {workoutLabel}
        </div>

        <h1 style={{ ...title, ...(compactMode ? compactTitle : null), color: theme.accent }}>
          {activeFlowBlock
            ? activeFlowBlock.label
            : getExerciseLabel(currentExercise.name)}
        </h1>

        <div style={{ ...subtitle, ...(compactMode ? compactSubtitle : null) }}>
          {activeFlowBlock
            ? getFlowBlockSubtitle(activeFlowBlock)
            : formatSetStageLabel(setIndex, currentWarmupRounds, currentExercise.sets)}
        </div>

        <div style={{ ...transitionCard, ...(compactMode ? compactTransitionCard : null) }}>
          <div style={transitionColumn}>
            <div style={transitionLabel}>Jetzt</div>
            <div style={transitionValue}>{screenStateLabel}</div>
          </div>
          <div style={transitionDivider} />
          <div style={transitionColumn}>
            <div style={transitionLabel}>Danach</div>
            <div style={transitionValue}>{nextStepLabel}</div>
          </div>
        </div>

        <div style={{ ...metricsRow, ...(compactMode ? compactMetricsRow : null) }}>
          <div style={{ ...metricCard, ...(compactMode ? compactMetricCard : null) }}>
            <div style={metricLabel}>Workout</div>
            <div style={{ ...metricValue, ...(compactMode ? compactMetricValue : null) }}>
              {workoutDuration}
            </div>
          </div>
          <div
            style={{
              ...metricCard,
              ...(compactMode ? compactMetricCard : null),
              ...metricCardAccent,
              background: theme.badgeBackground,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ ...metricLabel, color: theme.accent }}>Aktiver Satz</div>
            <div
              style={{
                ...metricValue,
                ...(compactMode ? compactMetricValue : null),
                color: theme.accent,
              }}
            >
              {activeSetDuration}
            </div>
          </div>
        </div>

        <div style={{ ...insightGrid, ...(compactMode ? compactInsightGrid : null) }}>
          {!activeFlowBlock && (lastLoggedExerciseSet || lastTrainingSet || bestMatchingSet) ? (
            <div
              style={{
                ...insightCard,
                ...(compactMode ? compactInsightCard : null),
                ...insightWide,
              }}
            >
              <div style={insightLabel}>Vergleich</div>
              <div style={compareContextLabel}>{comparisonStageLabel}</div>
              <div style={{ ...compareTiles, ...(compactMode ? compactCompareTiles : null) }}>
                {lastLoggedExerciseSet ? (
                  <div style={{ ...compareTile, ...(compactMode ? compactCompareTile : null) }}>
                    <span style={compareTileLabel}>Letzter Satz</span>
                    <span style={compareTileValue}>
                      {formatWeight(lastLoggedExerciseSet.weight)} kg x{" "}
                      {formatReps(lastLoggedExerciseSet.reps)}
                    </span>
                  </div>
                ) : null}
                {lastTrainingSet ? (
                  <div style={{ ...compareTile, ...(compactMode ? compactCompareTile : null) }}>
                    <span style={compareTileLabel}>Letztes Training</span>
                    <span style={compareTileValue}>
                      {formatWeight(lastTrainingSet.weight)} kg x {formatReps(lastTrainingSet.reps)}
                    </span>
                  </div>
                ) : null}
                {bestMatchingSet ? (
                  <div style={{ ...compareTile, ...(compactMode ? compactCompareTile : null) }}>
                    <span style={compareTileLabel}>Bestwert</span>
                    <span style={compareTileValue}>
                      {formatWeight(bestMatchingSet.weight)} kg x {formatReps(bestMatchingSet.reps)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            style={{
              ...insightCard,
              ...(compactMode ? compactInsightCard : null),
              ...insightWide,
            }}
          >
            <div style={insightLabel}>Plan</div>
            {activeFlowBlock ? (
              <div style={{ ...compactMeta, ...(compactMode ? compactMetaTight : null) }}>
                <span>{getFlowBlockMeta(activeFlowBlock)}</span>
                {activeFlowContextLabel ? (
                  <span>{activeFlowContextLabel}</span>
                ) : null}
                {currentExercise ? (
                  <span>Nächste Übung: {getExerciseLabel(currentExercise.name)}</span>
                ) : null}
              </div>
            ) : (
              <div style={{ ...compactMeta, ...(compactMode ? compactMetaTight : null) }}>
                {currentExerciseBlock ? (
                  <span>{getExerciseTraitSummary(currentExerciseBlock)}</span>
                ) : null}
                <span>
                  {currentExercise.minReps}-{currentExercise.maxReps} Wdh.
                </span>
                <span>{formatRest(currentExercise.restSeconds)}</span>
                {currentTop ? (
                  <span>
                    Top {formatWeight(currentTop.weight)} x {formatReps(currentTop.reps)}
                  </span>
                ) : null}
                {progress &&
                (progress.weight !== 0 || progress.reps !== 0) ? (
                  <span style={{ color: getDeltaColor(progress.weight || progress.reps) }}>
                    {formatProgress(progress)}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...planOverviewCard, ...(compactMode ? compactPlanOverviewCard : null) }}>
          <div style={overviewHeaderRow}>
            <div style={insightLabel}>Heutiger Plan</div>
            <div style={overviewHeaderActions}>
              <div style={overviewSummary}>
                {totalCompletedSets} / {totalPlannedSets} Sätze
              </div>
              <button
                style={planToggleButton}
                onClick={() => setShowPlanDetails((current) => !current)}
              >
                {shouldShowPlanDetails ? "Weniger" : "Details"}
              </button>
            </div>
          </div>
          {activeDayProgress ? (
            <div style={planFocusRow}>
              <div style={planFocusText}>
                <div style={planFocusTitle}>
                  {getExerciseLabel(activeDayProgress.exercise.name)}
                </div>
                <div style={planFocusMeta}>
                  Aktuell {activeDayProgress.completed}/{activeDayProgress.total} Sätze
                </div>
              </div>
              <div style={planOverviewDots}>
                {Array.from({ length: activeDayProgress.total }).map((_, dotIndex) => (
                  <span
                    key={`${activeDayProgress.exercise.id}-${dotIndex}`}
                    style={{
                      ...planOverviewDot,
                      ...(dotIndex < activeDayProgress.completed ? completedPlanOverviewDot : null),
                      ...activePlanOverviewDot,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {shouldShowPlanDetails ? (
            <>
              <div style={planOverviewList}>
                {dayProgress.map((entry, index) => (
                  <div
                    key={`${entry.exercise.id}-${index}`}
                    style={{
                      ...planOverviewItem,
                      ...(index === exerciseIndex ? activePlanOverviewItem : null),
                    }}
                  >
                    <div style={planOverviewTop}>
                      <span style={planOverviewName}>
                        {getExerciseLabel(entry.exercise.name)}
                      </span>
                      <span style={planOverviewCount}>
                        {entry.completed}/{entry.total}
                      </span>
                    </div>
                    <div style={planOverviewDots}>
                      {Array.from({ length: entry.total }).map((_, dotIndex) => (
                        <span
                          key={`${entry.exercise.id}-${dotIndex}`}
                          style={{
                            ...planOverviewDot,
                            ...(dotIndex < entry.completed ? completedPlanOverviewDot : null),
                            ...(index === exerciseIndex ? activePlanOverviewDot : null),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {dayBlocksProgress.length > 0 ? (
                <div style={planBlocksSection}>
                  <div style={overviewHeaderRow}>
                    <div style={insightLabel}>Ablauf</div>
                    <div style={overviewSummary}>{dayBlocksProgress.length} Blöcke</div>
                  </div>
                  <div style={planBlocksList}>
                    {dayBlocksProgress.map((block) => (
                      <div
                        key={block.id}
                        style={{
                          ...planBlockChip,
                          ...(block.id === activeBlockId ? activePlanBlockChip : null),
                          ...(block.done ? completedPlanBlockChip : null),
                        }}
                        >
                          <span style={planBlockType}>{getPlanBlockTypeLabel(block.type)}</span>
                          <span style={planBlockName}>{block.label}</span>
                        <span style={planBlockMeta}>
                          {getPlanBlockSummary(block)} · {block.doneLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {activeFlowBlock ? (
          <div
            style={{
              ...restCard,
              ...(compactMode ? compactRestCard : null),
              background: theme.badgeBackground,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ ...restLabel, color: theme.accent }}>
              {activeFlowBlock.type === "stretch"
                ? "Dehnen"
                : activeFlowBlock.scope === "workout"
                  ? "Workout-Pause"
                  : "Pauseblock"}
            </div>
            {flowSequenceLabel ? (
              <div style={flowSequenceMeta}>{flowSequenceLabel}</div>
            ) : null}
            <div style={{ ...restTimer, ...(compactMode ? compactRestTimer : null) }}>
              {formatRestTimer(flowBlockTime)}
            </div>
            {visualCountdown ? (
              <div style={countdownOverlay}>{visualCountdown}</div>
            ) : null}
            <div style={{ ...progressTrack, background: theme.progressTrack }}>
              <div
                style={{
                  ...progressFill,
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (flowBlockTime / getFlowBlockDuration(activeFlowBlock)) * 100
                    )
                  )}%`,
                  background: theme.restFill,
                }}
              />
            </div>
            <div style={{ ...restContextCard, ...(compactMode ? compactRestContextCard : null) }}>
              <div style={insightLabel}>Aktueller Block</div>
              <div style={restContextValue}>{activeFlowBlock.label}</div>
              <div style={restContextMeta}>{getFlowBlockMeta(activeFlowBlock)}</div>
              {activeFlowContextLabel ? (
                <div style={restContextMeta}>{activeFlowContextLabel}</div>
              ) : null}
              {pendingFlowBlocks.length > 0 ? (
                <div style={flowPreviewSection}>
                  <div style={insightLabel}>Als Nächstes</div>
                  <div style={flowPreviewRow}>
                    {upcomingFlowBlocks.map((block) => (
                      <span key={block.id} style={flowPreviewChip}>
                        {block.label}
                      </span>
                    ))}
                    {pendingFlowBlocks.length > upcomingFlowBlocks.length ? (
                      <span style={flowPreviewMoreChip}>
                        +{pendingFlowBlocks.length - upcomingFlowBlocks.length}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={restContextMeta}>Danach: {nextStepLabel}</div>
              )}
            </div>
            <button
              style={{ ...continueButton, ...(compactMode ? compactContinueButton : null) }}
              onClick={handleNext}
            >
              Weiter
            </button>
          </div>
        ) : !isResting ? (
          <div style={{ ...activeStack, ...(compactMode ? compactActiveStack : null) }}>
            <div style={{ ...weightBox, ...(compactMode ? compactWeightBox : null) }}>
              {formatWeight(weight)} kg
            </div>

            <div style={sectionLabel}>Gewicht</div>
            <div style={weightControls}>
              <div style={{ ...weightRow, ...(compactMode ? compactWeightRow : null) }}>
                {weightSteps.map((step) => (
                  <button
                    key={`minus-${step}`}
                    style={{
                      ...miniButton,
                      ...(compactMode ? compactMiniButton : null),
                      ...getWeightStepStyle(step),
                      ...(canChangeWeight(-step) ? null : disabledButton),
                    }}
                    onClick={() => changeWeight(-step)}
                    disabled={!canChangeWeight(-step)}
                  >
                    -{formatWeight(step)}
                  </button>
                ))}
              </div>
              <div style={{ ...weightRow, ...(compactMode ? compactWeightRow : null) }}>
                {weightSteps
                  .slice()
                  .reverse()
                  .map((step) => (
                    <button
                      key={`plus-${step}`}
                      style={{
                        ...miniButton,
                        ...(compactMode ? compactMiniButton : null),
                        ...getWeightStepStyle(step),
                        ...(canChangeWeight(step) ? null : disabledButton),
                      }}
                      onClick={() => changeWeight(step)}
                      disabled={!canChangeWeight(step)}
                    >
                      +{formatWeight(step)}
                    </button>
                  ))}
              </div>
            </div>

            <div style={sectionLabel}>Wiederholungen</div>
            <div style={{ ...repsGrid, ...(compactMode ? compactRepsGrid : null) }}>
              <button
                style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }}
                onClick={() => handleRepsChange(-1)}
              >
                -1
              </button>
              <button
                style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }}
                onClick={() => handleRepsChange(-0.5)}
              >
                -0.5
              </button>
              <button style={{ ...saveButton, ...(compactMode ? compactSaveButton : null) }} onClick={save}>
                <span style={{ ...saveButtonValue, ...(compactMode ? compactSaveButtonValue : null) }}>
                  {formatReps(reps)}
                </span>
                <span style={{ ...saveButtonLabel, ...(compactMode ? compactSaveButtonLabel : null) }}>
                  Satz speichern
                </span>
              </button>
              <button
                style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }}
                onClick={() => handleRepsChange(0.5)}
              >
                +0.5
              </button>
              <button
                style={{ ...sideButton, ...(compactMode ? compactSideButton : null) }}
                onClick={() => handleRepsChange(1)}
              >
                +1
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              ...restCard,
              ...(compactMode ? compactRestCard : null),
              background: theme.badgeBackground,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ ...restLabel, color: theme.accent }}>Pause</div>
            <div style={{ ...restTimer, ...(compactMode ? compactRestTimer : null) }}>
              {formatRestTimer(restTime)}
            </div>
            {visualCountdown ? (
              <div style={countdownOverlay}>{visualCountdown}</div>
            ) : null}
            <div style={{ ...progressTrack, background: theme.progressTrack }}>
              <div
                style={{
                  ...progressFill,
                  width: `${restProgress}%`,
                  background: theme.restFill,
                }}
              />
            </div>
            {lastSavedSet ? (
              <div style={{ ...restContextCard, ...(compactMode ? compactRestContextCard : null) }}>
                <div style={insightLabel}>Zuletzt gespeichert</div>
                <div style={restContextValue}>
                  {getExerciseLabel(lastSavedSet.exercise)} · {formatWeight(lastSavedSet.weight)} kg x{" "}
                  {formatReps(lastSavedSet.reps)}
                </div>
                <div style={restSetRow}>
                  {Array.from({
                    length: currentTotalSets,
                  }).map((_, index) => (
                    <span
                      key={`current-rest-set-${index}`}
                      style={{
                        ...restSetDot,
                        ...(index < currentExerciseProgress.length ? restSetDotDone : null),
                      }}
                    />
                  ))}
                </div>
                <div style={restContextMeta}>
                  Aktuelle Übung: {currentExerciseProgress.length}/{currentTotalSets} Sätze
                </div>
                {previousExercise && previousExerciseSets.length > 0 ? (
                  <div style={previousExerciseCard}>
                    <div style={insightLabel}>Vorherige Übung</div>
                    <div style={restContextValue}>
                      {getExerciseLabel(previousExercise.name)}
                    </div>
                    <div style={restSetRow}>
                      {Array.from({
                        length: previousExerciseTotalSets,
                      }).map((_, index) => (
                        <span
                          key={`previous-rest-set-${index}`}
                          style={{
                            ...restSetDot,
                            ...(index < previousExerciseSets.length ? restSetDotDone : null),
                          }}
                        />
                      ))}
                    </div>
                    <div style={restContextMeta}>
                      {previousExerciseSets.length}/{previousExerciseTotalSets} Sätze erledigt
                    </div>
                    {previousExerciseTopSet ? (
                      <div style={restContextMeta}>
                        Top: {formatWeight(previousExerciseTopSet.weight)} kg x{" "}
                        {formatReps(previousExerciseTopSet.reps)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={restWeightLabel}>Nächstes Gewicht</div>
            <div style={{ ...restWeightValue, ...(compactMode ? compactRestWeightValue : null) }}>
              {formatWeight(weight)} kg
            </div>
            <div style={weightControls}>
              <div style={{ ...restWeightRow, ...(compactMode ? compactRestWeightRow : null) }}>
                {weightSteps.map((step) => (
                  <button
                    key={`rest-minus-${step}`}
                    style={{
                      ...restWeightButton,
                      ...(compactMode ? compactRestWeightButton : null),
                      ...getWeightStepStyle(step),
                      ...(canChangeWeight(-step) ? null : disabledButton),
                    }}
                    onClick={() => changeWeight(-step)}
                    disabled={!canChangeWeight(-step)}
                  >
                    -{formatWeight(step)}
                  </button>
                ))}
              </div>
              <div style={{ ...restWeightRow, ...(compactMode ? compactRestWeightRow : null) }}>
                {weightSteps
                  .slice()
                  .reverse()
                  .map((step) => (
                    <button
                      key={`rest-plus-${step}`}
                      style={{
                        ...restWeightButton,
                        ...(compactMode ? compactRestWeightButton : null),
                        ...getWeightStepStyle(step),
                        ...(canChangeWeight(step) ? null : disabledButton),
                      }}
                      onClick={() => changeWeight(step)}
                      disabled={!canChangeWeight(step)}
                    >
                      +{formatWeight(step)}
                    </button>
                  ))}
              </div>
            </div>
            <button
              style={{ ...continueButton, ...(compactMode ? compactContinueButton : null) }}
              onClick={handleNext}
            >
              Weiter
            </button>
          </div>
        )}

        {loading ? <p style={loadingText}>Speichere...</p> : null}
      </div>
    </div>
  );
}

const screen = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: "8px",
};

const card = {
  width: "100%",
  maxWidth: 430,
  minHeight: "calc(100dvh - 16px)",
  borderRadius: 28,
  padding: "8px 8px 10px",
  background: "rgba(255,255,255,0.94)",
  backdropFilter: "blur(14px)",
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto auto auto 1fr auto",
  alignContent: "start" as const,
  gap: 6,
};

const progressHeader = {
  marginBottom: 2,
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const compactTopRow = {
  gap: 6,
};

const topActions = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const contextRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const compactContextRow = {
  gap: 6,
};

const contextMeta = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
};

const stateChip = {
  minHeight: 26,
  padding: "4px 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
  border: "1px solid #dde5f0",
  color: "#0f172a",
  fontSize: 11,
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const compactStateChip = {
  minHeight: 24,
  padding: "3px 8px",
  fontSize: 10,
};

const controlButton = {
  minHeight: 28,
  padding: "5px 9px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "end",
  border: "1px solid #dde5f0",
  background: "#111827",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: "bold",
};

const homeLink = {
  minHeight: 28,
  padding: "5px 8px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  background: "#f8fafc",
  border: "1px solid #dde5f0",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
};

const backButton = {
  minHeight: 28,
  padding: "5px 9px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  border: "1px solid #d6dbe5",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
};

const pausedBanner = {
  minHeight: 32,
  padding: "6px 12px",
  borderRadius: 12,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#c2410c",
  fontSize: 12,
  fontWeight: "bold",
  textAlign: "center" as const,
};

const pausedContextCard = {
  padding: "8px 10px",
  borderRadius: 12,
  background: "#fffaf5",
  border: "1px solid #fed7aa",
  display: "grid",
  gap: 3,
};

const pausedContextLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
  color: "#9a3412",
  fontWeight: 700,
};

const pausedContextValue = {
  fontSize: 13,
  color: "#7c2d12",
  fontWeight: "bold",
  lineHeight: 1.3,
};

const progressMeta = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  opacity: 0.82,
};

const progressTrack = {
  marginTop: 5,
  width: "100%",
  height: 9,
  borderRadius: 999,
  overflow: "hidden" as const,
};

const progressFill = {
  height: "100%",
  borderRadius: 999,
};

const badge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "5px 11px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: "bold",
  letterSpacing: 1,
  justifySelf: "start" as const,
};

const title = {
  fontSize: 22,
  fontWeight: "bold",
  textAlign: "center" as const,
  lineHeight: 1,
  margin: 0,
};

const subtitle = {
  textAlign: "center" as const,
  fontSize: 14,
  fontWeight: "bold",
  color: "#1f2937",
};

const transitionCard = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 8,
  padding: "6px 9px",
  borderRadius: 13,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const transitionColumn = {
  display: "grid",
  gap: 2,
};

const transitionLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
  color: "#64748b",
  fontWeight: 600,
};

const transitionValue = {
  fontSize: 12,
  color: "#111827",
  fontWeight: "bold",
  lineHeight: 1.25,
};

const transitionDivider = {
  width: 1,
  alignSelf: "stretch" as const,
  background: "#dbe4f0",
};

const metricsRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const metricCard = {
  padding: "8px 10px",
  borderRadius: 15,
  background: "#f6f7fb",
};

const metricCardAccent = {
  border: "1px solid transparent",
};

const metricLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#6b7280",
};

const metricValue = {
  marginTop: 4,
  fontSize: 15,
  fontWeight: "bold",
  color: "#111827",
};

const insightGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const insightCard = {
  padding: "8px 10px",
  borderRadius: 13,
  background: "#f9fafb",
  border: "1px solid #e7ebf2",
};

const insightWide = {
  gridColumn: "1 / -1",
};

const insightLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#6b7280",
};

const insightValue = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
};

const compactMeta = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 4,
  fontSize: 11,
  fontWeight: 600,
  color: "#475569",
};

const compareContextLabel = {
  marginTop: 4,
  fontSize: 10,
  color: "#64748b",
  fontWeight: 600,
};

const compareTiles = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
  marginTop: 4,
};

const compareTile = {
  display: "grid",
  gap: 4,
  padding: "7px 8px",
  borderRadius: 11,
  background: "#ffffff",
  border: "1px solid #e7ebf2",
};

const compactCompareTiles = {
  gap: 5,
};

const compactCompareTile = {
  gap: 3,
  padding: "6px 7px",
};

const compareTileLabel = {
  fontSize: 10,
  color: "#64748b",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: 0.7,
};

const compareTileValue = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#111827",
  lineHeight: 1.25,
};

const planOverviewCard = {
  padding: "8px 10px",
  borderRadius: 13,
  background: "#f9fafb",
  border: "1px solid #e7ebf2",
  display: "grid",
  gap: 7,
};

const overviewHeaderRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const overviewHeaderActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const overviewSummary = {
  fontSize: 11,
  fontWeight: "bold",
  color: "#475569",
};

const planToggleButton = {
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid #d7e0ec",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 11,
  fontWeight: "bold",
};

const planFocusRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "6px 8px",
  borderRadius: 11,
  background: "#ffffff",
  border: "1px solid #e7ebf2",
};

const planFocusText = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const planFocusTitle = {
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
};

const planFocusMeta = {
  fontSize: 11,
  color: "#64748b",
};

const planOverviewList = {
  display: "grid",
  gap: 6,
};

const planBlocksSection = {
  display: "grid",
  gap: 6,
};

const planBlocksList = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const planBlockChip = {
  display: "grid",
  gap: 2,
  minWidth: 104,
  padding: "7px 8px",
  borderRadius: 12,
  background: "#ffffff",
  border: "1px solid #e7ebf2",
};

const activePlanBlockChip = {
  border: "1px solid #d7e6ff",
  background: "#f8fbff",
  boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.1)",
};

const completedPlanBlockChip = {
  background: "#f8fff8",
};

const planBlockType = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#64748b",
};

const planBlockName = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#111827",
};

const planBlockMeta = {
  fontSize: 11,
  color: "#475569",
};

const planOverviewItem = {
  padding: "7px 8px",
  borderRadius: 11,
  background: "#ffffff",
  border: "1px solid #e7ebf2",
};

const activePlanOverviewItem = {
  border: "1px solid #d7e6ff",
  background: "#f8fbff",
};

const planOverviewTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const planOverviewName = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#111827",
};

const planOverviewCount = {
  fontSize: 11,
  fontWeight: "bold",
  color: "#64748b",
};

const planOverviewDots = {
  display: "flex",
  gap: 4,
  marginTop: 5,
};

const planOverviewDot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#e5e7eb",
};

const completedPlanOverviewDot = {
  background: "#22c55e",
};

const activePlanOverviewDot = {
  boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.18)",
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
  display: "grid",
  alignContent: "start" as const,
  gap: 6,
  padding: "9px 8px 8px",
  borderRadius: 18,
  textAlign: "center" as const,
};

const restLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const flowSequenceMeta = {
  marginTop: -1,
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
};

const restTimer = {
  fontSize: 28,
  fontWeight: "bold",
  color: "#111827",
  lineHeight: 1,
};

const countdownOverlay = {
  fontSize: 54,
  lineHeight: 1,
  fontWeight: "bold",
  color: "#dc2626",
  textAlign: "center" as const,
  letterSpacing: -1,
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

const restContextCard = {
  padding: "8px 10px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(215,225,239,0.8)",
  display: "grid",
  gap: 4,
};

const compactRestContextCard = {
  padding: "7px 8px",
  gap: 3,
};

const restContextValue = {
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
  lineHeight: 1.3,
};

const restContextMeta = {
  fontSize: 11,
  color: "#475569",
  lineHeight: 1.3,
};

const flowPreviewSection = {
  marginTop: 2,
  display: "grid",
  gap: 5,
};

const flowPreviewRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 5,
};

const flowPreviewChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 8px",
  borderRadius: 999,
  background: "#ffffff",
  border: "1px solid rgba(215,225,239,0.9)",
  color: "#334155",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.2,
};

const flowPreviewMoreChip = {
  ...flowPreviewChip,
  background: "#f8fafc",
  color: "#64748b",
};

const previousExerciseCard = {
  marginTop: 2,
  paddingTop: 6,
  borderTop: "1px solid rgba(215,225,239,0.9)",
  display: "grid",
  gap: 4,
};

const restSetRow = {
  display: "flex",
  gap: 5,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const restSetDot = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#e5e7eb",
};

const restSetDotDone = {
  background: "#22c55e",
};

const restWeightRow = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1.15fr 1fr 0.9fr",
  gap: 6,
};

const restWeightButton = {
  minHeight: 38,
  borderRadius: 12,
  border: "2px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const continueButton = {
  marginTop: 1,
  justifySelf: "center" as const,
  padding: "8px 16px",
  borderRadius: 14,
  border: "none",
  background: "#111827",
  color: "#fff",
  fontSize: 14,
  fontWeight: "bold",
};

const compactCard = {
  minHeight: "calc(100dvh - 16px)",
  gap: 5,
};

const compactBadge = {
  minHeight: 26,
  padding: "4px 10px",
  fontSize: 11,
};

const compactTitle = {
  fontSize: 20,
};

const compactSubtitle = {
  fontSize: 13,
};

const compactTransitionCard = {
  padding: "6px 8px",
  gap: 6,
};

const compactMetricsRow = {
  gap: 6,
};

const compactMetricCard = {
  padding: "8px 10px",
};

const compactMetricValue = {
  fontSize: 14,
};

const compactInsightGrid = {
  gap: 6,
};

const compactInsightCard = {
  padding: "7px 9px",
};

const compactInsightValue = {
  fontSize: 12,
};

const compactMetaTight = {
  gap: 5,
  fontSize: 10,
};

const compactPlanOverviewCard = {
  gap: 6,
  padding: "7px 9px",
};

const compactActiveStack = {
  gap: 5,
};

const compactWeightBox = {
  fontSize: 34,
};

const compactWeightRow = {
  gap: 5,
};

const compactMiniButton = {
  minHeight: 44,
  fontSize: 15,
};

const compactRepsGrid = {
  gridTemplateColumns: "44px 44px minmax(0, 1fr) 44px 44px",
  gap: 5,
};

const compactSideButton = {
  minHeight: 52,
  fontSize: 14,
};

const compactSaveButton = {
  minHeight: 86,
  borderRadius: 18,
};

const compactSaveButtonValue = {
  fontSize: 28,
};

const compactSaveButtonLabel = {
  fontSize: 9,
};

const compactRestCard = {
  gap: 6,
  padding: "9px 8px 8px",
};

const compactRestTimer = {
  fontSize: 24,
};

const compactRestWeightValue = {
  fontSize: 20,
};

const compactRestWeightRow = {
  gap: 5,
};

const compactRestWeightButton = {
  minHeight: 34,
  fontSize: 13,
};

const compactContinueButton = {
  padding: "7px 14px",
  fontSize: 13,
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

function getPlanBlockTypeLabel(type: TrainingPlanBlock["type"]) {
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

function getExerciseKindLabel(kind: ExercisePlanBlock["exerciseKind"]) {
  return kind === "compound" ? "Grundübung" : "Isolation";
}

function getExerciseTraitSummary(block: ExercisePlanBlock | null) {
  if (!block) {
    return "";
  }

  const parts = [getExerciseKindLabel(block.exerciseKind), block.category];

  if (block.weight.allowNegative) {
    parts.push("Gegengewicht");
  }

  return parts.join(" · ");
}

function getPlanBlockSummary(block: TrainingPlanBlock) {
  if (block.type === "exercise") {
    return getExerciseTraitSummary(block);
  }

  if (block.type === "warmup") {
    return "Vorbereitung";
  }

  if (block.type === "stretch") {
    return block.category;
  }

  return block.scope === "workout" ? "Workout" : "Zwischenblock";
}

function getLeadingFlowBlocks(dayBlocks: TrainingPlanBlock[]) {
  const blocks: Array<PausePlanBlock | StretchPlanBlock> = [];

  for (const block of dayBlocks) {
    if (block.type === "exercise" || block.type === "warmup") {
      break;
    }

    if (block.type === "stretch" || block.type === "pause") {
      blocks.push(block);
    }
  }

  return blocks;
}

function getFollowingFlowBlocks(
  exerciseId: string,
  dayBlocks: TrainingPlanBlock[]
) {
  const exerciseIndex = dayBlocks.findIndex(
    (block) => block.type === "exercise" && block.exerciseId === exerciseId
  );

  if (exerciseIndex === -1) {
    return [];
  }

  const blocks: Array<PausePlanBlock | StretchPlanBlock> = [];

  for (let index = exerciseIndex + 1; index < dayBlocks.length; index += 1) {
    const block = dayBlocks[index];

    if (block.type === "exercise" || block.type === "warmup") {
      break;
    }

    if (block.type === "stretch" || block.type === "pause") {
      blocks.push(block);
    }
  }

  return blocks;
}

function getWarmupRoundsForExercise(
  exerciseId: string,
  dayBlocks: TrainingPlanBlock[]
) {
  const warmupBlock = dayBlocks.find(
    (block): block is WarmupPlanBlock =>
      block.type === "warmup" && block.parentExerciseId === exerciseId
  );

  return (
    warmupBlock?.rounds ?? 1
  );
}

function getWarmupRestForExercise(
  exerciseId: string,
  dayBlocks: TrainingPlanBlock[],
  fallbackRestSeconds: number
) {
  const warmupBlock = dayBlocks.find(
    (block): block is WarmupPlanBlock =>
      block.type === "warmup" && block.parentExerciseId === exerciseId
  );

  return (
    warmupBlock?.restSeconds ?? fallbackRestSeconds
  );
}

function getInternalSetNumber(setIndex: number, warmupRounds: number) {
  return setIndex - warmupRounds + 1;
}

function formatSetStageLabel(
  setIndex: number,
  warmupRounds: number,
  workSets: number
) {
  if (setIndex < warmupRounds) {
    return `Aufwärmen ${setIndex + 1}/${warmupRounds}`;
  }

  return `Satz ${setIndex - warmupRounds + 1}/${workSets}`;
}

function getFlowBlockDuration(block: PausePlanBlock | StretchPlanBlock) {
  if (block.type === "stretch") {
    return block.holdSeconds * block.rounds;
  }

  return block.seconds;
}

function getFlowBlockSubtitle(block: PausePlanBlock | StretchPlanBlock) {
  if (block.type === "stretch") {
    return `Dehnen · ${block.rounds} Runden`;
  }

  return block.scope === "workout" ? "Workout-Pause" : "Pauseblock";
}

function getFlowBlockMeta(block: PausePlanBlock | StretchPlanBlock) {
  if (block.type === "stretch") {
    return `${block.rounds} Runden · ${block.holdSeconds} Sek`;
  }

  return `${formatRest(block.seconds)} · ${
    block.scope === "workout" ? "Workout" : "Zwischenblock"
  }`;
}

function getFlowBlockExerciseContext(
  blockId: string,
  dayBlocks: TrainingPlanBlock[]
) {
  const blockIndex = dayBlocks.findIndex((block) => block.id === blockId);

  if (blockIndex === -1) {
    return null;
  }

  let previousExercise: TrainingPlanBlock | null = null;
  for (let index = blockIndex - 1; index >= 0; index -= 1) {
    const block = dayBlocks[index];
    if (block.type === "exercise") {
      previousExercise = block;
      break;
    }
  }

  let nextExercise: TrainingPlanBlock | null = null;
  for (let index = blockIndex + 1; index < dayBlocks.length; index += 1) {
    const block = dayBlocks[index];
    if (block.type === "exercise") {
      nextExercise = block;
      break;
    }
  }

  return {
    previousExercise:
      previousExercise?.type === "exercise" ? previousExercise.label : null,
    nextExercise: nextExercise?.type === "exercise" ? nextExercise.label : null,
  };
}

function getFlowBlockContextLabel(
  context:
    | {
        previousExercise: string | null;
        nextExercise: string | null;
      }
    | null
) {
  if (!context) {
    return "";
  }

  if (context.previousExercise && context.nextExercise) {
    return `Zwischen ${context.previousExercise} und ${context.nextExercise}`;
  }

  if (context.nextExercise) {
    return `Vor ${context.nextExercise}`;
  }

  if (context.previousExercise) {
    return `Nach ${context.previousExercise}`;
  }

  return "";
}

function getScreenStateLabel({
  isWorkoutPaused,
  isResting,
  activeFlowBlock,
  currentSetNumber,
}: {
  isWorkoutPaused: boolean;
  isResting: boolean;
  activeFlowBlock: PausePlanBlock | StretchPlanBlock | null;
  currentSetNumber: number;
}) {
  if (isWorkoutPaused) {
    return "Training pausiert";
  }

  if (activeFlowBlock) {
    return activeFlowBlock.type === "stretch"
      ? "Dehnen"
      : activeFlowBlock.scope === "workout"
        ? "Workout-Pause"
        : "Pauseblock";
  }

  if (isResting) {
    return "Satzpause";
  }

  if (currentSetNumber <= 0) {
    return "Aufwärmen";
  }

  return "Aktiver Satz";
}

function getNextStepLabel({
  isWorkoutPaused,
  isResting,
  activeFlowBlock,
  pendingFlowBlocks,
  flowNextAction,
  setIndex,
  currentWarmupRounds,
  currentExercise,
  currentExerciseIndex,
  currentExerciseSetCount,
  currentTotalSets,
  exercises,
  dayBlocks,
}: {
  isWorkoutPaused: boolean;
  isResting: boolean;
  activeFlowBlock: PausePlanBlock | StretchPlanBlock | null;
  pendingFlowBlocks: Array<PausePlanBlock | StretchPlanBlock>;
  flowNextAction: "start-current" | "next-exercise" | "finish-workout" | null;
  setIndex: number;
  currentWarmupRounds: number;
  currentExercise: WorkoutExercise;
  currentExerciseIndex: number;
  currentExerciseSetCount: number;
  currentTotalSets: number;
  exercises: WorkoutExercise[];
  dayBlocks: TrainingPlanBlock[];
}) {
  if (isWorkoutPaused) {
    if (activeFlowBlock) {
      return `${activeFlowBlock.label} fortsetzen`;
    }

    if (isResting) {
      return "Satzpause fortsetzen";
    }

    return "Training fortsetzen";
  }

  if (activeFlowBlock) {
    if (pendingFlowBlocks.length > 0) {
      return pendingFlowBlocks[0].label;
    }

    if (flowNextAction === "start-current") {
      return describeExerciseStart(currentExercise, currentWarmupRounds);
    }

    if (flowNextAction === "next-exercise") {
      const nextExercise = exercises[currentExerciseIndex + 1];
      if (!nextExercise) {
        return "Übersicht";
      }

      const warmups = getWarmupRoundsForExercise(nextExercise.id, dayBlocks);
      return describeExerciseStart(nextExercise, warmups);
    }

    return "Übersicht";
  }

  if (isResting) {
    if (setIndex + 1 < currentTotalSets) {
      return formatSetStageLabel(
        setIndex + 1,
        currentWarmupRounds,
        currentExerciseSetCount
      );
    }

    const followingBlocks = getFollowingFlowBlocks(currentExercise.id, dayBlocks);
    if (followingBlocks.length > 0) {
      return followingBlocks[0].label;
    }

    const nextExercise = exercises[currentExerciseIndex + 1];
    if (!nextExercise) {
      return "Übersicht";
    }

    const warmups = getWarmupRoundsForExercise(nextExercise.id, dayBlocks);
    return describeExerciseStart(nextExercise, warmups);
  }

  return "Nach Speichern: Satzpause";
}

function describeExerciseStart(exercise: WorkoutExercise, warmupRounds: number) {
  const stage =
    warmupRounds > 0
      ? formatSetStageLabel(0, warmupRounds, exercise.sets)
      : formatSetStageLabel(0, 0, exercise.sets);

  return `${getExerciseLabel(exercise.name)} · ${stage}`;
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
  clearActiveWorkoutState();
  const target = `/workout/summary/index.html?sessionId=${sessionId}`;

  if (typeof window !== "undefined") {
    window.location.assign(target);
    return;
  }

  router.push(target);
}


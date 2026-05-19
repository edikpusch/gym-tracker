"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getBestMatchingSet,
  getLastSessionForExercise,
  getLastSetForExercise,
  getPreviousMatchingSet,
  getProgress,
  getSessionSetEntries,
  saveWorkoutEvent,
  getTopSet,
  saveSet,
  type SetType,
} from "@/lib/workoutEngine";
import {
  clearRestNotification,
  scheduleRestNotification,
} from "@/lib/restNotifications";
import { getAppPreferences, type AppPreferences } from "@/lib/appPreferences";
import { getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import {
  clearActiveWorkoutState,
  getActiveWorkoutSnapshot,
  setActiveWorkoutState,
  setActiveWorkoutSnapshot,
} from "@/lib/activeWorkout";
import {
  enterRestPictureInPictureNow,
  setRestOverlayState,
  stopRestOverlay,
} from "@/lib/restPictureInPicture";
import {
  buildExerciseBlock,
  buildWarmupBlock,
  getDefaultWeightConfig,
  syncDayBlocks,
  type StretchPlanBlock,
  type TrainingPlanBlock,
} from "@/lib/trainingModel";
import {
  addPauseBlock,
  addStretchBlock,
  addTrainingExercise,
  isCustomTrainingPlan,
  updateTrainingExercise,
} from "@/lib/trainingPlans";
import { type WorkoutExercise, type WorkoutType } from "@/lib/workoutPlan";
import { getExerciseLabel, STRETCH_LIBRARY } from "@/lib/workoutUi";

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

type AdjustAction = "addExercise" | "addStretch" | "addPause" | "skipExercise" | "replaceExercise" | "extraSet";

type PendingWorkoutChange = {
  title: string;
  description: string;
  canPersist: boolean;
  onSession: () => void;
  onPlan?: () => void;
};

export function WorkoutScreen({
  workoutType,
  workoutLabel,
  exercises,
  dayBlocks,
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
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [expandedPlanExerciseIndex, setExpandedPlanExerciseIndex] = useState<number | null>(null);
  const [showAdjustSheet, setShowAdjustSheet] = useState(false);
  const [pendingWorkoutChange, setPendingWorkoutChange] =
    useState<PendingWorkoutChange | null>(null);
  const [workoutChangeScope, setWorkoutChangeScope] = useState<"session" | "plan">("session");

  const [weight, setWeight] = useState(40);
  const [manualWeightInput, setManualWeightInput] = useState("40");
  const [reps, setReps] = useState(10);
  const [sessionExercises, setSessionExercises] = useState<WorkoutExercise[]>(exercises);
  const [sessionDayBlocks, setSessionDayBlocks] = useState<TrainingPlanBlock[]>(
    dayBlocks ?? syncDayBlocks(exercises)
  );
  const [queuedStretchBlocks, setQueuedStretchBlocks] = useState<StretchPlanBlock[]>([]);
  const [manualRestDurationSec, setManualRestDurationSec] = useState<number | null>(null);

  const [sessionSets, setSessionSets] = useState<Array<SetType | null>>([]);
  const [loggedSets, setLoggedSets] = useState<SetType[]>([]);
  const [previousSets, setPreviousSets] = useState<Array<SetType | null>>([]);
  const [lastSessionSets, setLastSessionSets] = useState<SetType[]>([]);
  const [lastTrainingSet, setLastTrainingSet] = useState<SetType | null>(null);
  const [bestMatchingSet, setBestMatchingSet] = useState<SetType | null>(null);

  const [loading, setLoading] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [stretchIndex, setStretchIndex] = useState(0);
  const [stretchEndsAt, setStretchEndsAt] = useState<number | null>(null);
  const [workoutPausedAt, setWorkoutPausedAt] = useState<number | null>(null);

  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [setStartedAt, setSetStartedAt] = useState(0);
  const [compactMode, setCompactMode] = useState(false);
  const [appPreferences, setAppPreferences] = useState<AppPreferences>(() =>
    getAppPreferences()
  );
  const lastGetReadySecondRef = useRef<number | null>(null);
  const lastInitializedExerciseRef = useRef<string | null>(null);
  const lastInitializedSessionRef = useRef<number | null>(null);
  const pendingResumeSnapshotRef = useRef<ReturnType<typeof getActiveWorkoutSnapshot>>(null);
  const workoutExercises = sessionExercises;
  const workoutDayBlocks = sessionDayBlocks;

  const currentExercise = workoutExercises[exerciseIndex];
  const currentWarmupSets = getWarmupRoundsForExercise(workoutDayBlocks, currentExercise.id);
  const weightConfig = getDefaultWeightConfig(currentExercise.name);
  const weightSteps = weightConfig.quickSteps;
  const primaryWeightStep = weightSteps.includes(5) ? 5 : weightSteps[0] ?? 5;
  const totalSets = currentExercise.sets + currentWarmupSets;
  const previousSet = previousSets[setIndex] ?? null;
  const currentStretchBlocks = [
    ...queuedStretchBlocks,
    ...getStretchBlocksForExercise(workoutDayBlocks, currentExercise.id),
  ];
  const activeStretchBlock = currentStretchBlocks[stretchIndex] ?? null;
  const isStretching = activeStretchBlock !== null && !isResting;
  const isWorkoutPaused = workoutPausedAt !== null;
  const canPersistPlanChange = Boolean(planId && dayId && isCustomTrainingPlan(planId));

  useEffect(() => {
    const now = Date.now();
    const resumeSnapshot = getActiveWorkoutSnapshot(workoutType);
    const nextDayBlocks = dayBlocks ?? syncDayBlocks(exercises);
    setSessionExercises(exercises);
    setSessionDayBlocks(nextDayBlocks);
    setQueuedStretchBlocks([]);
    setManualRestDurationSec(null);
    const clampedExerciseIndex = Math.min(
      Math.max(resumeSnapshot?.exerciseIndex ?? 0, 0),
      Math.max(exercises.length - 1, 0)
    );
    const resumedExercise = exercises[clampedExerciseIndex];
    const resumedTotalSets =
      resumedExercise.sets +
      getWarmupRoundsForExercise(nextDayBlocks, resumedExercise.id);
    const clampedSetIndex = Math.min(
      Math.max(resumeSnapshot?.setIndex ?? 0, 0),
      Math.max(resumedTotalSets - 1, 0)
    );

    if (resumeSnapshot) {
      pendingResumeSnapshotRef.current = resumeSnapshot;
      lastInitializedSessionRef.current = resumeSnapshot.sessionId;
      lastInitializedExerciseRef.current = resumedExercise.id;

      setSessionId(resumeSnapshot.sessionId);
      setExerciseIndex(clampedExerciseIndex);
      setSetIndex(clampedSetIndex);
      setWeight(resumeSnapshot.weight);
      setManualWeightInput(formatWeight(resumeSnapshot.weight).replace(".", ","));
      setReps(resumeSnapshot.reps);
      setIsResting(resumeSnapshot.isResting);
      setRestEndsAt(resumeSnapshot.restEndsAt);
      setStretchIndex(Math.max(resumeSnapshot.stretchIndex, 0));
      setStretchEndsAt(resumeSnapshot.stretchEndsAt);
      setWorkoutPausedAt(resumeSnapshot.workoutPausedAt);
      setStartTime(resumeSnapshot.startTime);
      setCurrentTime(now);
      setSetStartedAt(resumeSnapshot.setStartedAt);
      return;
    }

    setSessionId(now);
    setExerciseIndex(0);
    setSetIndex(0);
    setStartTime(now);
    setCurrentTime(now);
    setSetStartedAt(now);
    setRestEndsAt(null);
    setStretchIndex(0);
    setStretchEndsAt(null);
    setWorkoutPausedAt(null);
    setIsResting(false);
    lastInitializedSessionRef.current = null;
    lastInitializedExerciseRef.current = null;
    pendingResumeSnapshotRef.current = null;
  }, [dayBlocks, exercises, workoutType]);

  useEffect(() => {
    if (startTime === 0) {
      return;
    }

    if ((isResting || isStretching) && !isWorkoutPaused) {
      let frameId = 0;

      const tick = () => {
        setCurrentTime(Date.now());
        frameId = window.requestAnimationFrame(tick);
      };

      frameId = window.requestAnimationFrame(tick);

      return () => window.cancelAnimationFrame(frameId);
    }

    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [startTime, isResting, isStretching, isWorkoutPaused]);

  useEffect(() => {
    const resumeSnapshot = pendingResumeSnapshotRef.current;
    if (
      resumeSnapshot &&
      resumeSnapshot.sessionId === sessionId &&
      workoutExercises[exerciseIndex]?.id === currentExercise.id
    ) {
      setStretchIndex(Math.max(resumeSnapshot.stretchIndex, 0));
      setStretchEndsAt(resumeSnapshot.stretchEndsAt);
      pendingResumeSnapshotRef.current = null;
      return;
    }

    setStretchIndex(0);
    if (currentStretchBlocks.length > 0) {
      const now = Date.now();
      setStretchEndsAt(now + getStretchDurationSeconds(currentStretchBlocks[0]) * 1000);
      setCurrentTime(now);
      return;
    }

    setStretchEndsAt(null);
  }, [currentExercise.id, sessionId]);

  useEffect(() => {
    setAppPreferences(getAppPreferences());
  }, []);

  useEffect(() => {
    function updateCompactMode() {
      const nextCompactMode =
        window.innerHeight <= 1020 || (window.innerHeight <= 1120 && window.innerWidth <= 430);
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
          workoutType,
          currentExercise.id
        );
        history.push(last);
      }

      const lastSession = await getLastSessionForExercise(
        currentExercise.name,
        activeSessionId,
        workoutType,
        currentExercise.id
      );
      const previousMatchingSet = await getPreviousMatchingSet(
        currentExercise.name,
        setIndex,
        workoutType,
        activeSessionId,
        currentExercise.id
      );
      const bestSet = await getBestMatchingSet(
        currentExercise.name,
        setIndex,
        workoutType,
        currentExercise.id
      );
      const sessionEntries = await getSessionSetEntries(activeSessionId);
      const currentExerciseSessionSets = sessionEntries
        .filter((set) =>
          currentExercise.id
            ? set.exerciseId === currentExercise.id
            : set.exercise === currentExercise.name
        )
        .sort((a, b) => a.set - b.set);
      const alignedSessionSets = Array.from({ length: totalSets }, (_, index) => {
        return currentExerciseSessionSets.find((set) => set.set === index) ?? null;
      });

      setPreviousSets(history);
      setSessionSets(alignedSessionSets);
      setLoggedSets(sessionEntries);
      setLastSessionSets(lastSession);
      setLastTrainingSet(previousMatchingSet);
      setBestMatchingSet(bestSet);

      const exerciseKey = currentExercise.id;
      const isFreshExercise =
        lastInitializedSessionRef.current !== activeSessionId ||
        lastInitializedExerciseRef.current !== exerciseKey;

      if (history[0] && isFreshExercise) {
        setWeight(history[0].weight);
        setManualWeightInput(formatWeight(history[0].weight).replace(".", ","));
        setReps(history[0].reps);
      } else if (isFreshExercise) {
        setWeight(40);
        setManualWeightInput("40");
        setReps(getDefaultReps(currentExercise.minReps, currentExercise.maxReps));
      }

      lastInitializedSessionRef.current = activeSessionId;
      lastInitializedExerciseRef.current = exerciseKey;
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

    setWeight((currentWeight) => {
      const nextWeight = normalizeWeight(
        clampWeight(
          currentWeight + delta,
          weightConfig.min,
          weightConfig.max
        )
      );
      setManualWeightInput(formatWeight(nextWeight).replace(".", ","));
      return nextWeight;
    });
  }

  function canChangeWeight(delta: number) {
    const nextWeight = clampWeight(weight + delta, weightConfig.min, weightConfig.max);
    return normalizeWeight(nextWeight) !== normalizeWeight(weight);
  }

  function applyManualWeightValue(rawValue: string) {
    if (loading || isWorkoutPaused) {
      return;
    }

    const normalizedInput = rawValue.replace(",", ".").trim();
    if (!normalizedInput) {
      setManualWeightInput(formatWeight(weight).replace(".", ","));
      return;
    }

    const nextWeight = Number(normalizedInput);
    if (Number.isNaN(nextWeight)) {
      setManualWeightInput(formatWeight(weight).replace(".", ","));
      return;
    }

    const appliedWeight = normalizeWeight(
      clampWeight(nextWeight, weightConfig.min, weightConfig.max)
    );
    setWeight(appliedWeight);
    setManualWeightInput(formatWeight(appliedWeight).replace(".", ","));
  }

  function queueWorkoutChange(change: PendingWorkoutChange) {
    setWorkoutChangeScope("session");
    setPendingWorkoutChange(change);
  }

  function applySessionExerciseInsert(draft: ExerciseDraftInput) {
    const nextExercise = buildSessionExercise(draft.name, draft.sets, draft.minReps, draft.maxReps, draft.restSeconds);
    const nextExercises = [...workoutExercises];
    nextExercises.splice(exerciseIndex + 1, 0, nextExercise);
    setSessionExercises(nextExercises);
    setSessionDayBlocks((currentBlocks) => {
      const exerciseBlock = buildExerciseBlock(nextExercise);
      const warmupBlock = buildWarmupBlock(exerciseBlock);
      return insertBlocksAfterId(
        currentBlocks,
        [...(warmupBlock ? [warmupBlock] : []), exerciseBlock],
        `exercise:${currentExercise.id}`
      );
    });
  }

  function applySessionExerciseReplace(draft: ExerciseDraftInput) {
    const nextExercises = workoutExercises.map((exercise, index) =>
      index === exerciseIndex
        ? {
            ...exercise,
            name: draft.name,
            sets: draft.sets,
            minReps: draft.minReps,
            maxReps: draft.maxReps,
            restSeconds: draft.restSeconds,
          }
        : exercise
    );
    setSessionExercises(nextExercises);
    setSessionDayBlocks((currentBlocks) => syncDayBlocks(nextExercises, currentBlocks));
  }

  function applySessionExtraSet() {
    const nextExercises = workoutExercises.map((exercise, index) =>
      index === exerciseIndex ? { ...exercise, sets: exercise.sets + 1 } : exercise
    );
    setSessionExercises(nextExercises);
    setSessionDayBlocks((currentBlocks) => syncDayBlocks(nextExercises, currentBlocks));
  }

  function applySessionSkipExercise() {
    if (workoutExercises.length <= 1) {
      if (sessionId !== 0) {
        navigateToSummary(router, sessionId);
      }
      return;
    }

    const nextExercises = workoutExercises.filter((exercise) => exercise.id !== currentExercise.id);
    setSessionExercises(nextExercises);
    setSessionDayBlocks((currentBlocks) => syncDayBlocks(nextExercises, currentBlocks));
    setQueuedStretchBlocks([]);
    setStretchIndex(0);
    setStretchEndsAt(null);
    setIsResting(false);
    setRestEndsAt(null);
    setManualRestDurationSec(null);
    setWorkoutPausedAt(null);
    setExerciseIndex((current) => Math.min(current, nextExercises.length - 1));
    setSetIndex(0);
    setSetStartedAt(Date.now());
  }

  function applySessionStretch(draft: StretchDraftInput) {
    const stretchBlock = buildSessionStretchBlock(draft);
    setQueuedStretchBlocks((current) => [...current, stretchBlock]);
    if (!isStretching) {
      const now = Date.now();
      setStretchIndex(0);
      setStretchEndsAt(now + getStretchDurationSeconds(stretchBlock) * 1000);
      setCurrentTime(now);
      setIsResting(false);
      setRestEndsAt(null);
      setManualRestDurationSec(null);
      setSetStartedAt(now);
    }
  }

  function applySessionPause(draft: PauseDraftInput) {
    const now = Date.now();
    setQueuedStretchBlocks([]);
    setStretchIndex(0);
    setStretchEndsAt(null);
    setManualRestDurationSec(draft.seconds);
    setIsResting(true);
    setRestEndsAt(now + draft.seconds * 1000);
    setCurrentTime(now);
    void clearRestNotification();
    void stopRestOverlay();
    void setRestOverlayState(false);
    void scheduleRestNotification(getExerciseLabel(currentExercise.name), draft.seconds);
  }

  function confirmPendingWorkoutChange() {
    if (!pendingWorkoutChange) {
      return;
    }

    pendingWorkoutChange.onSession();
    if (workoutChangeScope === "plan" && pendingWorkoutChange.canPersist) {
      pendingWorkoutChange.onPlan?.();
    }
    setPendingWorkoutChange(null);
  }

  function requestExerciseChange(mode: "add" | "replace") {
    const initialName =
      mode === "replace" ? getExerciseLabel(currentExercise.name) : "";
    const exerciseName = window.prompt(
      mode === "replace" ? "Übung ersetzen" : "Übung hinzufügen",
      initialName
    )?.trim();

    if (!exerciseName) {
      return;
    }

    const suggested = getSuggestedExerciseSetup(exerciseName);
    const sets = parsePositiveIntPrompt(
      window.prompt("Sätze", String(mode === "replace" ? currentExercise.sets : suggested.sets)),
      mode === "replace" ? currentExercise.sets : suggested.sets
    );
    const repsRange = parseRepRangePrompt(
      window.prompt(
        "Wiederholungen (z. B. 8-12)",
        `${mode === "replace" ? currentExercise.minReps : suggested.minReps}-${
          mode === "replace" ? currentExercise.maxReps : suggested.maxReps
        }`
      ),
      mode === "replace"
        ? { min: currentExercise.minReps, max: currentExercise.maxReps }
        : { min: suggested.minReps, max: suggested.maxReps }
    );
    const restSeconds = parsePositiveIntPrompt(
      window.prompt(
        "Pause in Sekunden",
        String(mode === "replace" ? currentExercise.restSeconds : suggested.restSeconds)
      ),
      mode === "replace" ? currentExercise.restSeconds : suggested.restSeconds
    );

    const draft = {
      name: exerciseName,
      sets,
      minReps: repsRange.min,
      maxReps: repsRange.max,
      restSeconds,
    };

    queueWorkoutChange({
      title: mode === "replace" ? "Übung ersetzen" : "Übung hinzufügen",
      description:
        mode === "replace"
          ? "Die aktuelle Übung wird für diese Session ersetzt."
          : "Die neue Übung wird direkt nach der aktuellen Stelle eingefügt.",
      canPersist: canPersistPlanChange,
      onSession: () =>
        mode === "replace"
          ? applySessionExerciseReplace(draft)
          : applySessionExerciseInsert(draft),
      onPlan:
        planId && dayId
          ? () => {
              if (mode === "replace") {
                updateTrainingExercise(planId, dayId, currentExercise.id, draft);
              } else {
                addTrainingExercise(planId, dayId, draft, `exercise:${currentExercise.id}`);
              }
            }
          : undefined,
    });
  }

  function requestStretchChange() {
    const stretchName = window.prompt("Dehnübung", "Dehnen")?.trim();
    if (!stretchName) {
      return;
    }

    const holdSeconds = parsePositiveIntPrompt(window.prompt("Dauer in Sekunden", "30"), 30);
    const rounds = parsePositiveIntPrompt(window.prompt("Runden", "2"), 2);
    const draft = { label: stretchName, holdSeconds, rounds };
    const matchingStretch = STRETCH_LIBRARY.find(
      (entry) =>
        entry.label.toLowerCase() === stretchName.toLowerCase() ||
        entry.value.toLowerCase() === stretchName.toLowerCase()
    );

    queueWorkoutChange({
      title: "Dehnen hinzufügen",
      description: "Der Dehnblock wird in die laufende Session eingefügt.",
      canPersist: canPersistPlanChange && Boolean(matchingStretch),
      onSession: () => applySessionStretch(draft),
      onPlan:
        planId && dayId && matchingStretch
          ? () =>
              addStretchBlock(
                planId,
                dayId,
                {
                  stretchId: matchingStretch.value,
                  holdSeconds,
                  rounds,
                },
                `exercise:${currentExercise.id}`
              )
          : undefined,
    });
  }

  function requestPauseChange() {
    const label = window.prompt("Name der Pause", "Pause")?.trim() || "Pause";
    const seconds = parsePositiveIntPrompt(window.prompt("Dauer in Sekunden", "60"), 60);
    const draft = { label, seconds, scope: "exercise" as const };

    queueWorkoutChange({
      title: "Pause hinzufügen",
      description: "Die Pause startet direkt und kann optional im Plan gesichert werden.",
      canPersist: canPersistPlanChange,
      onSession: () => applySessionPause(draft),
      onPlan:
        planId && dayId
          ? () => addPauseBlock(planId, dayId, draft, `exercise:${currentExercise.id}`)
          : undefined,
    });
  }

  function handleAdjustAction(action: AdjustAction) {
    setShowAdjustSheet(false);

    if (action === "addExercise") {
      requestExerciseChange("add");
      return;
    }
    if (action === "replaceExercise") {
      requestExerciseChange("replace");
      return;
    }
    if (action === "addStretch") {
      requestStretchChange();
      return;
    }
    if (action === "addPause") {
      requestPauseChange();
      return;
    }
    if (action === "skipExercise") {
      queueWorkoutChange({
        title: "Übung überspringen",
        description: "Die aktuelle Übung wird nur in dieser Session übersprungen.",
        canPersist: false,
        onSession: () => applySessionSkipExercise(),
      });
      return;
    }

    queueWorkoutChange({
      title: "Zusatzsatz hinzufügen",
      description: "Die aktuelle Übung bekommt einen zusätzlichen Arbeitssatz.",
      canPersist: canPersistPlanChange,
      onSession: () => applySessionExtraSet(),
      onPlan:
        planId && dayId
          ? () =>
              updateTrainingExercise(planId, dayId, currentExercise.id, {
                name: currentExercise.name,
                sets: currentExercise.sets + 1,
                minReps: currentExercise.minReps,
                maxReps: currentExercise.maxReps,
                restSeconds: currentExercise.restSeconds,
              })
          : undefined,
    });
  }

  function handleNext() {
    if (isStretching) {
      void finishStretchBlock();
      return;
    }

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
    setManualRestDurationSec(null);

    const nextSet = setIndex + 1;

    if (nextSet < totalSets) {
      setSetIndex(nextSet);
      setSetStartedAt(Date.now());
      return;
    }

    if (exerciseIndex < workoutExercises.length - 1) {
      const nextExercise = workoutExercises[exerciseIndex + 1];
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
    if (!isStretching || !stretchEndsAt || isWorkoutPaused) {
      return;
    }

    if (currentTime >= stretchEndsAt) {
      void finishStretchBlock();
    }
  }, [currentTime, isStretching, stretchEndsAt, isWorkoutPaused]);

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
    if (loading || isResting || isStretching || sessionId === 0 || isWorkoutPaused) {
      return;
    }

    try {
      setLoading(true);
      const savedAt = Date.now();

      await saveSet({
        exercise: currentExercise.name,
        exerciseId: currentExercise.id,
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
          exerciseId: currentExercise.id,
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
          exerciseId: currentExercise.id,
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
      setManualRestDurationSec(null);
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
      setStretchEndsAt((current) => (current ? current + pausedDuration : current));
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

  async function finishStretchBlock() {
    if (!activeStretchBlock || sessionId === 0) {
      return;
    }

    await saveWorkoutEvent({
      label: activeStretchBlock.label,
      durationSeconds: getStretchDurationSeconds(activeStretchBlock),
      eventType: "stretch",
      sessionId,
      type: workoutType,
      planId,
      planName,
      dayId,
      dayName,
    });

    const nextStretchIndex = stretchIndex + 1;
    if (nextStretchIndex < currentStretchBlocks.length) {
      const now = Date.now();
      setStretchIndex(nextStretchIndex);
      setStretchEndsAt(
        now + getStretchDurationSeconds(currentStretchBlocks[nextStretchIndex]) * 1000
      );
      setCurrentTime(now);
      return;
    }

    setStretchIndex(nextStretchIndex);
    setStretchEndsAt(null);
    setQueuedStretchBlocks([]);
    setSetStartedAt(Date.now());
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
  const remainingRestMs = Math.max(0, (restEndsAt ?? effectiveNow) - effectiveNow);
  const restTime = Math.max(0, Math.ceil(remainingRestMs / 1000));
  const activeRestDurationSec = manualRestDurationSec ?? currentExercise.restSeconds;
  const remainingStretchMs = Math.max(0, (stretchEndsAt ?? effectiveNow) - effectiveNow);
  const stretchTime = Math.max(0, Math.ceil(remainingStretchMs / 1000));
  const progressPercent = Math.round(
    (((exerciseIndex * totalSets) + setIndex + 1) /
      (workoutExercises.length * totalSets)) *
      100
  );
  const restProgress = Math.max(
      0,
      Math.min(100, (remainingRestMs / (activeRestDurationSec * 1000 || 1)) * 100)
    );
    const remainingRestDegrees = restProgress * 3.6;
  const elapsedRestDegrees = (100 - restProgress) * 3.6;
  const restPulseScale =
    isResting && !isWorkoutPaused && appPreferences.progressAnimations
      ? 1 + Math.sin(currentTime / 320) * 0.012
      : 1;
  const visualCountdown =
    isResting &&
    !isWorkoutPaused &&
    appPreferences.countdownOverlay &&
    restTime > 0 &&
    restTime <= 3
      ? restTime
      : null;
  const visualStretchCountdown =
    isStretching &&
    !isWorkoutPaused &&
    appPreferences.countdownOverlay &&
    stretchTime > 0 &&
    stretchTime <= 3
      ? stretchTime
      : null;
  const lastSavedSet = loggedSets[loggedSets.length - 1] ?? null;
  const previousExercise = exerciseIndex > 0 ? workoutExercises[exerciseIndex - 1] : null;
  const previousExerciseSets = previousExercise
    ? loggedSets.filter((set) => set.exerciseId === previousExercise.id)
    : [];
  const previousExerciseTopSet = getTopSet(previousExerciseSets);
  const currentExerciseProgress = workoutExercises[exerciseIndex]
    ? loggedSets.filter((set) => set.exerciseId === workoutExercises[exerciseIndex].id)
    : [];
  const currentExerciseHistory = sessionSets
    .filter((set): set is SetType => set !== null)
    .filter((set) => set.exerciseId === currentExercise.id)
    .sort((a, b) => a.set - b.set);
  const dayProgress = workoutExercises.map((exercise) => {
    const warmupSets = getWarmupRoundsForExercise(workoutDayBlocks, exercise.id);
    const savedSetsForExercise = loggedSets.filter(
      (set) => set.exerciseId === exercise.id
    );

    return {
      exercise,
      completed: savedSetsForExercise.length,
      total: exercise.sets + warmupSets,
      topSet: getTopSet(savedSetsForExercise),
      warmupSets,
    };
  });

  useEffect(() => {
    if (!isResting || isWorkoutPaused) {
      lastGetReadySecondRef.current = null;
      return;
    }

    if (
      appPreferences.getReadyTone &&
      restTime === 10 &&
      lastGetReadySecondRef.current !== restTime
    ) {
      lastGetReadySecondRef.current = restTime;
      playGetReadyTone();
      return;
    }

    if (restTime > 10) {
      lastGetReadySecondRef.current = null;
    }
  }, [appPreferences.getReadyTone, isResting, isWorkoutPaused, restTime]);

  const referenceSet = lastTrainingSet ?? previousSet ?? bestMatchingSet;
  const referenceLabel = lastTrainingSet
    ? "Letztes Training"
    : previousSet
    ? "Letzter Satz"
    : bestMatchingSet
    ? "Bester Satz"
    : null;
  const currentSetLabel = getWorkoutSetLabel(
    setIndex,
    currentWarmupSets,
    currentExercise.sets
  );
  const nextExercise =
    exerciseIndex < workoutExercises.length - 1 ? workoutExercises[exerciseIndex + 1] : null;
  const nextExerciseWarmups = nextExercise
    ? getWarmupRoundsForExercise(workoutDayBlocks, nextExercise.id)
    : 0;
  const nextExerciseStretches = nextExercise
    ? getStretchBlocksForExercise(workoutDayBlocks, nextExercise.id)
    : [];
  const nextSetFlowLabel =
    setIndex + 1 < totalSets
      ? getWorkoutSetLabel(setIndex + 1, currentWarmupSets, currentExercise.sets)
      : nextExercise
      ? nextExerciseStretches.length > 0
        ? `Dehnen vor ${getExerciseLabel(nextExercise.name)}`
        : `${getWorkoutSetLabel(0, nextExerciseWarmups, nextExercise.sets)} · ${getExerciseLabel(
            nextExercise.name
          )}`
      : "Auswertung";
  const flowNowLabel = isWorkoutPaused
    ? "Training pausiert"
    : isStretching
    ? `Dehnen ${stretchIndex + 1}/${currentStretchBlocks.length}`
    : isResting
    ? "Satzpause"
    : currentSetLabel;
  const flowNextLabel = isWorkoutPaused
    ? isStretching
      ? `Weiter mit ${activeStretchBlock?.label ?? "Dehnen"}`
      : isResting
      ? `Weiter mit ${nextSetFlowLabel}`
      : `Weiter mit ${currentSetLabel}`
    : isStretching
    ? stretchIndex + 1 < currentStretchBlocks.length
      ? `Danach Dehnen ${stretchIndex + 2}/${currentStretchBlocks.length}`
      : `Danach ${currentSetLabel}`
    : isResting
    ? `Danach ${nextSetFlowLabel}`
    : "Danach Satzpause";
  const flowStatusText = isWorkoutPaused
    ? "Timer stehen still, bis du oben fortsetzt."
    : isStretching
    ? "Dehnblock läuft gerade."
    : isResting
    ? "Pause läuft bis zum nächsten Satz."
    : "Aktiver Satz im Fokus.";

  useEffect(() => {
    if (sessionId === 0) {
      return;
    }

    const stateLabel = isWorkoutPaused
      ? "Training pausiert"
      : isStretching
      ? flowNowLabel
      : isResting
      ? "Satzpause"
      : getExerciseLabel(currentExercise.name);

    const href =
      resumeHref ??
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/index.html");

    setActiveWorkoutState({
      href,
      workoutLabel,
      planName,
      dayName,
      stateLabel,
      sessionId,
      workoutType,
      updatedAt: Date.now(),
    });
    setActiveWorkoutSnapshot({
      workoutType,
      sessionId,
      exerciseIndex,
      setIndex,
      weight,
      reps,
      isResting,
      restEndsAt,
      stretchIndex,
      stretchEndsAt,
      workoutPausedAt,
      startTime,
      setStartedAt,
      updatedAt: Date.now(),
    });
  }, [
    currentExercise.name,
    dayName,
    exerciseIndex,
    flowNowLabel,
    isResting,
    isStretching,
    isWorkoutPaused,
    planName,
    reps,
    restEndsAt,
    resumeHref,
    sessionId,
    setIndex,
    setStartedAt,
    startTime,
    stretchEndsAt,
    stretchIndex,
    weight,
    workoutLabel,
    workoutType,
  ]);

  const totalCompleted = dayProgress.reduce((s, e) => s + e.completed, 0);
  const totalSetsAll = dayProgress.reduce((s, e) => s + e.total, 0);
  const activeWeightSteps = weightSteps.includes(2.5)
    ? [primaryWeightStep, 2.5]
    : [primaryWeightStep];
  const latestCurrentExerciseSet =
    currentExerciseHistory.length > 0
      ? currentExerciseHistory[currentExerciseHistory.length - 1]
      : null;
  const restSuggestion =
    latestCurrentExerciseSet === null
      ? {
          label: "Bereit",
          tone: "neutral" as const,
        }
      : latestCurrentExerciseSet.reps > currentExercise.maxReps
      ? {
          label: "Mehr Gewicht",
          tone: "up" as const,
        }
      : latestCurrentExerciseSet.reps < currentExercise.minReps
      ? {
          label: "Weniger Gewicht",
          tone: "down" as const,
        }
      : {
          label: "Optimal",
          tone: "good" as const,
        };
  const accentSoft = toRgba(theme.accent, 0.1);
  const accentBorder = toRgba(theme.accent, 0.2);
  const accentShadow = toRgba(theme.accent, 0.18);
  const progressSoft = toRgba(theme.accent, 0.12);
  const ringTrack = toRgba(theme.accent, 0.1);

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
            <a
              href="/index.html"
              style={{
                ...backLink,
                color: theme.accent,
                border: `1px solid ${accentBorder}`,
                background: theme.badgeBackground,
                boxShadow: `0 8px 18px ${accentSoft}`,
              }}
            >
              ← Home
            </a>
            <span
              style={{
                ...durationChip,
                color: theme.accent,
                background: theme.badgeBackground,
                border: `1px solid ${accentBorder}`,
              }}
            >
              {workoutDuration}
            </span>
          </div>
          <div style={topActions}>
            <button
              style={{
                ...controlButton,
                color: theme.accent,
                border: `1px solid ${accentBorder}`,
                background: theme.badgeBackground,
                boxShadow: `0 8px 18px ${accentSoft}`,
              }}
              onClick={() => void toggleWorkoutPause()}
            >
              {isWorkoutPaused ? "▶ Weiter" : "⏸ Pause"}
            </button>
          </div>
        </div>

        <div
          style={{
            ...contextCard,
            ...(compactMode ? compactContextCard : null),
            background: `linear-gradient(180deg, rgba(255,255,255,0.96) 0%, ${toRgba(
              theme.accent,
              0.035
            )} 100%)`,
            border: `1px solid ${accentBorder}`,
            boxShadow: `0 10px 24px ${accentSoft}`,
          }}
        >
          {/* FORTSCHRITT */}
          <div style={progressHeader}>
            <div style={{ ...progressMeta, ...(compactMode ? compactProgressMeta : null), color: theme.accent }}>
              <span>
                Übung {exerciseIndex + 1} / {workoutExercises.length}
                <span style={progressMetaDivider}>·</span>
                {getExerciseLabel(currentExercise.name)}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ ...progressTrack, background: theme.progressTrack }}>
              <div style={{ ...progressFill, width: `${progressPercent}%`, background: theme.progressFill }} />
            </div>
          </div>

          {/* ÜBUNG FOKUS */}
            <div style={exerciseFocus}>
              <div
                style={{
                  ...badge,
                ...(compactMode ? compactBadge : null),
                background: theme.badgeBackground,
                color: theme.screenBadge,
              }}
            >
              {workoutLabel} ·{" "}
              {isStretching
                ? `Dehnen ${stretchIndex + 1}/${currentStretchBlocks.length}`
                : getWorkoutSetLabel(setIndex, currentWarmupSets, currentExercise.sets)}
            </div>
              <div style={exerciseInfoRow}>
              {isStretching ? (
                <>
                  <span>{activeStretchBlock?.holdSeconds ?? 0} Sek halten</span>
                  <span style={exerciseInfoDot}>·</span>
                  <span>{activeStretchBlock?.rounds ?? 0} Runden</span>
                </>
              ) : (
                <>
                  <span>{currentExercise.minReps}–{currentExercise.maxReps} Wdh.</span>
                  <span style={exerciseInfoDot}>·</span>
                  <span>{formatRest(activeRestDurationSec)} Pause</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            ...flowCard,
            ...(compactMode ? compactFlowCard : null),
            background: `linear-gradient(180deg, rgba(255,255,255,0.96) 0%, ${toRgba(
              theme.accent,
              0.04
            )} 100%)`,
            border: `1px solid ${accentBorder}`,
            boxShadow: `0 10px 24px ${accentSoft}`,
          }}
        >
          <div style={flowRow}>
            <div style={flowLabel}>Jetzt</div>
            <div style={{ ...flowValue, ...(compactMode ? compactFlowValue : null), color: theme.accent }}>{flowNowLabel}</div>
          </div>
          <div style={flowDivider} />
          <div style={flowRow}>
            <div style={flowLabel}>Danach</div>
            <div style={{ ...flowValue, ...(compactMode ? compactFlowValue : null) }}>{flowNextLabel}</div>
          </div>
          {!compactMode ? <div style={flowHelper}>{flowStatusText}</div> : null}
        </div>

        {/* PAUSE-HINWEIS */}
        {isWorkoutPaused ? (
          <div
            style={{
              ...pausedBanner,
              background: progressSoft,
              border: `1px solid ${accentBorder}`,
              color: theme.accent,
            }}
          >
            ⏸ Pausiert – ▶ oben zum Fortsetzen
          </div>
        ) : null}

        {/* AKTIV oder REST – füllt den restlichen Platz */}
        {isStretching ? (
          <div
            style={{
              ...restCard,
              ...(compactMode ? compactRestCard : null),
              background: theme.badgeBackground,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                ...restHistoryCard,
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${toRgba(
                  theme.accent,
                  0.03
                )} 100%)`,
                border: `1px solid ${accentBorder}`,
                boxShadow: `0 10px 26px ${accentSoft}`,
                textAlign: "center",
              }}
            >
              <div style={{ ...restHistoryLabel, textAlign: "center", fontSize: 12 }}>
                Dehnübung
              </div>
              <div style={{ fontSize: compactMode ? 22 : 28, fontWeight: 800, color: theme.accent }}>
                {activeStretchBlock?.label ?? "Dehnen"}
              </div>
              <div style={{ fontSize: compactMode ? 13 : 15, color: "#64748b", fontWeight: 700 }}>
                {activeStretchBlock
                  ? `${activeStretchBlock.holdSeconds} Sek · ${activeStretchBlock.rounds} Runde${
                      activeStretchBlock.rounds > 1 ? "n" : ""
                    }`
                  : ""}
              </div>
            </div>

            <div style={restTimerWrap}>
              <div
                style={{
                  ...restCircle,
                  background: `conic-gradient(from -90deg, ${lightenColor(
                    theme.accent,
                    0.2
                  )} 0deg, ${theme.accent} ${Math.max(
                    (Math.max(
                      0,
                      Math.min(
                        100,
                        (remainingStretchMs /
                          (getStretchDurationSeconds(activeStretchBlock) * 1000 || 1)) *
                          100
                      )
                    ) *
                      3.6) -
                      24,
                    0
                  )}deg, ${ringTrack} ${
                    Math.max(
                      0,
                      Math.min(
                        100,
                        (remainingStretchMs /
                          (getStretchDurationSeconds(activeStretchBlock) * 1000 || 1)) *
                          100
                      )
                    ) * 3.6
                  }deg 360deg)`,
                  boxShadow: `inset 0 0 0 2px ${ringTrack}, 0 10px 28px ${accentSoft}`,
                }}
              >
                <div
                  style={{
                    ...restCircleSweep,
                    opacity: appPreferences.progressAnimations ? 1 : 0,
                    transform: `rotate(${
                      Math.max(
                        0,
                        Math.min(
                          100,
                          (remainingStretchMs /
                            (getStretchDurationSeconds(activeStretchBlock) * 1000 || 1)) *
                            100
                        )
                      ) * 3.6
                    }deg)`,
                  }}
                >
                  <div
                    style={{
                      ...restCircleSweepBar,
                      background: `linear-gradient(90deg, ${lightenColor(
                        theme.accent,
                        0.12
                      )} 0%, ${theme.accent} 100%)`,
                      boxShadow: `0 0 18px ${accentShadow}`,
                    }}
                  />
                  <div
                    style={{
                      ...restCircleSweepDot,
                      background: theme.accent,
                      boxShadow: `0 0 0 6px ${toRgba(
                        theme.accent,
                        0.14
                      )}, 0 0 22px ${accentShadow}`,
                    }}
                  />
                </div>
                <div
                  style={{
                    ...restCircleInner,
                    boxShadow: `inset 0 0 0 1px ${accentBorder}`,
                    transform: `rotate(90deg) scale(${restPulseScale})`,
                  }}
                >
                  <div style={{ ...restLabel, color: theme.accent }}>Dehnen</div>
                  <div style={restSubLabel}>Verbleibende Zeit</div>
                  <div style={{ ...restTimer, ...(compactMode ? compactRestTimer : null) }}>
                    {visualStretchCountdown ? (
                      <span style={{ ...countdownNumber, color: theme.accent }}>
                        {visualStretchCountdown}
                      </span>
                    ) : (
                      formatRestTimer(stretchTime)
                    )}
                  </div>
                  <div style={{ ...restTargetBadge, background: progressSoft, color: theme.accent }}>
                    {formatRest(getStretchDurationSeconds(activeStretchBlock))}
                  </div>
                </div>
              </div>
            </div>

            <div style={restBarTrack}>
              <div
                style={{
                  ...restBarFill,
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (remainingStretchMs /
                        (getStretchDurationSeconds(activeStretchBlock) * 1000 || 1)) *
                        100
                    )
                  )}%`,
                  background: `linear-gradient(90deg, ${theme.progressFill} 0%, ${theme.accent} 100%)`,
                  boxShadow: `0 6px 16px ${accentSoft}`,
                }}
              />
            </div>

            <div style={stretchNextSection}>
              <div style={restWeightLabel}>Danach</div>
              <div style={{ ...stretchNextValue, ...(compactMode ? compactStretchNextValue : null) }}>{flowNextLabel}</div>
              {!compactMode ? <div style={stretchNextHint}>Danach geht dein Workout automatisch weiter.</div> : null}
            </div>

            <div style={singleActionDock}>
              <button
                style={{
                  ...continueButton,
                  ...(compactMode ? compactContinueButton : null),
                  background: `linear-gradient(180deg, ${lightenColor(theme.accent, 0.08)} 0%, ${theme.accent} 100%)`,
                  boxShadow: `0 20px 34px ${accentShadow}`,
                }}
                onClick={handleNext}
              >
                ⏭ Dehnen überspringen
              </button>
              <button
                style={{
                  ...adjustButton,
                  border: `1px solid ${accentBorder}`,
                  color: theme.accent,
                }}
                onClick={() => setShowAdjustSheet(true)}
              >
                + Anpassen
              </button>
            </div>
          </div>
        ) : !isResting ? (
          <div style={{ ...activeStack, ...(compactMode ? compactActiveStack : null) }}>
            <div style={compareSection}>
              <div style={compareGrid}>
              <div style={{ ...insightCard, ...(compactMode ? compactInsightCard : null), border: `1px solid ${accentBorder}`, boxShadow: `0 10px 26px ${accentSoft}` }}>
                <div style={compareCardTop}>
                  <span style={{ ...compareIcon, color: theme.accent }}>🗓️</span>
                  <span style={{ ...insightLabel, color: theme.accent }}>Letztes Training</span>
                </div>
                <div style={compareMeta}>
                  {lastTrainingSet
                    ? formatDate(lastTrainingSet.timestamp)
                    : "Noch kein letztes Training"}
                </div>
                <div style={compactInsightValue}>
                  {lastTrainingSet
                    ? `${formatWeight(lastTrainingSet.weight)} kg × ${formatReps(lastTrainingSet.reps)}`
                    : "—"}
                </div>
                <div
                  style={{
                    ...compactInsightDescription,
                    color: getDeltaToneColor(weight, reps, lastTrainingSet, theme),
                  }}
                >
                  {lastTrainingSet
                    ? `${formatComparisonDelta(weight, reps, lastTrainingSet)} zum Satz`
                    : "Kommt nach deinem ersten Training."}
                </div>
              </div>
              <div style={{ ...insightCard, ...(compactMode ? compactInsightCard : null), border: `1px solid ${accentBorder}`, boxShadow: `0 10px 26px ${accentSoft}` }}>
                <div style={compareCardTop}>
                  <span style={{ ...compareIcon, color: theme.accent }}>🏆</span>
                  <span style={{ ...insightLabel, color: theme.accent }}>Deine Bestleistung</span>
                </div>
                <div style={compareMeta}>
                  {bestMatchingSet
                    ? formatDate(bestMatchingSet.timestamp)
                    : "Noch keine Bestleistung"}
                </div>
                <div style={compactInsightValue}>
                  {bestMatchingSet
                    ? `${formatWeight(bestMatchingSet.weight)} kg × ${formatReps(bestMatchingSet.reps)}`
                  : "—"}
                </div>
                <div style={{ ...compactInsightDescription, color: theme.accent }}>
                  {bestMatchingSet ? "Bestwert" : "Kommt mit deinem ersten Training."}
                </div>
              </div>
            </div>
            </div>

            <div
              style={{
                ...exerciseCard,
                ...(compactMode ? compactExerciseCard : null),
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${toRgba(
                  theme.accent,
                  0.03
                )} 100%)`,
                border: `1px solid ${accentBorder}`,
                boxShadow: `0 14px 36px ${accentSoft}`,
              }}
            >
              <div style={exerciseCardHeader}>
                <div>
                  <h1 style={{ ...title, ...(compactMode ? compactTitle : null), color: theme.accent }}>
                    {getExerciseLabel(currentExercise.name)}
                  </h1>
                  <div style={exerciseCardMeta}>
                    <span>{currentExercise.minReps}–{currentExercise.maxReps} Wdh.</span>
                    <span style={exerciseInfoDot}>·</span>
                    <span>{formatRest(activeRestDurationSec)} Pause</span>
                  </div>
                  {referenceSet && referenceLabel ? (
                    <div style={{ ...lastTrainingHint, ...(compactMode ? compactLastTrainingHint : null) }}>
                      {referenceLabel}: {formatWeight(referenceSet.weight)} kg × {formatReps(referenceSet.reps)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ ...weightPanel, ...(compactMode ? compactWeightPanel : null) }}>
                <div style={weightSideColumn}>
                  {activeWeightSteps.map((step) => (
                    <button
                      key={`active-minus-${step}`}
                      style={{
                        ...weightSideButton,
                        ...(compactMode ? compactWeightSideButton : null),
                        color: theme.accent,
                        border: `1px solid ${accentBorder}`,
                        boxShadow: `0 10px 24px ${accentSoft}`,
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
                <div style={weightCenter}>
                  <div style={weightCenterLabel}>Gewicht</div>
                  <div style={{ ...weightBox, ...(compactMode ? compactWeightBox : null) }}>
                    {formatWeight(weight)}
                    <span style={weightUnit}>kg</span>
                  </div>
                  <button
                    style={{
                      ...manualEntryButton,
                      border: `1px solid ${accentBorder}`,
                      color: theme.accent,
                      background: progressSoft,
                    }}
                    onClick={() => {
                      const input = window.prompt(
                        "Gewicht eingeben",
                        formatWeight(weight).replace(".", ",")
                      );
                      if (input !== null) {
                        applyManualWeightValue(input);
                      }
                    }}
                  >
                    Manuell eingeben
                  </button>
                </div>
                <div style={weightSideColumn}>
                  {activeWeightSteps
                    .slice()
                    .reverse()
                    .map((step) => (
                      <button
                        key={`active-plus-${step}`}
                        style={{
                          ...weightSideButton,
                          ...(compactMode ? compactWeightSideButton : null),
                          color: theme.accent,
                          border: `1px solid ${accentBorder}`,
                          boxShadow: `0 10px 24px ${accentSoft}`,
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

              <div style={repsSection}>
                <div style={sectionLabel}>Wiederholungen</div>
                <div style={{ ...repsRowModern, ...(compactMode ? compactRepsRowModern : null) }}>
                  <button style={{ ...repsRoundButton, ...(compactMode ? compactRepsRoundButton : null), color: theme.accent, border: `1px solid ${accentBorder}`, boxShadow: `0 8px 20px ${accentSoft}` }} onClick={() => handleRepsChange(-0.5)}>−</button>
                  <div style={{ ...repsValueCard, ...(compactMode ? compactRepsValueCard : null) }}>{formatReps(reps)}</div>
                  <button style={{ ...repsRoundButton, ...(compactMode ? compactRepsRoundButton : null), color: theme.accent, border: `1px solid ${accentBorder}`, boxShadow: `0 8px 20px ${accentSoft}` }} onClick={() => handleRepsChange(0.5)}>+</button>
                </div>
              </div>
            </div>
              <div style={bottomActionDock}>
               <button style={{ ...saveBarButton, ...(compactMode ? compactSaveBarButton : null), background: `linear-gradient(180deg, ${lightenColor(theme.accent, 0.08)} 0%, ${theme.accent} 100%)`, boxShadow: `0 20px 34px ${accentShadow}` }} onClick={save}>
                ⊙ Satz speichern
               </button>
               <button style={{ ...allSetsButton, color: theme.accent, border: `1px solid ${accentBorder}` }} onClick={() => setShowPlanModal(true)}>
                 ☰ Alle Sätze anzeigen
               </button>
               <button
                 style={{ ...adjustButton, color: theme.accent, border: `1px solid ${accentBorder}` }}
                 onClick={() => setShowAdjustSheet(true)}
               >
                 + Anpassen
               </button>
            </div>
          </div>
        ) : (
          <div style={{ ...restCard, ...(compactMode ? compactRestCard : null), background: theme.badgeBackground, border: `1px solid ${theme.border}` }}>
            <div
              style={{
                ...restHistoryCard,
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${toRgba(
                  theme.accent,
                  0.03
                )} 100%)`,
                border: `1px solid ${accentBorder}`,
                boxShadow: `0 10px 26px ${accentSoft}`,
              }}
            >
              <div style={restHistoryTop}>
                <span style={restHistoryLabel}>Bisherige Sätze</span>
                <span style={{ ...restHistoryTrend, color: theme.accent }}>↗</span>
              </div>
              <div style={restHistoryList}>
                {currentExerciseHistory.length > 0 ? (
                  currentExerciseHistory
                    .slice()
                    .reverse()
                    .map((set, index) => (
                      <div key={`${set.timestamp}-${index}`} style={restHistoryRow}>
                        <div
                          style={{
                            ...restHistoryIndex,
                            background: progressSoft,
                            color: theme.accent,
                            border: `1px solid ${accentBorder}`,
                          }}
                        >
                          {currentExerciseHistory.length - index}
                        </div>
                        <div style={restHistoryValue}>
                          <span style={restHistorySetLabel}>
                            {getSetLabelForExercise(
                              set.set,
                              currentWarmupSets,
                              currentExercise.sets
                            )}
                          </span>
                          <span>{formatWeight(set.weight)} kg × {formatReps(set.reps)}</span>
                        </div>
                        <div
                          style={{
                            ...restHistoryDone,
                            color: theme.accent,
                            background: progressSoft,
                            border: `1px solid ${accentBorder}`,
                          }}
                        >
                          ✓
                        </div>
                      </div>
                    ))
                ) : (
                  <div style={restHistoryEmpty}>Noch kein Satz gespeichert</div>
                )}
              </div>
              <button style={{ ...restHistoryButton, color: theme.accent, border: `1px solid ${accentBorder}` }} onClick={() => setShowPlanModal(true)}>
                Alle Sätze anzeigen
              </button>
            </div>

            <div style={restTimerWrap}>
                <div
                  style={{
                    ...restCircle,
                    background: `conic-gradient(from -90deg, ${lightenColor(theme.accent, 0.2)} 0deg, ${theme.accent} ${Math.max(
                      remainingRestDegrees - 24,
                      0
                    )}deg, ${ringTrack} ${remainingRestDegrees}deg 360deg)`,
                  boxShadow: `inset 0 0 0 2px ${ringTrack}, 0 10px 28px ${accentSoft}`,
                }}
              >
                <div
                  style={{
                    ...restCircleSweep,
                    opacity: appPreferences.progressAnimations ? 1 : 0,
                    transform: `rotate(${remainingRestDegrees}deg)`,
                  }}
                >
                  <div
                    style={{
                      ...restCircleSweepBar,
                      background: `linear-gradient(90deg, ${lightenColor(theme.accent, 0.12)} 0%, ${theme.accent} 100%)`,
                      boxShadow: `0 0 18px ${accentShadow}`,
                    }}
                  />
                  <div
                    style={{
                      ...restCircleSweepDot,
                      background: theme.accent,
                      boxShadow: `0 0 0 6px ${toRgba(theme.accent, 0.14)}, 0 0 22px ${accentShadow}`,
                    }}
                  />
                </div>
                <div
                  style={{
                    ...restCircleInner,
                    boxShadow: `inset 0 0 0 1px ${accentBorder}`,
                    transform: `rotate(90deg) scale(${restPulseScale})`,
                  }}
                >
                  <div style={{ ...restLabel, color: theme.accent }}>Pause</div>
                  <div style={restSubLabel}>Nächster Satz in</div>
                  <div style={{ ...restTimer, ...(compactMode ? compactRestTimer : null) }}>
                    {visualCountdown ? <span style={{ ...countdownNumber, color: theme.accent }}>{visualCountdown}</span> : formatRestTimer(restTime)}
                  </div>
                  <div style={{ ...restTargetBadge, background: progressSoft, color: theme.accent }}>{formatRest(activeRestDurationSec)}</div>
                </div>
              </div>
            </div>
            <div style={restBarTrack}>
              <div
                style={{
                  ...restBarFill,
                  width: `${restProgress}%`,
                  background: `linear-gradient(90deg, ${theme.progressFill} 0%, ${theme.accent} 100%)`,
                  boxShadow: `0 6px 16px ${accentSoft}`,
                }}
              />
            </div>
            <div style={restWeightSection}>
              <div style={restWeightLabel}>Nächster Satz</div>
              <div style={{ ...restWeightValueLarge, ...(compactMode ? compactRestWeightValueLarge : null) }}>
                {formatWeight(weight)}
                <span style={restWeightUnit}>kg</span>
              </div>
              <div style={{ ...restWeightRow, ...(compactMode ? compactRestWeightRow : null) }}>
                  <button
                    style={{
                      ...restWeightButton,
                      color: theme.accent,
                      border: `1px solid ${accentBorder}`,
                      boxShadow: `0 8px 20px ${accentSoft}`,
                      ...(compactMode ? compactRestWeightButton : null),
                      ...(canChangeWeight(-primaryWeightStep) ? null : disabledButton),
                    }}
                    onClick={() => changeWeight(-primaryWeightStep)}
                    disabled={!canChangeWeight(-primaryWeightStep)}
                  >
                    -{formatWeight(primaryWeightStep)}
                  </button>
                  <button
                    style={{
                      ...restWeightButton,
                      color: theme.accent,
                      border: `1px solid ${accentBorder}`,
                      boxShadow: `0 8px 20px ${accentSoft}`,
                      ...(compactMode ? compactRestWeightButton : null),
                      ...(canChangeWeight(-1) ? null : disabledButton),
                    }}
                    onClick={() => changeWeight(-1)}
                    disabled={!canChangeWeight(-1)}
                  >
                    -1
                  </button>
                  <button
                    style={{
                      ...restWeightButton,
                      color: theme.accent,
                      border: `1px solid ${accentBorder}`,
                      boxShadow: `0 8px 20px ${accentSoft}`,
                      ...(compactMode ? compactRestWeightButton : null),
                      ...(canChangeWeight(1) ? null : disabledButton),
                    }}
                    onClick={() => changeWeight(1)}
                    disabled={!canChangeWeight(1)}
                  >
                    +1
                  </button>
                  <button
                    style={{
                      ...restWeightButton,
                      color: theme.accent,
                      border: `1px solid ${accentBorder}`,
                      boxShadow: `0 8px 20px ${accentSoft}`,
                      ...(compactMode ? compactRestWeightButton : null),
                      ...(canChangeWeight(primaryWeightStep) ? null : disabledButton),
                    }}
                    onClick={() => changeWeight(primaryWeightStep)}
                    disabled={!canChangeWeight(primaryWeightStep)}
                  >
                    +{formatWeight(primaryWeightStep)}
                  </button>
              </div>
            </div>
            <div style={singleActionDock}>
              <button
                style={{
                  ...continueButton,
                  ...(compactMode ? compactContinueButton : null),
                  background: `linear-gradient(180deg, ${lightenColor(theme.accent, 0.08)} 0%, ${theme.accent} 100%)`,
                  boxShadow: `0 20px 34px ${accentShadow}`,
                }}
                onClick={handleNext}
              >
                ⏭ Pause überspringen
              </button>
              <button
                style={{
                  ...adjustButton,
                  border: `1px solid ${accentBorder}`,
                  color: theme.accent,
                }}
                onClick={() => setShowAdjustSheet(true)}
              >
                + Anpassen
              </button>
            </div>
          </div>
        )}

        {showAdjustSheet ? (
          <div style={inlineOverlay} onClick={() => setShowAdjustSheet(false)}>
            <div style={workoutSheet} onClick={(event) => event.stopPropagation()}>
              <div style={workoutSheetHeader}>
                <div>
                  <div style={workoutSheetEyebrow}>Workout</div>
                  <div style={workoutSheetTitle}>Schnell anpassen</div>
                </div>
                <button style={workoutSheetClose} onClick={() => setShowAdjustSheet(false)}>
                  ×
                </button>
              </div>
              <div style={adjustList}>
                <button style={adjustListButton} onClick={() => handleAdjustAction("addExercise")}>
                  <span style={adjustListIcon}>🏋️</span>
                  <span>
                    <div style={adjustListLabel}>Übung hinzufügen</div>
                    <div style={adjustListHint}>Neue Übung direkt danach einfügen</div>
                  </span>
                </button>
                <button style={adjustListButton} onClick={() => handleAdjustAction("addStretch")}>
                  <span style={adjustListIcon}>🧘</span>
                  <span>
                    <div style={adjustListLabel}>Dehnen hinzufügen</div>
                    <div style={adjustListHint}>Zusätzlichen Dehnblock einbauen</div>
                  </span>
                </button>
                <button style={adjustListButton} onClick={() => handleAdjustAction("addPause")}>
                  <span style={adjustListIcon}>⏱️</span>
                  <span>
                    <div style={adjustListLabel}>Pause hinzufügen</div>
                    <div style={adjustListHint}>Sofort zusätzliche Pause starten</div>
                  </span>
                </button>
                <button style={adjustListButton} onClick={() => handleAdjustAction("skipExercise")}>
                  <span style={adjustListIcon}>⏭</span>
                  <span>
                    <div style={adjustListLabel}>Aktuelle Übung überspringen</div>
                    <div style={adjustListHint}>Nur diese Session weiterziehen</div>
                  </span>
                </button>
                <button style={adjustListButton} onClick={() => handleAdjustAction("replaceExercise")}>
                  <span style={adjustListIcon}>🔄</span>
                  <span>
                    <div style={adjustListLabel}>Übung ersetzen</div>
                    <div style={adjustListHint}>Aktuelle Übung gegen eine andere tauschen</div>
                  </span>
                </button>
                <button style={adjustListButton} onClick={() => handleAdjustAction("extraSet")}>
                  <span style={adjustListIcon}>➕</span>
                  <span>
                    <div style={adjustListLabel}>Zusatzsatz hinzufügen</div>
                    <div style={adjustListHint}>Einen weiteren Arbeitssatz anhängen</div>
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingWorkoutChange ? (
          <div style={inlineOverlay} onClick={() => setPendingWorkoutChange(null)}>
            <div style={workoutSheet} onClick={(event) => event.stopPropagation()}>
              <div style={workoutSheetHeader}>
                <div>
                  <div style={workoutSheetEyebrow}>Änderung anwenden</div>
                  <div style={workoutSheetTitle}>{pendingWorkoutChange.title}</div>
                </div>
                <button style={workoutSheetClose} onClick={() => setPendingWorkoutChange(null)}>
                  ×
                </button>
              </div>
              <div style={confirmBodyText}>{pendingWorkoutChange.description}</div>
              <div style={scopeCard}>
                <button
                  style={workoutChangeScope === "session" ? scopeButtonActive : scopeButton}
                  onClick={() => setWorkoutChangeScope("session")}
                >
                  Nur dieses Training
                </button>
                <button
                  style={
                    workoutChangeScope === "plan" && pendingWorkoutChange.canPersist
                      ? scopeButtonActive
                      : pendingWorkoutChange.canPersist
                      ? scopeButton
                      : scopeButtonDisabled
                  }
                  onClick={() =>
                    pendingWorkoutChange.canPersist && setWorkoutChangeScope("plan")
                  }
                  disabled={!pendingWorkoutChange.canPersist}
                >
                  Dauerhaft im Plan
                </button>
              </div>
              {!pendingWorkoutChange.canPersist ? (
                <div style={confirmHint}>
                  Dauerhaftes Speichern ist hier nur bei eigenen Plänen verfügbar.
                </div>
              ) : null}
              <div style={confirmActions}>
                <button style={confirmSecondaryButton} onClick={() => setPendingWorkoutChange(null)}>
                  Abbrechen
                </button>
                <button style={confirmPrimaryButton} onClick={confirmPendingWorkoutChange}>
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? <p style={loadingText}>Speichere...</p> : null}
      </div>

      {/* PLAN MODAL */}
      {showPlanModal ? (
        <div
          style={modalOverlay}
          onClick={() => {
            setShowPlanModal(false);
            setExpandedPlanExerciseIndex(null);
          }}
        >
          <div style={modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <span style={modalTitle}>Heutiger Plan</span>
              <span style={modalMeta}>{totalCompleted} / {totalSetsAll} Sätze</span>
              <button
                style={modalClose}
                onClick={() => {
                  setShowPlanModal(false);
                  setExpandedPlanExerciseIndex(null);
                }}
              >
                ✕
              </button>
            </div>
            <div style={modalList}>
              {dayProgress.map((entry, index) => (
                <div
                  key={`mp-${entry.exercise.id}-${index}`}
                  style={{ ...modalItem, ...(index === exerciseIndex ? modalItemActive : null) }}
                >
                  <button
                    style={modalItemButton}
                    onClick={() =>
                      setExpandedPlanExerciseIndex((current) =>
                        current === index ? null : index
                      )
                    }
                  >
                    <div style={modalItemLeft}>
                      <span style={{ ...modalItemName, ...(index === exerciseIndex ? { color: theme.accent } : null) }}>
                        {index === exerciseIndex ? "▶ " : ""}{getExerciseLabel(entry.exercise.name)}
                      </span>
                      <span style={modalItemMeta}>{entry.completed} / {entry.total} Sätze</span>
                    </div>
                    <div style={modalItemRight}>
                      <div style={modalDots}>
                        {Array.from({ length: entry.total }).map((_, di) => (
                          <span
                            key={`md-${di}`}
                            style={{
                              ...modalDot,
                              ...(di < entry.completed
                                ? { ...modalDotDone, background: theme.accent }
                                : null),
                              ...(index === exerciseIndex
                                ? { borderColor: theme.border }
                                : null),
                            }}
                          />
                        ))}
                      </div>
                      <span style={modalChevron}>
                        {expandedPlanExerciseIndex === index ? "▾" : "▸"}
                      </span>
                    </div>
                  </button>
                  {expandedPlanExerciseIndex === index ? (
                    <div style={modalSetList}>
                      {loggedSets
                        .filter((set) => set.exerciseId === entry.exercise.id)
                        .sort((a, b) => a.set - b.set)
                        .map((set) => (
                          <div key={`ms-${entry.exercise.id}-${set.timestamp}-${set.set}`} style={modalSetRow}>
                            <span style={modalSetLabel}>
                              {getSetLabelForExercise(
                                set.set,
                                getWarmupRoundsForExercise(workoutDayBlocks, entry.exercise.id),
                                entry.exercise.sets
                              )}
                            </span>
                            <span style={modalSetValue}>
                              {formatWeight(set.weight)} kg × {formatReps(set.reps)}
                            </span>
                          </div>
                        ))}
                      {loggedSets.filter((set) => set.exerciseId === entry.exercise.id).length === 0 ? (
                        <div style={modalSetEmpty}>Noch keine Sätze gespeichert</div>
                      ) : null}
                    </div>
                  ) : null}
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
  height: "100%",
  overflow: "hidden" as const,
  padding: 0,
  boxSizing: "border-box" as const,
};

const card = {
  width: "100%",
  maxWidth: 430,
  height: "100%",
  borderRadius: 24,
  padding: "10px 10px calc(12px + env(safe-area-inset-bottom))",
  background: "rgba(255,255,255,0.96)",
  backdropFilter: "blur(14px)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  overflow: "hidden" as const,
  boxSizing: "border-box" as const,
};

const progressHeader = {
  marginBottom: 0,
};

const contextCard = {
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 18,
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
  minHeight: 36,
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
  minHeight: 36,
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
  minHeight: 32,
  padding: "6px 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: "bold",
  color: "#6b7280",
  background: "#f8fafc",
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
  maxHeight: "78dvh",
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
  display: "grid",
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

const modalItemButton = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "transparent",
  border: "none",
  padding: 0,
  textAlign: "left" as const,
  cursor: "pointer",
};

const modalItemRight = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
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

const modalChevron = {
  fontSize: 14,
  color: "#64748b",
  fontWeight: "bold",
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

const modalSetList = {
  display: "grid",
  gap: 6,
  marginTop: 10,
  paddingTop: 10,
  borderTop: "1px solid #e5ebf4",
};

const modalSetRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  borderRadius: 10,
  background: "#ffffff",
  border: "1px solid #edf1f7",
};

const modalSetLabel = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#64748b",
};

const modalSetValue = {
  fontSize: 13,
  fontWeight: "bold",
  color: "#111827",
};

const modalSetEmpty = {
  padding: "8px 2px 2px",
  fontSize: 12,
  color: "#94a3b8",
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

const progressMetaDivider = {
  display: "inline-block",
  margin: "0 6px",
  color: "#cbd5e1",
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
  gap: 4,
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

const flowCard = {
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 16,
  flexShrink: 0,
};

const flowRow = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const flowLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 0.9,
  color: "#94a3b8",
  fontWeight: 800,
};

const flowValue = {
  fontSize: 13,
  lineHeight: 1.3,
  color: "#111827",
  fontWeight: 800,
  textAlign: "right" as const,
};

const flowDivider = {
  height: 1,
  background: "rgba(203, 213, 225, 0.55)",
};

const flowHelper = {
  fontSize: 12,
  lineHeight: 1.35,
  color: "#64748b",
  fontWeight: 600,
};

const title = {
  fontSize: 34,
  fontWeight: 800,
  lineHeight: 1.02,
  margin: 0,
};

const activeStack = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  minHeight: 0,
  flex: 1,
};

const compareSection = {
  display: "grid",
  gap: 2,
  flexShrink: 0,
};

const compareGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
  alignItems: "stretch" as const,
};

const insightCard = {
  minHeight: 92,
  padding: "8px 10px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #edf1f7",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.03)",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between" as const,
  gap: 4,
  minWidth: 0,
};

const compareCardTop = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const compareIcon = {
  fontSize: 11,
};

const insightLabel = {
  fontSize: 9,
  textTransform: "uppercase" as const,
  letterSpacing: 0.9,
  color: "#64748b",
  fontWeight: 800,
};

const insightValue = {
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 800,
  color: "#111827",
};

const compactInsightValue = {
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 800,
  color: "#111827",
};

const compareHeroValue = {
  fontSize: 15,
  lineHeight: 1,
  fontWeight: "bold",
  color: "#111827",
};

const insightDescription = {
  fontSize: 10,
  lineHeight: 1.25,
  color: "#64748b",
};

const compactInsightDescription = {
  fontSize: 9,
  lineHeight: 1.2,
  color: "#64748b",
};

const compareMeta = {
  fontSize: 8,
  color: "#94a3b8",
  fontWeight: 700,
  minHeight: 10,
};

const compareDeltaPositive = {
  fontSize: 11,
  color: "#16a34a",
  fontWeight: "bold",
  lineHeight: 1.35,
};

const exerciseCard = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-start" as const,
  gap: 16,
  padding: "22px 18px 20px",
  borderRadius: 26,
  background: "#ffffff",
  border: "1px solid #edf1f7",
  boxShadow: "0 20px 42px rgba(15, 23, 42, 0.08)",
};

const exerciseCardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 8,
};

const exerciseCardMeta = {
  marginTop: 6,
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 15,
  color: "#64748b",
  fontWeight: 700,
  flexWrap: "wrap" as const,
};

const lastTrainingHint = {
  marginTop: 8,
  fontSize: 14,
  color: "#64748b",
  fontWeight: 700,
};

const weightPanel = {
  display: "grid",
  gridTemplateColumns: "86px minmax(0, 1fr) 86px",
  gap: 14,
  alignItems: "center",
};

const weightSideColumn = {
  display: "grid",
  gap: 8,
  alignContent: "start" as const,
};

const weightSideButton = {
  minHeight: 52,
  borderRadius: 16,
  border: "1px solid #dce4f0",
  background: "#ffffff",
  color: "#ef4444",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const weightCenter = {
  display: "grid",
  justifyItems: "center" as const,
  gap: 8,
};

const weightCenterLabel = {
  fontSize: 13,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: "#94a3b8",
  fontWeight: 800,
};

const weightControls = {
  display: "grid",
  gap: 5,
};

const weightBox = {
  fontSize: 80,
  fontWeight: 800,
  textAlign: "center" as const,
  color: "#111827",
  lineHeight: 0.95,
};

const weightUnit = {
  marginLeft: 6,
  fontSize: 30,
  color: "#334155",
};

const manualEntryButton = {
  minHeight: 34,
  padding: "7px 16px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const sectionLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: "#6b7280",
  textAlign: "center" as const,
  fontWeight: "bold",
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

const repsSection = {
  display: "grid",
  gap: 12,
};

const bottomActionDock = {
  display: "grid",
  gap: 12,
  marginTop: "auto",
  paddingTop: 10,
  paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
  flexShrink: 0,
};

const singleActionDock = {
  display: "grid",
  gap: 0,
  marginTop: "auto",
  paddingTop: 10,
  paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
  flexShrink: 0,
};

const repsRowModern = {
  display: "grid",
  gridTemplateColumns: "56px minmax(0, 1fr) 56px",
  gap: 10,
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

const repsValueCard = {
  minHeight: 84,
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid #edf1f7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 58,
  fontWeight: 800,
  color: "#111827",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
};

const repsRoundButton = {
  minHeight: 70,
  width: "100%",
  borderRadius: 999,
  border: "1px solid #dce4f0",
  background: "#ffffff",
  color: "#dc2626",
  fontSize: 34,
  fontWeight: 800,
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
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

const primaryActionButtonBase = {
  width: "100%",
  minHeight: 70,
  padding: "15px 18px",
  border: "none",
  borderRadius: 999,
  color: "#ffffff",
  fontSize: 19,
  fontWeight: 800,
  cursor: "pointer",
};

const saveBarButton = {
  ...primaryActionButtonBase,
  background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
  boxShadow: "0 18px 34px rgba(220, 38, 38, 0.24)",
};

const allSetsButton = {
  width: "100%",
  minHeight: 54,
  borderRadius: 999,
  border: "1px solid #e5ebf4",
  background: "#ffffff",
  color: "#334155",
  fontSize: 16,
  fontWeight: 700,
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
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
  gap: 12,
  padding: "16px 16px 22px",
  borderRadius: 24,
  textAlign: "center" as const,
  flex: 1,
};

const restHistoryCard = {
  padding: "14px 14px 14px",
  borderRadius: 20,
  background: "#ffffff",
  border: "1px solid #edf1f7",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: 8,
  textAlign: "left" as const,
};

const restHistoryTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const restHistoryLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#94a3b8",
  fontWeight: "bold",
};

const restHistoryTrend = {
  color: "#ef4444",
  fontSize: 14,
  fontWeight: "bold",
};

const restHistoryList = {
  display: "grid",
  gap: 8,
};

const restHistoryRow = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr) 22px",
  alignItems: "center",
  gap: 8,
};

const restHistoryIndex = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 13,
  fontWeight: "bold",
};

const restHistoryValue = {
  display: "grid",
  gap: 2,
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
};

const restHistorySetLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#94a3b8",
  fontWeight: "bold",
};

const restHistoryDone = {
  color: "#dc2626",
  fontSize: 14,
  fontWeight: "bold",
  textAlign: "center" as const,
};

const restHistoryEmpty = {
  fontSize: 12,
  color: "#64748b",
  textAlign: "center" as const,
  padding: "6px 0",
};

const restHistoryButton = {
  width: "100%",
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid #eef2f7",
  background: "#fbfbfd",
  color: "#334155",
  fontSize: 14,
  fontWeight: "bold",
};

const restTimerWrap = {
  display: "flex",
  justifyContent: "center",
  padding: "6px 0 4px",
};

const restBarTrack = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "#eef2f7",
  overflow: "hidden" as const,
};

const restBarFill = {
  height: "100%",
  borderRadius: 999,
};

const restCircle = {
  position: "relative" as const,
  width: 228,
  height: 228,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 10,
  transform: "rotate(-90deg)",
  boxShadow: "inset 0 0 0 2px rgba(239, 68, 68, 0.1), 0 14px 32px rgba(239, 68, 68, 0.1)",
};

const restCircleSweep = {
  position: "absolute" as const,
  inset: 8,
  borderRadius: "50%",
  pointerEvents: "none" as const,
};

const restCircleSweepBar = {
  position: "absolute" as const,
  top: -4,
  left: "50%",
  width: 20,
  height: 54,
  borderRadius: 999,
  transform: "translateX(-50%)",
};

const restCircleSweepDot = {
  position: "absolute" as const,
  top: -10,
  left: "50%",
  width: 24,
  height: 24,
  borderRadius: "50%",
  transform: "translateX(-50%)",
};

const restCircleInner = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  boxShadow: "inset 0 0 0 1px rgba(248, 220, 220, 0.95)",
  transform: "rotate(90deg)",
  transition: "transform 140ms linear",
};

const restLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const restSubLabel = {
  fontSize: 13,
  color: "#94a3b8",
  fontWeight: 600,
};

const restTimer = {
  fontSize: 50,
  fontWeight: 800,
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
  gap: 8,
};

const restWeightLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: "#6b7280",
  fontWeight: "bold",
};

const restWeightValueLarge = {
  fontSize: 56,
  fontWeight: 800,
  color: "#111827",
  lineHeight: 1,
};

const restWeightUnit = {
  marginLeft: 6,
  fontSize: 22,
  color: "#334155",
};

const restWeightRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: 8,
  alignItems: "center" as const,
};

const restWeightButton = {
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid #d6dbe5",
  background: "#fff",
  color: "#ef4444",
  fontSize: 17,
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
};

const stretchNextSection = {
  display: "grid",
  gap: 6,
  justifyItems: "center" as const,
  textAlign: "center" as const,
};

const stretchNextValue = {
  fontSize: 28,
  lineHeight: 1.08,
  fontWeight: 800,
  color: "#111827",
};

const stretchNextHint = {
  fontSize: 12,
  lineHeight: 1.35,
  color: "#64748b",
  fontWeight: 600,
};

const restSuggestionBadge = {
  display: "inline-flex",
  alignSelf: "center" as const,
  minHeight: 32,
  padding: "6px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
};

const restSuggestionGood = {
  background: "#ecfdf3",
  color: "#16a34a",
};

const restSuggestionUp = {
  background: "#eff6ff",
  color: "#2563eb",
};

const restSuggestionDown = {
  background: "#fff7ed",
  color: "#ea580c",
};

const restSuggestionNeutral = {
  background: "#f8fafc",
  color: "#475569",
};

const restTargetBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "5px 12px",
  borderRadius: 999,
  background: "#fff7f7",
  color: "#ef4444",
  fontSize: 13,
  fontWeight: "bold",
};

const continueButton = {
  ...primaryActionButtonBase,
  background: "#111827",
  marginTop: 8,
};

const adjustButton = {
  width: "100%",
  minHeight: 48,
  padding: "12px 16px",
  borderRadius: 999,
  background: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
};

const inlineOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(15, 23, 42, 0.38)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "20px 12px calc(20px + env(safe-area-inset-bottom))",
  zIndex: 40,
};

const workoutSheet = {
  width: "100%",
  maxWidth: 420,
  borderRadius: 28,
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(226,232,240,0.9)",
  boxShadow: "0 26px 60px rgba(15, 23, 42, 0.18)",
  padding: "18px 18px 18px",
  display: "grid",
  gap: 14,
};

const workoutSheetHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const workoutSheetEyebrow = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: "uppercase" as const,
  color: "#94a3b8",
};

const workoutSheetTitle = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 800,
  color: "#111827",
};

const workoutSheetClose = {
  minHeight: 46,
  minWidth: 46,
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
};

const adjustList = {
  display: "grid",
  gap: 10,
};

const adjustListButton = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  padding: "16px 16px",
  borderRadius: 22,
  border: "1px solid #e5ebf4",
  background: "#ffffff",
  color: "#111827",
  textAlign: "left" as const,
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const adjustListIcon = {
  fontSize: 24,
  flexShrink: 0,
};

const adjustListLabel = {
  fontSize: 16,
  fontWeight: 800,
  color: "#111827",
};

const adjustListHint = {
  marginTop: 2,
  fontSize: 13,
  color: "#64748b",
};

const confirmBodyText = {
  fontSize: 15,
  lineHeight: 1.5,
  color: "#475569",
};

const scopeCard = {
  display: "grid",
  gap: 10,
};

const scopeButton = {
  minHeight: 54,
  width: "100%",
  borderRadius: 18,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const scopeButtonActive = {
  ...scopeButton,
  background: "#111827",
  border: "1px solid #111827",
  color: "#ffffff",
  boxShadow: "0 12px 24px rgba(17, 24, 39, 0.18)",
};

const scopeButtonDisabled = {
  ...scopeButton,
  opacity: 0.45,
  cursor: "not-allowed",
};

const confirmHint = {
  fontSize: 13,
  color: "#64748b",
};

const confirmActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const confirmSecondaryButton = {
  minHeight: 56,
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const confirmPrimaryButton = {
  ...confirmSecondaryButton,
  background: "#111827",
  border: "1px solid #111827",
  color: "#ffffff",
  boxShadow: "0 14px 28px rgba(17, 24, 39, 0.18)",
};


const compactCard = {
  gap: 4,
};

const compactContextCard = {
  gap: 5,
  padding: "8px 10px",
  borderRadius: 16,
};

const compactProgressMeta = {
  fontSize: 10,
  marginBottom: 3,
};

const compactBadge = {
  fontSize: 10,
  padding: "2px 8px",
};

const compactTitle = {
  fontSize: 17,
};

const compactActiveStack = {
  gap: 3,
};

const compactFlowCard = {
  gap: 5,
  padding: "8px 10px",
};

const compactFlowValue = {
  fontSize: 12,
};

const compactInsightCard = {
  minHeight: 74,
  padding: "7px 9px",
  gap: 2,
};

const compactExerciseCard = {
  gap: 10,
  padding: "14px 14px 12px",
  borderRadius: 22,
};

const compactLastTrainingHint = {
  marginTop: 4,
  fontSize: 12,
};

const compactWeightPanel = {
  gridTemplateColumns: "74px minmax(0, 1fr) 74px",
  gap: 10,
};

const compactWeightSideButton = {
  minHeight: 44,
  borderRadius: 14,
};

const compactWeightBox = {
  fontSize: 42,
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

const compactRepsRowModern = {
  gridTemplateColumns: "44px minmax(0, 1fr) 44px",
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
  gap: 6,
  padding: "8px 8px",
};

const compactRestTimer = {
  fontSize: 32,
};

const compactRestWeightValue = {
  fontSize: 18,
};

const compactRestWeightValueLarge = {
  fontSize: 44,
};

const compactRestWeightRow = {
  gap: 4,
};

const compactRestWeightButton = {
  minHeight: 32,
  fontSize: 12,
};

const compactContinueButton = {
  minHeight: 56,
  padding: "10px 14px",
  fontSize: 14,
};

const compactSaveBarButton = {
  minHeight: 56,
  fontSize: 16,
};

const compactRepsRoundButton = {
  minHeight: 44,
  fontSize: 22,
};

const compactRepsValueCard = {
  minHeight: 68,
  fontSize: 42,
  borderRadius: 20,
};

const compactStretchNextValue = {
  fontSize: 22,
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

type ExerciseDraftInput = {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

type StretchDraftInput = {
  label: string;
  holdSeconds: number;
  rounds: number;
};

type PauseDraftInput = {
  label: string;
  seconds: number;
  scope: "exercise" | "workout";
};

function buildSessionExercise(
  name: string,
  sets: number,
  minReps: number,
  maxReps: number,
  restSeconds: number
): WorkoutExercise {
  return {
    id: `session:${slugifyLabel(name)}:${Date.now()}`,
    name,
    sets: Math.max(1, Math.round(sets || 1)),
    minReps: Math.max(1, minReps || 1),
    maxReps: Math.max(Math.max(1, minReps || 1), maxReps || minReps || 1),
    restSeconds: Math.max(15, Math.round(restSeconds || 60)),
  };
}

function buildSessionStretchBlock(draft: StretchDraftInput): StretchPlanBlock {
  return {
    id: `stretch:session:${Date.now()}`,
    type: "stretch",
    label: draft.label,
    stretchId: slugifyLabel(draft.label),
    category: "Dehnen",
    holdSeconds: Math.max(10, Math.round(draft.holdSeconds || 30)),
    rounds: Math.max(1, Math.round(draft.rounds || 1)),
  };
}

function insertBlocksAfterId(
  blocks: TrainingPlanBlock[],
  newBlocks: TrainingPlanBlock[],
  afterBlockId?: string | null
) {
  if (!afterBlockId) {
    return [...blocks, ...newBlocks];
  }

  const index = blocks.findIndex((block) => block.id === afterBlockId);
  if (index === -1) {
    return [...blocks, ...newBlocks];
  }

  return [...blocks.slice(0, index + 1), ...newBlocks, ...blocks.slice(index + 1)];
}

function parsePositiveIntPrompt(rawValue: string | null, fallback: number) {
  const parsed = Number.parseInt((rawValue ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRepRangePrompt(
  rawValue: string | null,
  fallback: { min: number; max: number }
) {
  const match = (rawValue ?? "").trim().match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) {
    return fallback;
  }

  const min = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2], 10);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return fallback;
  }

  return {
    min: Math.max(1, min),
    max: Math.max(Math.max(1, min), max),
  };
}

function slugifyLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "custom";
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

function getWarmupRoundsForExercise(
  dayBlocks: TrainingPlanBlock[] | undefined,
  exerciseId: string
) {
  const warmupBlock = dayBlocks?.find(
    (block): block is Extract<TrainingPlanBlock, { type: "warmup" }> =>
      block.type === "warmup" && block.parentExerciseId === exerciseId
  );
  return warmupBlock?.rounds ?? 1;
}

function getStretchBlocksForExercise(
  dayBlocks: TrainingPlanBlock[] | undefined,
  exerciseId: string
) {
  if (!dayBlocks || dayBlocks.length === 0) {
    return [] as StretchPlanBlock[];
  }

  const exerciseIndex = dayBlocks.findIndex(
    (block): block is Extract<TrainingPlanBlock, { type: "exercise" }> =>
      block.type === "exercise" && block.exerciseId === exerciseId
  );

  if (exerciseIndex < 0) {
    return [] as StretchPlanBlock[];
  }

  let startIndex = 0;
  for (let index = exerciseIndex - 1; index >= 0; index -= 1) {
    if (dayBlocks[index]?.type === "exercise") {
      startIndex = index + 1;
      break;
    }
  }

  return dayBlocks.slice(startIndex, exerciseIndex).filter(
    (block): block is StretchPlanBlock => block.type === "stretch"
  );
}

function getStretchDurationSeconds(block: StretchPlanBlock | null | undefined) {
  if (!block) {
    return 0;
  }

  return Math.max(1, block.holdSeconds * block.rounds);
}

function getSetLabelForExercise(
  setIndex: number,
  warmupSets: number,
  workSets: number
) {
  if (setIndex < warmupSets) {
    return warmupSets > 1
      ? `Warm-up ${setIndex + 1}/${warmupSets}`
      : "Warm-up";
  }

  const workSetNumber = setIndex - warmupSets + 1;
  return `Satz ${workSetNumber}/${workSets}`;
}

function getWorkoutSetLabel(
  setIndex: number,
  warmupSets: number,
  workSets: number
) {
  return getSetLabelForExercise(setIndex, warmupSets, workSets);
}

function buildHistoryPreview(previousSets: Array<SetType | null>) {
  const fallback = [
    { weight: 40, reps: 8 },
    { weight: 40, reps: 7 },
    { weight: 37.5, reps: 8 },
  ];

  const actual = previousSets
    .filter((set): set is SetType => set !== null)
    .slice(0, 3)
    .map((set) => ({
      weight: set.weight,
      reps: set.reps,
    }));

  return actual.length > 0 ? actual : fallback;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatComparisonDelta(
  currentWeight: number,
  currentReps: number,
  comparedSet: SetType
) {
  const weightDelta = normalizeWeight(currentWeight - comparedSet.weight);
  const repsDelta = normalizeReps(currentReps - comparedSet.reps);

  if (weightDelta === 0 && repsDelta === 0) {
    return "±0";
  }

  if (weightDelta !== 0) {
    return `${formatDelta(weightDelta)} kg`;
  }

  return `${formatDelta(repsDelta)} Wdh.`;
}

function getComparisonEncouragement(
  currentWeight: number,
  currentReps: number,
  comparedSet: SetType
) {
  const weightDelta = normalizeWeight(currentWeight - comparedSet.weight);
  const repsDelta = normalizeReps(currentReps - comparedSet.reps);

  if (weightDelta > 0 || repsDelta > 0) {
    return "Weiter so! 💪";
  }

  if (weightDelta === 0 && repsDelta === 0) {
    return "Gleich stark wie letztes Mal.";
  }

  return "Knapp unter dem letzten Training.";
}

function getDeltaToneColor(
  currentWeight: number,
  currentReps: number,
  comparedSet: SetType | null,
  theme: WorkoutTheme
) {
  if (!comparedSet) {
    return theme.accent;
  }

  const weightDelta = normalizeWeight(currentWeight - comparedSet.weight);
  const repsDelta = normalizeReps(currentReps - comparedSet.reps);

  if (weightDelta > 0 || repsDelta > 0) {
    return theme.accent;
  }

  if (weightDelta === 0 && repsDelta === 0) {
    return darkenColor(theme.accent, 0.08);
  }

  return darkenColor(theme.accent, 0.2);
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

function toRgba(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    const value = Number.parseInt(normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  return color;
}

function darkenColor(color: string, amount: number) {
  if (!color.startsWith("#")) {
    return color;
  }

  const hex = color.slice(1);
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;

  const value = Number.parseInt(normalized, 16);
  const r = Math.max(0, Math.round(((value >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((value >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((value & 255) * (1 - amount)));

  return `rgb(${r}, ${g}, ${b})`;
}

function lightenColor(color: string, amount: number) {
  if (!color.startsWith("#")) {
    return color;
  }

  const hex = color.slice(1);
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;

  const value = Number.parseInt(normalized, 16);
  const r = Math.min(255, Math.round(((value >> 16) & 255) + (255 - ((value >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((value >> 8) & 255) + (255 - ((value >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((value & 255) + (255 - (value & 255)) * amount));

  return `rgb(${r}, ${g}, ${b})`;
}


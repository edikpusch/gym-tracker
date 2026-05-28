"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { WorkoutStatusHeader } from "@/components/WorkoutStatusHeader";
import {
  getBestSetForExercise,
  getBestSetInsightForExercise,
  getCoachDecisionForRange,
  deleteStoredSet,
  getExerciseSuggestionForSet,
  getExerciseTrendInsight,
  getBestMatchingSet,
  getLastSessionForExercise,
  getRecentSessionsForExercise,
  getPreviousMatchingSet,
  getProgress,
  getSessionSetEntries,
  saveWorkoutEvent,
  getTopSet,
  saveSet,
  updateStoredSet,
  deleteWorkoutSession,
  getLoggedSetExerciseReference,
  type ExerciseSuggestionInsight,
  type ExerciseTrendInsight,
  type LoggedSetType,
  type SetType,
} from "@/lib/workoutEngine";
import {
  clearRestNotification,
  scheduleRestNotification,
} from "@/lib/restNotifications";
import { getAppPreferences, type AppPreferences } from "@/lib/appPreferences";
import {
  getSuggestedExerciseSetup,
  resolveExerciseCatalogReference,
} from "@/lib/trainingCatalog";
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
  updateWarmupBlock,
} from "@/lib/trainingPlans";
import { appChromeBackground, appPalette, splitThemes, withAlpha } from "@/lib/theme";
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

type AdjustAction =
  | "addExercise"
  | "addStretch"
  | "addPause"
  | "skipExercise"
  | "skipSet"
  | "replaceExercise"
  | "extraSet";

type PendingWorkoutChange = {
  title: string;
  description: string;
  canPersist: boolean;
  onSession: () => void;
  onPlan?: () => void;
};

type ManualEntryMode = "weight" | "reps";

type EditableSetState = {
  timestamp: number;
  weight: string;
  reps: string;
};

type ExerciseDraftSheetState = {
  mode: "add" | "replace";
  name: string;
  sets: string;
  minReps: string;
  maxReps: string;
  restSeconds: string;
};

type StretchDraftSheetState = {
  stretchId: string;
  holdSeconds: string;
  rounds: string;
};

type PauseDraftSheetState = {
  label: string;
  seconds: string;
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
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [showLastTrainingSheet, setShowLastTrainingSheet] = useState(false);
  const [exerciseDraftSheet, setExerciseDraftSheet] = useState<ExerciseDraftSheetState | null>(null);
  const [stretchDraftSheet, setStretchDraftSheet] = useState<StretchDraftSheetState | null>(null);
  const [pauseDraftSheet, setPauseDraftSheet] = useState<PauseDraftSheetState | null>(null);
  const [pendingWorkoutChange, setPendingWorkoutChange] =
    useState<PendingWorkoutChange | null>(null);
  const [workoutChangeScope, setWorkoutChangeScope] = useState<"session" | "plan">("session");
  const [manualEntryMode, setManualEntryMode] = useState<ManualEntryMode | null>(null);
  const [manualEntryValue, setManualEntryValue] = useState("");
  const [restHistoryExpanded, setRestHistoryExpanded] = useState(false);
  const [editableSet, setEditableSet] = useState<EditableSetState | null>(null);
  const [saveFeedbackVisible, setSaveFeedbackVisible] = useState(false);
  const [setDataVersion, setSetDataVersion] = useState(0);
  const [repsFeedbackDirection, setRepsFeedbackDirection] = useState<"up" | "down" | null>(null);
  const [repsFeedbackTick, setRepsFeedbackTick] = useState(0);

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
  const [lastExerciseSessionSets, setLastExerciseSessionSets] = useState<SetType[]>([]);
  const [recentExerciseSessions, setRecentExerciseSessions] = useState<SetType[][]>([]);
  const [lastTrainingSet, setLastTrainingSet] = useState<SetType | null>(null);
  const [bestMatchingSet, setBestMatchingSet] = useState<SetType | null>(null);
  const [bestExerciseSet, setBestExerciseSet] = useState<SetType | null>(null);
  const [bestExerciseInsightLabel, setBestExerciseInsightLabel] = useState<string | null>(null);
  const [bestExerciseInsightDetail, setBestExerciseInsightDetail] = useState<string | null>(null);
  const [exerciseSuggestion, setExerciseSuggestion] = useState<ExerciseSuggestionInsight | null>(null);
  const [exerciseTrendInsight, setExerciseTrendInsight] = useState<ExerciseTrendInsight | null>(null);

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
  const repsFeedbackTimeoutRef = useRef<number | null>(null);
  const workoutExercises = sessionExercises;
  const workoutDayBlocks = sessionDayBlocks;

  const currentExercise = workoutExercises[exerciseIndex];
  const getExerciseReference = (exerciseName: string) =>
    resolveExerciseCatalogReference(exerciseName) ?? exerciseName;
  const currentExerciseReference =
    getExerciseReference(currentExercise.name);
  const currentWarmupSets = getWarmupRoundsForExercise(workoutDayBlocks, currentExercise.id);
  const currentSetType = getLoggedSetType(setIndex, currentWarmupSets);
  const weightConfig = getDefaultWeightConfig(currentExercise.name);
  const weightSteps = weightConfig.quickSteps;
  const primaryWeightStep = weightSteps.includes(5) ? 5 : weightSteps[0] ?? 5;
  const displayedWeight = normalizeDisplayWeightInput(manualWeightInput, weight);
  const selectedManualWeight = normalizeWheelWeight(
    parseManualWeightValue(manualEntryValue, weight)
  );
  const selectedManualReps = normalizeWheelReps(
    parseManualRepsValue(manualEntryValue, reps)
  );
  const manualWeightOptions = useMemo(
    () => buildWeightWheelOptions(weightConfig.min, weightConfig.max, selectedManualWeight),
    [selectedManualWeight, weightConfig.max, weightConfig.min]
  );
  const manualRepsOptions = useMemo(
    () => buildRepsWheelOptions(selectedManualReps),
    [selectedManualReps]
  );
  const totalSets = currentExercise.sets + currentWarmupSets;
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
    const resumeExerciseIndex =
      resumeSnapshot?.exerciseInstanceId != null
        ? exercises.findIndex(
            (exercise) => exercise.id === resumeSnapshot.exerciseInstanceId
          )
        : resumeSnapshot?.exerciseReference != null
        ? exercises.findIndex(
            (exercise) =>
              (resolveExerciseCatalogReference(exercise.name) ?? exercise.name) ===
              resumeSnapshot.exerciseReference
          )
        : -1;
    const clampedExerciseIndex = Math.min(
      Math.max(
        resumeExerciseIndex >= 0
          ? resumeExerciseIndex
          : resumeSnapshot?.exerciseIndex ?? 0,
        0
      ),
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
      lastInitializedExerciseRef.current =
        resolveExerciseCatalogReference(resumedExercise.name) ?? resumedExercise.name;

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
    setRestHistoryExpanded(false);
    setEditableSet(null);
    setShowLastTrainingSheet(false);
  }, [currentExercise.id]);

  useEffect(() => {
    return () => {
      if (repsFeedbackTimeoutRef.current) {
        window.clearTimeout(repsFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function updateCompactMode() {
      const nextCompactMode =
        window.innerHeight <= 1480 || (window.innerHeight <= 1600 && window.innerWidth <= 460);
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
    const currentExerciseReference =
      resolveExerciseCatalogReference(currentExercise.name) ?? currentExercise.name;

    async function init() {
      const history: Array<SetType | null> = [];

      for (let i = 0; i < totalSets; i += 1) {
        const last = await getPreviousMatchingSet(
          currentExercise.name,
          i,
          workoutType,
          activeSessionId,
          currentExerciseReference,
          getLoggedSetType(i, currentWarmupSets)
        );
        history.push(last);
      }

      const lastSession = await getLastSessionForExercise(
        currentExercise.name,
        activeSessionId,
        workoutType,
        currentExerciseReference,
        currentSetType
      );
      const lastExerciseSession = await getLastSessionForExercise(
        currentExercise.name,
        activeSessionId,
        workoutType,
        currentExerciseReference
      );
      const recentSessions = await getRecentSessionsForExercise(
        currentExercise.name,
        activeSessionId,
        workoutType,
        currentExerciseReference,
        undefined,
        3
      );
      const previousMatchingSet = await getPreviousMatchingSet(
        currentExercise.name,
        setIndex,
        workoutType,
        activeSessionId,
        currentExerciseReference,
        currentSetType
      );
      const bestSet = await getBestMatchingSet(
        currentExercise.name,
        setIndex,
        workoutType,
        currentExerciseReference,
        currentSetType
      );
      const bestExerciseHistorySet = await getBestSetForExercise(
        currentExercise.name,
        workoutType,
        currentExerciseReference
      );
      const bestExerciseInsight = await getBestSetInsightForExercise(
        currentExercise.name,
        workoutType,
        currentExerciseReference
      );
      const sessionEntries = await getSessionSetEntries(activeSessionId);
      const currentExerciseSessionSets = sessionEntries
        .filter(
          (set) => getLoggedSetExerciseReference(set) === currentExerciseReference
        )
        .sort((a, b) => a.set - b.set);
      const alignedSessionSets = Array.from({ length: totalSets }, (_, index) => {
        return currentExerciseSessionSets.find((set) => set.set === index) ?? null;
      });

      setPreviousSets(history);
      setSessionSets(alignedSessionSets);
      setLoggedSets(sessionEntries);
      setLastSessionSets(lastSession);
      setLastExerciseSessionSets(lastExerciseSession);
      setRecentExerciseSessions(recentSessions);
      setLastTrainingSet(previousMatchingSet);
      setBestMatchingSet(bestSet);
      setBestExerciseSet(bestExerciseHistorySet);
      setBestExerciseInsightLabel(bestExerciseInsight.label);
      setBestExerciseInsightDetail(bestExerciseInsight.detail);
      setExerciseTrendInsight(getExerciseTrendInsight(recentSessions));

      const exerciseKey = currentExerciseReference;
      const isFreshExercise =
        lastInitializedSessionRef.current !== activeSessionId ||
        lastInitializedExerciseRef.current !== exerciseKey;

      const matchingHistorySet = history[setIndex] ?? null;
      const matchingSessionTypeSet =
        lastExerciseSession.find((set) => set.setType === currentSetType) ?? null;
      const fallbackHistorySet =
        matchingHistorySet ??
        matchingSessionTypeSet ??
        lastExerciseSession.find(
          (set) => getLoggedSetExerciseReference(set) === currentExerciseReference
        ) ??
        bestExerciseHistorySet ??
        null;

      const nextSuggestion = await getExerciseSuggestionForSet({
        exercise: currentExercise.name,
        setNumber: setIndex,
        currentSessionId: activeSessionId,
        workoutType,
        exerciseId: currentExerciseReference,
        setType: currentSetType,
        defaultReps: getDefaultReps(currentExercise.minReps, currentExercise.maxReps),
      });
      setExerciseSuggestion(nextSuggestion);

      if (fallbackHistorySet && (isFreshExercise || setIndex > 0)) {
        setWeight(fallbackHistorySet.weight);
        setManualWeightInput(formatWeight(fallbackHistorySet.weight).replace(".", ","));
        setReps(fallbackHistorySet.reps);
      } else if (isFreshExercise || setIndex > 0) {
        setWeight(40);
        setManualWeightInput("40");
        setReps(getDefaultReps(currentExercise.minReps, currentExercise.maxReps));
      }

      lastInitializedSessionRef.current = activeSessionId;
      lastInitializedExerciseRef.current = exerciseKey;
    }

    init();
  }, [
    currentExercise,
    currentSetType,
    currentWarmupSets,
    sessionId,
    setDataVersion,
    setIndex,
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
    setRepsFeedbackDirection(delta > 0 ? "up" : "down");
    setRepsFeedbackTick((current) => current + 1);
    if (repsFeedbackTimeoutRef.current) {
      window.clearTimeout(repsFeedbackTimeoutRef.current);
    }
    repsFeedbackTimeoutRef.current = window.setTimeout(() => {
      setRepsFeedbackDirection(null);
    }, 220);
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

    const appliedWeight = normalizeManualWeight(
      clampWeight(nextWeight, weightConfig.min, weightConfig.max)
    );
    const clampedWeight = clampWeight(nextWeight, weightConfig.min, weightConfig.max);
    const exactDisplayValue =
      clampedWeight === nextWeight
        ? normalizeManualWeightInputText(normalizedInput)
        : formatWeight(appliedWeight);
    setWeight(appliedWeight);
    setManualWeightInput(exactDisplayValue.replace(".", ","));
  }

  function applyManualRepsValue(rawValue: string) {
    if (loading || isResting || isWorkoutPaused) {
      return;
    }

    const normalizedInput = rawValue.replace(",", ".").trim();
    if (!normalizedInput) {
      return;
    }

    const nextReps = Number(normalizedInput);
    if (Number.isNaN(nextReps) || nextReps < 0.5) {
      return;
    }

    setReps(normalizeReps(nextReps));
  }

  function openManualEntry(mode: ManualEntryMode) {
    setManualEntryMode(mode);
    setManualEntryValue(
      mode === "weight"
        ? formatWeight(normalizeWheelWeight(weight)).replace(".", ",")
        : formatReps(normalizeWheelReps(reps)).replace(".", ",")
    );
  }

  function confirmManualEntry() {
    if (!manualEntryMode) {
      return;
    }

    if (manualEntryMode === "weight") {
      applyManualWeightValue(manualEntryValue);
    } else {
      applyManualRepsValue(manualEntryValue);
    }

    setManualEntryMode(null);
    setManualEntryValue("");
  }

  function openSetEditor(set: SetType) {
    setEditableSet({
      timestamp: set.timestamp,
      weight: formatWeight(set.weight).replace(".", ","),
      reps: formatReps(set.reps).replace(".", ","),
    });
  }

  async function saveEditedSet() {
    if (!editableSet) {
      return;
    }

    const nextWeight = Number(editableSet.weight.replace(",", ".").trim());
    const nextReps = Number(editableSet.reps.replace(",", ".").trim());

    if (Number.isNaN(nextWeight) || Number.isNaN(nextReps) || nextReps < 0.5) {
      return;
    }

    const updatedSet = await updateStoredSet(editableSet.timestamp, {
      weight: normalizeManualWeight(clampWeight(nextWeight, weightConfig.min, weightConfig.max)),
      reps: normalizeReps(nextReps),
    });

    if (!updatedSet) {
      return;
    }

    setLoggedSets((previous) =>
      previous.map((set) => (set.timestamp === updatedSet.timestamp ? updatedSet : set))
    );
    setSessionSets((previous) =>
      previous.map((set) => (set && set.timestamp === updatedSet.timestamp ? updatedSet : set))
    );
    setSetDataVersion((current) => current + 1);
    setEditableSet(null);
  }

  async function deleteEditedSet() {
    if (!editableSet) {
      return;
    }

    const targetTimestamp = editableSet.timestamp;
    const targetSet = loggedSets.find((set) => set.timestamp === targetTimestamp) ?? null;
    const deleted = await deleteStoredSet(targetTimestamp);

    if (!deleted) {
      return;
    }

    setLoggedSets((previous) => previous.filter((set) => set.timestamp !== targetTimestamp));
    setSessionSets((previous) =>
      previous.map((set) => (set && set.timestamp === targetTimestamp ? null : set))
    );
    setSetDataVersion((current) => current + 1);
    setEditableSet(null);

    if (
      targetSet &&
      isResting &&
      getLoggedSetExerciseReference(targetSet) === currentExerciseReference &&
      targetSet.set === setIndex
    ) {
      void clearRestNotification();
      void stopRestOverlay();
      void setRestOverlayState(false);
      setIsResting(false);
      setRestEndsAt(null);
      setManualRestDurationSec(null);
    }
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
      return insertBlocksAfterId(
        currentBlocks,
        [exerciseBlock],
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

  function applySessionSkipCurrentSet() {
    const targetSetIndex = isResting ? Math.min(setIndex + 1, totalSets - 1) : setIndex;
    const isWarmupSet = targetSetIndex < currentWarmupSets;

    if (!isWarmupSet && currentExercise.sets <= 1) {
      applySessionSkipExercise();
      return;
    }

    if (isWarmupSet) {
      setSessionDayBlocks((currentBlocks) => {
        const nextBlocks = currentBlocks
          .map((block) => {
            if (block.type === "exercise" && block.exerciseId === currentExercise.id) {
              return {
                ...block,
                warmupSets: Math.max(0, block.warmupSets - 1),
              };
            }

            if (block.type === "warmup" && block.parentExerciseId === currentExercise.id) {
              return {
                ...block,
                rounds: Math.max(0, block.rounds - 1),
              };
            }

            return block;
          })
          .filter(
            (block) =>
              !(
                block.type === "warmup" &&
                block.parentExerciseId === currentExercise.id &&
                block.rounds <= 0
              )
          );

        return nextBlocks;
      });
      return;
    }

    const nextExercises = workoutExercises.map((exercise, index) =>
      index === exerciseIndex ? { ...exercise, sets: Math.max(1, exercise.sets - 1) } : exercise
    );
    setSessionExercises(nextExercises);
    setSessionDayBlocks((currentBlocks) => syncDayBlocks(nextExercises, currentBlocks));
    setSessionSets((previous) => {
      const copy = [...previous];
      copy.splice(targetSetIndex, 1);
      return copy;
    });
    setPreviousSets((previous) => {
      const copy = [...previous];
      copy.splice(targetSetIndex, 1);
      return copy;
    });
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

  function buildExerciseDraftSheetState(mode: "add" | "replace", name: string) {
    const suggested = getSuggestedExerciseSetup(name);
    return {
      mode,
      name,
      sets: String(mode === "replace" ? currentExercise.sets : suggested.sets),
      minReps: String(mode === "replace" ? currentExercise.minReps : suggested.minReps),
      maxReps: String(mode === "replace" ? currentExercise.maxReps : suggested.maxReps),
      restSeconds: String(
        mode === "replace" ? currentExercise.restSeconds : suggested.restSeconds
      ),
    };
  }

  function requestExerciseChange(mode: "add" | "replace") {
    const initialName = mode === "replace" ? getExerciseLabel(currentExercise.name) : "";
    setExerciseDraftSheet(buildExerciseDraftSheetState(mode, initialName));
  }

  function confirmExerciseDraftChange() {
    if (!exerciseDraftSheet) {
      return;
    }

    const exerciseName = exerciseDraftSheet.name.trim();
    if (!exerciseName) {
      return;
    }

    const suggested = getSuggestedExerciseSetup(exerciseName);
    const draft = {
      name: exerciseName,
      sets: parsePositiveIntInput(exerciseDraftSheet.sets, suggested.sets),
      minReps: parsePositiveIntInput(exerciseDraftSheet.minReps, suggested.minReps),
      maxReps: Math.max(
        parsePositiveIntInput(exerciseDraftSheet.minReps, suggested.minReps),
        parsePositiveIntInput(exerciseDraftSheet.maxReps, suggested.maxReps)
      ),
      restSeconds: parsePositiveIntInput(
        exerciseDraftSheet.restSeconds,
        suggested.restSeconds
      ),
    };
    const mode = exerciseDraftSheet.mode;
    setExerciseDraftSheet(null);

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
    setStretchDraftSheet({
      stretchId: STRETCH_LIBRARY[0]?.value ?? "dehnen",
      holdSeconds: "30",
      rounds: "2",
    });
  }

  function confirmStretchDraftChange() {
    if (!stretchDraftSheet) {
      return;
    }

    const matchingStretch =
      STRETCH_LIBRARY.find((entry) => entry.value === stretchDraftSheet.stretchId) ??
      STRETCH_LIBRARY[0] ??
      { value: "dehnen", label: "Dehnen" };
    const holdSeconds = parsePositiveIntInput(stretchDraftSheet.holdSeconds, 30);
    const rounds = parsePositiveIntInput(stretchDraftSheet.rounds, 2);
    const draft = { label: matchingStretch.label, holdSeconds, rounds };
    setStretchDraftSheet(null);

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
    setPauseDraftSheet({
      label: "Pause",
      seconds: "60",
    });
  }

  function confirmPauseDraftChange() {
    if (!pauseDraftSheet) {
      return;
    }

    const label = pauseDraftSheet.label.trim() || "Pause";
    const seconds = parsePositiveIntInput(pauseDraftSheet.seconds, 60);
    const draft = { label, seconds, scope: "exercise" as const };
    setPauseDraftSheet(null);

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

    if (action === "skipSet") {
      const targetSetIndex = isResting ? Math.min(setIndex + 1, totalSets - 1) : setIndex;
      const isWarmupSet = targetSetIndex < currentWarmupSets;
      const wouldRemoveWholeExercise = !isWarmupSet && currentExercise.sets <= 1;

      queueWorkoutChange({
        title: "Anstehenden Satz überspringen",
        description: wouldRemoveWholeExercise
          ? "Der letzte Arbeitssatz wird heute übersprungen. Dadurch endet die aktuelle Übung direkt."
          : isWarmupSet
          ? "Der aktuelle Warm-up-Satz wird entfernt. Danach läuft dein Training mit dem nächsten Satz weiter."
          : "Der aktuelle Satz wird übersprungen oder optional dauerhaft im Plan reduziert.",
        canPersist: canPersistPlanChange && !wouldRemoveWholeExercise,
        onSession: () => applySessionSkipCurrentSet(),
        onPlan:
          planId && dayId && !wouldRemoveWholeExercise
            ? () => {
                if (isWarmupSet) {
                  updateWarmupBlock(planId, dayId, currentExercise.id, {
                    rounds: Math.max(0, currentWarmupSets - 1),
                    restSeconds: currentExercise.restSeconds,
                  });
                  return;
                }

                updateTrainingExercise(planId, dayId, currentExercise.id, {
                  name: currentExercise.name,
                  sets: Math.max(1, currentExercise.sets - 1),
                  minReps: currentExercise.minReps,
                  maxReps: currentExercise.maxReps,
                  restSeconds: currentExercise.restSeconds,
                });
              }
            : undefined,
      });
      return;
    }

    queueWorkoutChange({
      title: "Satz hinzufügen",
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

  useEffect(() => {
    if (!isResting || !restEndsAt || isWorkoutPaused) {
      void clearRestNotification();
      return;
    }

    void scheduleRestNotification(getExerciseLabel(currentExercise.name), restEndsAt);
  }, [
    currentExercise.name,
    isResting,
    restEndsAt,
    isWorkoutPaused,
    appPreferences.getReadyTone,
  ]);

  async function save() {
    if (loading || isResting || isStretching || sessionId === 0 || isWorkoutPaused) {
      return;
    }

    try {
      setLoading(true);
      const savedAt = Date.now();

      await saveSet({
        exercise: currentExercise.name,
        exerciseId:
          currentExerciseReference,
        weight,
        reps,
        set: setIndex,
        sessionId,
        type: workoutType,
        planId,
        planName,
        dayId,
        dayName,
        setType: currentSetType,
      });

      setSessionSets((prev) => {
        const copy = [...prev];
        const savedSet = {
          exercise: currentExercise.name,
          exerciseId:
            currentExerciseReference,
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
          setType: currentSetType,
        };
        copy[setIndex] = savedSet;
        return copy;
      });
      setLoggedSets((prev) => [
        ...prev,
        {
          exercise: currentExercise.name,
          exerciseId:
            currentExerciseReference,
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
          setType: currentSetType,
        },
      ]);

      const nextRestEndsAt = savedAt + currentExercise.restSeconds * 1000;
      setManualRestDurationSec(null);
      setRestEndsAt(nextRestEndsAt);
      setIsResting(true);
      setSaveFeedbackVisible(true);
      window.setTimeout(() => setSaveFeedbackVisible(false), 900);
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

      setStartTime((current) => current + pausedDuration);
      setSetStartedAt((current) => current + pausedDuration);
      setRestEndsAt((current) => (current ? current + pausedDuration : current));
      setStretchEndsAt((current) => (current ? current + pausedDuration : current));
      setCurrentTime(resumedAt);
      setWorkoutPausedAt(null);
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

  const validSets = useMemo(
    () => sessionSets.filter((set): set is SetType => set !== null),
    [sessionSets]
  );
  const currentTop = useMemo(() => getTopSet(validSets), [validSets]);
  const lastTop = useMemo(() => getTopSet(lastSessionSets), [lastSessionSets]);
  const lastExerciseSessionTopSet = useMemo(
    () => getTopSet(lastExerciseSessionSets),
    [lastExerciseSessionSets]
  );
  const progress = useMemo(() => getProgress(currentTop, lastTop), [currentTop, lastTop]);
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
  const progressPercent = useMemo(() => {
    let setsBeforeCurrent = 0;
    let totalSetsInPlan = 0;
    for (let i = 0; i < workoutExercises.length; i += 1) {
      const ex = workoutExercises[i];
      const sets = ex.sets + getWarmupRoundsForExercise(workoutDayBlocks, ex.id);
      if (i < exerciseIndex) setsBeforeCurrent += sets;
      totalSetsInPlan += sets;
    }
    if (totalSetsInPlan === 0) return 0;
    return Math.round(((setsBeforeCurrent + setIndex + 1) / totalSetsInPlan) * 100);
  }, [exerciseIndex, setIndex, workoutDayBlocks, workoutExercises]);
  const restProgress = Math.max(
      0,
      Math.min(100, (remainingRestMs / (activeRestDurationSec * 1000 || 1)) * 100)
    );
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
  const lastSavedSet = useMemo(() => loggedSets[loggedSets.length - 1] ?? null, [loggedSets]);
  const previousExercise = useMemo(
    () => (exerciseIndex > 0 ? workoutExercises[exerciseIndex - 1] : null),
    [exerciseIndex, workoutExercises]
  );
  const previousExerciseSets = useMemo(
    () =>
      previousExercise
        ? loggedSets.filter(
            (set) => getLoggedSetExerciseReference(set) === getExerciseReference(previousExercise.name)
          )
        : [],
    [loggedSets, previousExercise]
  );
  const previousExerciseTopSet = useMemo(() => getTopSet(previousExerciseSets), [previousExerciseSets]);
  const currentExerciseProgress = useMemo(
    () =>
      workoutExercises[exerciseIndex]
        ? loggedSets.filter(
            (set) =>
              getLoggedSetExerciseReference(set) ===
              getExerciseReference(workoutExercises[exerciseIndex].name)
          )
        : [],
    [exerciseIndex, loggedSets, workoutExercises]
  );
  const currentExerciseHistory = useMemo(
    () =>
      validSets
        .filter((set) => getLoggedSetExerciseReference(set) === currentExerciseReference)
        .sort((a, b) => a.set - b.set),
    [currentExerciseReference, validSets]
  );
  const dayProgress = useMemo(
    () =>
      workoutExercises.map((exercise) => {
        const warmupSets = getWarmupRoundsForExercise(workoutDayBlocks, exercise.id);
        const savedSetsForExercise = loggedSets.filter(
          (set) => getLoggedSetExerciseReference(set) === getExerciseReference(exercise.name)
        );

        return {
          exercise,
          completed: savedSetsForExercise.length,
          total: exercise.sets + warmupSets,
          topSet: getTopSet(savedSetsForExercise),
          warmupSets,
        };
      }),
    [loggedSets, workoutDayBlocks, workoutExercises]
  );

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

  const referenceSet = useMemo(
    () => lastTrainingSet ?? bestMatchingSet ?? bestExerciseSet,
    [bestExerciseSet, bestMatchingSet, lastTrainingSet]
  );
  const referenceLabel = useMemo(
    () =>
      lastTrainingSet
        ? "Letztes Training"
      : bestMatchingSet
        ? "Bester Satz"
        : bestExerciseSet
        ? "Bestleistung"
        : null,
    [bestExerciseSet, bestMatchingSet, lastTrainingSet]
  );
  const currentSetLabel = getWorkoutSetLabel(
    setIndex,
    currentWarmupSets,
    currentExercise.sets
  );
  const nextExercise = useMemo(
    () => (exerciseIndex < workoutExercises.length - 1 ? workoutExercises[exerciseIndex + 1] : null),
    [exerciseIndex, workoutExercises]
  );
  const nextExerciseWarmups = useMemo(
    () => (nextExercise ? getWarmupRoundsForExercise(workoutDayBlocks, nextExercise.id) : 0),
    [nextExercise, workoutDayBlocks]
  );
  const nextExerciseStretches = useMemo(
    () => (nextExercise ? getStretchBlocksForExercise(workoutDayBlocks, nextExercise.id) : []),
    [nextExercise, workoutDayBlocks]
  );
  const nextSetFlowLabel = useMemo(
    () =>
      setIndex + 1 < totalSets
        ? getWorkoutSetLabel(setIndex + 1, currentWarmupSets, currentExercise.sets)
        : nextExercise
        ? nextExerciseStretches.length > 0
          ? `Dehnen vor ${getExerciseLabel(nextExercise.name)}`
          : `${getWorkoutSetLabel(0, nextExerciseWarmups, nextExercise.sets)} · ${getExerciseLabel(
              nextExercise.name
            )}`
        : "Auswertung",
    [
      currentExercise.sets,
      currentWarmupSets,
      nextExercise,
      nextExerciseStretches.length,
      nextExerciseWarmups,
      setIndex,
      totalSets,
    ]
  );
  const nextExerciseLabel = useMemo(() => {
    if (isWorkoutPaused) {
      return getExerciseLabel(currentExercise.name);
    }

    if (isStretching) {
      return getExerciseLabel(currentExercise.name);
    }

    if (nextExercise) {
      return getExerciseLabel(nextExercise.name);
    }

    return "Auswertung";
  }, [currentExercise.name, isStretching, isWorkoutPaused, nextExercise]);
  const flowMeta = useMemo(() => {
    const flowNowLabel = isWorkoutPaused
      ? "Training pausiert"
      : isStretching
      ? `Dehnen ${stretchIndex + 1}/${currentStretchBlocks.length}`
      : isResting
      ? "Satzpause"
      : currentSetLabel;
    const flowNowDetail = isWorkoutPaused
      ? "Timer stehen still"
      : isStretching
      ? activeStretchBlock?.label ?? "Dehnblock"
      : getExerciseLabel(currentExercise.name);
    const flowNextLabel = isWorkoutPaused
      ? isStretching
        ? "Dehnen fortsetzen"
        : isResting
        ? nextSetFlowLabel
        : currentSetLabel
      : isStretching
      ? stretchIndex + 1 < currentStretchBlocks.length
        ? `Dehnen ${stretchIndex + 2}/${currentStretchBlocks.length}`
        : currentSetLabel
      : isResting
      ? nextSetFlowLabel
      : "Satzpause";
    const flowNextDetail = isWorkoutPaused
      ? "Weiter oben fortsetzen"
      : isStretching
      ? stretchIndex + 1 < currentStretchBlocks.length
        ? currentStretchBlocks[stretchIndex + 1]?.label ?? "Nächster Dehnblock"
        : getExerciseLabel(currentExercise.name)
      : isResting
      ? "läuft automatisch weiter"
      : "startet nach dem Speichern";
    const flowStatusText = isWorkoutPaused
      ? "Timer stehen still, bis du oben fortsetzt."
      : isStretching
      ? "Dehnblock läuft gerade."
      : isResting
      ? "Pause läuft bis zum nächsten Satz."
      : "Aktiver Satz im Fokus.";

    return { flowNowLabel, flowNowDetail, flowNextLabel, flowNextDetail, flowStatusText };
  }, [
    activeStretchBlock,
    currentExercise.name,
    currentSetLabel,
    currentStretchBlocks,
    isResting,
    isStretching,
    isWorkoutPaused,
    nextSetFlowLabel,
    stretchIndex,
  ]);

  useEffect(() => {
    if (sessionId === 0) {
      return;
    }

    const stateLabel = isWorkoutPaused
      ? "Training pausiert"
      : isStretching
      ? flowMeta.flowNowLabel
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
      exerciseInstanceId: currentExercise.id,
      exerciseReference: currentExerciseReference,
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
    currentExerciseReference,
    flowMeta.flowNowLabel,
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

  const totalCompleted = useMemo(
    () => dayProgress.reduce((s, e) => s + e.completed, 0),
    [dayProgress]
  );
  const totalSetsAll = useMemo(
    () => dayProgress.reduce((s, e) => s + e.total, 0),
    [dayProgress]
  );
  const activeWeightSteps = weightSteps.includes(2.5)
    ? [primaryWeightStep, 2.5]
    : [primaryWeightStep];
  const latestCurrentExerciseSet = useMemo(
    () => (currentExerciseHistory.length > 0 ? currentExerciseHistory[currentExerciseHistory.length - 1] : null),
    [currentExerciseHistory]
  );
  const restSuggestion = useMemo(
    () =>
      latestCurrentExerciseSet === null
        ? {
            label: "Bereit",
            detail: "Starte mit einem sauberen ersten Arbeitssatz.",
            tone: "neutral" as const,
          }
        : latestCurrentExerciseSet.reps > currentExercise.maxReps
        ? {
            label: "Mehr Gewicht",
            detail: "Die letzten Wiederholungen liegen über der Zielrange.",
            tone: "up" as const,
          }
        : latestCurrentExerciseSet.reps < currentExercise.minReps
        ? {
            label: "Weniger Gewicht",
            detail: "Die letzte Leistung lag unter der Zielrange.",
            tone: "down" as const,
          }
        : {
            label: "Optimal",
            detail: "Die letzten Wiederholungen sitzen in der Zielrange.",
            tone: "good" as const,
          },
    [currentExercise.maxReps, currentExercise.minReps, latestCurrentExerciseSet]
  );
  const progressionDecision = useMemo(
    () =>
      getCoachDecisionForRange(
        currentExerciseHistory,
        currentExercise.minReps,
        currentExercise.maxReps
      ),
    [currentExercise.maxReps, currentExercise.minReps, currentExerciseHistory]
  );
  const accentSoft = toRgba(theme.accent, 0.1);
  const accentBorder = toRgba(theme.accent, 0.2);
  const accentShadow = toRgba(theme.accent, 0.18);
  const progressSoft = toRgba(theme.accent, 0.12);
  const ringTrack = toRgba(theme.accent, 0.1);
  const bestSetSummaryLabel = bestExerciseInsightLabel ?? (bestExerciseSet ? "Bestwert" : null);
  const headerBlockTypeLabel = isWorkoutPaused
    ? "Pausiert"
    : isStretching
    ? "Dehnen"
    : isResting
    ? "Satzpause"
    : setIndex < currentWarmupSets
    ? "Warm-up"
    : "Arbeitssatz";
  const headerBlockProgressLabel = isWorkoutPaused
    ? undefined
    : isStretching
    ? `${stretchIndex + 1}/${currentStretchBlocks.length}`
    : isResting
    ? undefined
    : setIndex < currentWarmupSets
    ? `${setIndex + 1}/${currentWarmupSets}`
    : `${setIndex - currentWarmupSets + 1}/${currentExercise.sets}`;
  const currentContextTargetLabel = isWorkoutPaused
    ? `Weiter mit ${flowMeta.flowNowLabel}`
    : isStretching
    ? `${activeStretchBlock?.holdSeconds ?? 0} Sek halten · ${activeStretchBlock?.rounds ?? 0} Runden`
    : isResting
    ? `Nächster Satz: ${flowMeta.flowNextLabel}`
    : `${currentExercise.minReps}–${currentExercise.maxReps} Wdh. · ${formatRest(activeRestDurationSec)}`;
  const currentBlockHeadline = headerBlockProgressLabel
    ? `${headerBlockTypeLabel} ${headerBlockProgressLabel}`
    : headerBlockTypeLabel;
  const nextContextLabel = isWorkoutPaused
    ? `Weiter mit ${nextExerciseLabel}`
    : nextExerciseLabel;
  const activeSetRecommendationTone =
    restSuggestion.tone === "good"
      ? restSuggestionGood
      : restSuggestion.tone === "up"
      ? restSuggestionUp
      : restSuggestion.tone === "down"
      ? restSuggestionDown
      : restSuggestionNeutral;
  const pauseButtonLabel = isWorkoutPaused ? "▶ Weiter" : "⏸ Pause";
  const progressExerciseName = getExerciseLabel(currentExercise.name).toUpperCase();
  const renderExerciseInsightCards = (dense = false) => (
    <div style={compareSection}>
      <div style={compareGrid}>
        <AppCard
          variant="theme"
          accentColor={theme.accent}
          interactive={lastExerciseSessionSets.length > 0}
          style={{ ...insightCard, ...(compactMode || dense ? compactInsightCard : null) }}
          onClick={() => {
            if (lastExerciseSessionSets.length > 0) {
              setShowLastTrainingSheet(true);
            }
          }}
        >
          <div style={compareCardTop}>
            <span style={{ ...compareIcon, color: theme.accent }}>🗓️</span>
            <AppBadge variant={getInsightBadgeVariant("last")} style={insightBadge}>
              Letztes Training
            </AppBadge>
          </div>
          <div style={compareMeta}>
            {lastExerciseSessionSets[0]
              ? formatDate(lastExerciseSessionSets[0].timestamp)
              : "Noch kein letztes Training"}
          </div>
          <div style={compactInsightValue}>
            {lastExerciseSessionTopSet
              ? `${formatWeight(lastExerciseSessionTopSet.weight)} kg × ${formatReps(
                  lastExerciseSessionTopSet.reps
                )}`
              : "—"}
          </div>
          <div style={insightMetaRow}>
            <span
              style={{
                ...compactInsightPill,
                color:
                  lastExerciseSessionSets.length > 0
                    ? theme.accent
                    : appPalette.textMuted,
                background:
                  lastExerciseSessionSets.length > 0
                    ? toRgba(theme.accent, 0.1)
                    : appPalette.surfaceMuted,
              }}
            >
              {lastExerciseSessionSets.length > 0
                ? `${lastExerciseSessionSets.length} Sätze`
                : "noch leer"}
            </span>
            {lastExerciseSessionSets.length > 0 ? (
              <span style={insightActionHint}>Tippen für Verlauf</span>
            ) : null}
          </div>
          {exerciseTrendInsight ? (
            <div style={insightSupportText}>
              {exerciseTrendInsight.label} · {exerciseTrendInsight.detail}
            </div>
          ) : null}
        </AppCard>
        <AppCard
          variant="theme"
          accentColor={theme.accent}
          style={{ ...insightCard, ...(compactMode || dense ? compactInsightCard : null) }}
        >
          <div style={compareCardTop}>
            <span style={{ ...compareIcon, color: theme.accent }}>🏆</span>
            <AppBadge variant={getInsightBadgeVariant("best")} style={insightBadge}>
              Deine Bestleistung
            </AppBadge>
          </div>
          <div style={compareMeta}>
            {bestExerciseSet ? formatDate(bestExerciseSet.timestamp) : "Noch keine Bestleistung"}
          </div>
          <div style={compactInsightValue}>
            {bestExerciseSet
              ? `${formatWeight(bestExerciseSet.weight)} kg × ${formatReps(bestExerciseSet.reps)}`
              : "—"}
          </div>
            <div style={insightMetaRow}>
              <span
                style={{
                  ...compactInsightPill,
                  color: theme.accent,
                background: toRgba(theme.accent, 0.1),
              }}
              >
                {bestSetSummaryLabel ?? "baut sich auf"}
              </span>
            </div>
            {bestExerciseSet && bestExerciseInsightDetail ? (
              <div style={insightSupportText}>{bestExerciseInsightDetail}</div>
            ) : null}
          </AppCard>
      </div>
    </div>
  );
  const renderFlowContextPanel = (
    badgeLabel?: string,
    badgeStyle?: CSSProperties | null,
    dense = false
  ) => (
    <div
      style={{
        ...restContextPanel,
        ...(dense ? compactRestContextPanel : null),
        border: `1px solid ${accentBorder}`,
        background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.96)} 0%, ${toRgba(
          theme.accent,
          0.04
        )} 100%)`,
      }}
    >
      <div style={restContextContent}>
        <div style={restContextColumn}>
          <div style={restContextLabel}>Jetzt</div>
          <div style={restContextValue}>{flowMeta.flowNowLabel}</div>
          <div style={restContextSubline}>{flowMeta.flowNowDetail}</div>
        </div>
        <div style={restContextColumn}>
          <div style={restContextLabel}>Danach</div>
          <div style={restContextValue}>{flowMeta.flowNextLabel}</div>
          <div style={restContextSubline}>{flowMeta.flowNextDetail}</div>
        </div>
      </div>
      <div style={restContextMetaStack}>
        <div style={restContextStatus}>{flowMeta.flowStatusText}</div>
        {referenceSet ? (
          <div
            style={{
              ...restDeltaHint,
              color: getDeltaToneColor(weight, reps, referenceSet, theme),
            }}
          >
            Aktuell {formatComparisonDelta(weight, reps, referenceSet)} ·{" "}
            {getComparisonEncouragement(weight, reps, referenceSet)}
          </div>
        ) : null}
        {exerciseSuggestion ? (
          <div style={{ ...suggestionHint, ...(dense ? compactSuggestionHint : null) }}>
            <strong>{exerciseSuggestion.label}</strong>
            <span>{exerciseSuggestion.detail}</span>
          </div>
        ) : null}
        <div
          style={{
            ...restDeltaHint,
            color: getCoachToneColor(progressionDecision.action, theme),
          }}
        >
          Coach: {progressionDecision.label}
        </div>
        <div style={restCoachDetail}>{progressionDecision.detail}</div>
        {exerciseTrendInsight ? (
          <div style={restCoachDetail}>
            Trend: {exerciseTrendInsight.label} · {exerciseTrendInsight.detail}
          </div>
        ) : null}
      </div>
      {badgeLabel ? (
        <span
          style={{
            ...restSuggestionBadge,
            ...(badgeStyle ?? null),
          }}
        >
          {badgeLabel}
        </span>
      ) : null}
    </div>
  );
  const navigateHome = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/index.html");
      return;
    }
    router.push("/index.html");
  };
  const handleGoHome = () => {
    navigateHome();
  };

  const handleFinishWorkout = () => {
    setShowExitSheet(false);
    void stopRestOverlay();
    void setRestOverlayState(false);
    void clearRestNotification();
    navigateToSummary(router, sessionId);
  };

  async function handleAbortWorkout() {
    setShowExitSheet(false);
    void stopRestOverlay();
    void setRestOverlayState(false);
    await clearRestNotification();
    await deleteWorkoutSession(sessionId);
    clearActiveWorkoutState();
    navigateHome();
  }

  const handleOpenStopSheet = () => {
    if (sessionId === 0) {
      navigateHome();
      return;
    }

    setShowExitSheet(true);
  };

  return (
    <div
      style={{
        ...screen,
        background: `linear-gradient(180deg, ${appPalette.surfaceDark} 0px, ${appPalette.surfaceDark} calc(env(safe-area-inset-top) + 56px), ${theme.background} calc(env(safe-area-inset-top) + 56px), ${theme.background} 100%)`,
      }}
    >
      <div
        style={{
          ...card,
          ...(compactMode ? compactCard : null),
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <WorkoutStatusHeader
          theme={{ primary: theme.accent, soft: theme.badgeBackground, dark: theme.screenBadge }}
          onHome={handleGoHome}
          onPause={() => void toggleWorkoutPause()}
          onStop={handleOpenStopSheet}
          elapsedLabel={workoutDuration}
          exerciseIndex={exerciseIndex + 1}
          exerciseTotal={workoutExercises.length}
          progressPercent={progressPercent}
          exerciseName={progressExerciseName}
          nextLabel={nextContextLabel}
          pauseLabel={pauseButtonLabel}
          compact={compactMode}
        />

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
                background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.98)} 0%, ${toRgba(
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
                {(activeStretchBlock?.label ?? "Dehnen") + " / " + currentBlockHeadline}
              </div>
              <div style={{ fontSize: compactMode ? 13 : 15, color: appPalette.textMuted, fontWeight: 700 }}>
                {activeStretchBlock
                  ? `${activeStretchBlock.holdSeconds} Sek · ${activeStretchBlock.rounds} Runde${
                      activeStretchBlock.rounds > 1 ? "n" : ""
                    }`
                  : ""}
              </div>
            </div>

            <div style={stretchFocusStage}>
              <div style={restTimerWrap}>
                <ProgressRing
                  totalSeconds={getStretchDurationSeconds(activeStretchBlock)}
                  remainingSeconds={stretchTime}
                  color={theme.accent}
                  size={compactMode ? 188 : 236}
                  strokeWidth={compactMode ? 10 : 13}
                  label="Dehnen"
                  subLabel={formatRest(getStretchDurationSeconds(activeStretchBlock))}
                  valueText={
                    visualStretchCountdown
                      ? String(visualStretchCountdown).padStart(2, "0")
                      : formatRestTimer(stretchTime)
                  }
                  pulse={appPreferences.progressAnimations}
                />
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

              {renderFlowContextPanel(
                activeStretchBlock
                  ? `Runde ${Math.min(stretchIndex + 1, currentStretchBlocks.length)} von ${currentStretchBlocks.length}`
                  : "Mobil bleiben",
                {
                  color: theme.accent,
                  background: toRgba(theme.accent, 0.1),
                },
                compactMode
              )}
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
                  ...(compactMode
                    ? {
                        minHeight: 42,
                        fontSize: 14,
                        padding: "10px 14px",
                      }
                    : null),
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
            {renderExerciseInsightCards()}

            <div
              style={{
                ...exerciseCard,
                ...(compactMode ? compactExerciseCard : null),
                background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.98)} 0%, ${toRgba(
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
                    {getExerciseLabel(currentExercise.name)} / {currentBlockHeadline}
                  </h1>
                  <div style={exerciseCardMeta}>
                    <span>{currentContextTargetLabel}</span>
                  </div>
                </div>
              </div>

              {renderFlowContextPanel(
                referenceLabel
                  ? `${referenceLabel}: ${
                      referenceSet
                        ? `${formatWeight(referenceSet.weight)} kg × ${formatReps(referenceSet.reps)}`
                        : "—"
                    }`
                  : undefined,
                referenceLabel
                  ? {
                      color: theme.accent,
                      background: toRgba(theme.accent, 0.1),
                    }
                  : null,
                compactMode
              )}

              <div style={exerciseInputStage}>
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
                    <button
                      type="button"
                      style={{
                        ...weightBox,
                        ...(compactMode ? compactWeightBox : null),
                        appearance: "none",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                      onClick={() => openManualEntry("weight")}
                    >
                      {displayedWeight}
                      <span style={weightUnit}>kg</span>
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
                    <button
                      type="button"
                      key={repsFeedbackTick}
                      style={{
                        ...repsValueCard,
                        ...(compactMode ? compactRepsValueCard : null),
                        appearance: "none",
                        background: appPalette.surface,
                        cursor: "pointer",
                        ...(repsFeedbackDirection
                          ? {
                              transform: repsFeedbackDirection === "up" ? "scale(1.03)" : "scale(0.985)",
                              boxShadow:
                                repsFeedbackDirection === "up"
                                  ? `0 16px 30px ${accentSoft}`
                                  : `0 10px 22px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
                              borderColor: toRgba(theme.accent, 0.26),
                            }
                          : null),
                      }}
                      onClick={() => openManualEntry("reps")}
                    >
                      <div style={{ ...repsValueMeta, ...(compactMode ? compactRepsValueMeta : null) }}>
                        Aktueller Satz
                      </div>
                      <div style={{ ...repsValueNumber, ...(compactMode ? compactRepsValueNumber : null) }}>
                        {formatReps(reps)}
                      </div>
                    </button>
                    <button style={{ ...repsRoundButton, ...(compactMode ? compactRepsRoundButton : null), color: theme.accent, border: `1px solid ${accentBorder}`, boxShadow: `0 8px 20px ${accentSoft}` }} onClick={() => handleRepsChange(0.5)}>+</button>
                  </div>
                </div>
              </div>
            </div>
              <div style={bottomActionDock}>
               <button
                style={{
                  ...saveBarButton,
                  ...(compactMode ? compactSaveBarButton : null),
                  background: saveFeedbackVisible
                    ? `linear-gradient(180deg, ${lightenColor(appPalette.success, 0.08)} 0%, ${appPalette.success} 100%)`
                    : `linear-gradient(180deg, ${lightenColor(theme.accent, 0.08)} 0%, ${theme.accent} 100%)`,
                  boxShadow: saveFeedbackVisible
                    ? `0 20px 34px ${withAlpha(appPalette.success, 0.28)}`
                    : `0 20px 34px ${accentShadow}`,
                }}
                onClick={save}
              >
                {saveFeedbackVisible ? "✓ Gespeichert" : "⊙ Satz speichern"}
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
                background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.98)} 0%, ${toRgba(
                  theme.accent,
                  0.03
                )} 100%)`,
                border: `1px solid ${accentBorder}`,
                boxShadow: `0 10px 26px ${accentSoft}`,
              }}
            >
              <div style={restHistoryTop}>
                <span style={restHistoryLabel}>Bisherige Sätze</span>
                <button
                  type="button"
                  style={{
                    ...restHistoryToggle,
                    color: theme.accent,
                    border: `1px solid ${accentBorder}`,
                    background: progressSoft,
                  }}
                  onClick={() => setRestHistoryExpanded((current) => !current)}
                >
                  {restHistoryExpanded ? "▾" : "▸"}
                </button>
              </div>
              {restHistoryExpanded ? (
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
                          <button
                            type="button"
                            style={{
                              ...restHistoryEditButton,
                              color: theme.accent,
                              background: progressSoft,
                              border: `1px solid ${accentBorder}`,
                            }}
                            onClick={() => openSetEditor(set)}
                          >
                            ✏️
                          </button>
                        </div>
                      ))
                  ) : (
                    <div style={restHistoryEmpty}>Noch kein Satz gespeichert</div>
                  )}
                </div>
              ) : (
                <div style={restHistoryCollapsedHint}>
                  {currentExerciseHistory.length > 0
                    ? `${currentExerciseHistory.length} Sätze gespeichert`
                    : "Noch kein Satz gespeichert"}
                </div>
              )}
              <div style={restHistoryActions}>
                <button
                  style={{ ...restHistoryButton, color: theme.accent, border: `1px solid ${accentBorder}` }}
                  onClick={() => setShowPlanModal(true)}
                >
                  Alle Sätze anzeigen
                </button>
              </div>
            </div>

            <div style={restFocusStage}>
              <div style={restTimerWrap}>
                <ProgressRing
                  totalSeconds={activeRestDurationSec}
                  remainingSeconds={restTime}
                  color={theme.accent}
                  size={compactMode ? 188 : 236}
                  strokeWidth={compactMode ? 10 : 13}
                  label="Pause"
                  subLabel={formatRest(activeRestDurationSec)}
                  valueText={
                    visualCountdown
                      ? String(visualCountdown).padStart(2, "0")
                      : formatRestTimer(restTime)
                  }
                  pulse={appPreferences.progressAnimations}
                />
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
              {renderFlowContextPanel(
                restSuggestion.label,
                activeSetRecommendationTone,
                true
              )}
              {renderExerciseInsightCards(true)}
              <div style={restWeightSection}>
                <div style={restWeightLabel}>Nächster Satz</div>
                <div style={{ ...restWeightValueLarge, ...(compactMode ? compactRestWeightValueLarge : null) }}>
                  {displayedWeight}
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
          <BottomSheet open={showAdjustSheet} onClose={() => setShowAdjustSheet(false)} style={workoutSheet}>
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
                <button style={adjustListButton} onClick={() => handleAdjustAction("skipSet")}>
                  <span style={adjustListIcon}>↷</span>
                  <span>
                    <div style={adjustListLabel}>Anstehenden Satz überspringen</div>
                    <div style={adjustListHint}>Satz für heute oder dauerhaft reduzieren</div>
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
                    <div style={adjustListLabel}>Satz hinzufügen</div>
                    <div style={adjustListHint}>Einen weiteren Arbeitssatz anhängen</div>
                  </span>
                </button>
              </div>
          </BottomSheet>
        ) : null}

        {exerciseDraftSheet ? (
          <BottomSheet
            open={Boolean(exerciseDraftSheet)}
            onClose={() => setExerciseDraftSheet(null)}
            style={workoutSheet}
          >
            <div style={workoutSheetHeader}>
              <div>
                <div style={workoutSheetEyebrow}>Workout</div>
                <div style={workoutSheetTitle}>
                  {exerciseDraftSheet.mode === "replace" ? "Übung ersetzen" : "Übung hinzufügen"}
                </div>
              </div>
              <button style={workoutSheetClose} onClick={() => setExerciseDraftSheet(null)}>
                ×
              </button>
            </div>
            <div style={manualEntrySheetBody}>
              <input
                value={exerciseDraftSheet.name}
                onChange={(event) =>
                  setExerciseDraftSheet(
                    buildExerciseDraftSheetState(
                      exerciseDraftSheet.mode,
                      event.target.value
                    )
                  )
                }
                placeholder="Übungsname"
                style={sheetField}
              />
              <div style={sheetFieldGrid}>
                <input
                  inputMode="numeric"
                  value={exerciseDraftSheet.sets}
                  onChange={(event) =>
                    setExerciseDraftSheet((current) =>
                      current ? { ...current, sets: event.target.value } : current
                    )
                  }
                  placeholder="Sätze"
                  style={sheetField}
                />
                <input
                  inputMode="numeric"
                  value={exerciseDraftSheet.restSeconds}
                  onChange={(event) =>
                    setExerciseDraftSheet((current) =>
                      current ? { ...current, restSeconds: event.target.value } : current
                    )
                  }
                  placeholder="Pause (Sek.)"
                  style={sheetField}
                />
              </div>
              <div style={sheetFieldGrid}>
                <input
                  inputMode="numeric"
                  value={exerciseDraftSheet.minReps}
                  onChange={(event) =>
                    setExerciseDraftSheet((current) =>
                      current ? { ...current, minReps: event.target.value } : current
                    )
                  }
                  placeholder="Min. Wdh."
                  style={sheetField}
                />
                <input
                  inputMode="numeric"
                  value={exerciseDraftSheet.maxReps}
                  onChange={(event) =>
                    setExerciseDraftSheet((current) =>
                      current ? { ...current, maxReps: event.target.value } : current
                    )
                  }
                  placeholder="Max. Wdh."
                  style={sheetField}
                />
              </div>
              <div style={manualEntryHint}>
                Passe die Werte an und übernimm die Änderung danach für diese Session oder optional dauerhaft in den Plan.
              </div>
              <div style={manualEntryActions}>
                <AppButton variant="secondary" onClick={() => setExerciseDraftSheet(null)} style={{ flex: 1 }}>
                  Abbrechen
                </AppButton>
                <AppButton
                  variant="primary"
                  onClick={confirmExerciseDraftChange}
                  style={{ flex: 1 }}
                  disabled={!exerciseDraftSheet.name.trim()}
                >
                  Weiter
                </AppButton>
              </div>
            </div>
          </BottomSheet>
        ) : null}

        {stretchDraftSheet ? (
          <BottomSheet
            open={Boolean(stretchDraftSheet)}
            onClose={() => setStretchDraftSheet(null)}
            style={workoutSheet}
          >
            <div style={workoutSheetHeader}>
              <div>
                <div style={workoutSheetEyebrow}>Workout</div>
                <div style={workoutSheetTitle}>Dehnen hinzufügen</div>
              </div>
              <button style={workoutSheetClose} onClick={() => setStretchDraftSheet(null)}>
                ×
              </button>
            </div>
            <div style={manualEntrySheetBody}>
              <select
                value={stretchDraftSheet.stretchId}
                onChange={(event) =>
                  setStretchDraftSheet((current) =>
                    current ? { ...current, stretchId: event.target.value } : current
                  )
                }
                style={sheetField}
              >
                {STRETCH_LIBRARY.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <div style={sheetFieldGrid}>
                <input
                  inputMode="numeric"
                  value={stretchDraftSheet.holdSeconds}
                  onChange={(event) =>
                    setStretchDraftSheet((current) =>
                      current ? { ...current, holdSeconds: event.target.value } : current
                    )
                  }
                  placeholder="Dauer (Sek.)"
                  style={sheetField}
                />
                <input
                  inputMode="numeric"
                  value={stretchDraftSheet.rounds}
                  onChange={(event) =>
                    setStretchDraftSheet((current) =>
                      current ? { ...current, rounds: event.target.value } : current
                    )
                  }
                  placeholder="Runden"
                  style={sheetField}
                />
              </div>
              <div style={manualEntryActions}>
                <AppButton variant="secondary" onClick={() => setStretchDraftSheet(null)} style={{ flex: 1 }}>
                  Abbrechen
                </AppButton>
                <AppButton variant="primary" onClick={confirmStretchDraftChange} style={{ flex: 1 }}>
                  Weiter
                </AppButton>
              </div>
            </div>
          </BottomSheet>
        ) : null}

        {pauseDraftSheet ? (
          <BottomSheet
            open={Boolean(pauseDraftSheet)}
            onClose={() => setPauseDraftSheet(null)}
            style={workoutSheet}
          >
            <div style={workoutSheetHeader}>
              <div>
                <div style={workoutSheetEyebrow}>Workout</div>
                <div style={workoutSheetTitle}>Pause hinzufügen</div>
              </div>
              <button style={workoutSheetClose} onClick={() => setPauseDraftSheet(null)}>
                ×
              </button>
            </div>
            <div style={manualEntrySheetBody}>
              <input
                value={pauseDraftSheet.label}
                onChange={(event) =>
                  setPauseDraftSheet((current) =>
                    current ? { ...current, label: event.target.value } : current
                  )
                }
                placeholder="Name der Pause"
                style={sheetField}
              />
              <input
                inputMode="numeric"
                value={pauseDraftSheet.seconds}
                onChange={(event) =>
                  setPauseDraftSheet((current) =>
                    current ? { ...current, seconds: event.target.value } : current
                  )
                }
                placeholder="Dauer in Sekunden"
                style={sheetField}
              />
              <div style={manualEntryActions}>
                <AppButton variant="secondary" onClick={() => setPauseDraftSheet(null)} style={{ flex: 1 }}>
                  Abbrechen
                </AppButton>
                <AppButton variant="primary" onClick={confirmPauseDraftChange} style={{ flex: 1 }}>
                  Weiter
                </AppButton>
              </div>
            </div>
          </BottomSheet>
        ) : null}

        {showExitSheet ? (
          <BottomSheet open={showExitSheet} onClose={() => setShowExitSheet(false)} style={workoutSheet}>
            <div style={workoutSheetHeader}>
                <div>
                  <div style={workoutSheetEyebrow}>Training</div>
                  <div style={workoutSheetTitle}>Training stoppen</div>
                </div>
              <button style={workoutSheetClose} onClick={() => setShowExitSheet(false)}>
                ×
              </button>
            </div>
            <div style={confirmBodyText}>
              Das `X` stoppt dein Training bewusst. Du kannst direkt weitermachen, die Session
              regulär beenden oder das aktuelle Training komplett abbrechen.
            </div>
            <div style={adjustList}>
              <button style={adjustListButton} onClick={() => setShowExitSheet(false)}>
                <span style={adjustListIcon}>▶</span>
                <span>
                  <div style={adjustListLabel}>Weitertrainieren</div>
                  <div style={adjustListHint}>Im aktuellen Workout bleiben.</div>
                </span>
              </button>
              <button style={adjustListButton} onClick={handleFinishWorkout}>
                <span style={adjustListIcon}>✓</span>
                <span>
                  <div style={adjustListLabel}>Training beenden</div>
                  <div style={adjustListHint}>Zur Auswertung wechseln und die Session behalten.</div>
                </span>
              </button>
              <button
                style={{
                  ...adjustListButton,
                  border: "1px solid rgba(239, 68, 68, 0.18)",
                  background:
                    "linear-gradient(180deg, rgba(254, 242, 242, 0.96) 0%, rgba(255,255,255,0.96) 100%)",
                }}
                onClick={() => void handleAbortWorkout()}
              >
                <span style={{ ...adjustListIcon, color: appPalette.danger }}>✕</span>
                <span>
                  <div style={{ ...adjustListLabel, color: appPalette.danger }}>Training abbrechen</div>
                  <div style={adjustListHint}>
                    Die laufende Session und der Fortsetzen-Status werden verworfen.
                  </div>
                </span>
              </button>
            </div>
          </BottomSheet>
        ) : null}

        {showLastTrainingSheet ? (
          <BottomSheet
            open={showLastTrainingSheet}
            onClose={() => setShowLastTrainingSheet(false)}
            style={workoutSheet}
          >
            <div style={workoutSheetHeader}>
              <div>
                <div style={workoutSheetEyebrow}>Übungshistorie</div>
                <div style={workoutSheetTitle}>Letztes Training</div>
              </div>
              <button style={workoutSheetClose} onClick={() => setShowLastTrainingSheet(false)}>
                ×
              </button>
            </div>
            <div style={historySheetMeta}>
              <div style={historySheetExercise}>{getExerciseLabel(currentExercise.name)}</div>
              <div style={historySheetDate}>
                {recentExerciseSessions.length > 0
                  ? `${recentExerciseSessions.length} letzte Einheiten`
                  : "Noch kein vorheriges Training"}
              </div>
            </div>
            <div style={historySheetList}>
              {recentExerciseSessions.length > 0 ? (
                recentExerciseSessions.map((sessionSets, sessionIndex) => (
                  <div
                    key={`history-session-${sessionSets[0]?.sessionId ?? sessionIndex}`}
                    style={historySheetSessionCard}
                  >
                    <div style={historySheetSessionHeader}>
                      <div style={historySheetSessionTitle}>
                        {sessionIndex === 0 ? "Letzte Einheit" : `${sessionIndex + 1}. letzte Einheit`}
                      </div>
                      <div style={historySheetSessionDate}>
                        {sessionSets[0] ? formatDate(sessionSets[0].timestamp) : ""}
                      </div>
                    </div>
                    <div style={historySheetSessionRows}>
                      {sessionSets
                        .slice()
                        .sort((a, b) => a.set - b.set)
                        .map((set) => (
                          <div
                            key={`history-${set.sessionId}-${set.timestamp}-${set.set}`}
                            style={historySheetRow}
                          >
                            <div style={historySheetRowLabel}>
                              {getSetLabelForExercise(
                                set.set,
                                currentWarmupSets,
                                currentExercise.sets
                              )}
                            </div>
                            <div style={historySheetRowValue}>
                              {formatWeight(set.weight)} kg × {formatReps(set.reps)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={historySheetEmpty}>
                  Für diese Übung gibt es noch keine frühere Einheit.
                </div>
              )}
            </div>
          </BottomSheet>
        ) : null}

        {manualEntryMode ? (
          <BottomSheet
            open={Boolean(manualEntryMode)}
            onClose={() => {
              setManualEntryMode(null);
              setManualEntryValue("");
            }}
            style={workoutSheet}
          >
            <div style={workoutSheetHeader}>
              <div>
                <div style={workoutSheetEyebrow}>Manuelle Eingabe</div>
                <div style={workoutSheetTitle}>
                  {manualEntryMode === "weight" ? "Gewicht eingeben" : "Wiederholungen eingeben"}
                </div>
              </div>
              <button
                style={workoutSheetClose}
                onClick={() => {
                  setManualEntryMode(null);
                  setManualEntryValue("");
                }}
              >
                ×
              </button>
            </div>
            <div style={manualEntrySheetBody}>
              <div style={manualEntryWheelHeader}>
                <div style={manualEntryWheelValue}>
                  {manualEntryMode === "weight"
                    ? `${formatWeight(selectedManualWeight)} kg`
                    : `${formatReps(selectedManualReps)} Wdh.`}
                </div>
                <div style={manualEntryWheelMeta}>
                  {manualEntryMode === "weight" ? "0,25-kg Schritte" : "1er Schritte"}
                </div>
              </div>
              <WheelPicker
                ariaLabel={
                  manualEntryMode === "weight"
                    ? "Gewicht wählen"
                    : "Wiederholungen wählen"
                }
                items={
                  manualEntryMode === "weight"
                    ? manualWeightOptions
                    : manualRepsOptions
                }
                selectedValue={
                  manualEntryMode === "weight"
                    ? selectedManualWeight
                    : selectedManualReps
                }
                onChange={(value) =>
                  setManualEntryValue(
                    (manualEntryMode === "weight"
                      ? formatWeight(value)
                      : formatReps(value)
                    ).replace(".", ",")
                  )
                }
              />
              <div style={manualEntryHint}>
                {manualEntryMode === "weight"
                  ? "Mit dem Rad stellst du dein Gewicht in präzisen 0,25-kg-Schritten ein."
                  : "Mit dem Rad wählst du die Wiederholungen in klaren Einerschritten."}
              </div>
              <div style={manualEntryActions}>
                <AppButton
                  variant="secondary"
                  onClick={() => {
                    setManualEntryMode(null);
                    setManualEntryValue("");
                  }}
                  style={{ flex: 1 }}
                >
                  Abbrechen
                </AppButton>
                <AppButton variant="primary" onClick={confirmManualEntry} style={{ flex: 1 }}>
                  Übernehmen
                </AppButton>
              </div>
            </div>
          </BottomSheet>
        ) : null}

        {editableSet ? (
          <BottomSheet
            open={Boolean(editableSet)}
            onClose={() => setEditableSet(null)}
            style={workoutSheet}
          >
            <div style={workoutSheetHeader}>
              <div>
                <div style={workoutSheetEyebrow}>Gespeicherter Satz</div>
                <div style={workoutSheetTitle}>Satz bearbeiten</div>
              </div>
              <button style={workoutSheetClose} onClick={() => setEditableSet(null)}>
                ×
              </button>
            </div>
            <div style={manualEntrySheetBody}>
              <input
                inputMode="decimal"
                value={editableSet.weight}
                onChange={(event) =>
                  setEditableSet((current) =>
                    current ? { ...current, weight: event.target.value } : current
                  )
                }
                placeholder="Gewicht"
                style={manualEntryField}
              />
              <input
                inputMode="decimal"
                value={editableSet.reps}
                onChange={(event) =>
                  setEditableSet((current) =>
                    current ? { ...current, reps: event.target.value } : current
                  )
                }
                placeholder="Wiederholungen"
                style={manualEntryField}
              />
              <div style={manualEntryActions}>
                <AppButton variant="danger" onClick={() => void deleteEditedSet()} style={{ flex: 1 }}>
                  Löschen
                </AppButton>
                <AppButton variant="primary" onClick={() => void saveEditedSet()} style={{ flex: 1 }}>
                  Speichern
                </AppButton>
              </div>
            </div>
          </BottomSheet>
        ) : null}

        {pendingWorkoutChange ? (
          <BottomSheet
            open={Boolean(pendingWorkoutChange)}
            onClose={() => setPendingWorkoutChange(null)}
            style={workoutSheet}
          >
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
                <AppButton
                  variant="secondary"
                  block
                  style={confirmActionButton}
                  onClick={() => setPendingWorkoutChange(null)}
                >
                  Abbrechen
                </AppButton>
                <AppButton
                  variant="primary"
                  block
                  style={confirmActionButton}
                  onClick={confirmPendingWorkoutChange}
                >
                  Übernehmen
                </AppButton>
              </div>
          </BottomSheet>
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
                        .filter(
                          (set) =>
                            getLoggedSetExerciseReference(set) ===
                            getExerciseReference(entry.exercise.name)
                        )
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
                      {loggedSets.filter(
                        (set) =>
                          getLoggedSetExerciseReference(set) ===
                          getExerciseReference(entry.exercise.name)
                      ).length === 0 ? (
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
  alignItems: "stretch",
  height: "100dvh",
  overflow: "hidden" as const,
  padding: "calc(env(safe-area-inset-top) + 8px) 0 calc(env(safe-area-inset-bottom) + 10px)",
  background: appChromeBackground,
  boxSizing: "border-box" as const,
};

const card = {
  width: "100%",
  maxWidth: 430,
  height: "100%",
  borderRadius: 24,
  padding: "8px 8px 6px",
  background: withAlpha(appPalette.surface, 0.96),
  backdropFilter: "blur(14px)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
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
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
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
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderDefault}`,
  color: appPalette.textStrong,
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
  color: appPalette.textMuted,
  background: appPalette.surfaceMuted,
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
};

const planButton = {
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
};

const modalOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: withAlpha(appPalette.surfaceDark, 0.45),
  zIndex: 100,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

const modalSheet = {
  width: "100%",
  maxWidth: 430,
  maxHeight: "78dvh",
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  borderRadius: "24px 24px 0 0",
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden" as const,
};

const modalHeader = {
  display: "flex",
  alignItems: "center",
  padding: "14px 16px 10px",
  borderBottom: `1px solid ${appPalette.borderSoft}`,
  gap: 8,
  flexShrink: 0,
};

const modalTitle = {
  fontSize: 15,
  fontWeight: "bold",
  color: appPalette.textStrong,
  flex: 1,
};

const modalMeta = {
  fontSize: 12,
  color: appPalette.textMuted,
  fontWeight: "600",
};

const modalClose = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "none",
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
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
  background: appPalette.surfaceMuted,
  border: "1px solid transparent",
};

const modalItemActive = {
  background: withAlpha("#2563eb", 0.12),
  border: `1px solid ${withAlpha("#2563eb", 0.28)}`,
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
  color: appPalette.textStrong,
  display: "block",
  whiteSpace: "nowrap" as const,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
};

const modalItemMeta = {
  fontSize: 11,
  color: appPalette.textMuted,
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
  color: appPalette.textMuted,
  fontWeight: "bold",
};

const modalDot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: appPalette.borderDefault,
  border: "1px solid transparent",
};

const modalDotDone = {
  background: appPalette.success,
};

const modalSetList = {
  display: "grid",
  gap: 6,
  marginTop: 10,
  paddingTop: 10,
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const modalSetRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  borderRadius: 10,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
};

const modalSetLabel = {
  fontSize: 12,
  fontWeight: "bold",
  color: appPalette.textMuted,
};

const modalSetValue = {
  fontSize: 13,
  fontWeight: "bold",
  color: appPalette.textStrong,
};

const modalSetEmpty = {
  padding: "8px 2px 2px",
  fontSize: 12,
  color: appPalette.textSoft,
};

const pausedBanner = {
  padding: "8px 12px",
  borderRadius: 12,
  background: withAlpha(appPalette.warning, 0.12),
  border: `1px solid ${withAlpha(appPalette.warning, 0.28)}`,
  color: appPalette.warning,
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
  color: appPalette.borderDefault,
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
  color: appPalette.textDefault,
  alignItems: "center",
};

const exerciseInfoDot = {
  color: appPalette.borderDefault,
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

const flowBadge = {
  minHeight: 28,
  padding: "0 10px",
  fontSize: 10,
  letterSpacing: 0.8,
  textTransform: "uppercase" as const,
};

const flowValue = {
  fontSize: 13,
  lineHeight: 1.3,
  color: appPalette.textStrong,
  fontWeight: 800,
  textAlign: "right" as const,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "flex-end",
  gap: 2,
};

const flowSubValue = {
  fontSize: 10,
  lineHeight: 1.2,
  color: appPalette.textSoft,
  fontWeight: 700,
};

const flowDivider = {
  height: 1,
  background: withAlpha(appPalette.borderDefault, 0.7),
};

const flowHelper = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  fontWeight: 600,
};

const title = {
  fontSize: 34,
  fontWeight: 800,
  lineHeight: 1.02,
  margin: 0,
};

const activeStack = {
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: 8,
  minHeight: 0,
  flex: 1,
};

const compareSection = {
  display: "grid",
  gap: 6,
  flexShrink: 0,
};

const compareGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  alignItems: "stretch" as const,
};

const insightCard = {
  minHeight: 92,
  padding: "10px 11px",
  borderRadius: 18,
  background: withAlpha(appPalette.surface, 0.92),
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: `0 10px 20px ${withAlpha(appPalette.surfaceDark, 0.03)}`,
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between" as const,
  gap: 6,
  minWidth: 0,
};

const compareCardTop = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const compareIcon = {
  fontSize: 11,
};

const insightBadge = {
  minHeight: 22,
  padding: "0 9px",
  fontSize: 9,
  letterSpacing: 0.6,
  textTransform: "uppercase" as const,
};

const insightValue = {
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const compactInsightValue = {
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const insightMetaRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 6,
};

const compactInsightPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const compareHeroValue = {
  fontSize: 15,
  lineHeight: 1,
  fontWeight: "bold",
  color: appPalette.textStrong,
};

const insightDescription = {
  fontSize: 10,
  lineHeight: 1.25,
  color: appPalette.textMuted,
};

const compactInsightDescription = {
  fontSize: 9,
  lineHeight: 1.2,
  color: appPalette.textMuted,
};

const compareMeta = {
  fontSize: 9,
  color: appPalette.textSoft,
  fontWeight: 700,
  minHeight: 10,
};

const compareDeltaPositive = {
  fontSize: 11,
  color: appPalette.success,
  fontWeight: "bold",
  lineHeight: 1.35,
};

const exerciseCard = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 12,
  padding: "18px 18px 16px",
  borderRadius: 26,
  background: withAlpha(appPalette.surface, 0.98),
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: `0 20px 42px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
  overflow: "hidden" as const,
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
  gap: 8,
  fontSize: 13,
  color: appPalette.textMuted,
  fontWeight: 700,
  flexWrap: "wrap" as const,
};

const exerciseInputStage = {
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto",
  gap: 10,
};

const lastTrainingHint = {
  marginTop: 6,
  fontSize: 13,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const suggestionHint = {
  marginTop: 6,
  display: "grid",
  gap: 2,
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
};

const coachHint = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 700,
};

const liveDeltaHint = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 700,
};

const restDeltaHint = {
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 700,
};

const restCoachDetail = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  textAlign: "center" as const,
  marginTop: -2,
};

const weightPanel = {
  display: "grid",
  gridTemplateColumns: "78px minmax(0, 1fr) 78px",
  gap: 14,
  alignItems: "center",
  alignContent: "center" as const,
  minHeight: "clamp(144px, 22vh, 212px)",
  padding: "4px 0 0",
};

const weightSideColumn = {
  display: "grid",
  gap: 12,
  alignContent: "center" as const,
};

const weightSideButton = {
  minHeight: 52,
  borderRadius: 16,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.danger,
  boxShadow: `0 10px 24px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const weightCenter = {
  display: "grid",
  justifyItems: "center" as const,
  alignContent: "center" as const,
  gap: 8,
  minHeight: "100%",
  padding: "4px 0",
};

const weightCenterLabel = {
  fontSize: 14,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: appPalette.textSoft,
  fontWeight: 800,
  marginTop: 0,
};

const weightControls = {
  display: "grid",
  gap: 5,
};

const weightBox = {
  fontSize: "clamp(58px, 8.2vw, 76px)",
  fontWeight: 800,
  textAlign: "center" as const,
  color: appPalette.textStrong,
  lineHeight: 0.95,
  minHeight: 66,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const weightUnit = {
  marginLeft: 8,
  fontSize: 24,
  color: appPalette.textDefault,
};

const sectionLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: appPalette.textMuted,
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
  border: `2px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 17,
  boxShadow: `0 8px 20px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
};

const repsGrid = {
  display: "grid",
  gridTemplateColumns: "48px 48px minmax(0, 1fr) 48px 48px",
  gap: 6,
  alignItems: "center" as const,
};

const repsSection = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end",
  flexShrink: 0,
  gap: 8,
  marginTop: 0,
};

const bottomActionDock = {
  display: "grid",
  gap: 8,
  marginTop: 0,
  paddingTop: 8,
  paddingBottom: 0,
  flexShrink: 0,
};

const singleActionDock = {
  display: "grid",
  gap: 8,
  marginTop: 0,
  paddingTop: 8,
  paddingBottom: 0,
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
  border: `2px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 15,
  fontWeight: "bold",
  boxShadow: `0 8px 20px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
};

const repsValueCard = {
  minHeight: 84,
  borderRadius: 24,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  color: appPalette.textStrong,
  boxShadow: `0 10px 22px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const repsValueMeta = {
  fontSize: 10,
  letterSpacing: 1.1,
  textTransform: "uppercase" as const,
  color: appPalette.textSoft,
  fontWeight: 800,
};

const repsValueNumber = {
  marginTop: 4,
  fontSize: 58,
  lineHeight: 0.95,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const repsRoundButton = {
  minHeight: 70,
  width: "100%",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.danger,
  fontSize: 34,
  fontWeight: 800,
  boxShadow: `0 10px 22px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
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
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  border: `3px solid ${appPalette.surface}`,
  boxShadow: `0 18px 32px ${withAlpha(appPalette.surfaceDark, 0.24)}`,
};

const primaryActionButtonBase = {
  width: "100%",
  minHeight: 74,
  padding: "15px 18px",
  border: "none",
  borderRadius: 999,
  color: appPalette.surface,
  fontSize: 19,
  fontWeight: 800,
  cursor: "pointer",
};

const saveBarButton = {
  ...primaryActionButtonBase,
  background: `linear-gradient(180deg, ${lightenColor(appPalette.danger, 0.08)} 0%, ${appPalette.danger} 100%)`,
  boxShadow: `0 18px 34px ${withAlpha(appPalette.danger, 0.24)}`,
};

const allSetsButton = {
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  color: appPalette.textDefault,
  fontSize: 16,
  fontWeight: 700,
  boxShadow: `0 8px 22px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
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
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: 8,
  padding: "10px 10px 12px",
  borderRadius: 24,
  textAlign: "center" as const,
  flex: 1,
  minHeight: 0,
};

const restFocusStage = {
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto auto auto auto",
  gap: 8,
  alignContent: "stretch" as const,
};

const restCompareRow = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const restCompareItem = {
  display: "grid",
  gap: 3,
  padding: "8px 10px",
  borderRadius: 16,
  border: `1px solid ${appPalette.borderSoft}`,
  background: withAlpha(appPalette.surface, 0.9),
};

const restCompareLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: appPalette.textMuted,
  fontWeight: 800,
};

const restCompareValue = {
  fontSize: 14,
  color: appPalette.textStrong,
  fontWeight: 700,
};

const restHistoryCard = {
  padding: "9px 10px 9px",
  borderRadius: 20,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: `0 10px 26px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
  display: "grid",
  gap: 5,
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
  color: appPalette.textSoft,
  fontWeight: "bold",
};

const restHistoryTrend = {
  color: appPalette.danger,
  fontSize: 14,
  fontWeight: "bold",
};

const restHistoryToggle = {
  minHeight: 32,
  minWidth: 32,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 800,
};

const restHistoryList = {
  display: "grid",
  gap: 8,
};

const restHistoryRow = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr) 36px",
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
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
  fontSize: 13,
  fontWeight: "bold",
};

const restHistoryValue = {
  display: "grid",
  gap: 2,
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const restHistorySetLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: appPalette.textSoft,
  fontWeight: "bold",
};

const restHistoryEditButton = {
  minHeight: 36,
  minWidth: 36,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 800,
  textAlign: "center" as const,
};

const restHistoryEmpty = {
  fontSize: 12,
  color: appPalette.textMuted,
  textAlign: "center" as const,
  padding: "6px 0",
};

const restHistoryCollapsedHint = {
  fontSize: 13,
  color: appPalette.textMuted,
  padding: "4px 0 2px",
};

const restHistoryButton = {
  width: "100%",
  minHeight: 38,
  borderRadius: 14,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
  fontSize: 14,
  fontWeight: "bold",
};

const restHistoryActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const insightActionHint = {
  marginLeft: "auto",
  fontSize: 11,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const insightSupportText = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  marginTop: 2,
};

const historySheetMeta = {
  display: "grid",
  gap: 4,
};

const historySheetExercise = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const historySheetDate = {
  fontSize: 13,
  color: appPalette.textMuted,
};

const historySheetList = {
  display: "grid",
  gap: 10,
};

const historySheetSessionCard = {
  display: "grid",
  gap: 10,
  padding: "14px 14px 12px",
  borderRadius: 20,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surfaceMuted,
  boxShadow: `0 10px 28px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const historySheetSessionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  flexWrap: "wrap" as const,
};

const historySheetSessionTitle = {
  fontSize: 14,
  fontWeight: 900,
  color: appPalette.textStrong,
};

const historySheetSessionDate = {
  fontSize: 12,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const historySheetSessionRows = {
  display: "grid",
  gap: 8,
};

const historySheetRow = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 18,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  boxShadow: `0 8px 24px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
};

const historySheetRowLabel = {
  fontSize: 13,
  fontWeight: 800,
  color: appPalette.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const historySheetRowValue = {
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
  textAlign: "right" as const,
};

const historySheetEmpty = {
  padding: "16px 8px",
  textAlign: "center" as const,
  color: appPalette.textMuted,
  fontSize: 14,
};

const restTimerWrap = {
  display: "flex",
  justifyContent: "center",
  padding: "0",
  alignItems: "center",
  flex: 1,
  minHeight: "clamp(184px, 27vh, 228px)",
};

const restBarTrack = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: appPalette.borderSoft,
  overflow: "hidden" as const,
};

const restBarFill = {
  height: "100%",
  borderRadius: 999,
};

const restContextPanel = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 20,
  boxShadow: `0 10px 24px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
  textAlign: "left" as const,
};

const compactRestContextPanel = {
  padding: "10px 12px",
  gap: 8,
};

const restContextContent = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  flex: 1,
  minWidth: 0,
};

const restContextColumn = {
  minWidth: 0,
};

const restContextLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: appPalette.textSoft,
  fontWeight: 800,
};

const restContextValue = {
  marginTop: 4,
  fontSize: 15,
  lineHeight: 1.3,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const restContextSubline = {
  marginTop: 4,
  fontSize: 11,
  lineHeight: 1.4,
  color: appPalette.textMuted,
  fontWeight: 600,
};

const restContextMetaStack = {
  display: "grid",
  gap: 7,
  width: "100%",
};

const restContextStatus = {
  fontSize: 11,
  lineHeight: 1.4,
  color: appPalette.textMuted,
  fontWeight: 700,
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
  boxShadow: `inset 0 0 0 2px ${withAlpha(appPalette.danger, 0.1)}, 0 14px 32px ${withAlpha(appPalette.danger, 0.1)}`,
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
  background: appPalette.surface,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  boxShadow: `inset 0 0 0 1px ${withAlpha(appPalette.borderSoft, 0.95)}`,
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
  color: appPalette.textSoft,
  fontWeight: 600,
};

const restTimer = {
  fontSize: 50,
  fontWeight: 800,
  color: appPalette.textStrong,
  lineHeight: 1,
};

const countdownNumber = {
  color: appPalette.danger,
};

const restSavedRow = {
  padding: "8px 10px",
  borderRadius: 12,
  background: withAlpha(appPalette.surface, 0.7),
  border: `1px solid ${withAlpha(appPalette.borderDefault, 0.8)}`,
  display: "flex",
  flexDirection: "column" as const,
  gap: 5,
  textAlign: "left" as const,
};

const restSavedLabel = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: appPalette.textMuted,
};

const restSavedValue = {
  fontSize: 13,
  fontWeight: "bold",
  color: appPalette.textStrong,
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
  background: appPalette.borderDefault,
};

const restSetDotDone = {
  background: appPalette.success,
};

const restWeightSection = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "center",
  gap: 8,
  flexShrink: 0,
  alignContent: "start" as const,
};

const restWeightLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: appPalette.textMuted,
  fontWeight: "bold",
};

const restWeightValueLarge = {
  fontSize: 64,
  fontWeight: 800,
  color: appPalette.textStrong,
  lineHeight: 1,
};

const restWeightUnit = {
  marginLeft: 6,
  fontSize: 22,
  color: appPalette.textDefault,
};

const restWeightRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: 10,
  alignItems: "center" as const,
};

const restWeightButton = {
  minHeight: 46,
  borderRadius: 14,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.danger,
  fontSize: 17,
  fontWeight: "bold",
  boxShadow: `0 8px 20px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const stretchNextSection = {
  display: "grid",
  gap: 6,
  justifyItems: "center" as const,
  textAlign: "center" as const,
  padding: "4px 8px 0",
  alignContent: "start" as const,
};

const stretchFocusStage = {
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto auto",
  gap: 8,
  alignContent: "stretch" as const,
};

const stretchNextValue = {
  fontSize: 32,
  lineHeight: 1.08,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const stretchNextHint = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  fontWeight: 600,
};

const restSuggestionBadge = {
  display: "inline-flex",
  alignSelf: "flex-start" as const,
  minHeight: 28,
  padding: "5px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const restSuggestionGood = {
  background: withAlpha(appPalette.success, 0.14),
  color: appPalette.success,
};

const restSuggestionUp = {
  background: withAlpha(splitThemes.pull.primary, 0.12),
  color: splitThemes.pull.primary,
};

const restSuggestionDown = {
  background: withAlpha(appPalette.warning, 0.14),
  color: appPalette.warning,
};

const restSuggestionNeutral = {
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
};

const restTargetBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "5px 12px",
  borderRadius: 999,
  background: withAlpha(appPalette.danger, 0.08),
  color: appPalette.danger,
  fontSize: 13,
  fontWeight: "bold",
};

const continueButton = {
  ...primaryActionButtonBase,
  background: appPalette.surfaceDark,
  minHeight: 74,
};

const adjustButton = {
  width: "100%",
  minHeight: 42,
  padding: "10px 16px",
  borderRadius: 999,
  background: appPalette.surface,
  fontSize: 15,
  fontWeight: 700,
  boxShadow: `0 8px 22px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const workoutSheet = {
  display: "grid",
  gap: 14,
  paddingTop: 4,
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
  color: appPalette.textSoft,
};

const workoutSheetTitle = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const workoutSheetClose = {
  minHeight: 46,
  minWidth: 46,
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: `0 8px 22px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
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
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  textAlign: "left" as const,
  cursor: "pointer",
  boxShadow: `0 8px 24px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
};

const adjustListIcon = {
  fontSize: 24,
  flexShrink: 0,
};

const adjustListLabel = {
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const adjustListHint = {
  marginTop: 2,
  fontSize: 13,
  color: appPalette.textMuted,
};

const manualEntrySheetBody = {
  display: "grid",
  gap: 12,
};

const manualEntryWheelHeader = {
  display: "grid",
  justifyItems: "center" as const,
  gap: 4,
};

const manualEntryWheelValue = {
  fontSize: 28,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const manualEntryWheelMeta = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.3,
  color: appPalette.textMuted,
  textTransform: "uppercase" as const,
};

const manualEntryField = {
  width: "100%",
  minHeight: 58,
  borderRadius: 18,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 28,
  fontWeight: 800,
  padding: "0 18px",
  outline: "none",
  boxSizing: "border-box" as const,
};

const sheetField = {
  ...manualEntryField,
  fontSize: 18,
  fontWeight: 700,
};

const sheetFieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const manualEntryHint = {
  fontSize: 13,
  lineHeight: 1.45,
  color: appPalette.textMuted,
};

const manualEntryActions = {
  display: "flex",
  gap: 10,
};

const confirmBodyText = {
  fontSize: 15,
  lineHeight: 1.5,
  color: appPalette.textDefault,
};

const scopeCard = {
  display: "grid",
  gap: 10,
};

const scopeButton = {
  minHeight: 54,
  width: "100%",
  borderRadius: 18,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const scopeButtonActive = {
  ...scopeButton,
  background: appPalette.surfaceDark,
  border: `1px solid ${appPalette.surfaceDark}`,
  color: appPalette.surface,
  boxShadow: `0 12px 24px ${withAlpha(appPalette.surfaceDark, 0.18)}`,
};

const scopeButtonDisabled = {
  ...scopeButton,
  opacity: 0.45,
  cursor: "not-allowed",
};

const confirmHint = {
  fontSize: 13,
  color: appPalette.textMuted,
};

const confirmActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const confirmActionButton = {
  minHeight: 56,
  borderRadius: 16,
};


const compactCard = {
  gap: 2,
};

const compactContextCard = {
  gap: 4,
  padding: "7px 9px",
  borderRadius: 16,
};

const compactProgressMeta = {
  fontSize: 10,
  marginBottom: 3,
};

const compactBadge = {
  fontSize: 10,
  padding: "2px 7px",
};

const compactTitle = {
  fontSize: 16,
};

const compactActiveStack = {
  gap: 4,
};

const compactFlowCard = {
  gap: 4,
  padding: "7px 9px",
};

const compactFlowValue = {
  fontSize: 11,
};

const compactInsightCard = {
  minHeight: 70,
  padding: "7px 9px",
  gap: 4,
};

const compactExerciseCard = {
  gap: 10,
  padding: "12px 12px 10px",
  borderRadius: 20,
};

const compactLastTrainingHint = {
  marginTop: 4,
  fontSize: 12,
};

const compactSuggestionHint = {
  marginTop: 4,
  fontSize: 11,
};

const compactCoachHint = {
  marginTop: 4,
  fontSize: 11,
};

const compactLiveDeltaHint = {
  marginTop: 4,
  fontSize: 11,
};

const compactWeightPanel = {
  gridTemplateColumns: "72px minmax(0, 1fr) 72px",
  minHeight: 146,
  gap: 10,
};

const compactWeightSideButton = {
  minHeight: 40,
  borderRadius: 12,
};

const compactWeightBox = {
  fontSize: 50,
  minHeight: 54,
};

const compactWeightRow = {
  gap: 6,
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
  gridTemplateColumns: "42px minmax(0, 1fr) 42px",
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
  gap: 4,
  padding: "6px 6px 8px",
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
  gap: 6,
};

const compactRestWeightButton = {
  minHeight: 28,
  fontSize: 11,
};

const compactContinueButton = {
  minHeight: 48,
  padding: "8px 14px",
  fontSize: 14,
};

const compactSaveBarButton = {
  minHeight: 46,
  fontSize: 14,
};

const compactRepsRoundButton = {
  minHeight: 40,
  fontSize: 20,
};

const compactRepsValueCard = {
  minHeight: 60,
  borderRadius: 18,
};

const compactRepsValueMeta = {
  fontSize: 9,
};

const compactRepsValueNumber = {
  marginTop: 3,
  fontSize: 36,
};

const compactStretchNextValue = {
  fontSize: 20,
};

const compactTopButton = {
  minHeight: 34,
  padding: "6px 10px",
  fontSize: 12,
};

const compactDurationChip = {
  minHeight: 30,
  padding: "5px 10px",
  fontSize: 11,
};

const disabledButton = {
  opacity: 0.45,
};

const loadingText = {
  margin: 0,
  textAlign: "center" as const,
  color: appPalette.textMuted,
  fontSize: 13,
};

function getDeltaColor(value: number) {
  if (value > 0) return appPalette.success;
  if (value < 0) return appPalette.danger;
  return appPalette.textDefault;
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

  return trimTrailingZeros(value.toFixed(4));
}

function trimTrailingZeros(value: string) {
  if (!value.includes(".")) {
    return value;
  }

  return value.replace(/0+$/, "").replace(/\.$/, "");
}

function normalizeManualWeightInputText(value: string) {
  return trimTrailingZeros(value);
}

function normalizeDisplayWeightInput(input: string, fallbackWeight: number) {
  const normalized = input.replace(",", ".").trim();
  if (!normalized) {
    return formatWeight(fallbackWeight);
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return formatWeight(fallbackWeight);
  }

  return normalizeManualWeightInputText(normalized);
}

function parseManualWeightValue(value: string, fallbackWeight: number) {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isNaN(parsed) ? fallbackWeight : parsed;
}

function parseManualRepsValue(value: string, fallbackReps: number) {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isNaN(parsed) ? fallbackReps : parsed;
}

function normalizeWheelWeight(value: number) {
  return Math.round(value * 4) / 4;
}

function normalizeWheelReps(value: number) {
  return Math.max(1, Math.round(value));
}

function buildWeightWheelOptions(
  min: number,
  max: number | null,
  selectedValue: number
) {
  const upperBound = max ?? Math.max(200, Math.ceil((selectedValue + 80) / 5) * 5);
  const safeMin = Math.floor(min * 4) / 4;
  const safeMax = Math.ceil(upperBound * 4) / 4;
  const options: Array<{ value: number; label: string }> = [];

  for (let index = 0, current = safeMin; current <= safeMax + 0.0001; index += 1, current = safeMin + index * 0.25) {
    const normalized = normalizeWheelWeight(current);
    options.push({
      value: normalized,
      label: formatWeight(normalized).replace(".", ","),
    });
  }

  return options;
}

function buildRepsWheelOptions(selectedValue: number) {
  const max = Math.max(30, selectedValue + 12);
  return Array.from({ length: max }, (_, index) => {
    const value = index + 1;
    return {
      value,
      label: String(value),
    };
  });
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

function parsePositiveIntInput(rawValue: string, fallback: number) {
  const parsed = Number.parseInt(rawValue.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function normalizeManualWeight(value: number) {
  return value;
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
  if (warmupBlock) {
    return warmupBlock.rounds;
  }

  const exerciseBlock = dayBlocks?.find(
    (block): block is Extract<TrainingPlanBlock, { type: "exercise" }> =>
      block.type === "exercise" && block.exerciseId === exerciseId
  );

  return exerciseBlock?.warmupSets ?? 0;
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

function getLoggedSetType(
  setIndex: number,
  warmupSets: number
): LoggedSetType {
  return setIndex < warmupSets ? "warmup" : "workset";
}

function getWorkoutBadgeVariant(
  isStretching: boolean,
  isResting: boolean,
  setIndex: number,
  warmupSets: number
): "exercise" | "warmup" | "stretch" | "pause" {
  if (isStretching) return "stretch";
  if (isResting) return "pause";
  if (setIndex < warmupSets) return "warmup";
  return "exercise";
}

function getInsightBadgeVariant(kind: "last" | "best") {
  return kind === "best" ? "better" : "equal";
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

function getCoachToneColor(
  action: "increase" | "keep" | "decrease",
  theme: WorkoutTheme
) {
  if (action === "increase") {
    return theme.accent;
  }

  if (action === "decrease") {
    return darkenColor(theme.accent, 0.18);
  }

  return darkenColor(theme.accent, 0.08);
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

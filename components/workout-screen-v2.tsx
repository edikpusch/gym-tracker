"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTrainingPlan, getActivePlanId, getDayBlocks, type TrainingDay, type TrainingExercise } from "@/lib/trainingPlans";
import { type TrainingPlanBlock } from "@/lib/trainingModel";
import { saveSet, saveSession, updateSession, getLastSessionSets, getBestSet, saveActiveWorkout, getActiveWorkout, clearActiveWorkout, type SetEntry } from "@/lib/db";
import { scheduleRestNotification, clearRestNotification } from "@/lib/restNotifications";
import { BottomNav } from "@/components/ui/BottomNav";
import { RestOverlay } from "@/components/workout/RestOverlay";
import { SetLogger } from "@/components/workout/SetLogger";
import { ExerciseList } from "@/components/workout/ExerciseList";
import { WorkoutHeader } from "@/components/workout/WorkoutHeader";
import { ExerciseFocus } from "@/components/workout/ExerciseFocus";

type WorkoutTab = "focus" | "list";

type SessionSet = SetEntry & { saved: boolean };

type ExerciseState = {
  exercise: TrainingExercise;
  completedWorkSets: number;
  sets: SessionSet[];
};

type WorkoutPhase = "active" | "resting" | "done";

function getWarmupRounds(blocks: TrainingPlanBlock[], exerciseId: string): number {
  const warmup = blocks.find((b) => b.type === "warmup" && b.parentExerciseId === exerciseId);
  return warmup?.type === "warmup" ? warmup.rounds : 0;
}

function buildWeightSuggestion(lastSets: SetEntry[], bestSet: SetEntry | null): { weight: number; label: string } {
  if (lastSets.length > 0) {
    const last = lastSets[lastSets.length - 1];
    return { weight: last.weight, label: `${last.weight} kg · Letztes Mal` };
  }
  if (bestSet) {
    return { weight: bestSet.weight, label: `${bestSet.weight} kg · Bestleistung` };
  }
  return { weight: 40, label: "Startgewicht" };
}

export function WorkoutScreen({ dayId }: { dayId: string }) {
  const router = useRouter();

  const [day, setDay] = useState<TrainingDay | null>(null);
  const [blocks, setBlocks] = useState<TrainingPlanBlock[]>([]);
  const [sessionId] = useState(() => Date.now());
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [tab, setTab] = useState<WorkoutTab>("focus");
  const [phase, setPhase] = useState<WorkoutPhase>("active");
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restDuration, setRestDuration] = useState(90);
  const [now, setNow] = useState(Date.now());
  const [exerciseStates, setExerciseStates] = useState<ExerciseState[]>([]);
  const [startedAt] = useState(Date.now());
  const [sessionSaved, setSessionSaved] = useState(false);
  const [pendingWeight, setPendingWeight] = useState(40);
  const [pendingReps, setPendingReps] = useState(10);
  const [pendingSetType, setPendingSetType] = useState<"warmup" | "workset">("workset");
  const [suggestion, setSuggestion] = useState<{ weight: number; label: string } | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  const sessionSavedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const currentExercise = exerciseStates[exerciseIndex]?.exercise ?? null;
  const currentState = exerciseStates[exerciseIndex] ?? null;

  // Load day & init exercise states
  useEffect(() => {
    const plan = getTrainingPlan(getActivePlanId());
    const foundDay = plan.days.find((d) => d.id === dayId) ?? plan.days[0] ?? null;
    if (!foundDay) return;

    setDay(foundDay);
    const dayBlocks = getDayBlocks(foundDay);
    setBlocks(dayBlocks);

    const states: ExerciseState[] = foundDay.exercises.map((ex) => ({
      exercise: ex,
      completedWorkSets: 0,
      sets: [],
    }));
    setExerciseStates(states);

    // Save session record
    saveSession({
      sessionId,
      startedAt: Date.now(),
      planId: plan.id,
      planName: plan.name,
      dayId: foundDay.id,
      dayName: foundDay.name,
    });
  }, [dayId, sessionId]);

  // Load suggestion for current exercise
  useEffect(() => {
    if (!currentExercise) return;
    const exerciseId = currentExercise.id;
    Promise.all([getLastSessionSets(exerciseId), getBestSet(exerciseId)]).then(([last, best]) => {
      setSuggestion(buildWeightSuggestion(last, best));
      if (last.length > 0) {
        setPendingWeight(last[last.length - 1].weight);
        setPendingReps(last[last.length - 1].reps);
      }
    });

    // Determine set type
    const warmupRounds = getWarmupRounds(blocks, currentExercise.id);
    const completedWorkSets = exerciseStates[exerciseIndex]?.completedWorkSets ?? 0;
    const totalLogged = exerciseStates[exerciseIndex]?.sets.length ?? 0;
    const warmupDone = totalLogged >= warmupRounds;
    setPendingSetType(warmupDone ? "workset" : "warmup");
  }, [currentExercise, exerciseIndex, blocks, exerciseStates]);

  // Rest timer tick
  useEffect(() => {
    if (phase !== "resting") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => setNow(Date.now()), 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Auto-advance when rest ends
  useEffect(() => {
    if (phase !== "resting" || !restEndsAt) return;
    if (now >= restEndsAt) {
      void clearRestNotification();
      setPhase("active");
      setRestEndsAt(null);
      setIsLogging(false);
    }
  }, [now, phase, restEndsAt]);

  const handleSetDone = useCallback(async (weight: number, reps: number) => {
    if (!currentExercise || !day) return;

    const warmupRounds = getWarmupRounds(blocks, currentExercise.id);
    const totalLogged = exerciseStates[exerciseIndex]?.sets.length ?? 0;
    const setType: "warmup" | "workset" = totalLogged < warmupRounds ? "warmup" : "workset";
    const setIndex = totalLogged;

    const plan = getTrainingPlan(getActivePlanId());

    const entry = await saveSet({
      sessionId,
      timestamp: Date.now(),
      exercise: currentExercise.name,
      exerciseId: currentExercise.id,
      weight,
      reps,
      setIndex,
      setType,
      planId: plan.id,
      planName: plan.name,
      dayId: day.id,
      dayName: day.name,
    });

    setExerciseStates((prev) => prev.map((es, i) => {
      if (i !== exerciseIndex) return es;
      return {
        ...es,
        completedWorkSets: setType === "workset" ? es.completedWorkSets + 1 : es.completedWorkSets,
        sets: [...es.sets, { ...entry, saved: true }],
      };
    }));

    // Start rest timer immediately
    const dur = currentExercise.restSeconds;
    setRestDuration(dur);
    setRestEndsAt(Date.now() + dur * 1000);
    setPhase("resting");
    setIsLogging(true);

    void scheduleRestNotification(currentExercise.name, Date.now() + dur * 1000);

    // Persist snapshot for background resume
    void saveActiveWorkout({
      key: `workout-${sessionId}`,
      sessionId,
      startedAt,
      planId: plan.id,
      planName: plan.name,
      dayId: day.id,
      dayName: day.name,
      exerciseId: currentExercise.id,
      exerciseIndex,
      setIndex,
      weight,
      reps,
      isResting: true,
      restEndsAt: Date.now() + dur * 1000,
      updatedAt: Date.now(),
    });
  }, [currentExercise, day, blocks, exerciseStates, exerciseIndex, sessionId, startedAt]);

  const handleSkipRest = useCallback(() => {
    void clearRestNotification();
    setPhase("active");
    setRestEndsAt(null);
    setIsLogging(false);
  }, []);

  const handleNextExercise = useCallback(() => {
    if (exerciseIndex < exerciseStates.length - 1) {
      setExerciseIndex((i) => i + 1);
      setPhase("active");
      setIsLogging(false);
    } else {
      handleFinish();
    }
  }, [exerciseIndex, exerciseStates.length]);

  const handleFinish = useCallback(async () => {
    setPhase("done");
    void clearRestNotification();
    void clearActiveWorkout(`workout-${sessionId}`);
    await updateSession(sessionId, { endedAt: Date.now() });
    sessionSavedRef.current = true;
    setSessionSaved(true);
    router.push("/workout/summary");
  }, [sessionId, router]);

  const restSecondsLeft = restEndsAt ? Math.max(0, (restEndsAt - now) / 1000) : 0;
  const restProgress = restDuration > 0 ? 1 - restSecondsLeft / restDuration : 0;

  if (!day || exerciseStates.length === 0) {
    return (
      <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--c-text-3)" }}>Lädt…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <WorkoutHeader
        dayName={day.name}
        exerciseIndex={exerciseIndex}
        totalExercises={exerciseStates.length}
        startedAt={startedAt}
        tab={tab}
        onTabChange={setTab}
        onFinish={handleFinish}
      />

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as const, paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 80px)" }}>
        {tab === "focus" ? (
          <ExerciseFocus
            exerciseState={currentState}
            blocks={blocks}
            suggestion={suggestion}
            pendingWeight={pendingWeight}
            pendingReps={pendingReps}
            pendingSetType={pendingSetType}
            onWeightChange={setPendingWeight}
            onRepsChange={setPendingReps}
            onSetDone={handleSetDone}
            onNextExercise={handleNextExercise}
            isLastExercise={exerciseIndex === exerciseStates.length - 1}
            isResting={phase === "resting"}
          />
        ) : (
          <ExerciseList
            exerciseStates={exerciseStates}
            currentIndex={exerciseIndex}
            blocks={blocks}
            onSelectExercise={(i) => { setExerciseIndex(i); setTab("focus"); }}
          />
        )}
      </div>

      {phase === "resting" && (
        <RestOverlay
          secondsLeft={restSecondsLeft}
          totalSeconds={restDuration}
          progress={restProgress}
          isLogging={isLogging}
          pendingWeight={pendingWeight}
          pendingReps={pendingReps}
          pendingSetType={pendingSetType}
          onWeightChange={setPendingWeight}
          onRepsChange={setPendingReps}
          onSkip={handleSkipRest}
          onLogDone={() => setIsLogging(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTrainingPlan, getActivePlanId, getDayBlocks, type TrainingDay, type TrainingExercise } from "@/lib/trainingPlans";
import { type TrainingPlanBlock } from "@/lib/trainingModel";
import { saveSet, saveSession, updateSession, getLastSessionSets, getBestSet, saveActiveWorkout, clearActiveWorkout, setSetting, type SetEntry } from "@/lib/db";
import { scheduleRestNotification, clearRestNotification } from "@/lib/restNotifications";
import { BottomNav } from "@/components/ui/BottomNav";
import { RestOverlay } from "@/components/workout/RestOverlay";
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
  const [pendingWeight, setPendingWeight] = useState(40);
  const [pendingReps, setPendingReps] = useState(10);
  const [lastSessionSets, setLastSessionSets] = useState<SetEntry[]>([]);
  const [bestSet, setBestSet] = useState<SetEntry | null>(null);
  const [lastLoggedSet, setLastLoggedSet] = useState<{ exerciseName: string; setLabel: string; weight: number; reps: number } | null>(null);

  const timerRef = useRef<number | null>(null);

  const currentExercise = exerciseStates[exerciseIndex]?.exercise ?? null;
  const currentState = exerciseStates[exerciseIndex] ?? null;

  // Derived inline — no state needed
  const warmupRoundsForCurrent = currentExercise ? getWarmupRounds(blocks, currentExercise.id) : 0;
  const totalLoggedForCurrent = currentState?.sets.length ?? 0;
  const pendingSetType: "warmup" | "workset" = totalLoggedForCurrent < warmupRoundsForCurrent ? "warmup" : "workset";

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

    // Remember last used day for smart navigation
    void setSetting("lastWorkoutDayId", foundDay.id);

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

  // Load comparison data — fires only when exercise changes, not on every set
  useEffect(() => {
    if (!currentExercise) return;
    setLastSessionSets([]);
    setBestSet(null);
    const id = currentExercise.id;
    Promise.all([getLastSessionSets(id), getBestSet(id)]).then(([last, best]) => {
      setLastSessionSets(last);
      setBestSet(best);
      if (last.length > 0) {
        setPendingWeight(last[last.length - 1].weight);
        setPendingReps(last[last.length - 1].reps);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise?.id]);

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

    // Build label for confirmation display
    const warmupRoundsForLabel = getWarmupRounds(blocks, currentExercise.id);
    const totalLoggedBefore = exerciseStates[exerciseIndex]?.sets.length ?? 0;
    const isWarmupSet = totalLoggedBefore < warmupRoundsForLabel;
    const setLabel = isWarmupSet
      ? `AW${totalLoggedBefore + 1}`
      : `S${totalLoggedBefore - warmupRoundsForLabel + 1}`;
    setLastLoggedSet({ exerciseName: currentExercise.name, setLabel, weight, reps });

    // Start rest timer immediately
    const dur = currentExercise.restSeconds;
    setRestDuration(dur);
    setRestEndsAt(Date.now() + dur * 1000);
    setPhase("resting");

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
  }, []);

  const handleFinish = useCallback(async () => {
    setPhase("done");
    void clearRestNotification();
    void clearActiveWorkout(`workout-${sessionId}`);
    await updateSession(sessionId, { endedAt: Date.now() });
    router.push("/workout/summary");
  }, [sessionId, router]);

  const handleNextExercise = useCallback(() => {
    if (exerciseIndex < exerciseStates.length - 1) {
      setExerciseIndex((i) => i + 1);
      setPhase("active");
    } else {
      void handleFinish();
    }
  }, [exerciseIndex, exerciseStates.length, handleFinish]);

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
            lastSessionSets={lastSessionSets}
            bestSet={bestSet}
            currentWorkSetIndex={currentState?.completedWorkSets ?? 0}
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
          progress={restProgress}
          lastLoggedSet={lastLoggedSet}
          lastSessionSets={lastSessionSets}
          nextWorkSetIndex={currentState?.completedWorkSets ?? 0}
          pendingWeight={pendingWeight}
          pendingReps={pendingReps}
          onWeightChange={setPendingWeight}
          onRepsChange={setPendingReps}
          onSkip={handleSkipRest}
        />
      )}

      <BottomNav />
    </div>
  );
}

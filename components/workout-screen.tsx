"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getCoachDecision,
  getFatigue,
  getLastSessionForExercise,
  getLastSetForExercise,
  getProgress,
  getTopSet,
  saveSet,
  type SetType,
} from "@/lib/workoutEngine";
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
  theme: WorkoutTheme;
};

const MIN_WEIGHT = 0;

export function WorkoutScreen({
  workoutType,
  workoutLabel,
  exercises,
  theme,
}: WorkoutScreenProps) {
  const router = useRouter();

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [sessionId, setSessionId] = useState(0);

  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(10);

  const [sessionSets, setSessionSets] = useState<Array<SetType | null>>([]);
  const [previousSets, setPreviousSets] = useState<Array<SetType | null>>([]);
  const [lastSessionSets, setLastSessionSets] = useState<SetType[]>([]);

  const [loading, setLoading] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(exercises[0].restSeconds);

  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [setStartedAt, setSetStartedAt] = useState(0);

  const currentExercise = exercises[exerciseIndex];
  const totalSets = currentExercise.sets + 1;
  const previousSet = previousSets[setIndex] ?? null;

  useEffect(() => {
    const now = Date.now();
    setSessionId(now);
    setStartTime(now);
    setCurrentTime(now);
    setSetStartedAt(now);
    setRestTime(exercises[0].restSeconds);
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
    if (!currentExercise || sessionId === 0) {
      return;
    }

    const activeSessionId = sessionId;

    async function init() {
      const history: Array<SetType | null> = [];

      for (let i = 0; i < totalSets; i++) {
        const last = await getLastSetForExercise(currentExercise.name, i);
        history.push(last);
      }

      const lastSession = await getLastSessionForExercise(
        currentExercise.name,
        activeSessionId
      );

      setPreviousSets(history);
      setSessionSets([]);
      setLastSessionSets(lastSession);

      if (history[0]) {
        setWeight(history[0].weight);
        setReps(history[0].reps);
      } else {
        setWeight(40);
        setReps(getDefaultReps(currentExercise.minReps, currentExercise.maxReps));
      }
    }

    init();
  }, [currentExercise, sessionId, totalSets]);

  function handleRepsChange(delta: number) {
    if (loading || isResting) {
      return;
    }

    const newReps = normalizeReps(reps + delta);
    if (newReps < 0.5) {
      return;
    }

    setReps(newReps);
  }

  function changeWeight(delta: number) {
    if (loading) {
      return;
    }

    setWeight((currentWeight) => Math.max(MIN_WEIGHT, currentWeight + delta));
  }

  function handleNext() {
    setIsResting(false);

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
      setRestTime(nextExercise.restSeconds);
      return;
    }

    if (sessionId === 0) {
      return;
    }

    navigateToSummary(router, sessionId);
  }

  useEffect(() => {
    if (!isResting) {
      return;
    }

    const interval = setInterval(() => {
      setRestTime((time) => {
        if (time <= 1) {
          clearInterval(interval);
          handleNext();
          return 0;
        }

        return time - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isResting]);

  async function save() {
    if (loading || isResting || sessionId === 0) {
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
      });

      setSessionSets((prev) => {
        const copy = [...prev];
        copy[setIndex] = {
          exercise: currentExercise.name,
          weight,
          reps,
          set: setIndex,
          sessionId,
          timestamp: savedAt,
          type: workoutType,
        };
        return copy;
      });

      setRestTime(currentExercise.restSeconds);
      setIsResting(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const validSets = sessionSets.filter((set): set is SetType => set !== null);
  const currentTop = getTopSet(validSets);
  const lastTop = getTopSet(lastSessionSets);
  const progress = getProgress(currentTop, lastTop);
  const consistency = getFatigue(validSets);
  const coach = getCoachDecision(currentExercise.name, validSets);
  const workoutDuration = formatDuration(Math.max(0, currentTime - startTime));
  const activeSetDuration = formatDuration(
    Math.max(0, currentTime - setStartedAt)
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

  return (
    <div style={{ ...screen, background: theme.background }}>
      <div
        style={{
          ...card,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <div style={progressHeader}>
          <div style={{ ...progressMeta, color: theme.accent }}>
            <span>Uebung {exerciseIndex + 1}/{exercises.length}</span>
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
            background: theme.badgeBackground,
            color: theme.screenBadge,
          }}
        >
          {workoutLabel}
        </div>

        <h1 style={{ ...title, color: theme.accent }}>
          {getExerciseLabel(currentExercise.name)}
        </h1>

        <div style={subtitle}>
          {setIndex === 0 ? "Warmup" : `Satz ${setIndex}`} / {currentExercise.sets}
        </div>

        <div style={metricsRow}>
          <div style={metricCard}>
            <div style={metricLabel}>Workout</div>
            <div style={metricValue}>{workoutDuration}</div>
          </div>
          <div
            style={{
              ...metricCard,
              ...metricCardAccent,
              background: theme.badgeBackground,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ ...metricLabel, color: theme.accent }}>Aktiver Satz</div>
            <div style={{ ...metricValue, color: theme.accent }}>
              {activeSetDuration}
            </div>
          </div>
        </div>

        <div style={insightGrid}>
          {previousSet && (
            <div style={insightCard}>
              <div style={insightLabel}>Letzter Satz</div>
              <div style={insightValue}>
                {previousSet.weight} kg x {previousSet.reps}
              </div>
            </div>
          )}

          <div style={insightCard}>
            <div style={insightLabel}>Coach</div>
            <div style={{ ...insightValue, color: theme.accent }}>
              {getCoachText(coach.action)}
            </div>
          </div>

          <div style={{ ...insightCard, ...insightWide }}>
            <div style={insightLabel}>Plan</div>
            <div style={compactMeta}>
              <span>
                Ziel {currentExercise.minReps}-{currentExercise.maxReps} Wdh.
              </span>
              <span>Pause {formatRest(currentExercise.restSeconds)}</span>
              {currentTop && <span>Top {currentTop.weight} x {currentTop.reps}</span>}
              {progress && progress.weight !== 0 && (
                <span style={{ color: getDeltaColor(progress.weight) }}>
                  {formatDelta(progress.weight)} kg
                </span>
              )}
              {progress && progress.reps !== 0 && (
                <span style={{ color: getDeltaColor(progress.reps) }}>
                  {formatDelta(progress.reps)} reps
                </span>
              )}
              {consistency !== null && <span>{getConsistencyText(consistency)}</span>}
            </div>
          </div>
        </div>

        {!isResting ? (
          <div style={activeStack}>
            <div style={weightBox}>{weight} kg</div>

            <div style={sectionLabel}>Gewicht</div>
            <div style={weightRow}>
              <button style={miniButton} onClick={() => changeWeight(-5)}>
                -5
              </button>
              <button style={miniButton} onClick={() => changeWeight(-2.5)}>
                -2.5
              </button>
              <button style={miniButton} onClick={() => changeWeight(2.5)}>
                +2.5
              </button>
              <button style={miniButton} onClick={() => changeWeight(5)}>
                +5
              </button>
            </div>

            <div style={sectionLabel}>Wiederholungen</div>
            <div style={repHint}>
              Ziel: {currentExercise.minReps}-{currentExercise.maxReps}, frei anpassbar
            </div>
            <div style={repsGrid}>
              <button style={sideButton} onClick={() => handleRepsChange(-1)}>
                -1
              </button>
              <button style={sideButton} onClick={() => handleRepsChange(-0.5)}>
                -0.5
              </button>
              <button style={saveButton} onClick={save}>
                <span style={saveButtonValue}>{formatReps(reps)}</span>
                <span style={saveButtonLabel}>Satz speichern</span>
              </button>
              <button style={sideButton} onClick={() => handleRepsChange(0.5)}>
                +0.5
              </button>
              <button style={sideButton} onClick={() => handleRepsChange(1)}>
                +1
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              ...restCard,
              background: theme.badgeBackground,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ ...restLabel, color: theme.accent }}>Pause</div>
            <div style={restTimer}>{formatRestTimer(restTime)}</div>
            <div style={{ ...progressTrack, background: theme.progressTrack }}>
              <div
                style={{
                  ...progressFill,
                  width: `${restProgress}%`,
                  background: theme.restFill,
                }}
              />
            </div>
            <div style={restWeightLabel}>Naechstes Gewicht</div>
            <div style={restWeightValue}>{weight} kg</div>
            <div style={restWeightRow}>
              <button style={restWeightButton} onClick={() => changeWeight(-5)}>
                -5
              </button>
              <button style={restWeightButton} onClick={() => changeWeight(-2.5)}>
                -2.5
              </button>
              <button style={restWeightButton} onClick={() => changeWeight(2.5)}>
                +2.5
              </button>
              <button style={restWeightButton} onClick={() => changeWeight(5)}>
                +5
              </button>
            </div>
            <button style={continueButton} onClick={handleNext}>
              Weiter
            </button>
          </div>
        )}

        {loading && <p style={loadingText}>Speichere...</p>}
      </div>
    </div>
  );
}

const screen = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: "8px 8px 10px",
};

const card = {
  width: "100%",
  maxWidth: 430,
  borderRadius: 28,
  padding: "10px 10px 12px",
  background: "rgba(255,255,255,0.94)",
  backdropFilter: "blur(14px)",
};

const progressHeader = {
  marginBottom: 8,
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
  marginTop: 7,
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
  minHeight: 30,
  marginBottom: 8,
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: "bold",
  letterSpacing: 1,
};

const title = {
  fontSize: 24,
  fontWeight: "bold",
  textAlign: "center" as const,
  lineHeight: 1,
};

const subtitle = {
  marginTop: 4,
  textAlign: "center" as const,
  fontSize: 15,
  fontWeight: "bold",
  color: "#1f2937",
};

const metricsRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 10,
};

const metricCard = {
  padding: "10px 12px",
  borderRadius: 16,
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
  fontSize: 16,
  fontWeight: "bold",
  color: "#111827",
};

const insightGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 10,
};

const insightCard = {
  padding: "9px 11px",
  borderRadius: 14,
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
  fontSize: 14,
  fontWeight: "bold",
  color: "#111827",
};

const compactMeta = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
  marginTop: 4,
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
};

const activeStack = {
  marginTop: 10,
};

const weightBox = {
  fontSize: 42,
  fontWeight: "bold",
  textAlign: "center" as const,
  color: "#111827",
};

const sectionLabel = {
  marginTop: 8,
  marginBottom: 6,
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: "#6b7280",
  textAlign: "center" as const,
};

const repHint = {
  marginBottom: 4,
  textAlign: "center" as const,
  fontSize: 11,
  color: "#6b7280",
};

const weightRow = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const miniButton = {
  minHeight: 52,
  borderRadius: 16,
  border: "2px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 18,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const repsGrid = {
  display: "grid",
  gridTemplateColumns: "52px 52px minmax(0, 1fr) 52px 52px",
  gap: 6,
  alignItems: "center" as const,
};

const sideButton = {
  minHeight: 64,
  width: "100%",
  borderRadius: 16,
  border: "2px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 16,
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const saveButton = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 112,
  padding: "10px 8px",
  borderRadius: 22,
  background: "#14161a",
  color: "#fff",
  border: "3px solid #fff",
  boxShadow: "0 18px 32px rgba(15, 23, 42, 0.24)",
};

const saveButtonValue = {
  fontSize: 34,
  lineHeight: 1,
};

const saveButtonLabel = {
  marginTop: 4,
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  opacity: 0.74,
};

const restCard = {
  marginTop: 8,
  padding: "10px 10px 10px",
  borderRadius: 20,
  textAlign: "center" as const,
};

const restLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const restTimer = {
  marginTop: 2,
  fontSize: 30,
  fontWeight: "bold",
  color: "#111827",
};

const restWeightLabel = {
  marginTop: 6,
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  color: "#6b7280",
};

const restWeightValue = {
  marginTop: 2,
  fontSize: 24,
  fontWeight: "bold",
  color: "#111827",
};

const restWeightRow = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  marginTop: 8,
};

const restWeightButton = {
  minHeight: 40,
  borderRadius: 12,
  border: "2px solid #d6dbe5",
  background: "#fff",
  color: "#111",
  fontSize: 15,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const continueButton = {
  marginTop: 8,
  padding: "8px 18px",
  borderRadius: 14,
  border: "none",
  background: "#111827",
  color: "#fff",
  fontSize: 14,
  fontWeight: "bold",
};

const loadingText = {
  marginTop: 10,
  textAlign: "center" as const,
  color: "#6b7280",
};

function getCoachText(action: string) {
  if (action === "increase") return "Heute steigern";
  if (action === "decrease") return "Heute leichter";
  return "Heute halten";
}

function getDeltaColor(value: number) {
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "#475569";
}

function formatDelta(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatReps(value: number) {
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

function getConsistencyText(value: number) {
  if (value >= 0) return "Konstant";
  if (value > -3) return "Leicht schwaecher";
  return "Deutlich schwaecher";
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

function labelSet(setNumber: number) {
  return setNumber === 0 ? "(Warmup)" : `(Satz ${setNumber})`;
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

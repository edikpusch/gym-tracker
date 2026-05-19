"use client";

import { useEffect, useMemo, useState } from "react";

import {
  deleteWorkoutSession,
  getAllSets,
  getTopSet,
  isLoggedSetEntry,
  type SetType,
  type WorkoutLogEntry,
} from "@/lib/workoutEngine";
import { getActivePlanId, getTrainingPlan } from "@/lib/trainingPlans";
import { getExerciseLabel } from "@/lib/workoutUi";

type SessionExerciseSummary = {
  exercise: string;
  exerciseId: string;
  topSet: SetType | null;
  previousTopSet: SetType | null;
};

type SessionCard = {
  sessionId: string;
  timestamp: number;
  type: string;
  typeLabel: string;
  planId: string;
  planName: string;
  date: string;
  weekday: string;
  duration: number;
  sets: WorkoutLogEntry[];
  summaries: SessionExerciseSummary[];
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null
  );
  const [expandedSetListSessionId, setExpandedSetListSessionId] = useState<string | null>(
    null
  );
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(
    null
  );
  const [activePlanId, setActivePlanIdState] = useState("my-plan");
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    setActivePlanIdState(getActivePlanId());
  }, []);

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    function updateCompactMode() {
      const nextCompactMode =
        window.innerHeight <= 820 ||
        (window.innerHeight <= 900 && window.innerWidth <= 400);
      setCompactMode(nextCompactMode);
    }

    updateCompactMode();
    window.addEventListener("resize", updateCompactMode);

    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  const activePlan = useMemo(
    () => getTrainingPlan(activePlanId),
    [activePlanId]
  );

  const visibleSessions = useMemo(() => {
    if (showAllPlans) {
      return sessions;
    }

    return sessions.filter((session) => session.planId === activePlanId);
  }, [sessions, showAllPlans, activePlanId]);

  async function loadSessions() {
    try {
      setLoading(true);

      const sets = await getAllSets();
      const grouped = sets.reduce<Record<string, WorkoutLogEntry[]>>((acc, current) => {
        const key = String(current.sessionId);
        acc[key] ??= [];
        acc[key].push(current);
        return acc;
      }, {});

      const sortedSessionEntries = Object.entries(grouped)
        .map(([sessionId, sessionSets]) => {
          const orderedSets = [...sessionSets].sort(
            (a, b) => a.timestamp - b.timestamp
          );
          const first = orderedSets[0];
          const last = orderedSets[orderedSets.length - 1];
          const date = new Date(first.timestamp);
          const fallbackPlan = getTrainingPlan(
            first.planId ||
              (first.type?.includes(":") ? first.type.split(":")[0] : "my-plan")
          );

          return {
            sessionId,
            timestamp: first.timestamp,
            type: first.type || detectWorkoutType(orderedSets.filter(isLoggedSetEntry)),
            typeLabel:
              first.dayName || first.type || detectWorkoutType(orderedSets.filter(isLoggedSetEntry)),
            planId: first.planId || fallbackPlan.id,
            planName: first.planName || fallbackPlan.name,
            date: date.toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            weekday: capitalize(
              date.toLocaleDateString("de-DE", {
                weekday: "long",
              })
            ),
            duration: Math.max(
              1,
              Math.round((last.timestamp - first.timestamp) / 60000)
            ),
            sets: orderedSets,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      const exerciseHistory = new Map<string, SetType>();
      const cards: SessionCard[] = [];

      for (let index = sortedSessionEntries.length - 1; index >= 0; index -= 1) {
        const session = sortedSessionEntries[index];
        const sessionSetEntries = session.sets.filter(isLoggedSetEntry);
        const summaries = buildExerciseSummaries(
          sessionSetEntries,
          session.type,
          exerciseHistory
        );

        summaries.forEach((summary) => {
          if (summary.topSet) {
            exerciseHistory.set(
              getHistoryKey(session.type, summary.exercise, summary.exerciseId),
              summary.topSet
            );
          }
        });

        cards.unshift({
          ...session,
          summaries,
        });
      }

      setSessions(cards);
    } catch (error) {
      console.error("History load failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm(
      "Dieses Training wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    );

    if (!confirmed) {
      return;
    }

    const deleted = await deleteWorkoutSession(Number(sessionId));

    if (!deleted) {
      window.alert("Das Training konnte nicht gelöscht werden.");
      return;
    }

    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    }

    if (expandedSetListSessionId === sessionId) {
      setExpandedSetListSessionId(null);
    }

    if (expandedExerciseKey?.startsWith(`${sessionId}:`)) {
      setExpandedExerciseKey(null);
    }

    await loadSessions();
  }

  return (
    <main style={screen}>
      <div style={{ ...shell, ...(compactMode ? compactShell : null) }}>
        <div style={headerRow}>
          <div style={brandPill}>Gym Tracker</div>
          <div style={headerRight}>
            <a href="/index.html" style={backButton}>← Zurück</a>
          </div>
        </div>

        <div style={titleRow}>
          <div>
            <div style={eyebrow}>Verlauf</div>
            <h1 style={{ ...title, ...(compactMode ? compactTitle : null) }}>
              Alle Trainings
            </h1>
            <div style={{ ...headerCopy, ...(compactMode ? compactHeaderCopy : null) }}>
              {showAllPlans ? "Alle Pläne" : `Plan: ${activePlan.name}`}
            </div>
          </div>
        </div>

        <div style={{ ...filterRow, ...(compactMode ? compactFilterRow : null) }}>
          <button
            style={!showAllPlans ? activeFilterButton : filterButton}
            onClick={() => setShowAllPlans(false)}
          >
            Dieser Plan
          </button>
          <button
            style={showAllPlans ? activeFilterButton : filterButton}
            onClick={() => setShowAllPlans(true)}
          >
            Alle Pläne
          </button>
        </div>

        {loading ? <p style={emptyText}>Lade Verlauf...</p> : null}

        {!loading && visibleSessions.length === 0 ? (
          <div style={emptyState}>
            <div style={emptyTitle}>Noch keine Trainings gefunden</div>
            <div style={emptyCopy}>
              Sobald du ein Workout speicherst, siehst du hier deine letzten
              Einheiten.
            </div>
          </div>
        ) : null}

        {visibleSessions.map((session) => (
          <article
            key={session.sessionId}
            style={{ ...card, ...(compactMode ? compactCard : null) }}
          >
            <div style={cardTop}>
              <div>
                <div style={cardDate}>
                  {session.weekday} · {session.date}
                </div>
                <div
                  style={{
                    ...cardMetaLine,
                    ...(compactMode ? compactCardMetaLine : null),
                  }}
                >
                  {session.planName} · {session.typeLabel} · {session.duration} min ·{" "}
                  {session.sets.length} Sätze
                </div>
                <div style={sessionCompareRow}>
                  {getSessionStats(session.summaries).map((item) => (
                    <span key={`${session.sessionId}-${item.label}`} style={item.style}>
                      {item.text}
                    </span>
                  ))}
                </div>
              </div>

              <div style={cardButtonStack}>
                <button
                  style={toggleButton}
                  onClick={() => {
                    setExpandedSessionId((current) => {
                      const next = current === session.sessionId ? null : session.sessionId;
                      if (!next) {
                        setExpandedSetListSessionId((setListCurrent) =>
                          setListCurrent === session.sessionId ? null : setListCurrent
                        );
                      }
                      return next;
                    });
                  }}
                >
                  {expandedSessionId === session.sessionId ? "Übersicht" : "Details"}
                </button>
                <button
                  style={deleteButton}
                  onClick={() => void handleDeleteSession(session.sessionId)}
                >
                  Löschen
                </button>
              </div>
            </div>

            <div
              style={{
                ...summaryGrid,
                ...(compactMode ? compactSummaryGrid : null),
              }}
            >
              {(expandedSessionId === session.sessionId
                ? session.summaries
                : session.summaries.slice(0, 2)
              ).map((summary) => (
                (() => {
                  const summaryKey = `${session.sessionId}:${summary.exerciseId}`;
                  return (
                <div
                  key={summaryKey}
                  style={{
                    ...summaryCard,
                    ...(compactMode ? compactSummaryCard : null),
                    ...(expandedExerciseKey === summaryKey
                      ? expandedSummaryCard
                      : null),
                  }}
                  onClick={() =>
                    setExpandedExerciseKey((current) =>
                      current === summaryKey
                        ? null
                        : summaryKey
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedExerciseKey((current) =>
                        current === summaryKey
                          ? null
                          : summaryKey
                      );
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div style={summaryCardHeader}>
                  <div
                    style={{
                      ...summaryExercise,
                      ...(compactMode ? compactSummaryExercise : null),
                    }}
                  >
                    {getExerciseLabel(summary.exercise)}
                  </div>
                    <span style={summaryCardChevron}>
                      {expandedExerciseKey === summaryKey
                        ? "v"
                        : ">"}
                    </span>
                  </div>
                  {summary.topSet ? (
                    <div
                      style={{
                        ...summaryTopSet,
                        ...(compactMode ? compactSummaryTopSet : null),
                      }}
                    >
                      {summary.topSet.weight} kg x {summary.topSet.reps}
                    </div>
                  ) : null}
                  <div style={summaryBadgeRow}>
                    <span style={getComparisonBadgeStyle(summary)}>
                      {getComparisonArrow(summary)} {getComparisonLabel(summary)}
                    </span>
                  </div>
                  {expandedExerciseKey === summaryKey ? (
                    <div style={summarySetList}>
                      {session.sets
                        .filter(
                          (set) =>
                            isLoggedSetEntry(set) &&
                            (set.exerciseId
                              ? set.exerciseId === summary.exerciseId
                              : set.exercise === summary.exercise)
                        )
                        .sort((a, b) => a.set - b.set)
                        .map((set, index) => (
                          <div
                            key={`${summaryKey}-${set.timestamp}-${index}`}
                            style={summarySetRow}
                          >
                            <span style={summarySetLabel}>
                              {labelSet(set.set)}
                            </span>
                            <span style={summarySetValue}>
                              {set.weight} kg x {set.reps}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
                  );
                })()
              ))}
              {expandedSessionId !== session.sessionId &&
              session.summaries.length > 2 ? (
                <button
                  style={moreSummariesCard}
                  onClick={() => setExpandedSessionId(session.sessionId)}
                >
                  +{session.summaries.length - 2} weitere Übungen
                </button>
              ) : null}
            </div>

            {expandedSessionId === session.sessionId ? (
              <div style={sessionDetailActions}>
                <button
                  style={sessionDetailButton}
                  onClick={() =>
                    setExpandedSetListSessionId((current) =>
                      current === session.sessionId ? null : session.sessionId
                    )
                  }
                >
                  {expandedSetListSessionId === session.sessionId
                    ? "Satzliste ausblenden"
                    : "Alle Sätze anzeigen"}
                </button>
              </div>
            ) : null}

            {expandedSessionId === session.sessionId &&
            expandedSetListSessionId === session.sessionId ? (
              <div style={setList}>
                {session.sets.map((set, index) => (
                  <div
                    key={`${session.sessionId}-${set.exercise}-${index}`}
                    style={setRow}
                  >
                    <span style={exerciseName}>
                      {getExerciseLabel(set.exercise)} {labelSet(set.set)}
                    </span>
                    <span style={setValue}>
                      {set.weight} kg x {set.reps}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        <div style={bottomRow}>
          <a href="/index.html" style={bottomLink}>← Start</a>
        </div>
      </div>
    </main>
  );
}

const screen = {
  minHeight: "100%",
  padding: "10px 10px calc(26px + env(safe-area-inset-bottom))",
  background: "radial-gradient(circle at top, #dde6f5 0%, #f3f5f9 42%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
  boxSizing: "border-box" as const,
};

const shell = {
  maxWidth: 460,
  margin: "0 auto",
  padding: "12px",
  borderRadius: 30,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.08)",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 10,
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

const headerRight = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const backButton = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f1f5f9",
  color: "#374151",
  fontSize: 12,
  fontWeight: "bold",
  textDecoration: "none",
};

const titleRow = {
  marginBottom: 10,
};

const eyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: "#64748b",
  fontWeight: "bold",
};

const title = {
  marginTop: 4,
  fontSize: 28,
  fontWeight: 800,
  color: "#111827",
};

const headerCopy = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 700,
  color: "#475569",
};

const filterRow = {
  display: "flex",
  gap: 8,
  marginBottom: 12,
  flexWrap: "wrap" as const,
};

const filterButton = {
  minHeight: 36,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#f8fafc",
  color: "#374151",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const activeFilterButton = {
  ...filterButton,
  background: "#eef4ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
};

const emptyText = {
  marginTop: 24,
  opacity: 0.7,
};

const emptyState = {
  marginTop: 16,
  padding: "16px 14px",
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e6ebf2",
};

const emptyTitle = {
  fontWeight: "bold",
};

const emptyCopy = {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.45,
  opacity: 0.72,
};

const card = {
  marginTop: 10,
  padding: "14px 14px",
  borderRadius: 20,
  background: "linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)",
  border: "1px solid #e5ebf4",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05)",
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
};

const cardButtonStack = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "end",
  gap: 6,
};

const cardDate = {
  fontWeight: 800,
  fontSize: 15,
  color: "#111827",
};

const cardMetaLine = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
};

const sessionCompareRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 6,
};

const summaryGrid = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  marginTop: 12,
};

const summaryCard = {
  padding: "12px 12px 10px",
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid #e8ecf3",
  boxShadow: "0 12px 22px rgba(15, 23, 42, 0.04)",
  width: "100%",
  cursor: "pointer",
};

const expandedSummaryCard = {
  border: "1px solid #cfe0ff",
  boxShadow: "0 12px 26px rgba(59, 130, 246, 0.08)",
};

const summaryCardHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const summaryCardChevron = {
  fontSize: 15,
  fontWeight: "bold",
  color: "#64748b",
};

const moreSummariesCard = {
  minHeight: 74,
  borderRadius: 18,
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 18px",
  width: "100%",
};

const summaryExercise = {
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
};

const summaryTopSet = {
  marginTop: 6,
  fontSize: 20,
  fontWeight: 800,
  color: "#111827",
};

const summaryBadgeRow = {
  marginTop: 8,
  display: "flex",
};

const summarySetList = {
  marginTop: 8,
  display: "grid",
  gap: 6,
};

const summarySetRow = {
  paddingTop: 6,
  borderTop: "1px solid #edf2f7",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 14,
};

const summarySetLabel = {
  color: "#64748b",
  fontWeight: 700,
};

const summarySetValue = {
  color: "#111827",
  fontWeight: 700,
};

const baseBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const successBadge = {
  ...baseBadge,
  color: "#15803d",
  background: "#ecfdf3",
};

const warningBadge = {
  ...baseBadge,
  color: "#b91c1c",
  background: "#fff1f2",
};

const neutralBadge = {
  ...baseBadge,
  color: "#475569",
  background: "#f3f4f6",
};

const sessionDetailActions = {
  marginTop: 10,
  display: "flex",
  justifyContent: "flex-start",
};

const sessionDetailButton = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 13,
  fontWeight: 800,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
};

const setList = {
  marginTop: 12,
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const setRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 14,
  paddingTop: 6,
  borderTop: "1px solid #eceff5",
};

const exerciseName = {
  fontWeight: 600,
};

const setValue = {
  fontWeight: 600,
};

const toggleButton = {
  border: "1px solid #d7e1ef",
  background: "#f8fafc",
  color: "#374151",
  fontWeight: 800,
  fontSize: 12,
  borderRadius: 999,
  padding: "7px 11px",
  cursor: "pointer",
};

const deleteButton = {
  border: "1px solid #fecdd3",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 800,
  fontSize: 12,
  borderRadius: 999,
  padding: "7px 11px",
  cursor: "pointer",
};

const bottomRow = {
  marginTop: 12,
  display: "flex",
  justifyContent: "center",
};

const bottomLink = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "8px 20px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: "bold",
  textDecoration: "none",
  color: "#374151",
  background: "#f1f5f9",
  border: "1px solid #d7e1ef",
};

const compactShell = {
  padding: "10px",
};

const compactTitle = {
  fontSize: 22,
};

const compactHeaderCopy = {
  fontSize: 12,
};

const compactFilterRow = {
  marginBottom: 8,
};

const compactCard = {
  marginTop: 8,
  padding: "10px 12px",
  borderRadius: 14,
};

const compactCardMetaLine = {
  fontSize: 12,
};

const compactSummaryGrid = {
  gap: 8,
  marginTop: 12,
};

const compactSummaryCard = {
  padding: "9px 9px 8px",
};

const compactSummaryExercise = {
  fontSize: 13,
};

const compactSummaryTopSet = {
  fontSize: 16,
};

function buildExerciseSummaries(
  sets: SetType[],
  sessionType: string,
  exerciseHistory: Map<string, SetType>
) {
  const grouped = sets.reduce<Record<string, SetType[]>>((acc, current) => {
    const key = current.exerciseId ?? current.exercise;
    acc[key] ??= [];
    acc[key].push(current);
    return acc;
  }, {});

  return Object.entries(grouped).map(([exerciseId, exerciseSets]) => ({
    exercise: exerciseSets[0]?.exercise ?? "",
    exerciseId,
    topSet: getTopSet(exerciseSets),
    previousTopSet:
      exerciseHistory.get(
        getHistoryKey(sessionType, exerciseSets[0]?.exercise ?? "", exerciseId)
      ) ?? null,
  }));
}

function getHistoryKey(sessionType: string, exercise: string, exerciseId?: string) {
  return `${sessionType}:${exerciseId ?? exercise}`;
}

function getComparisonArrow(summary: SessionExerciseSummary) {
  const result = compareTopSet(summary.topSet, summary.previousTopSet);
  if (result > 0) return "↑";
  if (result < 0) return "↓";
  return "→";
}

function getComparisonLabel(summary: SessionExerciseSummary) {
  if (!summary.previousTopSet) {
    return "Neu";
  }

  const result = compareTopSet(summary.topSet, summary.previousTopSet);
  if (result > 0) return "Besser";
  if (result < 0) return "Schwächer";
  return "Gleich";
}

function getComparisonBadgeStyle(summary: SessionExerciseSummary) {
  if (!summary.previousTopSet) {
    return neutralBadge;
  }

  const result = compareTopSet(summary.topSet, summary.previousTopSet);
  if (result > 0) return successBadge;
  if (result < 0) return warningBadge;
  return neutralBadge;
}

function getSessionStats(summaries: SessionExerciseSummary[]) {
  const counts = {
    better: 0,
    worse: 0,
    same: 0,
    new: 0,
  };

  summaries.forEach((summary) => {
    if (!summary.previousTopSet) {
      counts.new += 1;
      return;
    }

    const result = compareTopSet(summary.topSet, summary.previousTopSet);
    if (result > 0) counts.better += 1;
    else if (result < 0) counts.worse += 1;
    else counts.same += 1;
  });

  const items = [];

  if (counts.better > 0) {
    items.push({
      label: "better",
      text: `${counts.better} besser`,
      style: successBadge,
    });
  }
  if (counts.worse > 0) {
    items.push({
      label: "worse",
      text: `${counts.worse} schwächer`,
      style: warningBadge,
    });
  }
  if (counts.same > 0) {
    items.push({
      label: "same",
      text: `${counts.same} gleich`,
      style: neutralBadge,
    });
  }
  if (counts.new > 0) {
    items.push({
      label: "new",
      text: `${counts.new} neu`,
      style: neutralBadge,
    });
  }

  return items;
}

function compareTopSet(current: SetType | null, previous: SetType | null) {
  if (!current || !previous) {
    return 0;
  }

  if (current.weight !== previous.weight) {
    return current.weight - previous.weight;
  }

  return current.reps - previous.reps;
}

function detectWorkoutType(sets: SetType[]) {
  const exerciseNames = sets.map((set) => set.exercise);

  if (
    exerciseNames.some((name) =>
      ["benchpress", "pullups_wide", "shoulderpress", "dips"].includes(name)
    )
  ) {
    return "push";
  }

  if (
    exerciseNames.some((name) =>
      ["rows", "pushups", "romanian_deadlift", "face_pulls"].includes(name)
    )
  ) {
    return "pull";
  }

  if (
    exerciseNames.some((name) =>
      ["squat", "pullups", "shoulderpress_pushups", "core"].includes(name)
    )
  ) {
    return "mixed";
  }

  return "workout";
}

function labelSet(setNumber?: number) {
  if (setNumber === undefined) return "";
  if (setNumber === 0) return "(Warm-up)";
  return `(Satz ${setNumber})`;
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}


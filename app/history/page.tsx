"use client";

import { useEffect, useState } from "react";

import { getAllSets, getTopSet, type SetType } from "@/lib/workoutEngine";
import { getExerciseLabel } from "@/lib/workoutUi";

type SessionExerciseSummary = {
  exercise: string;
  topSet: SetType | null;
  previousTopSet: SetType | null;
};

type SessionCard = {
  sessionId: string;
  timestamp: number;
  type: string;
  date: string;
  weekday: string;
  duration: number;
  sets: SetType[];
  summaries: SessionExerciseSummary[];
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const sets = await getAllSets();

        const grouped = sets.reduce<Record<string, SetType[]>>((acc, current) => {
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

            return {
              sessionId,
              timestamp: first.timestamp,
              type: first.type || detectWorkoutType(orderedSets),
              date: date.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }),
              weekday: date.toLocaleDateString("de-DE", {
                weekday: "long",
              }),
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
          const summaries = buildExerciseSummaries(session.sets, exerciseHistory);

          summaries.forEach((summary) => {
            if (summary.topSet) {
              exerciseHistory.set(summary.exercise, summary.topSet);
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

    load();
  }, []);

  return (
    <main style={screen}>
      <div style={shell}>
        <div style={headerRow}>
          <div>
            <div style={eyebrow}>Verlauf</div>
            <h1 style={title}>Alle Trainings</h1>
          </div>

          <a href="/index.html" style={backPill}>
            Start
          </a>
        </div>

        {loading && <p style={emptyText}>Lade Verlauf...</p>}
        {!loading && sessions.length === 0 && (
          <div style={emptyState}>
            <div style={emptyTitle}>Noch keine Trainings gefunden</div>
            <div style={emptyCopy}>
              Sobald du ein Workout speicherst, siehst du hier deine Vergleiche.
            </div>
          </div>
        )}

        {sessions.map((session) => (
          <article key={session.sessionId} style={card}>
            <div style={cardTop}>
              <div>
                <div style={cardDate}>
                  {capitalize(session.weekday)} - {session.date}
                </div>
                <div style={cardMetaLine}>
                  {session.duration} min - {session.sets.length} Saetze
                </div>
                <div style={sessionCompareRow}>
                  {getSessionStats(session.summaries).map((item) => (
                    <span key={`${session.sessionId}-${item.label}`} style={item.style}>
                      {item.text}
                    </span>
                  ))}
                </div>
              </div>
              <div style={topActions}>
                <span style={badge}>{session.type}</span>
                <button
                  style={toggleButton}
                  onClick={() =>
                    setExpandedSessionId((current) =>
                      current === session.sessionId ? null : session.sessionId
                    )
                  }
                >
                  {expandedSessionId === session.sessionId ? "Saetze" : "Details"}
                </button>
              </div>
            </div>

            <div style={summaryGrid}>
              {session.summaries.map((summary) => (
                <div key={`${session.sessionId}-${summary.exercise}`} style={summaryCard}>
                  <div style={summaryExercise}>{getExerciseLabel(summary.exercise)}</div>
                  {summary.topSet && (
                    <div style={summaryTopSet}>
                      {summary.topSet.weight} kg x {summary.topSet.reps}
                    </div>
                  )}
                  <div style={summaryBadgeRow}>
                    <span style={getComparisonBadgeStyle(summary)}>
                      {getComparisonArrow(summary)} {getComparisonLabel(summary)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {expandedSessionId === session.sessionId && (
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
            )}
          </article>
        ))}

        <a href="/index.html" style={bottomLink}>
          Zur Startseite
        </a>
      </div>
    </main>
  );
}

const screen = {
  minHeight: "100dvh",
  padding: "18px 16px 32px",
  background:
    "radial-gradient(circle at top, #e7eefb 0%, #f4f6fb 34%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
};

const shell = {
  maxWidth: 520,
  margin: "0 auto",
  padding: "20px 18px 24px",
  borderRadius: 30,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.10)",
  backdropFilter: "blur(14px)",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "start",
};

const eyebrow = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
  opacity: 0.5,
};

const title = {
  marginTop: 4,
  fontSize: 30,
  fontWeight: "bold",
};

const backPill = {
  padding: "10px 14px",
  borderRadius: 999,
  textDecoration: "none",
  color: "#111827",
  fontWeight: "bold",
  background: "#f3f6fb",
  border: "1px solid #dde5f0",
};

const emptyText = {
  marginTop: 24,
  opacity: 0.7,
};

const emptyState = {
  marginTop: 20,
  padding: "18px 16px",
  borderRadius: 22,
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
  marginTop: 16,
  padding: 16,
  borderRadius: 22,
  background: "#f9fbff",
  border: "1px solid #e8ecf3",
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
};

const topActions = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "end",
  gap: 8,
};

const cardDate = {
  fontWeight: "bold",
  fontSize: 16,
};

const cardMetaLine = {
  marginTop: 4,
  fontSize: 13,
  opacity: 0.62,
};

const sessionCompareRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 8,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const summaryCard = {
  padding: "12px 12px 10px",
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid #e8ecf3",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
};

const summaryExercise = {
  fontSize: 14,
  fontWeight: "bold",
  color: "#111827",
};

const summaryTopSet = {
  marginTop: 6,
  fontSize: 18,
  fontWeight: "bold",
  color: "#111827",
};

const summaryBadgeRow = {
  marginTop: 8,
  display: "flex",
};

const baseBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: "bold",
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

const setList = {
  marginTop: 14,
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const setRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 14,
  paddingTop: 8,
  borderTop: "1px solid #eceff5",
};

const exerciseName = {
  fontWeight: 600,
};

const setValue = {
  fontWeight: 600,
};

const badge = {
  background: "#111827",
  color: "#fff",
  padding: "6px 10px",
  borderRadius: 999,
  textTransform: "capitalize" as const,
  fontSize: 12,
};

const toggleButton = {
  border: "1px solid #dde5f0",
  background: "#fff",
  color: "#111827",
  fontWeight: "bold",
  fontSize: 12,
  borderRadius: 999,
  padding: "6px 10px",
};

const bottomLink = {
  marginTop: 22,
  width: "100%",
  padding: 16,
  borderRadius: 18,
  fontSize: 16,
  fontWeight: "bold",
  display: "block",
  textAlign: "center" as const,
  textDecoration: "none",
  color: "#111827",
  background: "#f3f6fb",
  border: "1px solid #dde5f0",
};

function buildExerciseSummaries(
  sets: SetType[],
  exerciseHistory: Map<string, SetType>
) {
  const grouped = sets.reduce<Record<string, SetType[]>>((acc, current) => {
    acc[current.exercise] ??= [];
    acc[current.exercise].push(current);
    return acc;
  }, {});

  return Object.entries(grouped).map(([exercise, exerciseSets]) => ({
    exercise,
    topSet: getTopSet(exerciseSets),
    previousTopSet: exerciseHistory.get(exercise) ?? null,
  }));
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
  if (result < 0) return "Schwaecher";
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
    items.push({ label: "better", text: `${counts.better} besser`, style: successBadge });
  }
  if (counts.worse > 0) {
    items.push({
      label: "worse",
      text: `${counts.worse} schwaecher`,
      style: warningBadge,
    });
  }
  if (counts.same > 0) {
    items.push({ label: "same", text: `${counts.same} gleich`, style: neutralBadge });
  }
  if (counts.new > 0) {
    items.push({ label: "new", text: `${counts.new} neu`, style: neutralBadge });
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
  if (setNumber === 0) return "(Warmup)";
  return `(Satz ${setNumber})`;
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

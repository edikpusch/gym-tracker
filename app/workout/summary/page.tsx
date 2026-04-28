"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  getBestMatchingSet,
  getPreviousMatchingSet,
  getSetComparison,
  getSetsBySession,
  getTopSet,
  type SetComparisonKind,
  type SetType,
} from "@/lib/workoutEngine";
import { getTrainingPlan } from "@/lib/trainingPlans";
import { getExerciseLabel } from "@/lib/workoutUi";

type SummaryRow = {
  setNumber: number;
  current: SetType;
  previous: SetType | null;
  best: SetType | null;
  comparison: ReturnType<typeof getSetComparison>;
};

type ExerciseSummary = {
  exercise: string;
  rows: SummaryRow[];
};

export default function SummaryPage() {
  return (
    <Suspense fallback={<div style={screen}>Lade Daten...</div>}>
      <SummaryContent />
    </Suspense>
  );
}

function SummaryContent() {
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionMeta, setSessionMeta] = useState("");
  const [exerciseData, setExerciseData] = useState<ExerciseSummary[]>([]);
  const [compactMode, setCompactMode] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const params = useSearchParams();
  const sessionIdParam = params.get("sessionId");
  const sessionId =
    sessionIdParam && !isNaN(Number(sessionIdParam))
      ? Number(sessionIdParam)
      : null;

  useEffect(() => {
    async function loadSession() {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const data = await getSetsBySession(sessionId);
        const workSets = data.filter((set) => set.set > 0);
        const first = data[0];
        const workoutType = first?.type;

        if (data.length > 0 && first) {
          const min = data[0].timestamp;
          const max = data[data.length - 1].timestamp;
          const fallbackPlan = getTrainingPlan(
            first.planId ||
              (first.type?.includes(":") ? first.type.split(":")[0] : "my-plan")
          );

          setDuration(Math.max(1, Math.round((max - min) / 60000)));
          setSessionDate(
            new Date(min).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          );
          setSessionMeta(
            [first.planName || fallbackPlan.name, first.dayName || "Workout"]
              .filter(Boolean)
              .join(" · ")
          );
        }

        const grouped = new Map<string, SetType[]>();
        workSets.forEach((set) => {
          if (!grouped.has(set.exercise)) {
            grouped.set(set.exercise, []);
          }
          grouped.get(set.exercise)!.push(set);
        });

        const result: ExerciseSummary[] = [];

        for (const [exercise, currentSets] of grouped.entries()) {
          const sortedSets = [...currentSets].sort((a, b) => a.set - b.set);

          const rows = await Promise.all(
            sortedSets.map(async (current) => {
              const previous = await getPreviousMatchingSet(
                exercise,
                current.set,
                workoutType,
                sessionId
              );
              const best = await getBestMatchingSet(
                exercise,
                current.set,
                workoutType
              );

              return {
                setNumber: current.set,
                current,
                previous,
                best,
                comparison: getSetComparison(current, previous),
              };
            })
          );

          result.push({
            exercise,
            rows,
          });
        }

        setExerciseData(result);
      } catch (error) {
        console.error("Summary load failed:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, [sessionId]);

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

  const stats = useMemo(() => getSummaryStats(exerciseData), [exerciseData]);

  return (
    <div style={screen}>
      <div style={{ ...shell, ...(compactMode ? compactShell : null) }}>
        <div style={{ ...hero, ...(compactMode ? compactHero : null) }}>
          <div style={heroTopRow}>
            <div>
              <div style={{ ...title, ...(compactMode ? compactTitle : null) }}>
                Training {sessionDate || "-"}
              </div>
              {sessionMeta ? (
                <div
                  style={{ ...metaLine, ...(compactMode ? compactMetaLine : null) }}
                >
                  {sessionMeta}
                </div>
              ) : null}
            </div>
            <a
              href="/index.html"
              style={{ ...backButton, ...(compactMode ? compactBackButton : null) }}
            >
              ← Zurück
            </a>
          </div>

          {!loading ? (
            <>
              <div
                style={{
                  ...durationRow,
                  ...(compactMode ? compactDurationRow : null),
                }}
              >
                <span style={statLabel}>Dauer</span>
                <span
                  style={{
                    ...statValue,
                    ...(compactMode ? compactStatValue : null),
                  }}
                >
                  {duration} min
                </span>
              </div>

              <div
                style={{
                  ...heroSummaryRow,
                  ...(compactMode ? compactHeroSummaryRow : null),
                }}
              >
                <span style={successBadge}>{stats.better} besser</span>
                <span style={neutralBadge}>{stats.same} gleich</span>
                <span style={warningBadge}>{stats.worse} schwächer</span>
                {stats.newCount > 0 ? (
                  <span style={newBadge}>{stats.newCount} neu</span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {loading ? (
          <p style={loadingText}>Lade Daten...</p>
        ) : (
          <div style={contentScroll}>
            <div
              style={{
                ...exerciseGrid,
                ...(compactMode ? compactExerciseGrid : null),
              }}
            >
              {exerciseData.map((exercise) => (
                <div
                  key={exercise.exercise}
                  style={{ ...card, ...(compactMode ? compactCard : null) }}
                >
                  <div
                    style={{
                      ...exerciseTitle,
                      ...(compactMode ? compactExerciseTitle : null),
                    }}
                  >
                    {getExerciseLabel(exercise.exercise)}
                  </div>

                  <div style={overviewBlock}>
                    <div
                      style={{
                        ...overviewTopSet,
                        ...(compactMode ? compactOverviewTopSet : null),
                      }}
                    >
                      {formatTopSet(exercise.rows)}
                    </div>
                    <div style={overviewCaption}>Bester Satz heute</div>
                    <div style={overviewBadgeRow}>
                      {getExerciseStats(exercise.rows).map((item) => (
                        <span key={`${exercise.exercise}-${item.label}`} style={item.style}>
                          {item.text}
                        </span>
                      ))}
                    </div>
                    <button
                      style={detailsButton}
                      onClick={() =>
                        setExpandedExercise((current) =>
                          current === exercise.exercise ? null : exercise.exercise
                        )
                      }
                    >
                      {expandedExercise === exercise.exercise ? "Details zu" : "Sätze"}
                    </button>
                  </div>

                  {expandedExercise === exercise.exercise ? (
                    <div
                      style={{
                        ...rowsStack,
                        ...(compactMode ? compactRowsStack : null),
                      }}
                    >
                      {exercise.rows.map((row) => (
                        <div
                          key={`${exercise.exercise}-${row.setNumber}`}
                          style={{ ...setRow, ...(compactMode ? compactSetRow : null) }}
                        >
                          <div style={setHeaderRow}>
                            <span style={setLabel}>Satz {row.setNumber}</span>
                            <span style={getStatusBadgeStyle(row.comparison?.kind)}>
                              {getStatusArrow(row.comparison?.kind)}{" "}
                              {getStatusLabel(row.comparison?.kind)}
                            </span>
                          </div>

                          <div
                            style={{
                              ...todayValue,
                              ...(compactMode ? compactTodayValue : null),
                            }}
                          >
                            Heute: {formatSetValue(row.current)}
                          </div>
                          <div
                            style={{
                              ...comparisonLine,
                              ...(compactMode ? compactComparisonLine : null),
                            }}
                          >
                            Letztes Mal: {formatSetValue(row.previous)}
                          </div>
                          <div
                            style={{
                              ...comparisonLine,
                              ...(compactMode ? compactComparisonLine : null),
                            }}
                          >
                            Bestwert: {formatSetValue(row.best)}
                          </div>
                          <div
                            style={{
                              ...deltaLine,
                              ...(compactMode ? compactDeltaLine : null),
                            }}
                          >
                            Differenz: {formatDelta(row.comparison)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            ...actionStack,
            ...(compactMode ? compactActionStack : null),
          }}
        >
          <a href="/index.html" style={primaryButton}>
            Start
          </a>
          <a href="/history/index.html" style={secondaryButton}>
            ◷ Verlauf
          </a>
        </div>
      </div>
    </div>
  );
}

function getSummaryStats(exercises: ExerciseSummary[]) {
  return exercises
    .flatMap((exercise) => exercise.rows)
    .reduce(
      (acc, row) => {
        const kind = row.comparison?.kind ?? "new";
        if (kind === "better") acc.better += 1;
        if (kind === "same") acc.same += 1;
        if (kind === "worse") acc.worse += 1;
        if (kind === "new") acc.newCount += 1;
        return acc;
      },
      {
        better: 0,
        same: 0,
        worse: 0,
        newCount: 0,
      }
    );
}

function getExerciseStats(rows: SummaryRow[]) {
  const counts = {
    better: 0,
    same: 0,
    worse: 0,
    newCount: 0,
  };

  rows.forEach((row) => {
    const kind = row.comparison?.kind ?? "new";
    if (kind === "better") counts.better += 1;
    if (kind === "same") counts.same += 1;
    if (kind === "worse") counts.worse += 1;
    if (kind === "new") counts.newCount += 1;
  });

  const items = [];
  if (counts.better > 0) {
    items.push({ label: "better", text: `${counts.better} besser`, style: successBadge });
  }
  if (counts.same > 0) {
    items.push({ label: "same", text: `${counts.same} gleich`, style: neutralBadge });
  }
  if (counts.worse > 0) {
    items.push({ label: "worse", text: `${counts.worse} schwächer`, style: warningBadge });
  }
  if (counts.newCount > 0) {
    items.push({ label: "new", text: `${counts.newCount} neu`, style: newBadge });
  }

  return items;
}

function formatTopSet(rows: SummaryRow[]) {
  const topSet = getTopSet(rows.map((row) => row.current));
  if (!topSet) {
    return "Neu";
  }

  return `${topSet.weight} kg x ${topSet.reps}`;
}

function formatSetValue(set: SetType | null) {
  if (!set) {
    return "Neu";
  }

  return `${set.weight} kg x ${set.reps}`;
}

function formatDelta(comparison: ReturnType<typeof getSetComparison>) {
  if (!comparison || comparison.kind === "new") {
    return "Neu";
  }

  if (comparison.weight === 0 && comparison.reps === 0) {
    return "0 kg / 0 Wdh.";
  }

  const parts = [];

  if (comparison.weight !== 0) {
    parts.push(`${formatSignedNumber(comparison.weight)} kg`);
  }

  if (comparison.reps !== 0) {
    parts.push(`${formatSignedNumber(comparison.reps)} Wdh.`);
  }

  return parts.join(" / ");
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function getStatusLabel(kind: SetComparisonKind | undefined) {
  if (!kind || kind === "new") return "Neu";
  if (kind === "better") return "Besser";
  if (kind === "worse") return "Schwächer";
  return "Gleich";
}

function getStatusArrow(kind: SetComparisonKind | undefined) {
  if (!kind || kind === "new") return "→";
  if (kind === "better") return "↑";
  if (kind === "worse") return "↓";
  return "→";
}

function getStatusBadgeStyle(kind: SetComparisonKind | undefined) {
  if (!kind || kind === "new") {
    return newBadge;
  }

  if (kind === "better") {
    return successBadge;
  }

  if (kind === "worse") {
    return warningBadge;
  }

  return neutralBadge;
}

const screen = {
  height: "100dvh",
  padding: "10px 10px 12px",
  overflow: "hidden" as const,
  background:
    "radial-gradient(circle at top, #e7eefb 0%, #f4f6fb 34%, #fbfbfd 100%)",
  fontFamily: "sans-serif",
};

const shell = {
  maxWidth: 460,
  height: "100%",
  margin: "0 auto",
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  gap: 10,
};

const hero = {
  padding: "14px 16px",
  borderRadius: 24,
  background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
  color: "#fff",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.18)",
};

const heroTopRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
};

const title = {
  fontSize: 22,
  fontWeight: "bold",
  lineHeight: 1.1,
};

const metaLine = {
  marginTop: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "rgba(255,255,255,0.74)",
};

const durationRow = {
  marginTop: 10,
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};

const statLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  opacity: 0.68,
};

const statValue = {
  fontSize: 22,
  fontWeight: "bold",
};

const backButton = {
  minHeight: 34,
  padding: "8px 12px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  background: "#f8fafc",
  border: "1px solid rgba(255,255,255,0.22)",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.12)",
};

const heroSummaryRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 10,
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

const newBadge = {
  ...baseBadge,
  color: "#1d4ed8",
  background: "#eaf2ff",
};

const loadingText = {
  marginTop: 16,
  opacity: 0.72,
};

const contentScroll = {
  overflowY: "auto" as const,
  minHeight: 0,
  paddingRight: 2,
};

const exerciseGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  alignContent: "start" as const,
};

const card = {
  padding: 12,
  border: "1px solid #e8ecf3",
  borderRadius: 18,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const exerciseTitle = {
  fontWeight: "bold",
  fontSize: 15,
  lineHeight: 1.15,
  color: "#111827",
};

const rowsStack = {
  marginTop: 10,
  display: "grid",
  gap: 8,
};

const overviewBlock = {
  marginTop: 10,
  display: "grid",
  gap: 8,
};

const overviewTopSet = {
  fontSize: 20,
  fontWeight: "bold",
  color: "#111827",
  lineHeight: 1.05,
};

const overviewCaption = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 600,
};

const overviewBadgeRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const detailsButton = {
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid #dde5f0",
  background: "#f8fafc",
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold",
  justifySelf: "start" as const,
};

const setRow = {
  paddingTop: 8,
  borderTop: "1px solid #edf2f7",
};

const setHeaderRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const setLabel = {
  fontSize: 12,
  fontWeight: "bold",
  letterSpacing: 0.3,
  color: "#475569",
  textTransform: "uppercase" as const,
};

const todayValue = {
  marginTop: 7,
  fontSize: 15,
  fontWeight: "bold",
  color: "#111827",
};

const comparisonLine = {
  marginTop: 4,
  fontSize: 13,
  color: "#475569",
};

const deltaLine = {
  marginTop: 5,
  fontSize: 13,
  fontWeight: 600,
  color: "#1f2937",
};

const actionStack = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const primaryButton = {
  minHeight: 48,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#fff",
  background: "#111827",
  fontWeight: "bold",
  boxShadow: "0 14px 32px rgba(17, 24, 39, 0.12)",
};

const secondaryButton = {
  minHeight: 48,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111827",
  background: "#f3f6fb",
  border: "1px solid #dde5f0",
  fontWeight: "bold",
};

const compactShell = {
  gap: 8,
};

const compactHero = {
  padding: "12px 14px",
  borderRadius: 22,
};

const compactTitle = {
  fontSize: 20,
};

const compactMetaLine = {
  fontSize: 12,
  marginTop: 5,
};

const compactBackButton = {
  minHeight: 32,
  padding: "7px 10px",
  fontSize: 11,
};

const compactDurationRow = {
  marginTop: 8,
};

const compactStatValue = {
  fontSize: 19,
};

const compactHeroSummaryRow = {
  marginTop: 8,
  gap: 5,
};

const compactExerciseGrid = {
  gap: 6,
};

const compactCard = {
  padding: 10,
  borderRadius: 16,
};

const compactExerciseTitle = {
  fontSize: 14,
};

const compactRowsStack = {
  marginTop: 8,
  gap: 6,
};

const compactOverviewTopSet = {
  fontSize: 18,
};

const compactSetRow = {
  paddingTop: 6,
};

const compactTodayValue = {
  marginTop: 6,
  fontSize: 14,
};

const compactComparisonLine = {
  marginTop: 3,
  fontSize: 12,
};

const compactDeltaLine = {
  marginTop: 4,
  fontSize: 12,
};

const compactActionStack = {
  gap: 8,
};

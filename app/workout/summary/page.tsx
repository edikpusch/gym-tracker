"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clearActiveWorkoutState } from "@/lib/activeWorkout";

import {
  getBestMatchingSet,
  getPreviousMatchingSet,
  getSetComparison,
  getSessionSetEntries,
  getSetsBySession,
  isFlowEventEntry,
  getTopSet,
  type SetComparisonKind,
  type SetType,
  type WorkoutFlowEvent,
  type WorkoutLogEntry,
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
  warmupCount: number;
  rows: SummaryRow[];
  topRow: SummaryRow | null;
};

type SessionFlowStats = {
  stretchCount: number;
  pauseCount: number;
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
  const [flowStats, setFlowStats] = useState<SessionFlowStats>({
    stretchCount: 0,
    pauseCount: 0,
  });
  const [flowEntries, setFlowEntries] = useState<WorkoutFlowEvent[]>([]);
  const [compactMode, setCompactMode] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const params = useSearchParams();
  const sessionIdParam = params.get("sessionId");
  const sessionId =
    sessionIdParam && !isNaN(Number(sessionIdParam))
      ? Number(sessionIdParam)
      : null;

  useEffect(() => {
    clearActiveWorkoutState();
  }, []);

  useEffect(() => {
    async function loadSession() {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const entries = await getSetsBySession(sessionId);
        const data = await getSessionSetEntries(sessionId);
        const allSets = data;
        const workSets = data.filter((set) => set.set > 0);
        const first = entries[0];
        const workoutType = first?.type;

        setFlowStats({
          stretchCount: entries.filter(
            (entry): entry is WorkoutLogEntry =>
              isFlowEventEntry(entry) && entry.eventType === "stretch"
          ).length,
          pauseCount: entries.filter(
            (entry): entry is WorkoutLogEntry =>
              isFlowEventEntry(entry) && entry.eventType === "pause"
          ).length,
        });
        setFlowEntries(entries.filter(isFlowEventEntry));

        if (entries.length > 0 && first) {
          const min = entries[0].timestamp;
          const max = entries[entries.length - 1].timestamp;
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
        allSets.forEach((set) => {
          if (!grouped.has(set.exercise)) {
            grouped.set(set.exercise, []);
          }
          grouped.get(set.exercise)!.push(set);
        });

        const result: ExerciseSummary[] = [];

        for (const [exercise, currentSets] of grouped.entries()) {
          const sortedSets = [...currentSets].sort((a, b) => a.set - b.set);
          const warmupCount = sortedSets.filter((set) => set.set <= 0).length;
          const workRows = sortedSets.filter((set) => set.set > 0);

          const rows = await Promise.all(
            workRows.map(async (current) => {
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
            warmupCount,
            rows,
            topRow: getTopSummaryRow(rows),
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
  const totalWarmupCount = useMemo(
    () => exerciseData.reduce((sum, exercise) => sum + exercise.warmupCount, 0),
    [exerciseData]
  );
  const additionalSummary = useMemo(
    () =>
      formatAdditionalSummary({
        warmupCount: totalWarmupCount,
        stretchCount: flowStats.stretchCount,
        pauseCount: flowStats.pauseCount,
      }),
    [flowStats.pauseCount, flowStats.stretchCount, totalWarmupCount]
  );
  const daySummary = useMemo(
    () =>
      formatDaySummaryLine({
        exerciseCount: exerciseData.length,
        warmupCount: totalWarmupCount,
        stretchCount: flowStats.stretchCount,
        pauseCount: flowStats.pauseCount,
      }),
    [exerciseData.length, flowStats.pauseCount, flowStats.stretchCount, totalWarmupCount]
  );
  const dayPreview = useMemo(
    () => buildSummaryDayPreview(exerciseData, flowEntries),
    [exerciseData, flowEntries]
  );

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
                <div style={summarySection}>
                  <span style={sectionEyebrow}>Leistung</span>
                  <div style={badgeRow}>
                    <span style={successBadge}>{stats.better} besser</span>
                    <span style={neutralBadge}>{stats.same} gleich</span>
                    <span style={warningBadge}>{stats.worse} schwächer</span>
                    {stats.newCount > 0 ? (
                      <span style={newBadge}>{stats.newCount} neu</span>
                    ) : null}
                  </div>
                </div>
                {additionalSummary ? (
                  <div style={summarySection}>
                    <span style={sectionEyebrow}>Zusatz</span>
                    <div style={sectionSummaryLine}>{additionalSummary}</div>
                  </div>
                ) : null}
              </div>
              {daySummary ? (
                <div style={flowDetailSection}>
                  <span style={sectionEyebrow}>Ablauf</span>
                  <div style={heroFlowSummaryLine}>{daySummary}</div>
                  {dayPreview.length > 0 ? (
                    <div style={heroFlowPreviewRow}>
                      {dayPreview.map((item) => (
                        <span key={`summary-preview-${item}`} style={heroFlowPreviewChip}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                      {formatSummaryTopRowValue(exercise.topRow)}
                    </div>
                    <div style={overviewCaption}>
                      {exercise.topRow
                        ? `Bester Satz heute · Satz ${exercise.topRow.setNumber}`
                        : "Bester Satz heute"}
                    </div>
                    <div style={overviewMetaList}>
                      <div style={overviewMetaRow}>
                        <span style={overviewMetaLabel}>Letztes Training</span>
                        <span style={overviewMetaValue}>
                          {exercise.topRow
                            ? formatSetValue(exercise.topRow.previous)
                            : "Neu"}
                        </span>
                      </div>
                      <div style={overviewMetaRow}>
                        <span style={overviewMetaLabel}>Bestwert</span>
                        <span style={overviewMetaValue}>
                          {exercise.topRow ? formatSetValue(exercise.topRow.best) : "Neu"}
                        </span>
                      </div>
                    </div>
                    {exercise.warmupCount > 0 ? (
                      <div style={overviewWarmupCaption}>
                        {exercise.warmupCount} Aufwärmsätze
                      </div>
                    ) : null}
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
                      {expandedExercise === exercise.exercise ? "Zuklappen" : "Satzdetails"}
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

                          <div style={setMetaList}>
                            <div style={setMetaRow}>
                              <span style={setMetaLabel}>Heute</span>
                              <span
                                style={{
                                  ...todayValueInline,
                                  ...(compactMode ? compactTodayValueInline : null),
                                }}
                              >
                                {formatSetValue(row.current)}
                              </span>
                            </div>
                            <div style={setMetaRow}>
                              <span style={setMetaLabel}>Letztes Mal</span>
                              <span
                                style={{
                                  ...comparisonValue,
                                  ...(compactMode ? compactComparisonValue : null),
                                }}
                              >
                                {formatSetValue(row.previous)}
                              </span>
                            </div>
                            <div style={setMetaRow}>
                              <span style={setMetaLabel}>Bestwert</span>
                              <span
                                style={{
                                  ...comparisonValue,
                                  ...(compactMode ? compactComparisonValue : null),
                                }}
                              >
                                {formatSetValue(row.best)}
                              </span>
                            </div>
                            <div style={setMetaRow}>
                              <span style={setMetaLabel}>Differenz</span>
                              <span
                                style={{
                                  ...deltaValue,
                                  ...(compactMode ? compactDeltaValue : null),
                                }}
                              >
                                {formatDelta(row.comparison)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {flowEntries.length > 0 ? (
              <div style={flowDetailSection}>
                <div style={flowDetailHeader}>Zusatzblöcke</div>
                <div style={flowDetailList}>
                  {flowEntries.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${entry.label}-${index}`}
                      style={{ ...flowDetailCard, ...(compactMode ? compactFlowDetailCard : null) }}
                    >
                      <div style={flowDetailTop}>
                        <span style={flowDetailTitle}>{entry.label}</span>
                        <span style={flowDetailBadge}>
                          {entry.eventType === "stretch"
                            ? "Dehnen"
                            : entry.scope === "workout"
                              ? "Workout-Pause"
                              : "Pause"}
                        </span>
                      </div>
                      <div style={flowDetailMeta}>{formatFlowEventDuration(entry)}</div>
                      {entry.contextLabel ? (
                        <div style={flowDetailContext}>{entry.contextLabel}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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

function getTopSummaryRow(rows: SummaryRow[]) {
  if (rows.length === 0) {
    return null;
  }

  return rows.reduce((best, current) => {
    if (current.current.weight > best.current.weight) {
      return current;
    }

    if (
      current.current.weight === best.current.weight &&
      current.current.reps > best.current.reps
    ) {
      return current;
    }

    return best;
  }, rows[0]);
}

function formatSummaryTopRowValue(row: SummaryRow | null) {
  if (!row) {
    return "Neu";
  }

  return formatSetValue(row.current);
}

function formatAdditionalSummary({
  warmupCount,
  stretchCount,
  pauseCount,
}: {
  warmupCount: number;
  stretchCount: number;
  pauseCount: number;
}) {
  const parts = [];

  if (warmupCount > 0) {
    parts.push(`${warmupCount} Aufwärmen`);
  }
  if (stretchCount > 0) {
    parts.push(`${stretchCount} Dehnen`);
  }
  if (pauseCount > 0) {
    parts.push(`${pauseCount} Pausen`);
  }

  return parts.join(" · ");
}

function formatDaySummaryLine({
  exerciseCount,
  warmupCount,
  stretchCount,
  pauseCount,
}: {
  exerciseCount: number;
  warmupCount: number;
  stretchCount: number;
  pauseCount: number;
}) {
  const parts = [];

  if (exerciseCount > 0) {
    parts.push(`${exerciseCount} Übungen`);
  }
  if (warmupCount > 0) {
    parts.push(`${warmupCount} Aufwärmen`);
  }
  if (stretchCount > 0) {
    parts.push(`${stretchCount} Dehnen`);
  }
  if (pauseCount > 0) {
    parts.push(`${pauseCount} Pausen`);
  }

  return parts.join(" · ");
}

function buildSummaryDayPreview(
  exercises: ExerciseSummary[],
  flowEntries: WorkoutFlowEvent[]
) {
  const exerciseItems = exercises.slice(0, 3).map((exercise) =>
    getExerciseLabel(exercise.exercise)
  );
  const flowItems = flowEntries
    .slice(0, 2)
    .map((entry) =>
      entry.eventType === "stretch"
        ? "Dehnen"
        : entry.scope === "workout"
          ? "Workout-Pause"
          : "Pause"
    );

  return [...exerciseItems, ...flowItems].slice(0, 5);
}

function formatFlowEventDuration(entry: WorkoutFlowEvent) {
  if (entry.durationSeconds % 60 === 0) {
    return `${entry.durationSeconds / 60} min`;
  }

  return `${entry.durationSeconds} Sek`;
}

function formatReferenceTopSet(
  rows: SummaryRow[],
  field: "previous" | "best"
) {
  const topSet = getTopSet(
    rows
      .map((row) => row[field])
      .filter((set): set is SetType => set !== null)
  );

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
  display: "grid",
  gap: 10,
  marginTop: 10,
};

const summarySection = {
  display: "grid",
  gap: 6,
};

const flowDetailSection = {
  marginTop: 14,
  display: "grid",
  gap: 8,
};

const flowDetailHeader = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "#94a3b8",
  fontWeight: "bold",
};

const flowDetailList = {
  display: "grid",
  gap: 8,
};

const flowDetailCard = {
  padding: "10px 12px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e8ecf3",
  display: "grid",
  gap: 4,
};

const flowDetailTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "start",
};

const flowDetailTitle = {
  fontWeight: 700,
  color: "#111827",
};

const flowDetailBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: "bold",
  color: "#475569",
  background: "#f3f4f6",
};

const flowDetailMeta = {
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
};

const flowDetailContext = {
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
};

const sectionSummaryLine = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.9)",
};

const heroFlowSummaryLine = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.9)",
  lineHeight: 1.3,
};

const heroFlowPreviewRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const heroFlowPreviewChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: "bold",
};

const sectionEyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  color: "rgba(255,255,255,0.74)",
};

const badgeRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
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

const overviewMetaList = {
  display: "grid",
  gap: 5,
};

const overviewMetaRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const overviewMetaLabel = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
};

const overviewMetaValue = {
  fontSize: 12,
  color: "#111827",
  fontWeight: "bold",
  textAlign: "right" as const,
};

const overviewWarmupCaption = {
  fontSize: 11,
  color: "#94a3b8",
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
  padding: "10px 10px 9px",
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #e8ecf3",
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

const setMetaList = {
  marginTop: 8,
  display: "grid",
  gap: 5,
};

const setMetaRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const setMetaLabel = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 700,
};

const todayValueInline = {
  fontSize: 14,
  fontWeight: "bold",
  color: "#111827",
};

const comparisonValue = {
  fontSize: 12,
  color: "#475569",
  fontWeight: 600,
  textAlign: "right" as const,
};

const deltaValue = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1f2937",
  textAlign: "right" as const,
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

const compactFlowDetailCard = {
  padding: "10px 11px",
};

const compactOverviewTopSet = {
  fontSize: 18,
};

const compactSetRow = {
  padding: "9px 9px 8px",
};

const compactTodayValueInline = {
  fontSize: 13,
};

const compactComparisonValue = {
  fontSize: 11,
};

const compactDeltaValue = {
  fontSize: 11,
};

const compactActionStack = {
  gap: 8,
};

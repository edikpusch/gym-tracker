"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppCard } from "@/components/ui/AppCard";
import { clearActiveWorkoutState } from "@/lib/activeWorkout";
import {
  appChromeBackground,
  appPalette,
  splitThemes,
  withAlpha,
} from "@/lib/theme";

import {
  getBestMatchingSet,
  getCoachDecision,
  getLoggedSetExerciseReference,
  getPreviousMatchingSet,
  getSetComparison,
  getSetsBySession,
  getTopSet,
  isLoggedSetEntry,
  isWarmupSetEntry,
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
  exerciseId: string;
  rows: SummaryRow[];
  coach: ReturnType<typeof getCoachDecision>;
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
  const [showAllExercises, setShowAllExercises] = useState(false);

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
        const data = await getSetsBySession(sessionId);
        const loggedSets = data.filter(isLoggedSetEntry);
        const workSets = loggedSets.filter(
          (set) => isLoggedSetEntry(set) && !isWarmupSetEntry(set)
        );
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
          const key = getLoggedSetExerciseReference(set);
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(set);
        });

        const result: ExerciseSummary[] = [];

        for (const [exerciseId, currentSets] of grouped.entries()) {
          const sortedSets = [...currentSets].sort((a, b) => a.set - b.set);
          const exercise = sortedSets[0]?.exercise ?? "";

          const rows = await Promise.all(
            sortedSets.map(async (current) => {
              const previous = await getPreviousMatchingSet(
                exercise,
                current.set,
                workoutType,
                sessionId,
                current.exerciseId,
                current.setType
              );
              const best = await getBestMatchingSet(
                exercise,
                current.set,
                workoutType,
                current.exerciseId,
                current.setType
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
            exerciseId,
            rows,
            coach: getCoachDecision(exercise, sortedSets),
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
  const sessionInsight = useMemo(
    () => getSessionInsight(exerciseData, stats),
    [exerciseData, stats]
  );
  const summaryFocusItems = useMemo(
    () => getSummaryFocusItems(exerciseData, stats),
    [exerciseData, stats]
  );
  const visibleExercises = useMemo(
    () => (showAllExercises ? exerciseData : exerciseData.slice(0, 3)),
    [exerciseData, showAllExercises]
  );

  return (
    <div style={screen}>
      <div style={{ ...shell, ...(compactMode ? compactShell : null) }}>
        <div style={topBar}>
          <div style={brandPill}>Gym Tracker</div>
          <div style={topBarRight}>
            <Link href="/" style={topBackButton}>← Zurück</Link>
          </div>
        </div>
        <div style={{ ...hero, ...(compactMode ? compactHero : null) }}>
          <div style={heroTopRow}>
            <div>
              <div style={eyebrow}>Auswertung</div>
              <div style={{ ...title, ...(compactMode ? compactTitle : null) }}>
                {sessionDate || "-"}
              </div>
              {sessionMeta ? (
                <div style={{ ...metaLine, ...(compactMode ? compactMetaLine : null) }}>
                  {sessionMeta}
                </div>
              ) : null}
            </div>
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

        {!loading ? (
          <>
            <AppCard
              style={{
                ...sessionInsightCard,
                ...(sessionInsight.tone === "good"
                  ? sessionInsightGood
                  : sessionInsight.tone === "warn"
                    ? sessionInsightWarn
                    : sessionInsightNeutral),
              }}
            >
              <div style={sessionInsightTitle}>{sessionInsight.title}</div>
              <div style={sessionInsightValue}>{sessionInsight.value}</div>
              <div style={sessionInsightDetail}>{sessionInsight.detail}</div>
            </AppCard>

            <AppCard style={focusSectionCard}>
              <div style={focusSectionHead}>
                <div style={focusSectionTitle}>Naechster Fokus</div>
                <span style={neutralBadge}>{summaryFocusItems.length}</span>
              </div>
              <div style={focusList}>
                {summaryFocusItems.map((item, index) => (
                  <div key={`${item}-${index}`} style={focusListRow}>
                    <span style={focusListIndex}>{index + 1}</span>
                    <span style={focusListText}>{item}</span>
                  </div>
                ))}
              </div>
            </AppCard>
          </>
        ) : null}

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
              {visibleExercises.map((exercise) => (
                <AppCard
                  key={exercise.exerciseId}
                  interactive
                  style={{
                    ...card,
                    ...(compactMode ? compactCard : null),
                    ...(expandedExercise === exercise.exerciseId ? expandedCard : null),
                  }}
                  onClick={() =>
                    setExpandedExercise((current) =>
                      current === exercise.exerciseId ? null : exercise.exerciseId
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedExercise((current) =>
                        current === exercise.exerciseId ? null : exercise.exerciseId
                      );
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div style={cardHeaderRow}>
                    <div
                      style={{
                        ...exerciseTitle,
                        ...(compactMode ? compactExerciseTitle : null),
                      }}
                    >
                      {getExerciseLabel(exercise.exercise)}
                    </div>
                    <span style={cardChevron}>
                      {expandedExercise === exercise.exerciseId ? "v" : ">"}
                    </span>
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
                        <span key={`${exercise.exerciseId}-${item.label}`} style={item.style}>
                          {item.text}
                        </span>
                      ))}
                    </div>
                    <div style={summaryCoachLine}>Coach: {exercise.coach.label}</div>
                  </div>

                  {expandedExercise === exercise.exerciseId ? (
                    <div
                      style={{
                        ...rowsStack,
                        ...(compactMode ? compactRowsStack : null),
                      }}
                    >
                      {exercise.rows.map((row) => (
                        <div
                          key={`${exercise.exerciseId}-${row.setNumber}`}
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
                            Vergleich: {getComparisonExplanation(row.comparison)}
                          </div>
                        </div>
                      ))}
                      <div style={summaryCoachDetail}>{exercise.coach.detail}</div>
                    </div>
                  ) : null}
                </AppCard>
              ))}
              {!showAllExercises && exerciseData.length > 3 ? (
                <button
                  style={moreExercisesCard}
                  onClick={() => setShowAllExercises(true)}
                >
                  +{exerciseData.length - 3} weitere Übungen anzeigen
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div
          style={{
            ...actionStack,
            ...(compactMode ? compactActionStack : null),
          }}
        >
          <Link href="/" style={primaryButton}>
            Start
          </Link>
          <Link href="/history" style={secondaryButton}>
            ◷ Verlauf
          </Link>
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

function getSessionInsight(exercises: ExerciseSummary[], stats: ReturnType<typeof getSummaryStats>) {
  const topExercise = exercises
    .flatMap((exercise) =>
      exercise.rows.map((row) => ({
        exercise: exercise.exercise,
        current: row.current,
        comparison: row.comparison,
      }))
    )
    .sort((a, b) => {
      if (b.current.weight !== a.current.weight) {
        return b.current.weight - a.current.weight;
      }
      return b.current.reps - a.current.reps;
    })[0] ?? null;

  if (!topExercise) {
    return {
      title: "Session-Fazit",
      value: "Noch keine Arbeitssaetze",
      detail: "Sobald ein Workout abgeschlossen ist, erscheint hier dein Tagesfazit.",
      tone: "neutral" as const,
    };
  }

  if (stats.better > stats.worse) {
    return {
      title: "Session-Fazit",
      value: "Starker Trainingstag",
      detail: `${stats.better} Saetze lagen ueber dem letzten passenden Vergleich. ${getExerciseLabel(topExercise.exercise)} war heute dein klarer Anker.`,
      tone: "good" as const,
    };
  }

  if (stats.worse > stats.better) {
    return {
      title: "Session-Fazit",
      value: "Mehr Stabilisieren als Druecken",
      detail: `${stats.worse} Saetze lagen unter dem letzten Vergleich. ${getExerciseLabel(topExercise.exercise)} zeigt trotzdem die staerkste Tagesleistung.`,
      tone: "warn" as const,
    };
  }

  return {
    title: "Session-Fazit",
    value: "Solide gehalten",
    detail: `Viele Saetze lagen auf Kurs. ${getExerciseLabel(topExercise.exercise)} war dabei dein staerkster Satz des Tages.`,
    tone: "neutral" as const,
  };
}

function getSummaryFocusItems(
  exercises: ExerciseSummary[],
  stats: ReturnType<typeof getSummaryStats>
) {
  const items: string[] = [];
  const decreaseCoach = exercises.find(
    (exercise) => exercise.coach.action === "decrease"
  );
  const increaseCoach = exercises.find(
    (exercise) => exercise.coach.action === "increase"
  );
  const stableCoach = exercises.find(
    (exercise) => exercise.coach.action === "keep"
  );

  if (decreaseCoach) {
    items.push(
      `${getExerciseLabel(decreaseCoach.exercise)} zuerst sauber stabilisieren. ${decreaseCoach.coach.detail}`
    );
  }

  if (increaseCoach) {
    items.push(
      `${getExerciseLabel(increaseCoach.exercise)} ist bereit fuer den naechsten kleinen Progressionsschritt.`
    );
  }

  if (stats.newCount > 0) {
    items.push(
      `${stats.newCount} neue Vergleichsfaelle sind jetzt gespeichert. Die naechste Einheit wird dadurch deutlich aussagekraeftiger.`
    );
  }

  if (!decreaseCoach && stableCoach) {
    items.push(
      `${getExerciseLabel(stableCoach.exercise)} weiter in der Zielrange festigen, statt zu frueh Gewicht nachzulegen.`
    );
  }

  if (items.length === 0) {
    items.push(
      "Die Einheit wirkt aktuell ausgeglichen. Halte den Rhythmus und beobachte, welche Uebung als naechstes klar nach vorne zieht."
    );
  }

  return items.slice(0, 3);
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

  return parts.join(" · ");
}

function getComparisonExplanation(
  comparison: ReturnType<typeof getSetComparison>
) {
  if (!comparison || comparison.kind === "new") {
    return "Erster passender Vergleich";
  }

  if (comparison.kind === "same") {
    return "Gleich wie letztes Mal";
  }

  const delta = formatDelta(comparison);
  return comparison.kind === "better"
    ? `${delta} stärker als letztes Mal`
    : `${delta} unter letztem Vergleich`;
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
  height: "var(--app-viewport-height, 100dvh)",
  padding: "calc(8px + env(safe-area-inset-top)) 10px calc(12px + var(--app-bottom-inset))",
  overflow: "hidden" as const,
  background: appChromeBackground,
  fontFamily: "sans-serif",
  boxSizing: "border-box" as const,
};

const shell = {
  maxWidth: 460,
  height: "100%",
  margin: "0 auto",
  padding: "12px",
  borderRadius: 30,
  background: withAlpha(appPalette.surface, 0.96),
  boxShadow: `0 24px 60px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
  border: `1px solid ${withAlpha(appPalette.borderDefault, 0.14)}`,
  display: "grid",
  gridTemplateRows: "auto auto 1fr auto",
  gap: 8,
  overflow: "hidden" as const,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "7px 12px",
  borderRadius: 999,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  fontSize: 13,
  fontWeight: "bold",
};

const topBarRight = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const topBackButton = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "6px 12px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
  fontSize: 12,
  fontWeight: "bold",
  textDecoration: "none",
};

const eyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: withAlpha(appPalette.surface, 0.6),
  fontWeight: "bold",
};

const hero = {
  padding: "14px 14px",
  borderRadius: 24,
  background: `linear-gradient(135deg, ${appPalette.surfaceDark} 0%, ${withAlpha(appPalette.surfaceDark, 0.9)} 100%)`,
  color: appPalette.surface,
  boxShadow: `0 24px 60px ${withAlpha(appPalette.surfaceDark, 0.18)}`,
};

const heroTopRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
};

const title = {
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1.1,
};

const metaLine = {
  marginTop: 5,
  fontSize: 12,
  fontWeight: 700,
  color: withAlpha(appPalette.surface, 0.74),
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
  fontSize: 24,
  fontWeight: 800,
};

const heroSummaryRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 8,
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
  color: appPalette.success,
  background: withAlpha(appPalette.success, 0.14),
};

const warningBadge = {
  ...baseBadge,
  color: appPalette.danger,
  background: withAlpha(appPalette.danger, 0.12),
};

const neutralBadge = {
  ...baseBadge,
  color: appPalette.textDefault,
  background: appPalette.surfaceMuted,
};

const newBadge = {
  ...baseBadge,
  color: splitThemes.pull.primary,
  background: withAlpha(splitThemes.pull.primary, 0.12),
};

const loadingText = {
  marginTop: 16,
  opacity: 0.72,
};

const contentScroll = {
  overflowY: "auto" as const,
  minHeight: 0,
  paddingRight: 2,
  paddingBottom: "calc(8px + var(--app-bottom-inset))",
};

const exerciseGrid = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  alignContent: "start" as const,
};

const card = {
  padding: 10,
  border: `1px solid ${appPalette.borderSoft}`,
  borderRadius: 20,
  background: withAlpha(appPalette.surface, 0.96),
  boxShadow: `0 14px 28px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
  width: "100%",
  cursor: "pointer",
};

const expandedCard = {
  border: `1px solid ${withAlpha(splitThemes.pull.primary, 0.28)}`,
  boxShadow: `0 14px 30px ${withAlpha(splitThemes.pull.primary, 0.08)}`,
};

const cardHeaderRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const cardChevron = {
  fontSize: 16,
  fontWeight: "bold",
  color: appPalette.textMuted,
};

const exerciseTitle = {
  fontWeight: 800,
  fontSize: 17,
  lineHeight: 1.15,
  color: appPalette.textStrong,
};

const rowsStack = {
  marginTop: 6,
  display: "grid",
  gap: 5,
};

const summaryCoachDetail = {
  fontSize: 13,
  lineHeight: 1.4,
  color: appPalette.textMuted,
  fontWeight: 700,
  paddingTop: 4,
};

const moreExercisesCard = {
  minHeight: 76,
  width: "100%",
  borderRadius: 20,
  border: `1px dashed ${appPalette.borderDefault}`,
  background: appPalette.surfaceMuted,
  color: appPalette.textDefault,
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 18px",
};

const overviewBlock = {
  marginTop: 8,
  display: "grid",
  gap: 6,
};

const overviewTopSet = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
  lineHeight: 1.05,
};

const overviewCaption = {
  fontSize: 13,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const overviewBadgeRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const summaryCoachLine = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const setRow = {
  paddingTop: 6,
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const setHeaderRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const setLabel = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.3,
  color: appPalette.textDefault,
  textTransform: "uppercase" as const,
};

const todayValue = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const comparisonLine = {
  marginTop: 4,
  fontSize: 13,
  color: appPalette.textDefault,
};

const deltaLine = {
  marginTop: 5,
  fontSize: 13,
  fontWeight: 700,
  color: appPalette.textStrong,
};

const actionStack = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  paddingBottom: "calc(4px + var(--app-bottom-inset))",
};

const primaryButton = {
  minHeight: 54,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: appPalette.surface,
  background: appPalette.surfaceDark,
  fontWeight: 800,
  boxShadow: `0 14px 32px ${withAlpha(appPalette.surfaceDark, 0.12)}`,
};

const secondaryButton = {
  minHeight: 50,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: appPalette.textStrong,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderDefault}`,
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
  padding: 9,
  borderRadius: 14,
};

const compactExerciseTitle = {
  fontSize: 14,
};

const compactRowsStack = {
  marginTop: 6,
  gap: 5,
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

const sessionInsightCard = {
  padding: "13px 14px 14px",
  display: "grid",
  gap: 5,
};

const sessionInsightGood = {
  background: withAlpha(appPalette.success, 0.12),
};

const sessionInsightWarn = {
  background: withAlpha(appPalette.warning, 0.14),
};

const sessionInsightNeutral = {
  background: appPalette.surface,
};

const sessionInsightTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const sessionInsightValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const sessionInsightDetail = {
  fontSize: 14,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const focusSectionCard = {
  padding: "14px 14px",
  display: "grid",
  gap: 10,
};

const focusSectionHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const focusSectionTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const focusList = {
  display: "grid",
  gap: 10,
};

const focusListRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  paddingTop: 10,
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const focusListIndex = {
  minWidth: 28,
  minHeight: 28,
  borderRadius: 999,
  background: appPalette.surfaceMuted,
  color: appPalette.textStrong,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
};

const focusListText = {
  fontSize: 14,
  lineHeight: 1.45,
  color: appPalette.textDefault,
  fontWeight: 700,
};


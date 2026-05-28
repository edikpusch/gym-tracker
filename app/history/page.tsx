"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NoticeDialog } from "@/components/ui/NoticeDialog";
import { clearActiveWorkoutState, getActiveWorkoutState } from "@/lib/activeWorkout";
import { appChromeBackground, appPalette, withAlpha } from "@/lib/theme";
import {
  getCoachDecision,
  deleteWorkoutSession,
  getAllSets,
  getLoggedSetExerciseReference,
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
  coach: ReturnType<typeof getCoachDecision>;
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
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedSetListSessionId, setExpandedSetListSessionId] = useState<string | null>(null);
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(null);
  const [activePlanId, setActivePlanIdState] = useState("my-plan");
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleteFailureNotice, setDeleteFailureNotice] = useState(false);

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

  const activePlan = useMemo(() => getTrainingPlan(activePlanId), [activePlanId]);

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
          const orderedSets = [...sessionSets].sort((a, b) => a.timestamp - b.timestamp);
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
              first.dayName ||
              first.type ||
              detectWorkoutType(orderedSets.filter(isLoggedSetEntry)),
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
            duration: Math.max(1, Math.round((last.timestamp - first.timestamp) / 60000)),
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
    const deleted = await deleteWorkoutSession(Number(sessionId));

    if (!deleted) {
      setDeleteSessionId(null);
      setDeleteFailureNotice(true);
      return;
    }

    setDeleteSessionId(null);

    const activeWorkout = getActiveWorkoutState();
    if (activeWorkout?.sessionId === Number(sessionId)) {
      clearActiveWorkoutState();
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
            <Link href="/" style={backButton}>← Zurück</Link>
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

        {loading ? <AppCard style={emptyState}>Lade Verlauf...</AppCard> : null}

        {!loading && visibleSessions.length === 0 ? (
          <div style={emptyState}>
            <div style={emptyTitle}>Noch keine Trainings gefunden</div>
            <div style={emptyCopy}>
              Sobald du ein Workout speicherst, siehst du hier deine letzten Einheiten.
            </div>
          </div>
        ) : null}

        {visibleSessions.map((session) => (
          <AppCard
            key={session.sessionId}
            interactive
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
                  {session.sets.filter(isLoggedSetEntry).length} Sätze
                </div>
                <div style={sessionCompareRow}>
                  {getSessionStats(session.summaries).map((item) => (
                    <AppBadge
                      key={`${session.sessionId}-${item.label}`}
                      variant={item.variant}
                      style={item.style}
                    >
                      {item.text}
                    </AppBadge>
                  ))}
                </div>
                <div style={sessionInsightLine}>
                  {getSessionInsightText(session.summaries)}
                </div>
              </div>

              <div style={cardButtonStack}>
                <AppButton
                  variant="secondary"
                  size="compact"
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
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="compact"
                  style={deleteButton}
                  onClick={() => setDeleteSessionId(session.sessionId)}
                >
                  Löschen
                </AppButton>
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
              ).map((summary) => {
                const summaryKey = `${session.sessionId}:${summary.exerciseId}`;
                return (
                  <AppCard
                    key={summaryKey}
                    interactive
                    style={{
                      ...summaryCard,
                      ...(compactMode ? compactSummaryCard : null),
                      ...(expandedExerciseKey === summaryKey ? expandedSummaryCard : null),
                    }}
                    onClick={() =>
                      setExpandedExerciseKey((current) =>
                        current === summaryKey ? null : summaryKey
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedExerciseKey((current) =>
                          current === summaryKey ? null : summaryKey
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
                        {expandedExerciseKey === summaryKey ? "v" : ">"}
                      </span>
                    </div>
                    {summary.topSet ? (
                      <div
                        style={{
                          ...summaryTopSet,
                          ...(compactMode ? compactSummaryTopSet : null),
                        }}
                      >
                        {summary.topSet.weight} kg × {summary.topSet.reps}
                      </div>
                    ) : null}
                    <div style={summaryTrendLine}>{getSummaryTrendText(summary)}</div>
                    <div style={summaryCoachLine}>
                      Coach: {summary.coach.label} · {summary.coach.detail}
                    </div>
                    <div style={summaryBadgeRow}>
                      <AppBadge
                        variant={getComparisonBadgeVariant(summary)}
                        style={getComparisonBadgeStyle(summary)}
                      >
                        {getComparisonArrow(summary)} {getComparisonLabel(summary)}
                      </AppBadge>
                    </div>
                    {expandedExerciseKey === summaryKey ? (
                      <div style={summarySetList}>
                        {session.sets
                          .filter(
                            (set) =>
                              isLoggedSetEntry(set) &&
                              getLoggedSetExerciseReference(set) === summary.exerciseId
                          )
                          .sort((a, b) => a.set - b.set)
                          .map((set, index) => (
                            <div
                              key={`${summaryKey}-${set.timestamp}-${index}`}
                              style={summarySetRow}
                            >
                              <span style={summarySetLabel}>{labelSet(set.set)}</span>
                              <span style={summarySetValue}>
                                {set.weight} kg × {set.reps}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </AppCard>
                );
              })}
              {expandedSessionId !== session.sessionId && session.summaries.length > 2 ? (
                <AppButton
                  block
                  variant="secondary"
                  style={moreSummariesCard}
                  onClick={() => setExpandedSessionId(session.sessionId)}
                >
                  +{session.summaries.length - 2} weitere Übungen
                </AppButton>
              ) : null}
            </div>

            {expandedSessionId === session.sessionId ? (
              <div style={sessionDetailActions}>
                <AppButton
                  variant="secondary"
                  size="compact"
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
                </AppButton>
              </div>
            ) : null}

            {expandedSessionId === session.sessionId &&
            expandedSetListSessionId === session.sessionId ? (
              <div style={setListSection}>
                {session.sets.map((set, index) => (
                  <div key={`${session.sessionId}-${set.timestamp}-${index}`} style={setRow}>
                    <div style={setName}>
                      {isLoggedSetEntry(set) ? getExerciseLabel(set.exercise) : set.label}
                    </div>
                    <div style={setMeta}>
                      {isLoggedSetEntry(set)
                        ? `${labelSet(set.set)} · ${set.weight} kg × ${set.reps}`
                        : `${set.durationSeconds} Sek`}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </AppCard>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteSessionId)}
        title="Training löschen?"
        body="Dieses Training wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        confirmVariant="danger"
        onCancel={() => setDeleteSessionId(null)}
        onConfirm={() => deleteSessionId && void handleDeleteSession(deleteSessionId)}
      />

      <NoticeDialog
        open={deleteFailureNotice}
        title="Löschen fehlgeschlagen"
        body="Das Training konnte nicht gelöscht werden."
        onClose={() => setDeleteFailureNotice(false)}
      />
    </main>
  );
}

function buildExerciseSummaries(
  sets: SetType[],
  workoutType: string,
  exerciseHistory: Map<string, SetType>
) {
  const byExercise = new Map<string, SetType[]>();

  sets.forEach((set) => {
    const key = getLoggedSetExerciseReference(set);
    const current = byExercise.get(key) ?? [];
    current.push(set);
    byExercise.set(key, current);
  });

  return Array.from(byExercise.entries()).map(([key, exerciseSets]) => {
    const firstSet = exerciseSets[0];
    const topSet = getTopSet(exerciseSets);
    const previousTopSet = exerciseHistory.get(
      getHistoryKey(workoutType, firstSet.exercise, key)
    ) ?? null;

    return {
      exercise: firstSet.exercise,
      exerciseId: key,
      topSet,
      previousTopSet,
      coach: getCoachDecision(firstSet.exercise, exerciseSets),
    };
  });
}

function getHistoryKey(type: string, exercise: string, exerciseId: string) {
  return `${type}:${exerciseId || exercise}`;
}

function getSessionStats(summaries: SessionExerciseSummary[]) {
  const better = summaries.filter(
    (summary) =>
      summary.topSet &&
      summary.previousTopSet &&
      (summary.topSet.weight > summary.previousTopSet.weight ||
        (summary.topSet.weight === summary.previousTopSet.weight &&
          summary.topSet.reps > summary.previousTopSet.reps))
  ).length;

  const same = summaries.filter(
    (summary) =>
      summary.topSet &&
      summary.previousTopSet &&
      summary.topSet.weight === summary.previousTopSet.weight &&
      summary.topSet.reps === summary.previousTopSet.reps
  ).length;

  const fresh = summaries.filter((summary) => !summary.previousTopSet).length;

  return [
    better > 0
      ? {
          label: "better",
          text: `${better} besser`,
          variant: "active" as const,
          style: undefined,
        }
      : null,
    same > 0
      ? {
          label: "same",
          text: `${same} gleich`,
          variant: "template" as const,
          style: undefined,
        }
      : null,
    fresh > 0
      ? {
          label: "fresh",
          text: `${fresh} neu`,
          variant: "new" as const,
          style: undefined,
        }
      : null,
  ].filter((item): item is NonNullable<(typeof item)> => item !== null);
}

function getComparisonBadgeVariant(summary: SessionExerciseSummary) {
  if (!summary.previousTopSet) return "new" as const;
  if (!summary.topSet) return "template" as const;

  if (
    summary.topSet.weight > summary.previousTopSet.weight ||
    (summary.topSet.weight === summary.previousTopSet.weight &&
      summary.topSet.reps > summary.previousTopSet.reps)
  ) {
    return "active" as const;
  }

  if (
    summary.topSet.weight === summary.previousTopSet.weight &&
    summary.topSet.reps === summary.previousTopSet.reps
  ) {
    return "template" as const;
  }

  return "custom" as const;
}

function getComparisonBadgeStyle(summary: SessionExerciseSummary) {
  if (!summary.previousTopSet) return undefined;
  if (!summary.topSet) return undefined;

  const improved =
    summary.topSet.weight > summary.previousTopSet.weight ||
    (summary.topSet.weight === summary.previousTopSet.weight &&
      summary.topSet.reps > summary.previousTopSet.reps);

  if (improved) return undefined;

  if (
    summary.topSet.weight === summary.previousTopSet.weight &&
    summary.topSet.reps === summary.previousTopSet.reps
  ) {
    return undefined;
  }

  return {
    background: withAlpha(appPalette.warning, 0.12),
    color: appPalette.warning,
  };
}

function getComparisonArrow(summary: SessionExerciseSummary) {
  if (!summary.previousTopSet) return "+";
  if (!summary.topSet) return "=";

  if (
    summary.topSet.weight > summary.previousTopSet.weight ||
    (summary.topSet.weight === summary.previousTopSet.weight &&
      summary.topSet.reps > summary.previousTopSet.reps)
  ) {
    return "↑";
  }

  if (
    summary.topSet.weight === summary.previousTopSet.weight &&
    summary.topSet.reps === summary.previousTopSet.reps
  ) {
    return "=";
  }

  return "↓";
}

function getComparisonLabel(summary: SessionExerciseSummary) {
  if (!summary.previousTopSet) return "Neu";
  if (!summary.topSet) return "Kein Top-Set";

  if (
    summary.topSet.weight > summary.previousTopSet.weight ||
    (summary.topSet.weight === summary.previousTopSet.weight &&
      summary.topSet.reps > summary.previousTopSet.reps)
  ) {
    return "Besser";
  }

  if (
    summary.topSet.weight === summary.previousTopSet.weight &&
    summary.topSet.reps === summary.previousTopSet.reps
  ) {
    return "Gleich";
  }

  return "Darunter";
}

function getSummaryTrendText(summary: SessionExerciseSummary) {
  if (!summary.topSet || !summary.previousTopSet) {
    return "Noch kein vorheriger Vergleich";
  }

  const weightDelta = summary.topSet.weight - summary.previousTopSet.weight;
  const repsDelta = summary.topSet.reps - summary.previousTopSet.reps;

  if (weightDelta === 0 && repsDelta === 0) {
    return "Gleich zur letzten passenden Einheit";
  }

  const parts: string[] = [];
  if (weightDelta !== 0) {
    parts.push(`${weightDelta > 0 ? "+" : ""}${weightDelta} kg`);
  }
  if (repsDelta !== 0) {
    parts.push(`${repsDelta > 0 ? "+" : ""}${repsDelta} Wdh.`);
  }

  return `${parts.join(" · ")} zur letzten passenden Einheit`;
}

function labelSet(setNumber: number) {
  if (setNumber === 0) return "Warm-up";
  return `Satz ${setNumber}`;
}

function getSessionInsightText(summaries: SessionExerciseSummary[]) {
  if (summaries.length === 0) {
    return "Noch keine passende Einordnung fuer diese Session.";
  }

  const improved = summaries.filter(
    (summary) =>
      summary.topSet &&
      summary.previousTopSet &&
      (summary.topSet.weight > summary.previousTopSet.weight ||
        (summary.topSet.weight === summary.previousTopSet.weight &&
          summary.topSet.reps > summary.previousTopSet.reps))
  ).length;
  const declined = summaries.filter(
    (summary) =>
      summary.topSet &&
      summary.previousTopSet &&
      (summary.topSet.weight < summary.previousTopSet.weight ||
        (summary.topSet.weight === summary.previousTopSet.weight &&
          summary.topSet.reps < summary.previousTopSet.reps))
  ).length;
  const coachFocus = summaries.find(
    (summary) => summary.coach.action === "decrease"
  );
  const coachGain = summaries.find(
    (summary) => summary.coach.action === "increase"
  );

  if (coachFocus) {
    return `Fokus: ${getExerciseLabel(coachFocus.exercise)} eher stabilisieren. ${coachFocus.coach.detail}`;
  }

  if (improved > declined && coachGain) {
    return `Tendenz vorwaerts: ${getExerciseLabel(coachGain.exercise)} ist bereit fuer den naechsten kleinen Schritt.`;
  }

  if (declined > improved) {
    return "Mehrere Uebungen liegen unter dem letzten Vergleich. Heute eher als Steuerungs- als als Druecktag lesen.";
  }

  return "Solider Verlauf: Die Session wirkt insgesamt stabil und gut vergleichbar.";
}

function detectWorkoutType(sets: SetType[]) {
  return sets[0]?.type || "workout";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const screen = {
  minHeight: "100dvh",
  padding: "calc(8px + env(safe-area-inset-top)) 10px calc(20px + env(safe-area-inset-bottom))",
  background: appChromeBackground,
  fontFamily: "sans-serif",
  boxSizing: "border-box" as const,
};

const shell = {
  maxWidth: 460,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const compactShell = {
  gap: 10,
};

const headerRow = {
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

const headerRight = {
  display: "flex",
  gap: 10,
};

const backButton = {
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

const titleRow = {
  display: "grid",
  gap: 4,
};

const eyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  color: appPalette.textMuted,
  fontWeight: "bold",
};

const title = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.02,
  color: appPalette.textStrong,
  fontWeight: 800,
};

const compactTitle = {
  fontSize: 26,
};

const headerCopy = {
  color: appPalette.textDefault,
  fontSize: 14,
};

const compactHeaderCopy = {
  fontSize: 13,
};

const filterRow = {
  display: "flex",
  gap: 8,
};

const compactFilterRow = {
  gap: 6,
};

const filterButton = {
  minHeight: 40,
  padding: "8px 14px",
  borderRadius: 999,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderDefault}`,
  color: appPalette.textDefault,
  fontSize: 13,
  fontWeight: 800,
};

const activeFilterButton = {
  ...filterButton,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  border: `1px solid ${appPalette.surfaceDark}`,
};

const emptyState = {
  padding: "18px 16px",
  textAlign: "center" as const,
  color: appPalette.textDefault,
};

const emptyTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const emptyCopy = {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.45,
};

const card = {
  padding: "16px 14px",
  display: "grid",
  gap: 12,
};

const compactCard = {
  gap: 10,
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const cardDate = {
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const cardMetaLine = {
  marginTop: 4,
  fontSize: 13,
  color: appPalette.textDefault,
};

const compactCardMetaLine = {
  fontSize: 12,
};

const sessionCompareRow = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap" as const,
  marginTop: 8,
};

const sessionInsightLine = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.4,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const cardButtonStack = {
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const toggleButton = {
  minWidth: 90,
};

const deleteButton = {
  minWidth: 90,
  color: appPalette.danger,
};

const summaryGrid = {
  display: "grid",
  gap: 10,
};

const compactSummaryGrid = {
  gap: 8,
};

const summaryCard = {
  padding: "12px 12px 14px",
  display: "grid",
  gap: 6,
};

const compactSummaryCard = {
  gap: 5,
};

const expandedSummaryCard = {
  border: `1px solid ${appPalette.borderDefault}`,
};

const summaryCardHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const summaryExercise = {
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const compactSummaryExercise = {
  fontSize: 14,
};

const summaryCardChevron = {
  color: appPalette.textMuted,
  fontWeight: 800,
};

const summaryTopSet = {
  fontSize: 20,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const summaryTrendLine = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const summaryCoachLine = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textSoft,
  fontWeight: 700,
};

const compactSummaryTopSet = {
  fontSize: 18,
};

const summaryBadgeRow = {
  display: "flex",
  gap: 8,
};

const summarySetList = {
  display: "grid",
  gap: 6,
  marginTop: 4,
};

const summarySetRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
  color: appPalette.textDefault,
};

const summarySetLabel = {
  fontWeight: 700,
};

const summarySetValue = {
  fontWeight: 800,
};

const moreSummariesCard = {
  width: "100%",
};

const sessionDetailActions = {
  display: "flex",
};

const sessionDetailButton = {
  width: "100%",
};

const setListSection = {
  display: "grid",
  gap: 8,
};

const setRow = {
  display: "grid",
  gap: 2,
  paddingTop: 8,
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const setName = {
  fontSize: 14,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const setMeta = {
  fontSize: 13,
  color: appPalette.textDefault,
};

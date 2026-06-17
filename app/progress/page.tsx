"use client";

import { useEffect, useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette, splitThemes, uiTheme, withAlpha } from "@/lib/theme";
import {
  getCoachDecisionForRange,
  getExerciseTrendInsight,
  getLoggedSetExerciseReference,
  getSetComparison,
  getTopSet,
  isLoggedSetEntry,
  isWorkSetEntry,
  type SetType,
  type WorkoutLogEntry,
} from "@/lib/workoutEngine";
import { getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import { getExerciseLabel, getExerciseMeta } from "@/lib/workoutUi";

type ExerciseProgress = {
  exercise: string;
  exerciseId: string;
  latest: SetType;
  previous: SetType | null;
  best: SetType | null;
  coach: ReturnType<typeof getCoachDecisionForRange>;
  recentTrend: SetType[];
  trendInsight: ReturnType<typeof getExerciseTrendInsight>;
  deltaWeight: number;
  deltaReps: number;
  kind: "better" | "worse" | "same" | "new";
};

export default function ProgressPage() {
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllComparisons, setShowAllComparisons] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { getAllSets } = await import("@/lib/workoutEngine");
        setEntries(await getAllSets());
      } catch (error) {
        console.error("Progress could not be loaded:", error);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const progressCards = useMemo(() => buildExerciseProgress(entries), [entries]);
  const betterCount = progressCards.filter((item) => item.kind === "better").length;
  const sameCount = progressCards.filter((item) => item.kind === "same").length;
  const worseCount = progressCards.filter((item) => item.kind === "worse").length;
  const newCount = progressCards.filter((item) => item.kind === "new").length;

  const topImprovers = progressCards
    .filter((item) => item.kind === "better")
    .sort((a, b) => b.deltaWeight + b.deltaReps - (a.deltaWeight + a.deltaReps))
    .slice(0, 5);

  const biggestStalls = progressCards
    .filter((item) => item.kind === "worse" || item.kind === "same")
    .sort((a, b) => {
      const aPenalty = Math.abs(a.deltaWeight) + Math.abs(a.deltaReps);
      const bPenalty = Math.abs(b.deltaWeight) + Math.abs(b.deltaReps);
      return bPenalty - aPenalty;
    })
    .slice(0, 5);

  const focusExercises = useMemo(() => {
    const map = new Map<
      string,
      {
        exercise: string;
        better: number;
        same: number;
        worse: number;
        latestTimestamp: number;
      }
    >();

    progressCards.forEach((item) => {
      const current = map.get(item.exerciseId) ?? {
        exercise: item.exercise,
        better: 0,
        same: 0,
        worse: 0,
        latestTimestamp: 0,
      };

      if (item.kind === "better") current.better += 1;
      if (item.kind === "same") current.same += 1;
      if (item.kind === "worse") current.worse += 1;
      current.latestTimestamp = Math.max(current.latestTimestamp, item.latest.timestamp);

      map.set(item.exerciseId, current);
    });

    const values = Array.from(map.values());

    const topStall =
      [...values]
        .filter((item) => item.same > 0 || item.worse > 0)
        .sort(
          (a, b) =>
            b.worse * 3 + b.same * 2 - (a.worse * 3 + a.same * 2) ||
            b.latestTimestamp - a.latestTimestamp
        )[0] ?? null;

    const topGain =
      [...values]
        .filter((item) => item.better > 0)
        .sort((a, b) => b.better - a.better || b.latestTimestamp - a.latestTimestamp)[0] ?? null;

    return { topStall, topGain };
  }, [progressCards]);

  const stalledCount = sameCount + worseCount;
  const focusInsight = useMemo(() => {
    if (progressCards.length === 0) {
      return {
        title: "Noch kein Verlauf",
        value: "Starte ein paar Sessions",
        detail: "Sobald mehrere passende Sätze vorhanden sind, erkennst du hier klare Trends.",
        tone: "neutral" as const,
      };
    }

    if (betterCount >= stalledCount) {
      return {
        title: "Positiver Trend",
        value: `${betterCount} Sätze stärker`,
        detail: "Dein aktueller Trainingsblock entwickelt sich nach vorn.",
        tone: "good" as const,
      };
    }

    const weakSpot =
      progressCards.find((item) => item.kind === "worse") ??
      progressCards.find((item) => item.kind === "same") ??
      null;

    return {
      title: "Nächster Fokus",
      value: weakSpot ? getExerciseLabel(weakSpot.exercise) : "Belastung prüfen",
      detail: weakSpot
        ? "Hier lohnt sich ein genauer Blick auf Technik, Müdigkeit oder Gewichtsplanung."
        : "Einige Sätze stagnieren aktuell.",
      tone: "warn" as const,
    };
  }, [progressCards, betterCount, stalledCount]);

  const recommendations = useMemo(() => {
    if (progressCards.length === 0) {
      return ["Noch fehlen genug Vergleichssätze. Halte erst ein paar Trainings sauber fest."];
    }

    const items: string[] = [];
    const primaryStall = biggestStalls[0] ?? null;
    const primaryGain = topImprovers[0] ?? null;
    const stallMeta = focusExercises.topStall ? getExerciseMeta(focusExercises.topStall.exercise) : null;
    const gainMeta = focusExercises.topGain ? getExerciseMeta(focusExercises.topGain.exercise) : null;

    if (primaryStall?.kind === "worse") {
      items.push(
        `${getExerciseLabel(primaryStall.exercise)} fällt zurück${stallMeta?.category ? ` (${stallMeta.category})` : ""}. Prüfe Gewicht, Erholung oder Satzqualität.`
      );
    } else if (primaryStall?.kind === "same") {
      items.push(
        `${getExerciseLabel(primaryStall.exercise)} stagniert${stallMeta?.category ? ` (${stallMeta.category})` : ""}. Ein kleiner Reiz über Gewicht, Wiederholungen oder Pause kann helfen.`
      );
    }

    if (primaryGain) {
      items.push(
        `${getExerciseLabel(primaryGain.exercise)} läuft gut${gainMeta?.category ? ` (${gainMeta.category})` : ""}. Halte dort die Progression kontrolliert weiter.`
      );
    }

    if (sameCount >= betterCount && sameCount > 0) {
      items.push(
        "Viele Sätze bewegen sich seitwärts. Ein klarerer Fokus auf 1-2 Schlüsselübungen könnte den nächsten Schub bringen."
      );
    }

    if (
      focusExercises.topStall &&
      focusExercises.topGain &&
      focusExercises.topStall.exercise !== focusExercises.topGain.exercise
    ) {
      items.push(
        `${getExerciseLabel(focusExercises.topGain.exercise)} zieht aktuell nach vorn, während ${getExerciseLabel(focusExercises.topStall.exercise)} mehr Aufmerksamkeit braucht.`
      );
    }

    if (items.length === 0) {
      items.push("Deine aktuellen Vergleiche wirken stabil. Jetzt lohnt sich vor allem Konstanz statt hektischer Änderungen.");
    }

    return items.slice(0, 3);
  }, [progressCards, biggestStalls, topImprovers, sameCount, betterCount, focusExercises]);

  return (
    <AppPageFrame
      activeKey="progress"
      eyebrow="Fortschritte"
      title="Wirst du stärker?"
      subtitle="Vergleiche deine neuesten Sätze direkt mit dem vorherigen passenden Training."
    >
      {loading ? <AppCard style={emptyCard}>Lade Fortschritte...</AppCard> : null}

      {!loading ? (
        <>
          <div style={heroStats}>
            <ProgressBadge label="stärker" value={betterCount} variant="better" />
            <ProgressBadge label="gleich" value={sameCount} variant="equal" />
            <ProgressBadge label="schwächer" value={worseCount} variant="worse" />
            {newCount > 0 ? <ProgressBadge label="neu" value={newCount} variant="new" /> : null}
          </div>

          <AppCard
            style={{
              ...focusCard,
              ...(focusInsight.tone === "good" ? goodCard : focusInsight.tone === "warn" ? warnCard : neutralCard),
            }}
          >
            <div style={focusTitle}>{focusInsight.title}</div>
            <div style={focusValue}>{focusInsight.value}</div>
            <div style={focusDetail}>{focusInsight.detail}</div>
          </AppCard>

          <AppCard style={sectionCard}>
            <div style={sectionHead}>
              <div style={sectionTitle}>Was jetzt?</div>
              <AppBadge variant="template">Fokus</AppBadge>
            </div>
            <div style={adviceList}>
              {recommendations.map((item, index) => (
                <div key={`${item}-${index}`} style={adviceRow}>
                  <AppBadge variant="exercise" style={adviceDot}>
                    {index + 1}
                  </AppBadge>
                  <span style={adviceText}>{item}</span>
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard style={sectionCard}>
            <div style={sectionHead}>
              <div style={sectionTitle}>Größte Verbesserungen</div>
              <AppBadge variant="better">{topImprovers.length}</AppBadge>
            </div>
            {topImprovers.length === 0 ? <div style={emptySmall}>Noch keine direkten Verbesserungen gefunden.</div> : null}
            {topImprovers.slice(0, 3).map((item) => (
              <ProgressRow key={`${item.exerciseId}-${item.latest.timestamp}`} item={item} />
            ))}
          </AppCard>

          <AppCard style={sectionCard}>
            <div style={sectionHead}>
              <div style={sectionTitle}>Darauf achten</div>
              <AppBadge variant="worse">{biggestStalls.length}</AppBadge>
            </div>
            {biggestStalls.length === 0 ? <div style={emptySmall}>Aktuell gibt es keine klaren Stagnationen oder Rückgänge.</div> : null}
            {biggestStalls.slice(0, 3).map((item) => (
              <ProgressRow key={`${item.exerciseId}-${item.latest.timestamp}-stall`} item={item} />
            ))}
          </AppCard>

          {progressCards.length > 3 || topImprovers.length > 3 || biggestStalls.length > 3 ? (
            <AppButton
              block
              variant="secondary"
              style={moreButton}
              onClick={() => setShowAllComparisons((current) => !current)}
            >
              {showAllComparisons ? "Weniger Vergleiche anzeigen" : "Alle Vergleiche anzeigen"}
            </AppButton>
          ) : null}

          {showAllComparisons ? (
            <AppCard style={sectionCard}>
              <div style={sectionHead}>
                <div style={sectionTitle}>Alle aktuellen Vergleiche</div>
                <AppBadge variant="active">{progressCards.length}</AppBadge>
              </div>
              {progressCards.length === 0 ? <div style={emptySmall}>Noch nicht genug Trainingsdaten vorhanden.</div> : null}
              {progressCards.map((item) => (
                <ProgressRow key={`${item.exerciseId}-${item.latest.timestamp}-all`} item={item} />
              ))}
            </AppCard>
          ) : null}
        </>
      ) : null}
    </AppPageFrame>
  );
}

function ProgressBadge({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "better" | "equal" | "worse" | "new";
}) {
  return (
    <AppCard style={{ ...heroBadge, ...heroBadgeTone[variant] }}>
      <span style={heroBadgeValue}>{value}</span>
      <span style={heroBadgeLabel}>{label}</span>
    </AppCard>
  );
}

function ProgressRow({ item }: { item: ExerciseProgress }) {
  const badgeVariant =
    item.kind === "better" ? "better" : item.kind === "worse" ? "worse" : item.kind === "new" ? "new" : "equal";

  return (
    <div style={progressRow}>
      <div style={progressRowTop}>
        <div style={progressExercise}>{getExerciseLabel(item.exercise)}</div>
        <AppBadge variant={badgeVariant}>
          {getProgressStatusLabel(item.kind)}
        </AppBadge>
      </div>
      <div style={progressMetricRow}>
        <AppCard variant="soft" style={progressMetricBlock}>
          <div style={metricLabel}>Aktuell</div>
          <div style={metricValueSmall}>
            {item.latest.weight} kg × {item.latest.reps}
          </div>
        </AppCard>
        <AppCard variant="soft" style={progressMetricBlock}>
          <div style={metricLabel}>Vorher</div>
          <div style={metricValueSmall}>
            {item.previous ? `${item.previous.weight} kg × ${item.previous.reps}` : "—"}
          </div>
        </AppCard>
        <AppCard variant="soft" style={progressMetricBlock}>
          <div style={metricLabel}>Bestwert</div>
          <div style={metricValueSmall}>{item.best ? `${item.best.weight} kg × ${item.best.reps}` : "—"}</div>
        </AppCard>
      </div>
      <div style={trendRow}>
        <div style={trendLabel}>Letzte 3 passende Sätze</div>
        <div style={trendChips}>
          {item.recentTrend.map((set) => (
            <span
              key={`${item.exerciseId}-${set.timestamp}-${set.set}`}
              style={trendChip}
            >
              {set.weight} kg × {set.reps}
            </span>
          ))}
        </div>
        <div style={trendInsightLine}>
          {item.trendInsight.label} · {item.trendInsight.detail}
        </div>
      </div>
      <div style={progressCoachLine}>
        Coach: {item.coach.label} · {item.coach.detail}
      </div>
      <div style={deltaLine}>
        {getProgressComparisonLine(item)}
      </div>
    </div>
  );
}

function buildExerciseProgress(entries: WorkoutLogEntry[]): ExerciseProgress[] {
  const sets = entries.filter(isLoggedSetEntry).filter(isWorkSetEntry);
  const grouped = new Map<string, SetType[]>();

  sets.forEach((set) => {
    const key = `${getLoggedSetExerciseReference(set)}:${set.set}`;
    grouped.set(key, [...(grouped.get(key) ?? []), set]);
  });

  const rows: ExerciseProgress[] = [];

  grouped.forEach((groupSets) => {
    const ordered = [...groupSets].sort((a, b) => a.timestamp - b.timestamp);
    const latest = ordered[ordered.length - 1];
    const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    const best = getTopSet(ordered);
    const comparison = getSetComparison(latest, previous);
    const scheme = getSuggestedExerciseSetup(getLoggedSetExerciseReference(latest));

    rows.push({
      exercise: latest.exercise,
      exerciseId: getLoggedSetExerciseReference(latest),
      latest,
      previous,
      best,
      coach: getCoachDecisionForRange(ordered, scheme.minReps, scheme.maxReps),
      recentTrend: ordered.slice(-3),
      trendInsight: getExerciseTrendInsight(
        groupSessionsDescending(ordered).slice(0, 3)
      ),
      deltaWeight: previous ? latest.weight - previous.weight : 0,
      deltaReps: previous ? latest.reps - previous.reps : 0,
      kind: comparison?.kind ?? "same",
    });
  });

  return rows.sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}

function groupSessionsDescending(sets: SetType[]) {
  const bySession = new Map<number, SetType[]>();

  [...sets]
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach((set) => {
      const current = bySession.get(set.sessionId) ?? [];
      current.push(set);
      bySession.set(set.sessionId, current);
    });

  return Array.from(bySession.values()).map((sessionSets) =>
    sessionSets.slice().sort((a, b) => a.timestamp - b.timestamp)
  );
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "±0";
}

function getProgressStatusLabel(kind: ExerciseProgress["kind"]) {
  if (kind === "better") return "stärker";
  if (kind === "worse") return "schwächer";
  if (kind === "new") return "neu";
  return "gleich";
}

function getProgressComparisonLine(item: ExerciseProgress) {
  if (!item.previous) {
    return "Erster Vergleich für diese Übung";
  }

  const delta = `${formatSigned(item.deltaWeight)} kg · ${formatSigned(item.deltaReps)} Wdh.`;
  if (item.kind === "better") {
    return `${delta} stärker als der letzte passende Satz`;
  }
  if (item.kind === "worse") {
    return `${delta} unter dem letzten passenden Satz`;
  }
  return `${delta} gleich zum letzten passenden Satz`;
}

const heroStats = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: uiTheme.spacing.small,
};

const heroBadge = {
  minWidth: 92,
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  justifyItems: "start" as const,
};

const heroBadgeTone = {
  better: { background: withAlpha(appPalette.success, 0.14) },
  equal: { background: appPalette.surfaceMuted },
  worse: { background: withAlpha(appPalette.danger, 0.12) },
  new: { background: withAlpha(splitThemes.pull.primary, 0.12) },
} as const;

const heroBadgeValue = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1,
  color: appPalette.textStrong,
};

const heroBadgeLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 700,
  color: appPalette.textDefault,
};

const focusCard = {
  padding: "14px 14px 15px",
  display: "grid",
  gap: 5,
};

const focusTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const focusValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const focusDetail = {
  fontSize: 14,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const goodCard = { background: withAlpha(appPalette.success, 0.12) };
const warnCard = { background: withAlpha(appPalette.warning, 0.12) };
const neutralCard = { background: appPalette.surface };

const adviceList = {
  display: "grid",
  gap: 10,
};

const adviceRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  paddingTop: 12,
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const adviceDot = {
  minWidth: 34,
  minHeight: 34,
  padding: "0 10px",
};

const adviceText = {
  fontSize: 15,
  lineHeight: 1.45,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const sectionCard = {
  padding: "14px 14px",
  display: "grid",
  gap: 10,
};

const sectionHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const sectionTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const progressRow = {
  padding: "10px 0 0",
  borderTop: `1px solid ${appPalette.borderSoft}`,
  display: "grid",
  gap: 8,
};

const progressRowTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const progressExercise = {
  fontSize: 17,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const progressMetricRow = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const progressMetricBlock = {
  padding: "8px 8px 9px",
  display: "grid",
  gap: 4,
};

const metricLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textSoft,
};

const metricValueSmall = {
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const trendRow = {
  display: "grid",
  gap: 6,
};

const trendLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const trendChips = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const trendInsightLine = {
  fontSize: 12,
  lineHeight: 1.4,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const trendChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderSoft}`,
  color: appPalette.textDefault,
  fontSize: 12,
  fontWeight: 700,
};

const deltaLine = {
  fontSize: 13,
  fontWeight: 700,
  color: appPalette.textDefault,
};

const progressCoachLine = {
  fontSize: 13,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const emptyCard = {
  padding: "18px 16px",
  color: appPalette.textMuted,
  fontSize: 15,
};

const emptySmall = {
  fontSize: 14,
  color: appPalette.textSoft,
};

const moreButton = {
  width: "100%",
  minHeight: 50,
};

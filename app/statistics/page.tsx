"use client";

import { useEffect, useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette, splitThemes, uiTheme, withAlpha } from "@/lib/theme";
import {
  getAllSets,
  getCoachDecisionForRange,
  getLoggedSetExerciseReference,
  isLoggedSetEntry,
  isWorkSetEntry,
  type WorkoutLogEntry,
} from "@/lib/workoutEngine";
import { getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import { getExerciseMeta, getExerciseLabel } from "@/lib/workoutUi";

type SessionSummary = {
  sessionId: number;
  timestamp: number;
  durationMinutes: number;
  planName: string;
  dayName: string;
  entries: WorkoutLogEntry[];
};

type TopStat = {
  label: string;
  value: number;
};

type InsightTone = "good" | "info" | "neutral";
type TrainingGuidance = {
  title: string;
  value: string;
  detail: string;
  tone: InsightTone;
};

export default function StatisticsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExtendedRankings, setShowExtendedRankings] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const entries = await getAllSets();
        setSessions(groupSessions(entries));
      } catch (error) {
        console.error("Statistics could not be loaded:", error);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const stats = useMemo(() => {
    const loggedSets = sessions.flatMap((session) => session.entries.filter(isLoggedSetEntry));
    const workSets = loggedSets.filter(isWorkSetEntry);
    const now = Date.now();

    const monthSessions = sessions.filter((session) => {
      const date = new Date(session.timestamp);
      const current = new Date(now);
      return date.getMonth() === current.getMonth() && date.getFullYear() === current.getFullYear();
    }).length;

    const weekSessions = sessions.filter((session) => now - session.timestamp <= 7 * 86400000).length;
    const previousWeekSessions = sessions.filter((session) => {
      const diff = now - session.timestamp;
      return diff > 7 * 86400000 && diff <= 14 * 86400000;
    }).length;

    const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const averageMinutes = sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;
    const totalVolume = Math.round(workSets.reduce((sum, set) => sum + set.weight * set.reps, 0));

    const exerciseMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const planMap = new Map<string, number>();

    workSets.forEach((set) => {
      const exerciseLabel = getExerciseLabel(getLoggedSetExerciseReference(set));
      exerciseMap.set(exerciseLabel, (exerciseMap.get(exerciseLabel) ?? 0) + 1);
      const category =
        getExerciseMeta(getLoggedSetExerciseReference(set))?.category ?? "Andere";
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
    });

    sessions.forEach((session) => {
      const label = session.planName || "Mein Plan";
      planMap.set(label, (planMap.get(label) ?? 0) + 1);
    });

    return {
      totalSessions: sessions.length,
      monthSessions,
      weekSessions,
      previousWeekSessions,
      totalMinutes,
      averageMinutes,
      totalWorkSets: workSets.length,
      totalVolume,
      topExercises: getTopEntries(exerciseMap),
      topCategories: getTopEntries(categoryMap),
      topPlans: getTopEntries(planMap),
    };
  }, [sessions]);

  const insights = useMemo(() => {
    const weekDelta = stats.weekSessions - stats.previousWeekSessions;
    const topExercise = stats.topExercises[0] ?? null;
    const topCategory = stats.topCategories[0] ?? null;
    const topPlan = stats.topPlans[0] ?? null;

    return [
      {
        title: "Trainingsrhythmus",
        value: `${stats.weekSessions} diese Woche`,
        detail: weekDelta === 0 ? "gleich wie letzte Woche" : `${formatSignedInt(weekDelta)} vs. letzte Woche`,
        tone: stats.weekSessions >= 4 ? "good" : stats.weekSessions >= 1 ? "info" : "neutral",
      },
      {
        title: "Dein Fokus",
        value: topCategory ? topCategory.label : "Noch offen",
        detail: topExercise ? `${topExercise.label} am häufigsten trainiert` : "Noch keine Übungsdaten",
        tone: "info",
      },
      {
        title: "Aktivster Plan",
        value: topPlan ? topPlan.label : "Noch keiner",
        detail: topPlan ? `${topPlan.value} Sessions insgesamt` : "Sobald du trainierst, erscheint hier dein Schwerpunkt",
        tone: "neutral",
      },
    ] as Array<{ title: string; value: string; detail: string; tone: InsightTone }>;
  }, [stats]);

  const recommendation = useMemo(() => {
    const topCategory = stats.topCategories[0] ?? null;
    const topExercise = stats.topExercises[0] ?? null;
    const topPlan = stats.topPlans[0] ?? null;
    const dominantPlanShare = topPlan && stats.totalSessions > 0 ? topPlan.value / stats.totalSessions : 0;

    if (stats.totalSessions === 0) {
      return {
        title: "Was jetzt?",
        value: "Mit 1 Workout starten",
        detail: "Sobald die ersten Sessions drin sind, werden Rhythmus, Fokus und aktive Pläne hier viel aussagekräftiger.",
      };
    }

    if (stats.weekSessions === 0) {
      return {
        title: "Was jetzt?",
        value: "Rhythmus wieder aufnehmen",
        detail: "Diese Woche ist noch kein Training geloggt. Eine kurze Session bringt dich sofort zurück in den Flow.",
      };
    }

    if (stats.weekSessions < 2) {
      return {
        title: "Was jetzt?",
        value: "Eine zweite Session anpeilen",
        detail: "Mit zwei Einheiten pro Woche werden Frequenz, Vergleichswerte und Fortschritte spürbar stabiler.",
      };
    }

    if (topPlan && dominantPlanShare >= 0.65) {
      return {
        title: "Was jetzt?",
        value: `${topPlan.label} trägt deinen Block`,
        detail: topCategory
          ? `Der Plan läuft gerade klar vorne, besonders mit Fokus auf ${topCategory.label}. Prüfe, ob der Rest deines Splits trotzdem genug Platz bekommt.`
          : "Ein Plan dominiert aktuell deutlich. Das ist okay für einen Block, sollte aber bewusst so gewollt sein.",
      };
    }

    if (topCategory && stats.totalWorkSets > 0 && topCategory.value / stats.totalWorkSets >= 0.6) {
      return {
        title: "Was jetzt?",
        value: `${topCategory.label} dominiert aktuell`,
        detail: topExercise
          ? `${topExercise.label} prägt den Schwerpunkt besonders stark. Wenn sich der Block einseitig anfühlt, ergänze einen Gegenspieler oder verteile das Volumen ausgewogener.`
          : "Wenn sich der Block einseitig anfühlt, ergänze einen Gegenspieler oder verteile das Volumen ausgewogener.",
      };
    }

    if (stats.averageMinutes > 0 && stats.averageMinutes < 35) {
      return {
        title: "Was jetzt?",
        value: "Sessions sind eher kurz",
        detail: "Wenn du mehr Fortschritt willst, hilft oft schon ein zusätzlicher Arbeitssatz oder ein klarer Zusatzblock.",
      };
    }

    return {
      title: "Was jetzt?",
      value: "Rhythmus stabil halten",
      detail: "Deine Daten wirken aktuell ausgeglichen. Jetzt lohnt es sich, denselben Trainingsfluss konsequent weiterzuführen.",
    };
  }, [stats]);

  const trainingGuidance = useMemo(() => {
    const workSets = sessions
      .flatMap((session) => session.entries.filter(isLoggedSetEntry))
      .filter(isWorkSetEntry);
    const grouped = new Map<string, typeof workSets>();

    workSets.forEach((set) => {
      const key = getLoggedSetExerciseReference(set);
      grouped.set(key, [...(grouped.get(key) ?? []), set]);
    });

    const decisions = Array.from(grouped.entries())
      .map(([exerciseId, sets]) => {
        const ordered = [...sets].sort((a, b) => a.timestamp - b.timestamp);
        const scheme = getSuggestedExerciseSetup(exerciseId);
        return {
          exerciseId,
          exercise: ordered[0]?.exercise ?? exerciseId,
          decision: getCoachDecisionForRange(ordered, scheme.minReps, scheme.maxReps),
          latestTimestamp: ordered[ordered.length - 1]?.timestamp ?? 0,
        };
      })
      .sort((a, b) => b.latestTimestamp - a.latestTimestamp);

    const increase = decisions.filter((item) => item.decision.action === "increase");
    const keep = decisions.filter((item) => item.decision.action === "keep");
    const decrease = decisions.filter((item) => item.decision.action === "decrease");

    if (decisions.length === 0) {
      return {
        title: "Trainingssteuerung",
        value: "Noch keine Coach-Daten",
        detail: "Sobald genug Arbeitssätze vorhanden sind, bekommst du hier Hinweise zu Steigern, Halten oder Entlasten.",
        tone: "neutral" as const,
      };
    }

    if (decrease.length > increase.length && decrease.length > 0) {
      const focus = decrease[0];
      return {
        title: "Trainingssteuerung",
        value: "Belastung genauer prüfen",
        detail: `${getExerciseLabel(focus.exercise)} wirkt aktuell eher ermüdet. Dort lohnt sich zuerst saubere Stabilisierung statt mehr Last.`,
        tone: "neutral" as const,
      };
    }

    if (increase.length > 0) {
      const focus = increase[0];
      return {
        title: "Trainingssteuerung",
        value: `${increase.length} Übungen bereit zum Steigern`,
        detail: `${getExerciseLabel(focus.exercise)} ist ein guter Kandidat für den nächsten kleinen Progressionsschritt.`,
        tone: "good" as const,
      };
    }

    return {
      title: "Trainingssteuerung",
      value: `${keep.length} Übungen stabil`,
      detail: "Die meisten aktuellen Muster sprechen eher für Halten und saubere Wiederholungsqualität als für hektische Änderungen.",
      tone: "info" as const,
    };
  }, [sessions]);

  const dataCoverage = useMemo(() => {
    if (stats.totalSessions === 0) {
      return {
        title: "Datenbasis",
        value: "Noch im Aufbau",
        detail: "Mit den ersten Sessions werden Verlauf, Coach-Logik und Statistik Schritt fuer Schritt aussagekraeftiger.",
        tone: "neutral" as const,
      };
    }

    if (stats.totalSessions >= 12 && stats.totalWorkSets >= 80) {
      return {
        title: "Datenbasis",
        value: "Sehr belastbar",
        detail: `${stats.totalSessions} Sessions und ${stats.totalWorkSets} Arbeitssaetze geben deinen Auswertungen bereits eine starke Grundlage.`,
        tone: "good" as const,
      };
    }

    if (stats.totalSessions >= 4 && stats.totalWorkSets >= 24) {
      return {
        title: "Datenbasis",
        value: "Gut lesbar",
        detail: `Mit ${stats.totalSessions} Sessions lassen sich erste klare Muster und Uebungstrends schon solide erkennen.`,
        tone: "info" as const,
      };
    }

    return {
      title: "Datenbasis",
      value: "Erste Richtung sichtbar",
      detail: "Die App erkennt bereits Tendenzen, aber noch nicht jede Uebung hat genug Historie fuer harte Aussagen.",
      tone: "neutral" as const,
    };
  }, [stats]);

  const rankingOverflow =
    stats.topExercises.length > 3 || stats.topCategories.length > 3 || stats.topPlans.length > 3;

  return (
    <AppPageFrame
      activeKey="stats"
      eyebrow="Statistiken"
      title="Dein Überblick"
      subtitle="Gesamtzahlen, Trainingsfrequenz und Schwerpunkte auf einen Blick."
    >
      {loading ? <AppCard style={emptyCard}>Lade Statistiken...</AppCard> : null}

      {!loading ? (
        <>
          <div style={insightGrid}>
            {insights.map((insight) => (
              <InsightCard key={insight.title} {...insight} />
            ))}
          </div>

          <InsightCard {...trainingGuidance} />
          <InsightCard {...dataCoverage} />

          <RecommendationCard {...recommendation} />

          <div style={metricGrid}>
            <MetricCard label="Trainings gesamt" value={stats.totalSessions} />
            <MetricCard label="Diese Woche" value={stats.weekSessions} />
            <MetricCard label="Dieser Monat" value={stats.monthSessions} />
            <MetricCard label="Ø Dauer" value={`${stats.averageMinutes} min`} />
          </div>

          <div style={metricGrid}>
            <MetricCard label="Arbeitssätze" value={stats.totalWorkSets} />
            <MetricCard label="Trainingszeit" value={`${stats.totalMinutes} min`} />
            <MetricCard label="Volumen" value={stats.totalVolume} smallSuffix="kg×Wdh" />
          </div>

          <StatsSection
            title="Meist trainierte Übungen"
            items={showExtendedRankings ? stats.topExercises : stats.topExercises.slice(0, 3)}
            emptyLabel="Noch keine Übungsdaten vorhanden"
          />
          <StatsSection
            title="Muskelgruppen im Fokus"
            items={showExtendedRankings ? stats.topCategories : stats.topCategories.slice(0, 3)}
            emptyLabel="Noch keine Muskelgruppen vorhanden"
          />
          <StatsSection
            title="Aktivste Pläne"
            items={showExtendedRankings ? stats.topPlans : stats.topPlans.slice(0, 3)}
            emptyLabel="Noch keine Plandaten vorhanden"
          />

          {rankingOverflow ? (
            <AppButton
              block
              variant="secondary"
              style={moreButton}
              onClick={() => setShowExtendedRankings((current) => !current)}
            >
              {showExtendedRankings ? "Weniger Rankings anzeigen" : "Weitere Rankings anzeigen"}
            </AppButton>
          ) : null}
        </>
      ) : null}
    </AppPageFrame>
  );
}

function MetricCard({
  label,
  value,
  smallSuffix,
}: {
  label: string;
  value: string | number;
  smallSuffix?: string;
}) {
  return (
    <AppCard style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
      {smallSuffix ? <div style={metricSuffix}>{smallSuffix}</div> : null}
    </AppCard>
  );
}

function InsightCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  tone: InsightTone;
}) {
  const toneStyle = tone === "good" ? insightGood : tone === "info" ? insightInfo : insightNeutral;

  return (
    <AppCard style={{ ...insightCard, ...toneStyle }}>
      <div style={insightTitle}>{title}</div>
      <div style={insightValue}>{value}</div>
      <div style={insightDetail}>{detail}</div>
    </AppCard>
  );
}

function RecommendationCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <AppCard style={recommendationCard}>
      <div style={recommendationTitle}>{title}</div>
      <div style={recommendationValue}>{value}</div>
      <div style={recommendationDetail}>{detail}</div>
    </AppCard>
  );
}

function StatsSection({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: TopStat[];
  emptyLabel: string;
}) {
  return (
    <AppCard style={sectionCard}>
      <div style={sectionHead}>
        <div style={sectionTitle}>{title}</div>
        {items.length > 0 ? <AppBadge variant="template">{items.length} Einträge</AppBadge> : null}
      </div>
      {items.length === 0 ? <div style={emptySmall}>{emptyLabel}</div> : null}
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} style={rankRow}>
          <div style={rankLeft}>
            <AppBadge variant="exercise" style={rankBadge}>
              {index + 1}
            </AppBadge>
            <span style={rankLabel}>{item.label}</span>
          </div>
          <div style={rankValue}>{item.value}</div>
        </div>
      ))}
    </AppCard>
  );
}

function groupSessions(entries: WorkoutLogEntry[]): SessionSummary[] {
  const grouped = entries.reduce<Record<string, WorkoutLogEntry[]>>((acc, entry) => {
    const key = String(entry.sessionId);
    acc[key] ??= [];
    acc[key].push(entry);
    return acc;
  }, {});

  return Object.values(grouped)
    .map((sessionEntries) => {
      const ordered = [...sessionEntries].sort((a, b) => a.timestamp - b.timestamp);
      const first = ordered[0];
      const last = ordered[ordered.length - 1];

      return {
        sessionId: first.sessionId,
        timestamp: first.timestamp,
        durationMinutes: Math.max(1, Math.round((last.timestamp - first.timestamp) / 60000)),
        planName: first.planName || "Mein Plan",
        dayName: first.dayName || "Workout",
        entries: ordered,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getTopEntries(map: Map<string, number>, limit = 5): TopStat[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function formatSignedInt(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
}

const insightGrid = {
  display: "grid",
  gap: uiTheme.spacing.small,
};

const insightCard = {
  padding: "13px 14px 14px",
  display: "grid",
  gap: 5,
};

const insightGood = {
  background: withAlpha(appPalette.success, 0.12),
};

const insightInfo = {
  background: withAlpha(splitThemes.pull.primary, 0.12),
};

const insightNeutral = {
  background: appPalette.surface,
};

const insightTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const insightValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const insightDetail = {
  fontSize: 13,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const recommendationCard = {
  padding: "13px 14px 14px",
  background: withAlpha(appPalette.warning, 0.12),
  border: `1px solid ${withAlpha(appPalette.warning, 0.28)}`,
  display: "grid",
  gap: 5,
};

const recommendationTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.warning,
};

const recommendationValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const recommendationDetail = {
  fontSize: 14,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const metricGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: uiTheme.spacing.small,
};

const metricCard = {
  padding: "13px 14px 14px",
  display: "grid",
  gap: 6,
};

const metricLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textSoft,
};

const metricValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const metricSuffix = {
  fontSize: 12,
  color: appPalette.textMuted,
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

const rankRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  paddingTop: 10,
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const rankLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const rankBadge = {
  minWidth: 36,
  minHeight: 34,
  padding: "0 10px",
};

const rankLabel = {
  fontSize: 16,
  fontWeight: 700,
  color: appPalette.textStrong,
};

const rankValue = {
  fontSize: 22,
  fontWeight: 800,
  color: appPalette.textStrong,
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

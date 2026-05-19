"use client";

import { useEffect, useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { getAllSets, isLoggedSetEntry, type WorkoutLogEntry } from "@/lib/workoutEngine";
import { getExerciseMeta } from "@/lib/workoutUi";

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
    const workSets = loggedSets.filter((set) => set.set > 0);
    const now = Date.now();

    const monthSessions = sessions.filter((session) => {
      const date = new Date(session.timestamp);
      const current = new Date(now);
      return (
        date.getMonth() === current.getMonth() &&
        date.getFullYear() === current.getFullYear()
      );
    }).length;

    const weekSessions = sessions.filter((session) => now - session.timestamp <= 7 * 86400000).length;
    const previousWeekSessions = sessions.filter((session) => {
      const diff = now - session.timestamp;
      return diff > 7 * 86400000 && diff <= 14 * 86400000;
    }).length;

    const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const averageMinutes = sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;
    const totalVolume = Math.round(
      workSets.reduce((sum, set) => sum + set.weight * set.reps, 0)
    );

    const exerciseMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const planMap = new Map<string, number>();

    workSets.forEach((set) => {
      exerciseMap.set(set.exercise, (exerciseMap.get(set.exercise) ?? 0) + 1);
      const category = getExerciseMeta(set.exercise)?.category ?? "Andere";
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
        detail:
          weekDelta === 0
            ? "gleich wie letzte Woche"
            : `${formatSignedInt(weekDelta)} vs. letzte Woche`,
        tone: stats.weekSessions >= 4 ? "good" : stats.weekSessions >= 1 ? "info" : "neutral",
      },
      {
        title: "Dein Fokus",
        value: topCategory ? topCategory.label : "Noch offen",
        detail: topExercise
          ? `${topExercise.label} am häufigsten trainiert`
          : "Noch keine Übungsdaten",
        tone: "info",
      },
      {
        title: "Aktivster Plan",
        value: topPlan ? topPlan.label : "Noch keiner",
        detail: topPlan
          ? `${topPlan.value} Sessions insgesamt`
          : "Sobald du trainierst, erscheint hier dein Schwerpunkt",
        tone: "neutral",
      },
    ] as const;
  }, [stats]);

  const recommendation = useMemo(() => {
    const topCategory = stats.topCategories[0] ?? null;
    const topExercise = stats.topExercises[0] ?? null;
    const topPlan = stats.topPlans[0] ?? null;
    const dominantPlanShare =
      topPlan && stats.totalSessions > 0 ? topPlan.value / stats.totalSessions : 0;

    if (stats.totalSessions === 0) {
      return {
        title: "Was jetzt?",
        value: "Mit 1 Workout starten",
        detail:
          "Sobald die ersten Sessions drin sind, werden Rhythmus, Fokus und aktive Pläne hier viel aussagekräftiger.",
      };
    }

    if (stats.weekSessions === 0) {
      return {
        title: "Was jetzt?",
        value: "Rhythmus wieder aufnehmen",
        detail:
          "Diese Woche ist noch kein Training geloggt. Eine kurze Session bringt dich sofort zurück in den Flow.",
      };
    }

    if (stats.weekSessions < 2) {
      return {
        title: "Was jetzt?",
        value: "Eine zweite Session anpeilen",
        detail:
          "Mit zwei Einheiten pro Woche werden Frequenz, Vergleichswerte und Fortschritte spürbar stabiler.",
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
        detail:
          "Wenn du mehr Fortschritt willst, hilft oft schon ein zusätzlicher Arbeitssatz oder ein klarer Zusatzblock.",
      };
    }

    return {
      title: "Was jetzt?",
      value: "Rhythmus stabil halten",
      detail:
        "Deine Daten wirken aktuell ausgeglichen. Jetzt lohnt es sich, denselben Trainingsfluss konsequent weiterzuführen.",
    };
  }, [stats]);

  const rankingOverflow =
    stats.topExercises.length > 3 ||
    stats.topCategories.length > 3 ||
    stats.topPlans.length > 3;

  return (
    <AppPageFrame
      activeKey="stats"
      eyebrow="Statistiken"
      title="Dein Überblick"
      subtitle="Gesamtzahlen, Trainingsfrequenz und Schwerpunkte auf einen Blick."
    >
      {loading ? <div style={emptyCard}>Lade Statistiken...</div> : null}

      {!loading ? (
        <>
          <div style={insightGrid}>
            {insights.map((insight) => (
              <InsightCard
                key={insight.title}
                title={insight.title}
                value={insight.value}
                detail={insight.detail}
                tone={insight.tone}
              />
            ))}
          </div>

          <RecommendationCard
            title={recommendation.title}
            value={recommendation.value}
            detail={recommendation.detail}
          />

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
            <button
              style={moreButton}
              onClick={() => setShowExtendedRankings((current) => !current)}
            >
              {showExtendedRankings ? "Weniger Rankings anzeigen" : "Weitere Rankings anzeigen"}
            </button>
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
    <div style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
      {smallSuffix ? <div style={metricSuffix}>{smallSuffix}</div> : null}
    </div>
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
  tone: "good" | "info" | "neutral";
}) {
  const toneStyle =
    tone === "good" ? insightGood : tone === "info" ? insightInfo : insightNeutral;

  return (
    <div style={{ ...insightCard, ...toneStyle }}>
      <div style={insightTitle}>{title}</div>
      <div style={insightValue}>{value}</div>
      <div style={insightDetail}>{detail}</div>
    </div>
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
    <div style={recommendationCard}>
      <div style={recommendationTitle}>{title}</div>
      <div style={recommendationValue}>{value}</div>
      <div style={recommendationDetail}>{detail}</div>
    </div>
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
    <section style={sectionCard}>
      <div style={sectionTitle}>{title}</div>
      {items.length === 0 ? <div style={emptySmall}>{emptyLabel}</div> : null}
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} style={rankRow}>
          <div style={rankLeft}>
            <span style={rankBadge}>{index + 1}</span>
            <span style={rankLabel}>{item.label}</span>
          </div>
          <div style={rankValue}>{item.value}</div>
        </div>
      ))}
    </section>
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
  gap: 10,
};

const insightCard = {
  padding: "14px 14px 15px",
  borderRadius: 20,
  border: "1px solid #e8eef6",
  boxShadow: "0 20px 34px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 5,
};

const insightGood = {
  background: "#f0fdf4",
};

const insightInfo = {
  background: "#eff6ff",
};

const insightNeutral = {
  background: "#ffffff",
};

const insightTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#64748b",
};

const insightValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const insightDetail = {
  fontSize: 13,
  color: "#475569",
  fontWeight: 700,
};

const recommendationCard = {
  padding: "14px 14px 15px",
  borderRadius: 20,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  boxShadow: "0 20px 34px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 5,
};

const recommendationTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#9a3412",
};

const recommendationValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const recommendationDetail = {
  fontSize: 14,
  color: "#7c2d12",
  fontWeight: 700,
};

const metricGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const metricCard = {
  padding: "14px 14px 15px",
  borderRadius: 20,
  background: "#ffffff",
  border: "1px solid #e8eef6",
  boxShadow: "0 20px 34px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 6,
};

const metricLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#94a3b8",
};

const metricValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const metricSuffix = {
  fontSize: 12,
  color: "#64748b",
};

const sectionCard = {
  padding: "16px 14px",
  borderRadius: 22,
  background: "#ffffff",
  border: "1px solid #e8eef6",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 12,
};

const sectionTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const rankRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  paddingTop: 12,
  borderTop: "1px solid #eef2f7",
};

const rankLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const rankBadge = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eef4ff",
  color: "#2563eb",
  fontWeight: 800,
  fontSize: 15,
};

const rankLabel = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const rankValue = {
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
};

const emptyCard = {
  padding: "18px 16px",
  borderRadius: 22,
  background: "#ffffff",
  border: "1px solid #e8eef6",
  color: "#64748b",
  fontSize: 15,
};

const emptySmall = {
  fontSize: 14,
  color: "#94a3b8",
};

const moreButton = {
  width: "100%",
  minHeight: 54,
  borderRadius: 999,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 800,
  border: "1px solid #dce5f0",
  boxShadow: "0 18px 30px rgba(15, 23, 42, 0.06)",
};

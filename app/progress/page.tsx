"use client";

import { useEffect, useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import {
  getSetComparison,
  getTopSet,
  isLoggedSetEntry,
  type SetType,
  type WorkoutLogEntry,
} from "@/lib/workoutEngine";
import { getExerciseLabel, getExerciseMeta } from "@/lib/workoutUi";

type ExerciseProgress = {
  exercise: string;
  exerciseId: string;
  latest: SetType;
  previous: SetType | null;
  best: SetType | null;
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
        .sort((a, b) => b.better - a.better || b.latestTimestamp - a.latestTimestamp)[0] ??
      null;

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
      return [
        "Noch fehlen genug Vergleichssätze. Halte erst ein paar Trainings sauber fest.",
      ];
    }

    const items: string[] = [];
    const primaryStall = biggestStalls[0] ?? null;
    const primaryGain = topImprovers[0] ?? null;
    const stallMeta = focusExercises.topStall
      ? getExerciseMeta(focusExercises.topStall.exercise)
      : null;
    const gainMeta = focusExercises.topGain
      ? getExerciseMeta(focusExercises.topGain.exercise)
      : null;

    if (primaryStall?.kind === "worse") {
      items.push(
        `${getExerciseLabel(primaryStall.exercise)} fällt zurück${
          stallMeta?.category ? ` (${stallMeta.category})` : ""
        }. Prüfe Gewicht, Erholung oder Satzqualität.`
      );
    } else if (primaryStall?.kind === "same") {
      items.push(
        `${getExerciseLabel(primaryStall.exercise)} stagniert${
          stallMeta?.category ? ` (${stallMeta.category})` : ""
        }. Ein kleiner Reiz über Gewicht, Wiederholungen oder Pause kann helfen.`
      );
    }

    if (primaryGain) {
      items.push(
        `${getExerciseLabel(primaryGain.exercise)} läuft gut${
          gainMeta?.category ? ` (${gainMeta.category})` : ""
        }. Halte dort die Progression kontrolliert weiter.`
      );
    }

    if (sameCount >= betterCount && sameCount > 0) {
      items.push(
        "Viele Sätze bewegen sich seitwärts. Ein klarerer Fokus auf 1–2 Schlüsselübungen könnte den nächsten Schub bringen."
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
      items.push(
        "Deine aktuellen Vergleiche wirken stabil. Jetzt lohnt sich vor allem Konstanz statt hektischer Änderungen."
      );
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
      {loading ? <div style={emptyCard}>Lade Fortschritte...</div> : null}

      {!loading ? (
        <>
          <div style={heroStats}>
            <ProgressBadge label="stärker" value={betterCount} tone="good" />
            <ProgressBadge label="gleich" value={sameCount} tone="neutral" />
            <ProgressBadge label="schwächer" value={worseCount} tone="warn" />
            {newCount > 0 ? <ProgressBadge label="neu" value={newCount} tone="new" /> : null}
          </div>

          <div
            style={{
              ...focusCard,
              ...(focusInsight.tone === "good"
                ? goodBadge
                : focusInsight.tone === "warn"
                  ? warnBadge
                  : neutralBadge),
            }}
          >
            <div style={focusTitle}>{focusInsight.title}</div>
            <div style={focusValue}>{focusInsight.value}</div>
            <div style={focusDetail}>{focusInsight.detail}</div>
          </div>

          <section style={sectionCard}>
            <div style={sectionTitle}>Was jetzt?</div>
            <div style={adviceList}>
              {recommendations.map((item, index) => (
                <div key={`${item}-${index}`} style={adviceRow}>
                  <span style={adviceDot}>{index + 1}</span>
                  <span style={adviceText}>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={sectionCard}>
            <div style={sectionTitle}>Größte Verbesserungen</div>
            {topImprovers.length === 0 ? (
              <div style={emptySmall}>Noch keine direkten Verbesserungen gefunden.</div>
            ) : null}
            {topImprovers.slice(0, 3).map((item) => (
              <ProgressRow key={`${item.exerciseId}-${item.latest.timestamp}`} item={item} />
            ))}
          </section>

          <section style={sectionCard}>
            <div style={sectionTitle}>Darauf achten</div>
            {biggestStalls.length === 0 ? (
              <div style={emptySmall}>Aktuell gibt es keine klaren Stagnationen oder Rückgänge.</div>
            ) : null}
            {biggestStalls.slice(0, 3).map((item) => (
              <ProgressRow key={`${item.exerciseId}-${item.latest.timestamp}-stall`} item={item} />
            ))}
          </section>

          {(progressCards.length > 3 || topImprovers.length > 3 || biggestStalls.length > 3) ? (
            <button
              style={moreButton}
              onClick={() => setShowAllComparisons((current) => !current)}
            >
              {showAllComparisons ? "Weniger Vergleiche anzeigen" : "Alle Vergleiche anzeigen"}
            </button>
          ) : null}

          {showAllComparisons ? (
            <section style={sectionCard}>
              <div style={sectionTitle}>Alle aktuellen Vergleiche</div>
              {progressCards.length === 0 ? (
                <div style={emptySmall}>Noch nicht genug Trainingsdaten vorhanden.</div>
              ) : null}
              {progressCards.map((item) => (
                <ProgressRow key={`${item.exerciseId}-${item.latest.timestamp}-all`} item={item} />
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </AppPageFrame>
  );
}

function ProgressBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "neutral" | "warn" | "new";
}) {
  const toneStyle =
    tone === "good"
      ? goodBadge
      : tone === "warn"
        ? warnBadge
        : tone === "new"
          ? newBadge
          : neutralBadge;

  return (
    <div style={{ ...heroBadge, ...toneStyle }}>
      <span style={heroBadgeValue}>{value}</span>
      <span style={heroBadgeLabel}>{label}</span>
    </div>
  );
}

function ProgressRow({ item }: { item: ExerciseProgress }) {
  return (
    <div style={progressRow}>
      <div style={progressRowTop}>
        <div style={progressExercise}>{getExerciseLabel(item.exercise)}</div>
        <div
          style={{
            ...miniBadge,
            ...(item.kind === "better"
              ? goodBadge
              : item.kind === "worse"
                ? warnBadge
                : item.kind === "new"
                  ? newBadge
                  : neutralBadge),
          }}
        >
          {item.kind === "better"
            ? "stärker"
            : item.kind === "worse"
              ? "schwächer"
              : item.kind === "new"
                ? "neu"
                : "gleich"}
        </div>
      </div>
      <div style={progressMetricRow}>
        <div style={progressMetricBlock}>
          <div style={metricLabel}>Aktuell</div>
          <div style={metricValueSmall}>
            {item.latest.weight} kg × {item.latest.reps}
          </div>
        </div>
        <div style={progressMetricBlock}>
          <div style={metricLabel}>Vorher</div>
          <div style={metricValueSmall}>
            {item.previous ? `${item.previous.weight} kg × ${item.previous.reps}` : "—"}
          </div>
        </div>
        <div style={progressMetricBlock}>
          <div style={metricLabel}>Bestwert</div>
          <div style={metricValueSmall}>
            {item.best ? `${item.best.weight} kg × ${item.best.reps}` : "—"}
          </div>
        </div>
      </div>
      <div style={deltaLine}>
        {item.previous
          ? `${formatSigned(item.deltaWeight)} kg · ${formatSigned(item.deltaReps)} Wdh.`
          : "Erster Vergleich für diese Übung"}
      </div>
    </div>
  );
}

function buildExerciseProgress(entries: WorkoutLogEntry[]): ExerciseProgress[] {
  const sets = entries.filter(isLoggedSetEntry).filter((set) => set.set > 0);
  const grouped = new Map<string, SetType[]>();

  sets.forEach((set) => {
    const key = `${set.exerciseId ?? set.exercise}:${set.set}`;
    grouped.set(key, [...(grouped.get(key) ?? []), set]);
  });

  const rows: ExerciseProgress[] = [];

  grouped.forEach((groupSets) => {
    const ordered = [...groupSets].sort((a, b) => a.timestamp - b.timestamp);
    const latest = ordered[ordered.length - 1];
    const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    const best = getTopSet(ordered);
    const comparison = getSetComparison(latest, previous);

    rows.push({
      exercise: latest.exercise,
      exerciseId: latest.exerciseId ?? latest.exercise,
      latest,
      previous,
      best,
      deltaWeight: previous ? latest.weight - previous.weight : 0,
      deltaReps: previous ? latest.reps - previous.reps : 0,
      kind: comparison?.kind ?? "same",
    });
  });

  return rows.sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "±0";
}

const heroStats = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const heroBadge = {
  minWidth: 86,
  padding: "10px 12px",
  borderRadius: 18,
  display: "grid",
  gap: 4,
  justifyItems: "start" as const,
};

const heroBadgeValue = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1,
};

const heroBadgeLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 700,
};

const focusCard = {
  padding: "14px 14px 15px",
  borderRadius: 22,
  border: "1px solid #e8eef6",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 5,
};

const focusTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#64748b",
};

const focusValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const focusDetail = {
  fontSize: 14,
  color: "#475569",
  fontWeight: 700,
};

const adviceList = {
  display: "grid",
  gap: 10,
};

const adviceRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  paddingTop: 12,
  borderTop: "1px solid #eef2f7",
};

const adviceDot = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff7ed",
  color: "#ea580c",
  fontWeight: 800,
  fontSize: 13,
  flexShrink: 0,
};

const adviceText = {
  fontSize: 15,
  lineHeight: 1.45,
  color: "#334155",
  fontWeight: 700,
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

const progressRow = {
  padding: "12px 0 0",
  borderTop: "1px solid #eef2f7",
  display: "grid",
  gap: 10,
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
  color: "#0f172a",
};

const progressMetricRow = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const progressMetricBlock = {
  display: "grid",
  gap: 4,
  padding: "9px 9px 10px",
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #edf2f7",
};

const metricLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#94a3b8",
};

const metricValueSmall = {
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
};

const deltaLine = {
  fontSize: 13,
  fontWeight: 700,
  color: "#475569",
};

const miniBadge = {
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
};

const goodBadge = {
  background: "#e8fbef",
  color: "#15803d",
};

const warnBadge = {
  background: "#fff1f2",
  color: "#be123c",
};

const neutralBadge = {
  background: "#f1f5f9",
  color: "#475569",
};

const newBadge = {
  background: "#eff6ff",
  color: "#2563eb",
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
  minHeight: 50,
  borderRadius: 999,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  border: "1px solid #dce5f0",
};

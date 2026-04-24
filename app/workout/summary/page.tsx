"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  getLastSessionForExercise,
  getProgress,
  getSetsBySession,
  getTopSet,
  type SetType,
} from "@/lib/workoutEngine";
import { getExerciseLabel } from "@/lib/workoutUi";

type ExerciseSummary = {
  exercise: string;
  topSet: SetType | null;
  progress: { weight: number; reps: number } | null;
};

export default function SummaryPage() {
  return (
    <Suspense fallback={<div style={screen}>Lade Daten...</div>}>
      <SummaryContent />
    </Suspense>
  );
}

function SummaryContent() {
  const [sets, setSets] = useState<SetType[]>([]);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exerciseData, setExerciseData] = useState<ExerciseSummary[]>([]);
  const [sessionDate, setSessionDate] = useState("");

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
        setSets(data);

        if (data.length > 0) {
          const min = data[0].timestamp;
          const max = data[data.length - 1].timestamp;
          setDuration(Math.max(1, Math.round((max - min) / 60000)));
          setSessionDate(
            new Date(min).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          );
        }

        const grouped = new Map<string, SetType[]>();

        data.forEach((set) => {
          if (!grouped.has(set.exercise)) {
            grouped.set(set.exercise, []);
          }
          grouped.get(set.exercise)!.push(set);
        });

        const result: ExerciseSummary[] = [];

        for (const [exercise, currentSets] of grouped.entries()) {
          const topSet = getTopSet(currentSets);
          const lastSession = await getLastSessionForExercise(exercise, sessionId);
          const lastTop = getTopSet(lastSession);
          const progress = getProgress(topSet, lastTop);

          result.push({
            exercise,
            topSet,
            progress,
          });
        }

        setExerciseData(result.slice(0, 6));
      } catch (error) {
        console.error("Summary load failed:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  return (
    <div style={screen}>
      <div style={shell}>
        <div style={hero}>
          <h1 style={title}>Training {sessionDate || "-"}</h1>

          {!loading && (
            <>
              <div style={statsGrid}>
                <div style={statCard}>
                  <div style={statLabel}>Dauer</div>
                  <div style={statValue}>{duration} min</div>
                </div>
                <div style={statCard}>
                  <div style={statLabel}>Saetze</div>
                  <div style={statValue}>{sets.length}</div>
                </div>
              </div>
              <div style={heroSummaryRow}>
                {getSummaryStats(exerciseData).map((item) => (
                  <span key={item.label} style={item.style}>
                    {item.text}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {loading ? (
          <p style={loadingText}>Lade Daten...</p>
        ) : (
          <div style={exerciseGrid}>
            {exerciseData.map((exercise) => (
              <div key={exercise.exercise} style={card}>
                <div>
                  <div style={exerciseTitle}>{getExerciseLabel(exercise.exercise)}</div>
                  {exercise.topSet && (
                    <div style={topSet}>
                      {exercise.topSet.weight} kg x {exercise.topSet.reps}
                    </div>
                  )}
                </div>

                <div style={chipRow}>
                  <span style={getProgressBadgeStyle(exercise.progress)}>
                    {getProgressArrow(exercise.progress)}{" "}
                    {getProgressLabel(exercise.progress)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={actionStack}>
          <a href="/index.html" style={primaryButton}>
            Start
          </a>

          <a href="/history/index.html" style={secondaryButton}>
            Verlauf
          </a>
        </div>
      </div>
    </div>
  );
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
};

const hero = {
  padding: "14px 16px",
  borderRadius: 24,
  background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
  color: "#fff",
  boxShadow: "0 24px 60px rgba(17, 24, 39, 0.18)",
};

const title = {
  fontSize: 20,
  fontWeight: "bold",
  lineHeight: 1,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 10,
};

const heroSummaryRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 8,
};

const statCard = {
  padding: "10px 12px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const statLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  opacity: 0.68,
};

const statValue = {
  marginTop: 4,
  fontSize: 20,
  fontWeight: "bold",
};

const loadingText = {
  marginTop: 16,
  opacity: 0.72,
};

const exerciseGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 10,
  alignContent: "start" as const,
};

const card = {
  minHeight: 112,
  padding: 12,
  border: "1px solid #e8ecf3",
  borderRadius: 18,
  background: "rgba(255,255,255,0.94)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
};

const exerciseTitle = {
  fontWeight: "bold",
  fontSize: 15,
  lineHeight: 1.15,
  color: "#111827",
};

const topSet = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: "bold",
  color: "#111827",
};

const chipRow = {
  marginTop: 6,
  display: "flex",
};

const actionStack = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 10,
};

const primaryButton = {
  padding: 14,
  borderRadius: 16,
  display: "block",
  textAlign: "center" as const,
  textDecoration: "none",
  color: "#fff",
  fontWeight: "bold",
  background: "#111827",
  boxShadow: "0 18px 40px rgba(17, 24, 39, 0.18)",
};

const secondaryButton = {
  padding: 14,
  borderRadius: 16,
  display: "block",
  textAlign: "center" as const,
  textDecoration: "none",
  color: "#111827",
  fontWeight: "bold",
  background: "#f3f6fb",
  border: "1px solid #dde5f0",
};

function getProgressArrow(progress: { weight: number; reps: number } | null) {
  if (!progress) return "→";
  if (progress.weight > 0 || progress.reps > 0) return "↑";
  if (progress.weight < 0 || progress.reps < 0) return "↓";
  return "→";
}

function getProgressLabel(progress: { weight: number; reps: number } | null) {
  if (!progress) return "Neu";
  if (progress.weight > 0 || progress.reps > 0) return "Besser";
  if (progress.weight < 0 || progress.reps < 0) return "Schwaecher";
  return "Gleich";
}

function getProgressBadgeStyle(progress: { weight: number; reps: number } | null) {
  if (!progress) {
    return neutralBadge;
  }

  if (progress.weight > 0 || progress.reps > 0) {
    return successBadge;
  }

  if (progress.weight < 0 || progress.reps < 0) {
    return warningBadge;
  }

  return neutralBadge;
}

function getProgressKind(progress: { weight: number; reps: number } | null) {
  if (!progress) return "new";
  if (progress.weight > 0 || progress.reps > 0) return "better";
  if (progress.weight < 0 || progress.reps < 0) return "worse";
  return "same";
}

function getSummaryStats(exercises: ExerciseSummary[]) {
  const counts = {
    better: 0,
    worse: 0,
    same: 0,
    new: 0,
  };

  exercises.forEach((exercise) => {
    counts[getProgressKind(exercise.progress)] += 1;
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
      text: `${counts.worse} schwaecher`,
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

const baseBadge = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
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

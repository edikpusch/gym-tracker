"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { getRecentSessions, getSetsForSession, type WorkoutSession, type SetEntry } from "@/lib/db";

type SessionStats = WorkoutSession & {
  volume: number;
  setCount: number;
  durationMin: number;
};

type PersonalBest = {
  exercise: string;
  exerciseId: string;
  weight: number;
  reps: number;
  date: number;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function VolumeBars({ sessions }: { sessions: SessionStats[] }) {
  const recent = sessions.slice(0, 10).reverse();
  if (recent.length === 0) return null;
  const maxVol = Math.max(...recent.map((s) => s.volume), 1);
  const W = 320;
  const H = 100;
  const barW = Math.floor((W - (recent.length - 1) * 6) / Math.max(recent.length, 1));

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto" }}>
      {recent.map((s, i) => {
        const h = Math.max(4, (s.volume / maxVol) * H);
        const x = i * (barW + 6);
        const y = H - h;
        return (
          <g key={s.sessionId}>
            <rect x={x} y={y} width={barW} height={h} rx={4} fill="var(--c-accent)" opacity={i === recent.length - 1 ? 1 : 0.45} />
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={8} fill="var(--c-text-3)">
              {formatDate(s.startedAt)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function StatisticsPage() {
  const [sessions, setSessions] = useState<SessionStats[]>([]);
  const [bests, setBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const raw = await getRecentSessions(20);
      const enriched: SessionStats[] = await Promise.all(
        raw.map(async (s) => {
          const sets = await getSetsForSession(s.sessionId);
          const work = sets.filter((x) => x.setType === "workset");
          const volume = work.reduce((sum, x) => sum + x.weight * x.reps, 0);
          const durationMin = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : 0;
          return { ...s, volume, setCount: work.length, durationMin };
        })
      );
      setSessions(enriched);

      // Personal bests: highest weight per exercise across all sets
      const allSets: SetEntry[] = (
        await Promise.all(raw.map((s) => getSetsForSession(s.sessionId)))
      ).flat();

      const bestMap = new Map<string, PersonalBest>();
      for (const set of allSets) {
        if (set.setType !== "workset" || !set.exerciseId) continue;
        const prev = bestMap.get(set.exerciseId);
        if (!prev || set.weight > prev.weight || (set.weight === prev.weight && set.reps > prev.reps)) {
          bestMap.set(set.exerciseId, {
            exercise: set.exercise,
            exerciseId: set.exerciseId,
            weight: set.weight,
            reps: set.reps,
            date: set.timestamp,
          });
        }
      }
      setBests(Array.from(bestMap.values()).sort((a, b) => b.weight - a.weight));
      setLoading(false);
    }
    void load();
  }, []);

  const totalVolume = sessions.reduce((s, x) => s + x.volume, 0);
  const totalWorkouts = sessions.length;
  const avgDuration = sessions.length
    ? Math.round(sessions.filter((s) => s.durationMin > 0).reduce((s, x) => s + x.durationMin, 0) / Math.max(1, sessions.filter((s) => s.durationMin > 0).length))
    : 0;

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 16px)" }}>

      <div style={{ paddingTop: "calc(20px + var(--safe-area-top))", paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--c-text)" }}>Statistiken</h1>
      </div>

      <div style={{ paddingLeft: 16, paddingRight: 16 }}>

        {loading ? (
          <p style={{ color: "var(--c-text-3)", textAlign: "center", paddingTop: 40 }}>Lädt…</p>
        ) : sessions.length === 0 ? (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📊</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", marginBottom: 6 }}>Noch keine Daten</p>
            <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Absolviere dein erstes Workout, um Statistiken zu sehen.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Einheiten", value: String(totalWorkouts) },
                { label: "Gesamt-Ton.", value: `${(totalVolume / 1000).toFixed(1)} t` },
                { label: "Ø Dauer", value: `${avgDuration} Min` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text)", marginBottom: 2 }}>{value}</p>
                  <p style={{ fontSize: 10, color: "var(--c-text-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Volume chart */}
            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: "16px 16px 8px", marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Volumen (letzte 10 Einheiten)</p>
              <VolumeBars sessions={sessions} />
            </div>

            {/* Personal bests */}
            {bests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Bestleistungen</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {bests.map((b) => (
                    <div key={b.exerciseId} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>{b.exercise}</p>
                        <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>{formatDate(b.date)}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-accent)" }}>{b.weight} kg</p>
                        <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>× {b.reps} Wdh</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      <BottomNav />
    </div>
  );
}

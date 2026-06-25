"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { getRecentSessions, getSetsForSession, type WorkoutSession, type SetEntry } from "@/lib/db";

type SessionDetail = WorkoutSession & {
  volume: number;
  setCount: number;
  durationMin: number;
  sets: SetEntry[];
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function groupSetsByExercise(sets: SetEntry[]) {
  const map = new Map<string, SetEntry[]>();
  for (const s of sets) {
    const key = s.exercise;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries());
}

function SessionCard({ session }: { session: SessionDetail }) {
  const [open, setOpen] = useState(false);
  const exerciseGroups = groupSetsByExercise(session.sets.filter((s) => s.setType === "workset"));

  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, overflow: "hidden", marginBottom: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", padding: "16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", marginBottom: 3 }}>
            {session.dayName ?? "Workout"}
          </p>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
            {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
            {session.durationMin > 0 ? ` · ${session.durationMin} Min` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text)", marginBottom: 2 }}>
            {(session.volume / 1000).toFixed(1)} t
          </p>
          <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>{session.setCount} Sätze</p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--c-text-3)" strokeWidth={2} strokeLinecap="round"
          style={{ marginLeft: 8, marginTop: 2, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--c-border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {exerciseGroups.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Keine Arbeitssätze aufgezeichnet.</p>
          ) : exerciseGroups.map(([exercise, sets]) => (
            <div key={exercise}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 6 }}>{exercise}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sets.map((s, i) => (
                  <div key={i} style={{ background: "var(--c-surface-2)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--c-text)", fontWeight: 500 }}>
                    {s.weight} kg × {s.reps}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const raw = await getRecentSessions(50);
      const enriched = await Promise.all(
        raw.map(async (s) => {
          const sets = await getSetsForSession(s.sessionId);
          const work = sets.filter((x) => x.setType === "workset");
          const volume = work.reduce((sum, x) => sum + x.weight * x.reps, 0);
          const durationMin = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : 0;
          return { ...s, volume, setCount: work.length, durationMin, sets };
        })
      );
      setSessions(enriched);
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 16px)" }}>

      <div style={{ paddingTop: "calc(20px + var(--safe-area-top))", paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--c-text)" }}>Verlauf</h1>
      </div>

      <div style={{ paddingLeft: 16, paddingRight: 16 }}>
        {loading ? (
          <p style={{ color: "var(--c-text-3)", textAlign: "center", paddingTop: 40 }}>Lädt…</p>
        ) : sessions.length === 0 ? (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", marginBottom: 6 }}>Noch leer</p>
            <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Abgeschlossene Workouts erscheinen hier.</p>
          </div>
        ) : (
          sessions.map((s) => <SessionCard key={s.sessionId} session={s} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}

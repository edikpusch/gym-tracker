import type { HistorySession, HistorySet } from "@/lib/workout-domain/analytics";
import { summarizeSessionExercises } from "@/lib/workout-domain/analytics";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatVolume(volumeKg: number) {
  return volumeKg >= 1_000 ? `${(volumeKg / 1_000).toFixed(1)} t` : `${Math.round(volumeKg)} kg`;
}

function setLoad(set: HistorySet) {
  if (set.loadKind === "bodyweight") return `${set.bodyWeight ?? set.weight} ${set.unit} Körpergewicht`;
  if (set.loadKind === "bodyweight-plus") return `Körpergewicht + ${set.weight} ${set.unit}`;
  if (set.loadKind === "assisted") return `Körpergewicht − ${set.weight} ${set.unit}`;
  if (set.loadKind === "per-side") return `${set.weight} ${set.unit}/Seite`;
  return `${set.weight} ${set.unit}`;
}

function SetChip({ set, onEdit }: { set: HistorySet; onEdit?: (set: HistorySet) => void }) {
  const style = { padding: "6px 9px", borderRadius: 9, background: set.kind === "warmup" ? "rgba(245,158,11,.12)" : "var(--c-surface-2)", color: set.kind === "warmup" ? "var(--c-warning)" : "var(--c-text)", fontSize: 12 };
  const label = `${setLoad(set)} × ${set.reps}`;
  return onEdit ? <button aria-label={`${set.exerciseName}: ${label} bearbeiten`} onClick={() => onEdit(set)} style={style}>{label}</button> : <span style={style}>{label}</span>;
}

export function WorkoutSessionMetrics({ session }: { session: HistorySession }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
      {[
        ["Gesamtzeit", formatDuration(session.durationMs)],
        ["Aktive Satzzeit", formatDuration(session.activeDurationMs)],
        ["Arbeitssätze", String(session.workSetCount)],
        ["Trainingsvolumen", formatVolume(session.volumeKg)],
      ].map(([label, value]) => (
        <div key={label} style={{ padding: 14, borderRadius: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
          <p style={{ fontSize: 20, fontWeight: 800 }}>{value}</p>
          <p style={{ color: "var(--c-text-3)", fontSize: 10, textTransform: "uppercase", marginTop: 4, fontWeight: 750 }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

export function WorkoutExerciseSummary({ session, onEditSet }: { session: HistorySession; onEditSet?: (set: HistorySet) => void }) {
  const exercises = summarizeSessionExercises(session);
  if (!exercises.length) return null;
  return (
    <section>
      <p style={{ color: "var(--c-text-3)", fontSize: 11, fontWeight: 750, textTransform: "uppercase", marginBottom: 9 }}>Übungen</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {exercises.map((exercise) => (
          <div key={exercise.exerciseId} style={{ padding: "13px 14px", borderRadius: 13, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <p style={{ fontWeight: 750, fontSize: 14 }}>{exercise.exerciseName}</p>
              <p style={{ color: "var(--c-text-3)", fontSize: 11, flexShrink: 0 }}>{exercise.workSets.length} Arbeit · {exercise.warmupSets.length} Warm-up</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
              {[...exercise.warmupSets, ...exercise.workSets].map((set) => <SetChip key={set.id} set={set} onEdit={onEditSet} />)}
            </div>
          </div>
        ))}
      </div>
      {session.warmupSetCount > 0 && <p style={{ color: "var(--c-text-3)", fontSize: 11, lineHeight: 1.45, marginTop: 9 }}>Warm-ups sind gespeichert, zählen aber nicht zu Volumen, Bestleistungen oder Fortschritt.</p>}
    </section>
  );
}

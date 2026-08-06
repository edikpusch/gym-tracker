"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { WorkoutExerciseSummary, WorkoutSessionMetrics, formatVolume } from "@/components/workout-session-summary";
import { getWorkoutHistory, type HistorySession, type HistorySet } from "@/lib/workout-domain/analytics";
import { deleteCompletedHistorySession, deleteCompletedHistorySet, updateCompletedHistorySet } from "@/lib/workout-domain/historyMutations";

function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  return minutes < 60 ? `${minutes} Min` : `${Math.floor(minutes / 60)} Std ${minutes % 60} Min`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
}

function SetEditSheet({ session, set, onClose, onChanged }: { session: HistorySession; set: HistorySet; onClose: () => void; onChanged: () => Promise<void> }) {
  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  const [bodyWeight, setBodyWeight] = useState(set.bodyWeight == null ? "" : String(set.bodyWeight));
  const [deletePending, setDeletePending] = useState(false);
  const [saving, setSaving] = useState(false);
  const needsBodyWeight = set.loadKind === "bodyweight" || set.loadKind === "bodyweight-plus" || set.loadKind === "assisted";
  const validWeight = parseNumber(weight);
  const validReps = parseNumber(reps);
  const validBodyWeight = bodyWeight ? parseNumber(bodyWeight) : undefined;
  const valid = Number.isFinite(validWeight) && validWeight >= 0 && Number.isInteger(validReps) && validReps >= 1 && (!needsBodyWeight || (validBodyWeight != null && Number.isFinite(validBodyWeight) && validBodyWeight > 0));

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    const updated = await updateCompletedHistorySet({ sessionId: session.id, source: session.source, setId: set.id, weight: validWeight, reps: validReps, bodyWeight: needsBodyWeight ? validBodyWeight : undefined });
    if (updated) await onChanged();
    setSaving(false);
    if (updated) onClose();
  }

  async function remove() {
    if (!deletePending) {
      setDeletePending(true);
      return;
    }
    setSaving(true);
    const deleted = await deleteCompletedHistorySet({ sessionId: session.id, source: session.source, setId: set.id });
    if (deleted) await onChanged();
    setSaving(false);
    if (deleted) onClose();
  }

  return <div role="dialog" aria-modal="true" aria-label="Satz bearbeiten" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(3,7,18,.78)", display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", padding: "18px 16px calc(18px + var(--safe-area-bottom))", borderRadius: "24px 24px 0 0", background: "var(--c-surface)", borderTop: "1px solid var(--c-border-strong)" }}><div style={{ display: "flex", alignItems: "start", gap: 12 }}><div style={{ flex: 1 }}><p style={{ color: set.kind === "warmup" ? "var(--c-warning)" : "var(--c-accent)", fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>{set.kind === "warmup" ? "Aufwärmsatz" : "Arbeitssatz"}</p><h2 style={{ fontSize: 21, marginTop: 4 }}>{set.exerciseName}</h2><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 4 }}>Änderungen aktualisieren Verlauf und Statistiken sofort.</p></div><button aria-label="Satzeditor schließen" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 11, background: "var(--c-surface-2)", color: "var(--c-text)" }}>×</button></div><div style={{ display: "grid", gridTemplateColumns: needsBodyWeight ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8, marginTop: 17 }}>{needsBodyWeight && <label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Körpergewicht<input aria-label="Körpergewicht bearbeiten" inputMode="decimal" value={bodyWeight} onChange={(event) => setBodyWeight(event.target.value)} style={{ width: "100%", marginTop: 5, padding: 12, borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", color: "var(--c-text)" }} /></label>}<label style={{ color: "var(--c-text-3)", fontSize: 11 }}>{set.loadKind === "assisted" ? "Unterstützung" : set.loadKind === "bodyweight-plus" ? "Zusatzgewicht" : "Gewicht"}<input aria-label="Gewicht bearbeiten" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} style={{ width: "100%", marginTop: 5, padding: 12, borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", color: "var(--c-text)" }} /></label><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Wiederholungen<input aria-label="Wiederholungen bearbeiten" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} style={{ width: "100%", marginTop: 5, padding: 12, borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", color: "var(--c-text)" }} /></label></div><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 7 }}>Alle Werte in {set.unit} · mindestens eine Wiederholung</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 17 }}><button disabled={saving} onClick={() => void remove()} style={{ padding: 14, borderRadius: 12, background: deletePending ? "var(--c-danger)" : "var(--c-danger-dim)", color: deletePending ? "white" : "var(--c-danger)", fontWeight: 800 }}>{deletePending ? "Löschen bestätigen" : "Satz löschen"}</button><button disabled={!valid || saving} onClick={() => void save()} style={{ padding: 14, borderRadius: 12, background: valid ? "var(--c-accent)" : "var(--c-surface-2)", color: valid ? "white" : "var(--c-text-3)", fontWeight: 800 }}>{saving ? "Speichert …" : "Änderungen speichern"}</button></div></div></div>;
}

function SessionCard({ session, onChanged }: { session: HistorySession; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [editSet, setEditSet] = useState<HistorySet | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  async function removeSession() {
    if (!deletePending) {
      setDeletePending(true);
      return;
    }
    if (await deleteCompletedHistorySession(session)) await onChanged();
  }

  return <article style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, overflow: "hidden" }}><button aria-expanded={open} onClick={() => setOpen((value) => !value)} style={{ width: "100%", padding: 16, display: "flex", gap: 12, alignItems: "start", textAlign: "left" }}><div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 15, fontWeight: 750 }}>{session.workoutName}</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 3 }}>{formatDate(session.startedAt)} · {formatDuration(session.durationMs)}</p>{session.planName && <p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>{session.planName}</p>}</div><div style={{ textAlign: "right" }}><p style={{ fontSize: 15, fontWeight: 750 }}>{formatVolume(session.volumeKg)}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>{session.workSetCount} {session.workSetCount === 1 ? "Arbeitssatz" : "Arbeitssätze"}</p></div><span aria-hidden="true" style={{ color: "var(--c-text-3)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>⌄</span></button>{open && <div style={{ padding: "14px 14px 16px", borderTop: "1px solid var(--c-border)", display: "flex", flexDirection: "column", gap: 16 }}><WorkoutSessionMetrics session={session} /><WorkoutExerciseSummary session={session} onEditSet={setEditSet} /><div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 12 }}><p style={{ color: "var(--c-text-3)", fontSize: 11, marginBottom: 8 }}>Tippe einen Satz an, um seine Werte zu korrigieren.</p><button onClick={() => void removeSession()} style={{ padding: "10px 12px", borderRadius: 10, color: "var(--c-danger)", background: deletePending ? "var(--c-danger-dim)" : "var(--c-surface-2)", fontSize: 12, fontWeight: 750 }}>{deletePending ? "Einheit endgültig löschen" : "Einheit löschen"}</button>{deletePending && <button onClick={() => setDeletePending(false)} style={{ padding: "10px 12px", marginLeft: 7, borderRadius: 10, color: "var(--c-text-2)", background: "var(--c-surface-2)", fontSize: 12, fontWeight: 750 }}>Abbrechen</button>}</div></div>}{editSet && <SetEditSheet key={editSet.id} session={session} set={editSet} onClose={() => setEditSet(null)} onChanged={onChanged} />}</article>;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setSessions(await getWorkoutHistory(100));
    setLoading(false);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void getWorkoutHistory(100).then((history) => {
      if (cancelled) return;
      setSessions(history);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 20px)" }}><header style={{ padding: "calc(20px + var(--safe-area-top)) 20px 16px" }}><p style={{ color: "var(--c-text-3)", fontSize: 12 }}>Abgeschlossene Einheiten</p><h1 style={{ fontSize: 27, marginTop: 2 }}>Verlauf</h1></header><main style={{ padding: "0 16px" }}>{loading ? <p style={{ color: "var(--c-text-3)", textAlign: "center", paddingTop: 40 }}>Lädt …</p> : sessions.length ? <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{sessions.map((session) => <SessionCard key={session.id} session={session} onChanged={reload} />)}</div> : <div style={{ padding: "42px 20px", borderRadius: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)", textAlign: "center" }}><p style={{ fontSize: 32 }}>◷</p><h2 style={{ fontSize: 17, marginTop: 12 }}>Noch keine abgeschlossenen Workouts</h2><p style={{ color: "var(--c-text-3)", fontSize: 13, marginTop: 6 }}>Gespeicherte Einheiten erscheinen automatisch hier.</p></div>}</main><BottomNav /></div>;
}

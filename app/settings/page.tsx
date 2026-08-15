"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppVersionCard } from "@/components/app-version-card";
import { BottomNav } from "@/components/ui/BottomNav";
import { PwaSettingsCard } from "@/components/pwa-settings-card";
import { exportGymTrackerBackup, importGymTrackerBackup } from "@/lib/appBackup";
import { getDb } from "@/lib/db";
import { DEFAULT_APP_PREFERENCES, getAppPreferences, updateAppPreferences, type AppPreferences } from "@/lib/appPreferences";
import { getBodyWeightEntries, saveBodyWeightEntry } from "@/lib/bodyWeight";

const sectionTitle = { fontSize: 12, fontWeight: 650, color: "var(--c-text-3)", letterSpacing: .8, textTransform: "uppercase" as const, marginBottom: 10 };
const card = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 15, overflow: "hidden" };

function PreferenceToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: () => void }) {
  return <button role="switch" aria-checked={checked} onClick={onChange} style={{ width: "100%", padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", borderBottom: "1px solid var(--c-border)" }}><div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 700 }}>{label}</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>{detail}</p></div><span style={{ width: 45, height: 26, borderRadius: 999, padding: 3, background: checked ? "var(--c-accent)" : "var(--c-surface-3)", display: "flex", justifyContent: checked ? "flex-end" : "flex-start", transition: "background .2s" }}><span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,.35)" }} /></span></button>;
}

export default function SettingsPage() {
  const [clearConfirm, setClearConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [bodyWeight, setBodyWeight] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const storedPreferences = getAppPreferences();
      setPreferences(storedPreferences);
      const latestBodyWeight = getBodyWeightEntries()[0]?.weight;
      setBodyWeight(latestBodyWeight == null ? "" : (storedPreferences.weightUnit === "lb" ? latestBodyWeight / 0.45359237 : latestBodyWeight).toFixed(1));
    });
    return () => { cancelled = true; };
  }, []);

  function togglePreference(key: "getReadyTone" | "restVibration" | "countdownOverlay") {
    setPreferences((current) => updateAppPreferences({ [key]: !current[key] }));
  }

  function changeWeightUnit(weightUnit: "kg" | "lb") {
    const current = Number(bodyWeight);
    if (Number.isFinite(current) && current > 0 && weightUnit !== preferences.weightUnit) {
      setBodyWeight((weightUnit === "lb" ? current / 0.45359237 : current * 0.45359237).toFixed(1));
    }
    setPreferences(updateAppPreferences({ weightUnit }));
  }

  function saveBodyWeight() {
    const value = Number(bodyWeight.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    saveBodyWeightEntry({ weight: preferences.weightUnit === "lb" ? value * 0.45359237 : value });
    setNotice("Körpergewicht gespeichert.");
  }

  async function clearData() {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    const db = getDb();
    await db.transaction("rw", [db.sets, db.sessions, db.weights, db.activeWorkout, db.workoutSessionsV2, db.workoutSetsV2, db.workoutMeta], async () => {
      await Promise.all([db.sets.clear(), db.sessions.clear(), db.weights.clear(), db.activeWorkout.clear(), db.workoutSessionsV2.clear(), db.workoutSetsV2.clear(), db.workoutMeta.clear()]);
    });
    setClearConfirm(false);
    setNotice("Alle Trainingsdaten wurden gelöscht.");
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      await importGymTrackerBackup(await file.text());
      setNotice("Backup importiert.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Backup konnte nicht importiert werden.");
    }
  }

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 20px)" }}>
      <header style={{ padding: "calc(20px + var(--safe-area-top)) 20px 16px" }}><p style={{ color: "var(--c-text-3)", fontSize: 12, marginBottom: 2 }}>Gym Tracker</p><h1 style={{ fontSize: 26, fontWeight: 750 }}>Einstellungen</h1></header>

      <main style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 22 }}>
        {notice && <button onClick={() => setNotice("")} style={{ padding: 12, textAlign: "left", borderRadius: 12, background: "var(--c-success-dim)", color: "var(--c-text)", fontSize: 13 }}>{notice}</button>}

        <section><p style={sectionTitle}>Training</p><Link href="/plans" style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}><div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--c-accent-dim)", color: "var(--c-accent)", display: "grid", placeItems: "center", fontSize: 19 }}>▤</div><div style={{ flex: 1 }}><p style={{ color: "var(--c-text)", fontWeight: 750, fontSize: 14 }}>Trainingspläne verwalten</p><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>Plan wechseln, erstellen, duplizieren oder bearbeiten</p></div><span aria-hidden="true" style={{ color: "var(--c-text-3)", fontSize: 22 }}>›</span></Link></section>

        <section><p style={sectionTitle}>Einheiten und Körpergewicht</p><div style={{ ...card, padding: 14 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Standard-Einheit<select value={preferences.weightUnit} onChange={(event) => changeWeightUnit(event.target.value as "kg" | "lb")} style={{ width: "100%", marginTop: 5, padding: "11px", borderRadius: 10, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}><option value="kg">Kilogramm</option><option value="lb">Pfund (lb)</option></select></label><label style={{ color: "var(--c-text-3)", fontSize: 11 }}>Aktuelles Körpergewicht<div style={{ display: "flex", marginTop: 5 }}><input inputMode="decimal" value={bodyWeight} onChange={(event) => setBodyWeight(event.target.value)} style={{ width: "100%", minWidth: 0, padding: "11px", borderRadius: "10px 0 0 10px", color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }} /><button onClick={saveBodyWeight} style={{ padding: "0 10px", borderRadius: "0 10px 10px 0", color: "white", background: "var(--c-accent)", fontWeight: 750 }}>{preferences.weightUnit}</button></div></label></div><p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 9 }}>Wird für Körpergewichts-, Zusatz- und Assistenzübungen vorgeschlagen.</p></div></section>

        <section><p style={sectionTitle}>Pausensignale</p><div style={card}>
          <PreferenceToggle label="Warnton bei 15 Sekunden" detail="Zwei kurze Töne, bevor die Pause endet" checked={preferences.getReadyTone} onChange={() => togglePreference("getReadyTone")} />
          <PreferenceToggle label="Vibration" detail="Wenn das Gerät und der Browser Haptik unterstützen" checked={preferences.restVibration} onChange={() => togglePreference("restVibration")} />
          <div style={{ borderBottom: 0 }}><PreferenceToggle label="3–2–1-Countdown" detail="Große Animation in den letzten drei Sekunden" checked={preferences.countdownOverlay} onChange={() => togglePreference("countdownOverlay")} /></div>
        </div></section>

        <section><p style={sectionTitle}>App und Offline-Nutzung</p><PwaSettingsCard /></section>

        <section><p style={sectionTitle}>Lokale Daten</p><div style={card}>
          <button onClick={() => void exportGymTrackerBackup().then(() => setNotice("Backup wurde bereitgestellt."))} style={{ width: "100%", padding: "14px 16px", textAlign: "left", borderBottom: "1px solid var(--c-border)" }}><p style={{ fontWeight: 700, fontSize: 14 }}>Vollständiges Backup exportieren</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 2 }}>Pläne, Workouts, Sätze, Gewichte und Einstellungen</p></button>
          <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "14px 16px", textAlign: "left", borderBottom: "1px solid var(--c-border)" }}><p style={{ fontWeight: 700, fontSize: 14 }}>Backup importieren</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 2 }}>Ersetzt die enthaltenen lokalen Daten</p></button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />
          <button onClick={() => void clearData()} style={{ width: "100%", padding: "14px 16px", textAlign: "left" }}><p style={{ fontWeight: 700, fontSize: 14, color: clearConfirm ? "var(--c-danger)" : "var(--c-text)" }}>{clearConfirm ? "Wirklich alle Trainingsdaten löschen?" : "Trainingsdaten löschen"}</p><p style={{ color: "var(--c-text-3)", fontSize: 12, marginTop: 2 }}>{clearConfirm ? "Noch einmal tippen zum Bestätigen" : "Pläne und Einstellungen bleiben erhalten"}</p></button>
        </div></section>

        <section><p style={sectionTitle}>Über die App</p><AppVersionCard /></section>
      </main>
      <BottomNav />
    </div>
  );
}

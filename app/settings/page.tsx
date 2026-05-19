"use client";

import { useEffect, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import {
  APP_PREFERENCES_KEY,
  DEFAULT_APP_PREFERENCES,
  getAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from "@/lib/appPreferences";
import { BODY_WEIGHT_KEY, clearBodyWeightEntries } from "@/lib/bodyWeight";
import { ACTIVE_PLAN_KEY, CUSTOM_PLANS_KEY } from "@/lib/trainingPlans";
import { WORKOUT_LOG_KEY } from "@/lib/workoutEngine";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppPreferences>(getAppPreferences());

  useEffect(() => {
    setSettings(getAppPreferences());
  }, []);

  function updateSettings(patch: Partial<AppPreferences>) {
    const next = {
      ...settings,
      ...patch,
    };
    setSettings(next);
    saveAppPreferences(next);
  }

  function exportData() {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      workoutLogs: window.localStorage.getItem(WORKOUT_LOG_KEY),
      activePlan: window.localStorage.getItem(ACTIVE_PLAN_KEY),
      customPlans: window.localStorage.getItem(CUSTOM_PLANS_KEY),
      bodyWeight: window.localStorage.getItem(BODY_WEIGHT_KEY),
      preferences: window.localStorage.getItem(APP_PREFERENCES_KEY),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gym-tracker-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function clearWeightHistory() {
    if (!window.confirm("Den kompletten Gewichtsverlauf löschen?")) {
      return;
    }

    clearBodyWeightEntries();
    window.alert("Gewichtsverlauf gelöscht.");
  }

  function resetPreferences() {
    saveAppPreferences(DEFAULT_APP_PREFERENCES);
    setSettings(DEFAULT_APP_PREFERENCES);
  }

  return (
    <AppPageFrame
      activeKey="settings"
      eyebrow="Einstellungen"
      title="App anpassen"
      subtitle="Steuere Menüseite, Trainingshinweise und deine Daten an einem Ort."
    >
      <section style={sectionCard}>
        <div style={sectionTitle}>Navigation</div>
        <div style={settingRow}>
          <div>
            <div style={settingLabel}>Menüseite</div>
            <div style={settingHint}>Lege fest, ob der Drawer links oder rechts öffnet.</div>
          </div>
          <div style={segmentedControl}>
            <button
              style={settings.menuSide === "left" ? segmentActive : segmentButton}
              onClick={() => updateSettings({ menuSide: "left" })}
            >
              Links
            </button>
            <button
              style={settings.menuSide === "right" ? segmentActive : segmentButton}
              onClick={() => updateSettings({ menuSide: "right" })}
            >
              Rechts
            </button>
          </div>
        </div>
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Training</div>
        <ToggleRow
          title="10-Sekunden-Ton"
          hint="Spielt kurz vor dem Pausenende einen Hinweis ab."
          checked={settings.getReadyTone}
          onChange={(checked) => updateSettings({ getReadyTone: checked })}
        />
        <ToggleRow
          title="3-2-1 Countdown"
          hint="Zeigt die letzten drei Sekunden groß im Timer an."
          checked={settings.countdownOverlay}
          onChange={(checked) => updateSettings({ countdownOverlay: checked })}
        />
        <ToggleRow
          title="Fortschrittsanimationen"
          hint="Aktiviert den animierten Ring und die sanfte Timer-Bewegung."
          checked={settings.progressAnimations}
          onChange={(checked) => updateSettings({ progressAnimations: checked })}
        />
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Daten</div>
        <button style={actionButton} onClick={exportData}>
          Daten exportieren
        </button>
        <button style={ghostButton} onClick={clearWeightHistory}>
          Gewichtsverlauf löschen
        </button>
        <button style={ghostButton} onClick={resetPreferences}>
          Einstellungen zurücksetzen
        </button>
      </section>
    </AppPageFrame>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div style={settingRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={settingLabel}>{title}</div>
        <div style={settingHint}>{hint}</div>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        style={checked ? toggleActive : toggleButton}
        onClick={() => onChange(!checked)}
      >
        <span style={checked ? toggleKnobActive : toggleKnob} />
      </button>
    </div>
  );
}

const sectionCard = {
  padding: "18px 16px",
  borderRadius: 26,
  background: "#ffffff",
  border: "1px solid #e8eef6",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 14,
  scrollMarginBottom: "calc(96px + env(safe-area-inset-bottom))",
};

const sectionTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
};

const settingRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  paddingTop: 2,
};

const settingLabel = {
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
};

const settingHint = {
  marginTop: 4,
  fontSize: 13,
  lineHeight: 1.45,
  color: "#64748b",
};

const segmentedControl = {
  display: "inline-flex",
  padding: 4,
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  gap: 4,
  flexShrink: 0,
};

const segmentButton = {
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  background: "transparent",
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const segmentActive = {
  ...segmentButton,
  background: "#111827",
  color: "#ffffff",
};

const toggleButton = {
  width: 56,
  height: 34,
  borderRadius: 999,
  background: "#e2e8f0",
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  transition: "all 180ms ease",
  flexShrink: 0,
};

const toggleActive = {
  ...toggleButton,
  background: "#dc2626",
  justifyContent: "flex-end",
};

const toggleKnob = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background: "#ffffff",
  boxShadow: "0 6px 12px rgba(15, 23, 42, 0.14)",
};

const toggleKnobActive = {
  ...toggleKnob,
};

const actionButton = {
  width: "100%",
  minHeight: 58,
  borderRadius: 999,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 800,
  boxShadow: "0 16px 28px rgba(15, 23, 42, 0.16)",
};

const ghostButton = {
  width: "100%",
  minHeight: 54,
  borderRadius: 999,
  background: "#ffffff",
  color: "#334155",
  fontSize: 15,
  fontWeight: 700,
  border: "1px solid #e2e8f0",
};

"use client";

import { useEffect, useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import {
  deleteBodyWeightEntry,
  getBodyWeightEntries,
  saveBodyWeightEntry,
  type BodyWeightEntry,
} from "@/lib/bodyWeight";

export default function WeightPage() {
  const [entries, setEntries] = useState<BodyWeightEntry[]>([]);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    setEntries(getBodyWeightEntries());
  }, []);

  const stats = useMemo(() => {
    const latest = entries[0] ?? null;
    const previous = entries[1] ?? null;
    const last7 = entries.filter((entry) => Date.now() - entry.timestamp <= 7 * 86400000);
    const last30 = entries.filter((entry) => Date.now() - entry.timestamp <= 30 * 86400000);

    const avg7 =
      last7.length > 0
        ? roundWeight(last7.reduce((sum, entry) => sum + entry.weight, 0) / last7.length)
        : null;
    const avg30 =
      last30.length > 0
        ? roundWeight(last30.reduce((sum, entry) => sum + entry.weight, 0) / last30.length)
        : null;
    const delta = latest && previous ? roundWeight(latest.weight - previous.weight) : null;
    const trendDelta =
      avg7 !== null && avg30 !== null ? roundWeight(avg7 - avg30) : null;

    return {
      latest,
      previous,
      avg7,
      avg30,
      delta,
      trendDelta,
    };
  }, [entries]);

  const trendRun = useMemo(() => {
    if (entries.length < 2) {
      return { direction: "none" as const, days: 0 };
    }

    let direction: "up" | "down" | "flat" | "none" = "none";
    let oldestTimestamp = entries[0].timestamp;

    for (let index = 0; index < entries.length - 1; index += 1) {
      const current = entries[index];
      const next = entries[index + 1];
      const diff = roundWeight(current.weight - next.weight);
      const currentDirection = diff > 0.2 ? "up" : diff < -0.2 ? "down" : "flat";

      if (direction === "none") {
        direction = currentDirection;
      }

      if (currentDirection !== direction) {
        break;
      }

      oldestTimestamp = next.timestamp;
    }

    if (direction === "none") {
      return { direction: "none" as const, days: 0 };
    }

    const days = Math.max(1, Math.round((entries[0].timestamp - oldestTimestamp) / 86400000));
    return { direction, days };
  }, [entries]);

  const trendInsight = useMemo(() => {
    if (!stats.latest) {
      return {
        title: "Noch kein Trend",
        value: "Ersten Eintrag speichern",
        detail: "Mit ein paar Werten erkennst du hier sofort, ob dein Gewicht steigt, fällt oder stabil bleibt.",
        tone: "neutral" as const,
      };
    }

    if (stats.trendDelta === null) {
      return {
        title: "Trend baut sich auf",
        value: `${stats.latest.weight} kg aktuell`,
        detail: "Für eine klare Richtung braucht es noch ein paar weitere Einträge.",
        tone: "info" as const,
      };
    }

    if (stats.trendDelta > 0.3) {
      return {
        title: "Leicht steigend",
        value: `${formatSigned(stats.trendDelta)} kg Trend`,
        detail: "Dein 7-Tage-Schnitt liegt aktuell über dem 30-Tage-Schnitt.",
        tone: "good" as const,
      };
    }

    if (stats.trendDelta < -0.3) {
      return {
        title: "Leicht fallend",
        value: `${formatSigned(stats.trendDelta)} kg Trend`,
        detail: "Dein 7-Tage-Schnitt liegt aktuell unter dem 30-Tage-Schnitt.",
        tone: "warn" as const,
      };
    }

    return {
      title: "Aktuell stabil",
      value: `${stats.avg7 ?? stats.latest.weight} kg im Schnitt`,
      detail: "Dein kurzfristiger Verlauf bewegt sich nah am 30-Tage-Niveau.",
      tone: "neutral" as const,
    };
  }, [stats]);

  const recommendation = useMemo(() => {
    if (!stats.latest) {
      return {
        title: "Was jetzt?",
        value: "Regelmäßig eintragen",
        detail: "2–3 Einträge pro Woche reichen schon, damit der Trend deutlich belastbarer wird.",
      };
    }

    if (entries.length < 3) {
      return {
        title: "Was jetzt?",
        value: "Noch 2–3 Vergleichswerte sammeln",
        detail: "Mit ein paar zusätzlichen Wiegetagen werden Durchschnitt und Trend deutlich aussagekräftiger.",
      };
    }

    if (stats.trendDelta !== null && stats.trendDelta > 0.3) {
      return {
        title: "Was jetzt?",
        value: "Zunahme bewusst beobachten",
        detail: `Wenn der Aufbau gewollt ist, weiter so. Wenn nicht, lohnt sich ein Blick auf Kalorienmenge und Rhythmus${
          trendRun.direction === "up" ? ` – der Anstieg läuft schon seit etwa ${trendRun.days} Tagen.` : "."
        }`,
      };
    }

    if (stats.trendDelta !== null && stats.trendDelta < -0.3) {
      return {
        title: "Was jetzt?",
        value: "Abnahme mit Leistung abgleichen",
        detail: `Sinkt das Körpergewicht, prüfe parallel deine Trainingsleistung, damit Kraft und Erholung nicht wegbrechen${
          trendRun.direction === "down" ? ` – die Tendenz hält schon etwa ${trendRun.days} Tage an.` : "."
        }`,
      };
    }

    return {
      title: "Was jetzt?",
      value: "Stabil weiter protokollieren",
      detail:
        trendRun.direction === "flat" && trendRun.days > 0
          ? `Dein Gewicht ist aktuell ruhig und bewegt sich seit etwa ${trendRun.days} Tagen nur wenig. Bleib bei einem einfachen Wiegerhythmus.`
          : "Dein Gewicht ist aktuell ruhig. Bleib bei einem einfachen Wiegerhythmus, damit kleine Trends früh sichtbar werden.",
    };
  }, [entries.length, stats.latest, stats.trendDelta, trendRun]);

  function refresh() {
    setEntries(getBodyWeightEntries());
  }

  function handleSave() {
    const parsed = Number(weight.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    saveBodyWeightEntry({
      weight: roundWeight(parsed),
      note,
    });

    setWeight("");
    setNote("");
    refresh();
  }

  function handleDelete(id: string) {
    if (!window.confirm("Diesen Gewichtseintrag löschen?")) {
      return;
    }

    deleteBodyWeightEntry(id);
    refresh();
  }

  return (
    <AppPageFrame
      activeKey="weight"
      eyebrow="Gewicht"
      title="Dein Körpergewicht"
      subtitle="Trenne Körpergewicht klar von Trainingsgewicht und behalte deinen Trend im Blick."
    >
      <div
        style={{
          ...trendCard,
          ...(trendInsight.tone === "good"
            ? goodCard
            : trendInsight.tone === "warn"
              ? warnCard
              : trendInsight.tone === "info"
                ? infoCard
                : neutralCard),
        }}
      >
        <div style={trendTitle}>{trendInsight.title}</div>
        <div style={trendValue}>{trendInsight.value}</div>
        <div style={trendDetail}>{trendInsight.detail}</div>
      </div>

      <div style={recommendationCard}>
        <div style={recommendationTitle}>{recommendation.title}</div>
        <div style={recommendationValue}>{recommendation.value}</div>
        <div style={recommendationDetail}>{recommendation.detail}</div>
      </div>

      <div style={metricGrid}>
        <MetricCard label="Aktuell" value={stats.latest ? `${stats.latest.weight} kg` : "—"} />
        <MetricCard
          label="Differenz"
          value={stats.delta !== null ? `${formatSigned(stats.delta)} kg` : "—"}
        />
        <MetricCard label="Ø 7 Tage" value={stats.avg7 ? `${stats.avg7} kg` : "—"} />
        <MetricCard label="Ø 30 Tage" value={stats.avg30 ? `${stats.avg30} kg` : "—"} />
      </div>

      <section style={sectionCard}>
        <div style={sectionTitle}>Neuen Eintrag speichern</div>
        <label style={fieldStack}>
          <span style={fieldLabel}>Gewicht</span>
          <input
            inputMode="decimal"
            placeholder="z. B. 82,4"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            style={textInput}
          />
        </label>
        <label style={fieldStack}>
          <span style={fieldLabel}>Notiz</span>
          <input
            placeholder="optional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            style={textInput}
          />
        </label>
        <button style={primaryButton} onClick={handleSave}>
          Gewicht speichern
        </button>
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Verlauf</div>
        {entries.length === 0 ? (
          <div style={emptySmall}>Noch keine Gewichtseinträge vorhanden.</div>
        ) : null}
        {(showAllHistory ? entries : entries.slice(0, 5)).map((entry) => (
          <div key={entry.id} style={entryRow}>
            <div>
              <div style={entryValue}>{entry.weight} kg</div>
              <div style={entryMeta}>
                {new Date(entry.timestamp).toLocaleDateString("de-DE")}
                {entry.note ? ` · ${entry.note}` : ""}
              </div>
            </div>
            <button style={deleteButton} onClick={() => handleDelete(entry.id)}>
              Löschen
            </button>
          </div>
        ))}
        {entries.length > 5 ? (
          <button
            style={moreButton}
            onClick={() => setShowAllHistory((current) => !current)}
          >
            {showAllHistory
              ? "Weniger Einträge anzeigen"
              : `+${entries.length - 5} weitere Einträge anzeigen`}
          </button>
        ) : null}
      </section>
    </AppPageFrame>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  );
}

function roundWeight(value: number) {
  return Math.round(value * 10) / 10;
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "±0";
}

const trendCard = {
  padding: "14px 14px 15px",
  borderRadius: 22,
  border: "1px solid #e8eef6",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 5,
};

const goodCard = {
  background: "#f0fdf4",
};

const warnCard = {
  background: "#fff7ed",
};

const infoCard = {
  background: "#eff6ff",
};

const neutralCard = {
  background: "#ffffff",
};

const trendTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#64748b",
};

const trendValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const trendDetail = {
  fontSize: 14,
  color: "#475569",
  fontWeight: 700,
};

const recommendationCard = {
  padding: "14px 14px 15px",
  borderRadius: 22,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
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
  gap: 12,
};

const metricCard = {
  padding: "16px 16px 18px",
  borderRadius: 24,
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
  fontSize: 28,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionCard = {
  padding: "18px 16px",
  borderRadius: 26,
  background: "#ffffff",
  border: "1px solid #e8eef6",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 12,
  scrollMarginBottom: "calc(96px + env(safe-area-inset-bottom))",
};

const sectionTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
};

const fieldStack = {
  display: "grid",
  gap: 8,
};

const fieldLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: "#94a3b8",
};

const textInput = {
  width: "100%",
  minHeight: 56,
  padding: "0 16px",
  borderRadius: 18,
  border: "1px solid #dce5f0",
  background: "#ffffff",
  fontSize: 17,
  color: "#0f172a",
  outline: "none",
};

const primaryButton = {
  width: "100%",
  minHeight: 56,
  borderRadius: 999,
  background: "#dc2626",
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 800,
  boxShadow: "0 18px 30px rgba(220, 38, 38, 0.22)",
};

const entryRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 0",
  borderTop: "1px solid #eef2f7",
};

const entryValue = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const entryMeta = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const deleteButton = {
  minHeight: 42,
  padding: "0 14px",
  borderRadius: 999,
  background: "#fef2f2",
  color: "#dc2626",
  fontSize: 13,
  fontWeight: 800,
  border: "1px solid #fecaca",
  flexShrink: 0,
};

const emptySmall = {
  fontSize: 14,
  color: "#94a3b8",
};

const moreButton = {
  width: "100%",
  minHeight: 52,
  borderRadius: 999,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  border: "1px solid #dce5f0",
};

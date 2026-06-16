

import { useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { appPalette, splitThemes, uiTheme, withAlpha } from "@/lib/theme";
import {
  deleteBodyWeightEntry,
  getBodyWeightEntries,
  saveBodyWeightEntry,
  type BodyWeightEntry,
} from "@/lib/bodyWeight";

export default function WeightPage() {
  const [entries, setEntries] = useState<BodyWeightEntry[]>(() => getBodyWeightEntries());
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [statsReferenceTime] = useState(() => Date.now());

  const stats = useMemo(() => {
    const latest = entries[0] ?? null;
    const previous = entries[1] ?? null;
    const last7 = entries.filter(
      (entry) => statsReferenceTime - entry.timestamp <= 7 * 86400000
    );
    const last30 = entries.filter(
      (entry) => statsReferenceTime - entry.timestamp <= 30 * 86400000
    );

    const avg7 =
      last7.length > 0
        ? roundWeight(last7.reduce((sum, entry) => sum + entry.weight, 0) / last7.length)
        : null;
    const avg30 =
      last30.length > 0
        ? roundWeight(last30.reduce((sum, entry) => sum + entry.weight, 0) / last30.length)
        : null;
    const delta = latest && previous ? roundWeight(latest.weight - previous.weight) : null;
    const trendDelta = avg7 !== null && avg30 !== null ? roundWeight(avg7 - avg30) : null;

    return {
      latest,
      previous,
      avg7,
      avg30,
      delta,
      trendDelta,
    };
  }, [entries, statsReferenceTime]);

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
        detail:
          "Mit ein paar Werten erkennst du hier sofort, ob dein Gewicht steigt, fällt oder stabil bleibt.",
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
        detail: "2-3 Einträge pro Woche reichen schon, damit der Trend deutlich belastbarer wird.",
      };
    }

    if (entries.length < 3) {
      return {
        title: "Was jetzt?",
        value: "Noch 2-3 Vergleichswerte sammeln",
        detail: "Mit ein paar zusätzlichen Wiegetagen werden Durchschnitt und Trend deutlich aussagekräftiger.",
      };
    }

    if (stats.trendDelta !== null && stats.trendDelta > 0.3) {
      return {
        title: "Was jetzt?",
        value: "Zunahme bewusst beobachten",
        detail: `Wenn der Aufbau gewollt ist, weiter so. Wenn nicht, lohnt sich ein Blick auf Kalorienmenge und Rhythmus${
          trendRun.direction === "up" ? ` - der Anstieg läuft schon seit etwa ${trendRun.days} Tagen.` : "."
        }`,
      };
    }

    if (stats.trendDelta !== null && stats.trendDelta < -0.3) {
      return {
        title: "Was jetzt?",
        value: "Abnahme mit Leistung abgleichen",
        detail: `Sinkt das Körpergewicht, prüfe parallel deine Trainingsleistung, damit Kraft und Erholung nicht wegbrechen${
          trendRun.direction === "down"
            ? ` - die Tendenz hält schon etwa ${trendRun.days} Tage an.`
            : "."
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
    deleteBodyWeightEntry(id);
    setDeleteEntryId(null);
    refresh();
  }

  return (
    <AppPageFrame
      activeKey="weight"
      eyebrow="Gewicht"
      title="Dein Körpergewicht"
      subtitle="Trenne Körpergewicht klar von Trainingsgewicht und behalte deinen Trend im Blick."
    >
      <AppCard
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
      </AppCard>

      <AppCard style={recommendationCard}>
        <div style={recommendationTitle}>{recommendation.title}</div>
        <div style={recommendationValue}>{recommendation.value}</div>
        <div style={recommendationDetail}>{recommendation.detail}</div>
      </AppCard>

      <div style={metricGrid}>
        <MetricCard label="Aktuell" value={stats.latest ? `${stats.latest.weight} kg` : "—"} />
        <MetricCard
          label="Differenz"
          value={stats.delta !== null ? `${formatSigned(stats.delta)} kg` : "—"}
        />
        <MetricCard label="Ø 7 Tage" value={stats.avg7 ? `${stats.avg7} kg` : "—"} />
        <MetricCard label="Ø 30 Tage" value={stats.avg30 ? `${stats.avg30} kg` : "—"} />
      </div>

      <AppCard style={sectionCard}>
        <div style={sectionHead}>
          <div style={sectionTitle}>Neuen Eintrag speichern</div>
          <AppBadge variant="new">neu</AppBadge>
        </div>
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
        <AppButton block variant="primary" style={primaryButton} onClick={handleSave}>
          Gewicht speichern
        </AppButton>
      </AppCard>

      <AppCard style={sectionCard}>
        <div style={sectionHead}>
          <div style={sectionTitle}>Verlauf</div>
          {entries.length > 0 ? <AppBadge variant="template">{entries.length} Einträge</AppBadge> : null}
        </div>
        {entries.length === 0 ? <div style={emptySmall}>Noch keine Gewichtseinträge vorhanden.</div> : null}
        {(showAllHistory ? entries : entries.slice(0, 5)).map((entry) => (
          <div key={entry.id} style={entryRow}>
            <div>
              <div style={entryValue}>{entry.weight} kg</div>
              <div style={entryMeta}>
                {new Date(entry.timestamp).toLocaleDateString("de-DE")}
                {entry.note ? ` · ${entry.note}` : ""}
              </div>
            </div>
            <AppButton
              variant="ghost"
              size="compact"
              style={deleteButton}
              onClick={() => setDeleteEntryId(entry.id)}
            >
              Löschen
            </AppButton>
          </div>
        ))}
        {entries.length > 5 ? (
          <AppButton
            block
            variant="secondary"
            style={moreButton}
            onClick={() => setShowAllHistory((current) => !current)}
          >
            {showAllHistory
              ? "Weniger Einträge anzeigen"
              : `+${entries.length - 5} weitere Einträge anzeigen`}
          </AppButton>
        ) : null}
      </AppCard>

      <ConfirmDialog
        open={Boolean(deleteEntryId)}
        title="Eintrag löschen?"
        body="Möchtest du diesen Gewichtseintrag wirklich entfernen?"
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        confirmVariant="danger"
        onCancel={() => setDeleteEntryId(null)}
        onConfirm={() => deleteEntryId && handleDelete(deleteEntryId)}
      />
    </AppPageFrame>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <AppCard style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </AppCard>
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
  padding: "13px 14px 14px",
  display: "grid",
  gap: 5,
};

const goodCard = { background: withAlpha(appPalette.success, 0.12) };
const warnCard = { background: withAlpha(appPalette.warning, 0.12) };
const infoCard = { background: withAlpha(splitThemes.pull.primary, 0.12) };
const neutralCard = { background: appPalette.surface };

const trendTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const trendValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const trendDetail = {
  fontSize: 14,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const recommendationCard = {
  padding: "13px 14px 14px",
  background: withAlpha(appPalette.warning, 0.12),
  border: `1px solid ${withAlpha(appPalette.warning, 0.28)}`,
  display: "grid",
  gap: 5,
};

const recommendationTitle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.warning,
};

const recommendationValue = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const recommendationDetail = {
  fontSize: 14,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const metricGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const metricCard = {
  padding: "14px 14px 16px",
  display: "grid",
  gap: 6,
};

const metricLabel = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textSoft,
};

const metricValue = {
  fontSize: 28,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const sectionCard = {
  padding: "16px 14px",
  display: "grid",
  gap: 12,
  scrollMarginBottom: "calc(96px + env(safe-area-inset-bottom))",
};

const sectionHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const sectionTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: appPalette.textStrong,
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
  color: appPalette.textSoft,
};

const textInput = {
  width: "100%",
  minHeight: 56,
  padding: "0 16px",
  borderRadius: 18,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  fontSize: 17,
  color: appPalette.textStrong,
  outline: "none",
};

const primaryButton = {
  width: "100%",
  minHeight: uiTheme.touch.comfortable,
};

const entryRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const entryValue = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const entryMeta = {
  marginTop: 4,
  fontSize: 13,
  color: appPalette.textDefault,
};

const deleteButton = {
  color: appPalette.danger,
};

const moreButton = {
  width: "100%",
};

const emptySmall = {
  fontSize: 14,
  color: appPalette.textDefault,
};

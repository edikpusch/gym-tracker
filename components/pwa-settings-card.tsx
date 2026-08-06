"use client";

import { usePwa } from "@/components/pwa-provider";

const rowStyle = {
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderBottom: "1px solid var(--c-border)",
} as const;

function StatusDot({ active, warning = false }: { active: boolean; warning?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 9,
        height: 9,
        flexShrink: 0,
        borderRadius: "50%",
        background: warning ? "var(--c-warning)" : active ? "var(--c-success)" : "var(--c-text-3)",
        boxShadow: active || warning ? `0 0 0 4px ${warning ? "var(--c-warning-dim)" : "var(--c-success-dim)"}` : undefined,
      }}
    />
  );
}

export function PwaSettingsCard() {
  const { installKind, isOnline, offlineReady, updateAvailable, install, applyUpdate } = usePwa();

  const installTitle = installKind === "installed" || installKind === "native"
    ? "Als App eingerichtet"
    : installKind === "prompt"
      ? "Auf diesem Gerät installieren"
      : installKind === "ios"
        ? "Zum Home-Bildschirm hinzufügen"
        : "Installation derzeit nicht angeboten";

  const installDetail = installKind === "installed"
    ? "Gym Tracker läuft im eigenständigen App-Fenster."
    : installKind === "native"
      ? "Gym Tracker läuft als native App."
      : installKind === "prompt"
        ? "Einmal installieren und künftig direkt vom Home-Bildschirm öffnen."
        : installKind === "ios"
          ? "In Safari: Teilen antippen und „Zum Home-Bildschirm“ wählen."
          : "Öffne die Seite in Chrome oder Safari, um sie als App einzurichten.";

  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 15, overflow: "hidden" }}>
      <div style={rowStyle}>
        <StatusDot active={installKind === "installed" || installKind === "native"} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{installTitle}</p>
          <p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3, lineHeight: 1.45 }}>{installDetail}</p>
        </div>
        {installKind === "prompt" && (
          <button onClick={() => void install()} style={{ padding: "9px 11px", borderRadius: 10, background: "var(--c-accent)", color: "white", fontSize: 12, fontWeight: 800 }}>
            Installieren
          </button>
        )}
      </div>

      <div style={updateAvailable ? rowStyle : { ...rowStyle, borderBottom: 0 }}>
        <StatusDot active={offlineReady} warning={!isOnline} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{isOnline ? "Online" : "Offline"}</p>
          <p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>
            {offlineReady ? "App und Trainingsdaten sind für Offline-Nutzung vorbereitet." : "Offline-Inhalte werden nach dem ersten vollständigen Laden vorbereitet."}
          </p>
        </div>
      </div>

      {updateAvailable && (
        <div style={{ ...rowStyle, borderBottom: 0, background: "var(--c-accent-dim)" }}>
          <StatusDot active={false} warning />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>Update verfügbar</p>
            <p style={{ color: "var(--c-text-3)", fontSize: 11, marginTop: 3 }}>Wird erst nach deiner Bestätigung geladen.</p>
          </div>
          <button onClick={applyUpdate} style={{ padding: "9px 11px", borderRadius: 10, background: "var(--c-accent)", color: "white", fontSize: 12, fontWeight: 800 }}>
            Aktualisieren
          </button>
        </div>
      )}
    </div>
  );
}

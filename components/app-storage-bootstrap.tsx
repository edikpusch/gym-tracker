"use client";

import { useEffect, useState, type ReactNode } from "react";

import { appChromeBackground, appPalette, withAlpha } from "@/lib/theme";
import { initializeNativeAppStorage } from "@/lib/appStorage";
import { APP_STORAGE_KEYS } from "@/lib/appStorageKeys";
import { isNativeRuntime } from "@/lib/platform";

type AppStorageBootstrapProps = {
  children: ReactNode;
};

export function AppStorageBootstrap({
  children,
}: AppStorageBootstrapProps) {
  const [storageReady, setStorageReady] = useState(() => !isNativeRuntime());

  useEffect(() => {
    let active = true;

    void initializeNativeAppStorage(APP_STORAGE_KEYS).finally(() => {
      if (!active) {
        return;
      }

      setStorageReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!storageReady) {
    return (
      <div style={bootScreen}>
        <div style={bootCard}>
          <div style={bootEyebrow}>Gym Tracker</div>
          <div style={bootTitle}>App wird vorbereitet</div>
          <div style={bootText}>
            Deine Trainingsdaten werden geladen, damit iPhone und Android
            denselben Stand sehen.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const bootScreen: React.CSSProperties = {
  minHeight: "var(--app-viewport-height, 100dvh)",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: appChromeBackground,
};

const bootCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: "24px",
  borderRadius: 24,
  background: withAlpha(appPalette.surface, 0.96),
  border: `1px solid ${withAlpha(appPalette.borderDefault, 0.92)}`,
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.16)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  textAlign: "center",
};

const bootEyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: appPalette.textMuted,
};

const bootTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const bootText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: appPalette.textDefault,
};

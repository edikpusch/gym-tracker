"use client";

import { useEffect, useState } from "react";
import { APP_VERSION, getActiveBuildId } from "@/lib/version";

/**
 * Zeigt die Version und den Build-Hash des tatsächlich aktiven Service Workers.
 *
 * Die Version allein genügt nicht als Nachweis für ein Update: sie steht schon
 * im ausgelieferten Bundle, bevor der Service Worker die neue Fassung
 * übernommen hat. Der Build-Hash stammt aus dem Cache-Namen und wechselt erst,
 * wenn das Update auf dem Gerät wirklich aktiv ist.
 */
export function AppVersionCard() {
  const [buildId, setBuildId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getActiveBuildId().then((id) => {
      if (cancelled) return;
      setBuildId(id);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <p style={{ color: "var(--c-text)", fontWeight: 700, fontSize: 14 }}>
          Version {APP_VERSION}
        </p>
        <p style={{ color: "var(--c-text-2)", fontSize: 12, marginTop: 3 }}>
          {!checked
            ? "Build wird ermittelt …"
            : buildId
              ? `Build ${buildId}`
              : "Kein Offline-Build aktiv"}
        </p>
      </div>
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "var(--c-accent-dim)",
          color: "var(--c-accent)",
          display: "grid",
          placeItems: "center",
          fontSize: 17,
        }}
      >
        ⓘ
      </span>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { releaseScrollLock } from "@/lib/useOverlay";

/**
 * Notbremse für die Scroll-Sperre.
 *
 * Ein Overlay sperrt den Hintergrund-Scroll und gibt ihn beim Schließen wieder
 * frei. Verschwindet das Overlay aber durch eine Navigation, statt geschlossen
 * zu werden — Zurückgeste, Link im Sheet, Weiterleitung — kann der Aufräumlauf
 * ausfallen. Der Body bliebe dann auf `position: fixed` stehen und die gesamte
 * App wäre bis zum Neuladen unscrollbar.
 *
 * Bei jedem Pfadwechsel wird die Sperre deshalb bedingungslos aufgehoben. Ein
 * Overlay, das nach der Navigation noch offen ist, setzt sie selbst neu.
 */
export function ScrollLockGuard() {
  const pathname = usePathname();

  useEffect(() => {
    releaseScrollLock();
  }, [pathname]);

  return null;
}

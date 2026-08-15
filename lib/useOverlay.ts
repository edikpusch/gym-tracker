"use client";

import { useEffect, useRef } from "react";

/**
 * Alles, was ein Overlay auf dem Handy braucht, an einer Stelle:
 *
 * 1. Hintergrund-Scroll sperren. Ohne das scrollt unter dem Sheet die Seite
 *    weiter; beim Schließen steht man an einer ganz anderen Stelle. Auf iOS
 *    reicht `overflow: hidden` nicht, dort braucht es `position: fixed` plus
 *    das Zurückstellen der Scroll-Position.
 * 2. Escape schließt.
 * 3. Die Android-Zurückgeste schließt das Overlay, statt die ganze Seite zu
 *    verlassen — mitten im Training war das der ärgerlichste Fall.
 * 4. Fokus wandert ins Overlay und beim Schließen zurück auf das auslösende
 *    Element; Tab bleibt innerhalb (Focus-Trap).
 */
/*
 * Die Scroll-Sperre wird gezählt statt einfach gesetzt und zurückgenommen.
 *
 * Warum das nötig ist: Öffnen sich zwei Overlays überlappend (Sheet über Sheet,
 * oder ein Sheet, das beim Schließen ein anderes öffnet), setzt das zweite die
 * Sperre und das erste hebt sie beim Aufräumen wieder auf — obwohl noch ein
 * Overlay offen ist. Umgekehrt kann ein verschluckter Aufräumlauf den Body
 * dauerhaft auf `position: fixed` stehen lassen. Dann scrollt die ganze App
 * nicht mehr, und zwar bis zum Neuladen.
 *
 * Der Zähler macht beide Fälle unmöglich, und `releaseScrollLock()` ist die
 * Notbremse, falls doch einmal etwas hängen bleibt.
 */
let lockCount = 0;
let savedScrollY = 0;

function lockScroll() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, savedScrollY);
}

/**
 * Hebt die Sperre bedingungslos auf. Wird beim Seitenwechsel aufgerufen, damit
 * ein Overlay, das während einer Navigation verschwindet, die App nicht
 * unscrollbar zurücklässt.
 */
export function releaseScrollLock() {
  if (typeof document === "undefined") return;
  lockCount = 0;
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
}

export function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Über einen Ref, damit die Effekte unten nicht bei jedem neuen onClose neu
  // laufen — sonst würde die Scroll-Sperre bei jedem Render zurückgesetzt.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  // Escape und Focus-Trap
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const raf = requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(selector);
      if (first && !ref.current?.contains(document.activeElement)) first.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(selector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Android-Zurück
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const marker = { overlay: true, at: Date.now() };
    window.history.pushState(marker, "");
    function onPopState() {
      closeRef.current();
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // Nur zurückräumen, wenn noch unser Eintrag oben liegt — sonst hätte der
      // Nutzer bereits selbst zurücknavigiert und wir würden eine echte Seite
      // aus der History werfen.
      if ((window.history.state as typeof marker | null)?.at === marker.at) {
        window.history.back();
      }
    };
  }, [open]);

  return ref;
}

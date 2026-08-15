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
export function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Über einen Ref, damit die Effekte unten nicht bei jedem neuen onClose neu
  // laufen — sonst würde die Scroll-Sperre bei jedem Render zurückgesetzt.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Scroll-Sperre
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const y = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, y);
    };
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

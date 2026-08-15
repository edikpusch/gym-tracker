"use client";

import { useEffect, useRef } from "react";

function applyViewportMetrics(baselineHeight: number) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportOffsetTop = viewport?.offsetTop ?? 0;

  // On iOS: window.innerHeight stays constant, visualViewport.height shrinks →
  // keyboardInset > 0 when keyboard is open.
  // On Android: both window.innerHeight and visualViewport.height shrink together →
  // window.innerHeight - viewportHeight = 0. We use a stored baseline so the
  // keyboard inset is correctly detected on both platforms.
  const keyboardInset = Math.max(
    0,
    baselineHeight - viewportHeight - viewportOffsetTop
  );

  root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
  root.style.setProperty("--app-keyboard-inset", `${keyboardInset}px`);
}

export function ViewportMetricsController() {
  const baselineHeightRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    baselineHeightRef.current = window.innerHeight;
    applyViewportMetrics(baselineHeightRef.current);

    const viewport = window.visualViewport;

    const handleMetricsChange = () => {
      // Die Baseline wächst mit: In iOS Safari ist innerHeight beim Laden klein,
      // weil die Adressleiste ausgeklappt ist. Ohne das Nachziehen bliebe
      // --app-keyboard-inset für immer 0, sobald die Leiste einmal einklappt.
      // Eine Tastatur macht den Viewport nur kleiner, nie größer — deshalb ist
      // das Maximum die richtige Referenz.
      baselineHeightRef.current = Math.max(baselineHeightRef.current, window.innerHeight);

      // Gedrosselt auf einen Frame: visualViewport.scroll feuert auf iOS während
      // des gesamten Scrollens. Da die Dokumenthöhe an --app-viewport-height
      // hängt, wurde sie sonst mitten im Scroll pro Ereignis neu gesetzt und der
      // Scroll stockte.
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        applyViewportMetrics(baselineHeightRef.current);
      });
    };

    const handleOrientationChange = () => {
      // Nach der Drehung braucht iOS länger als einen Frame, bis die Maße stehen.
      baselineHeightRef.current = 0;
      window.setTimeout(() => {
        baselineHeightRef.current = window.innerHeight;
        applyViewportMetrics(baselineHeightRef.current);
      }, 300);
    };

    window.addEventListener("resize", handleMetricsChange);
    window.addEventListener("orientationchange", handleOrientationChange);
    viewport?.addEventListener("resize", handleMetricsChange);
    viewport?.addEventListener("scroll", handleMetricsChange);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", handleMetricsChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
      viewport?.removeEventListener("resize", handleMetricsChange);
      viewport?.removeEventListener("scroll", handleMetricsChange);
    };
  }, []);

  return null;
}

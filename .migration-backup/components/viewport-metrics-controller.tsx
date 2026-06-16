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

  useEffect(() => {
    // Capture the full-screen height once on mount, before any keyboard appears.
    // This baseline is used to calculate the keyboard inset on Android where
    // window.innerHeight shrinks along with visualViewport.height.
    baselineHeightRef.current = window.innerHeight;
    applyViewportMetrics(baselineHeightRef.current);

    const viewport = window.visualViewport;

    const handleMetricsChange = () => {
      applyViewportMetrics(baselineHeightRef.current);
    };

    const handleOrientationChange = () => {
      // After rotation the baseline must be refreshed — wait one frame for the
      // browser to settle on the new dimensions before re-reading innerHeight.
      requestAnimationFrame(() => {
        baselineHeightRef.current = window.innerHeight;
        applyViewportMetrics(baselineHeightRef.current);
      });
    };

    window.addEventListener("resize", handleMetricsChange);
    window.addEventListener("orientationchange", handleOrientationChange);
    viewport?.addEventListener("resize", handleMetricsChange);
    viewport?.addEventListener("scroll", handleMetricsChange);

    return () => {
      window.removeEventListener("resize", handleMetricsChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
      viewport?.removeEventListener("resize", handleMetricsChange);
      viewport?.removeEventListener("scroll", handleMetricsChange);
    };
  }, []);

  return null;
}

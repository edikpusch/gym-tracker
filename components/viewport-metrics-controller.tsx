"use client";

import { useEffect } from "react";

function setViewportMetrics() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportOffsetTop = viewport?.offsetTop ?? 0;
  const keyboardInset = Math.max(
    0,
    window.innerHeight - viewportHeight - viewportOffsetTop
  );

  root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
  root.style.setProperty("--app-keyboard-inset", `${keyboardInset}px`);
}

export function ViewportMetricsController() {
  useEffect(() => {
    setViewportMetrics();

    const viewport = window.visualViewport;
    const handleMetricsChange = () => {
      setViewportMetrics();
    };

    window.addEventListener("resize", handleMetricsChange);
    window.addEventListener("orientationchange", handleMetricsChange);
    viewport?.addEventListener("resize", handleMetricsChange);
    viewport?.addEventListener("scroll", handleMetricsChange);

    return () => {
      window.removeEventListener("resize", handleMetricsChange);
      window.removeEventListener("orientationchange", handleMetricsChange);
      viewport?.removeEventListener("resize", handleMetricsChange);
      viewport?.removeEventListener("scroll", handleMetricsChange);
    };
  }, []);

  return null;
}

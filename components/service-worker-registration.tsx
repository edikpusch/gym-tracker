"use client";

import { useEffect } from "react";

function isCapacitorRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (window as typeof window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    }).Capacitor?.isNativePlatform?.() ?? window.location.hostname === "localhost"
  );
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      isCapacitorRuntime()
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}

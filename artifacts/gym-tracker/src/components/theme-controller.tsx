

import { useEffect } from "react";

import {
  APP_PREFERENCES_KEY,
  DEFAULT_APP_PREFERENCES,
  getAppPreferences,
  type AppPreferences,
} from "@/lib/appPreferences";

function applyTheme(preferences: AppPreferences) {
  if (typeof document === "undefined") {
    return;
  }

  const mode = preferences.themeMode ?? DEFAULT_APP_PREFERENCES.themeMode;
  document.documentElement.dataset.theme = mode;

  const themeColor = mode === "dark" ? "#0f172a" : "#111827";
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", themeColor);
  }
}

export function ThemeController() {
  useEffect(() => {
    const syncTheme = () => {
      applyTheme(getAppPreferences());
    };

    syncTheme();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === APP_PREFERENCES_KEY) {
        syncTheme();
      }
    };

    const onPreferencesChanged = () => {
      syncTheme();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onPreferencesChanged);
    window.addEventListener(
      "gym-tracker:storage-ready",
      onPreferencesChanged as EventListener
    );
    window.addEventListener(
      "gym-tracker:preferences-changed",
      onPreferencesChanged as EventListener
    );

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onPreferencesChanged);
      window.removeEventListener(
        "gym-tracker:storage-ready",
        onPreferencesChanged as EventListener
      );
      window.removeEventListener(
        "gym-tracker:preferences-changed",
        onPreferencesChanged as EventListener
      );
    };
  }, []);

  return null;
}

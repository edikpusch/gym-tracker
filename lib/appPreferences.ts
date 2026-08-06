import {
  getStorageItem,
  hasAppStorage,
  setStorageItem,
} from "@/lib/appStorage";
import type { WeightUnit } from "@/lib/workout-domain/types";

export type MenuSide = "left" | "right";
export type ThemeMode = "light" | "dark";

export type AppPreferences = {
  menuSide: MenuSide;
  themeMode: ThemeMode;
  getReadyTone: boolean;
  restVibration: boolean;
  countdownOverlay: boolean;
  progressAnimations: boolean;
  weightUnit: WeightUnit;
};

export const APP_PREFERENCES_KEY = "gym-tracker-app-preferences";

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  menuSide: "left",
  themeMode: "light",
  getReadyTone: true,
  restVibration: true,
  countdownOverlay: true,
  progressAnimations: true,
  weightUnit: "kg",
};

function normalizePreferences(value: Partial<AppPreferences> | null | undefined): AppPreferences {
  return {
    menuSide: value?.menuSide === "right" ? "right" : "left",
    themeMode: value?.themeMode === "dark" ? "dark" : "light",
    getReadyTone:
      typeof value?.getReadyTone === "boolean"
        ? value.getReadyTone
        : DEFAULT_APP_PREFERENCES.getReadyTone,
    restVibration:
      typeof value?.restVibration === "boolean"
        ? value.restVibration
        : DEFAULT_APP_PREFERENCES.restVibration,
    countdownOverlay:
      typeof value?.countdownOverlay === "boolean"
        ? value.countdownOverlay
        : DEFAULT_APP_PREFERENCES.countdownOverlay,
    progressAnimations:
      typeof value?.progressAnimations === "boolean"
        ? value.progressAnimations
        : DEFAULT_APP_PREFERENCES.progressAnimations,
    weightUnit: value?.weightUnit === "lb" ? "lb" : "kg",
  };
}

function notifyPreferencesChanged(next: AppPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("gym-tracker:preferences-changed", {
      detail: next,
    })
  );
}

export function getAppPreferences(): AppPreferences {
  if (!hasAppStorage()) {
    return DEFAULT_APP_PREFERENCES;
  }

  try {
    const raw = getStorageItem(APP_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_APP_PREFERENCES;
    }

    return normalizePreferences(JSON.parse(raw) as Partial<AppPreferences>);
  } catch (error) {
    console.error("App preferences could not be read:", error);
    return DEFAULT_APP_PREFERENCES;
  }
}

export function saveAppPreferences(next: AppPreferences) {
  if (!hasAppStorage()) {
    return;
  }

  try {
    const normalized = normalizePreferences(next);
    setStorageItem(
      APP_PREFERENCES_KEY,
      JSON.stringify(normalized)
    );
    notifyPreferencesChanged(normalized);
  } catch (error) {
    console.error("App preferences could not be saved:", error);
  }
}

export function updateAppPreferences(
  patch: Partial<AppPreferences>
): AppPreferences {
  const next = normalizePreferences({
    ...getAppPreferences(),
    ...patch,
  });
  saveAppPreferences(next);
  return next;
}

export function exportAppPreferences() {
  return getAppPreferences();
}

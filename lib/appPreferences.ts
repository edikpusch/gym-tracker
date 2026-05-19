export type MenuSide = "left" | "right";

export type AppPreferences = {
  menuSide: MenuSide;
  getReadyTone: boolean;
  countdownOverlay: boolean;
  progressAnimations: boolean;
};

export const APP_PREFERENCES_KEY = "gym-tracker-app-preferences";

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  menuSide: "left",
  getReadyTone: true,
  countdownOverlay: true,
  progressAnimations: true,
};

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function normalizePreferences(value: Partial<AppPreferences> | null | undefined): AppPreferences {
  return {
    menuSide: value?.menuSide === "right" ? "right" : "left",
    getReadyTone:
      typeof value?.getReadyTone === "boolean"
        ? value.getReadyTone
        : DEFAULT_APP_PREFERENCES.getReadyTone,
    countdownOverlay:
      typeof value?.countdownOverlay === "boolean"
        ? value.countdownOverlay
        : DEFAULT_APP_PREFERENCES.countdownOverlay,
    progressAnimations:
      typeof value?.progressAnimations === "boolean"
        ? value.progressAnimations
        : DEFAULT_APP_PREFERENCES.progressAnimations,
  };
}

export function getAppPreferences(): AppPreferences {
  if (!canUseStorage()) {
    return DEFAULT_APP_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(APP_PREFERENCES_KEY);
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
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      APP_PREFERENCES_KEY,
      JSON.stringify(normalizePreferences(next))
    );
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

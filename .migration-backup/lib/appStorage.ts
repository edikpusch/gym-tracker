"use client";

import { Preferences } from "@capacitor/preferences";
import { isNativePlatform } from "@/lib/platform";

export type AppStorageDriver = {
  name: string;
  isAvailable: () => boolean;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const localStorageDriver: AppStorageDriver = {
  name: "localStorage",
  isAvailable() {
    return typeof window !== "undefined" && "localStorage" in window;
  },
  getItem(key) {
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
  },
};

const unavailableDriver: AppStorageDriver = {
  name: "unavailable",
  isAvailable() {
    return false;
  },
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

let configuredDriver: AppStorageDriver | null = null;
let nativeStorageInitialized = false;
let nativeStorageInitPromise: Promise<boolean> | null = null;

function canUseNativePreferences() {
  return isNativePlatform();
}

function dispatchStorageReady() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("gym-tracker:storage-ready"));
}

async function mirrorToNativeStorage(key: string, value: string | null) {
  if (!canUseNativePreferences()) {
    return;
  }

  try {
    if (value === null) {
      await Preferences.remove({ key });
      return;
    }

    await Preferences.set({ key, value });
  } catch (error) {
    console.error(`Native storage mirror failed for "${key}":`, error);
  }
}

function resolveDriver() {
  const candidate = configuredDriver ?? localStorageDriver;
  return candidate.isAvailable() ? candidate : unavailableDriver;
}

export function configureAppStorageDriver(driver: AppStorageDriver | null) {
  configuredDriver = driver;
}

export function getAppStorageDriverName() {
  if (canUseNativePreferences()) {
    return `${resolveDriver().name}+preferences`;
  }

  return resolveDriver().name;
}

export function hasAppStorage() {
  return resolveDriver().isAvailable();
}

export function getStorageItem(key: string) {
  return resolveDriver().getItem(key);
}

export function setStorageItem(key: string, value: string) {
  const driver = resolveDriver();
  if (!driver.isAvailable()) {
    return false;
  }

  driver.setItem(key, value);
  void mirrorToNativeStorage(key, value);
  return true;
}

export function removeStorageItem(key: string) {
  const driver = resolveDriver();
  if (!driver.isAvailable()) {
    return false;
  }

  driver.removeItem(key);
  void mirrorToNativeStorage(key, null);
  return true;
}

export function readStorageEntries(keys: string[]) {
  const driver = resolveDriver();
  return keys.reduce<Record<string, string | null>>((result, key) => {
    result[key] = driver.getItem(key);
    return result;
  }, {});
}

export function writeStorageEntries(entries: Record<string, string | null>) {
  const driver = resolveDriver();
  if (!driver.isAvailable()) {
    return false;
  }

  Object.entries(entries).forEach(([key, value]) => {
    if (value === null) {
      driver.removeItem(key);
      void mirrorToNativeStorage(key, null);
      return;
    }

    driver.setItem(key, value);
    void mirrorToNativeStorage(key, value);
  });

  return true;
}

export async function initializeNativeAppStorage(keys: readonly string[]) {
  if (nativeStorageInitialized) {
    return true;
  }

  if (nativeStorageInitPromise) {
    return nativeStorageInitPromise;
  }

  nativeStorageInitPromise = (async () => {
    const driver = resolveDriver();
    if (!driver.isAvailable() || !canUseNativePreferences()) {
      dispatchStorageReady();
      nativeStorageInitialized = true;
      nativeStorageInitPromise = null;
      return false;
    }

    try {
      for (const key of keys) {
        const localValue = driver.getItem(key);
        const nativeValue = (await Preferences.get({ key })).value;

        if (nativeValue !== null) {
          if (localValue !== nativeValue) {
            driver.setItem(key, nativeValue);
          }
          continue;
        }

        if (localValue !== null) {
          await Preferences.set({ key, value: localValue });
        }
      }

      dispatchStorageReady();
      window.dispatchEvent(new Event("gym-tracker:preferences-changed"));
      nativeStorageInitialized = true;
      nativeStorageInitPromise = null;
      return true;
    } catch (error) {
      console.error("Native app storage initialization failed:", error);
      dispatchStorageReady();
      nativeStorageInitialized = true;
      nativeStorageInitPromise = null;
      return false;
    }
  })();

  return nativeStorageInitPromise;
}

"use client";

import { useEffect } from "react";

import { initializeNativeAppStorage } from "@/lib/appStorage";
import { APP_STORAGE_KEYS } from "@/lib/appStorageKeys";

export function AppStorageBootstrap() {
  useEffect(() => {
    void initializeNativeAppStorage(APP_STORAGE_KEYS);
  }, []);

  return null;
}

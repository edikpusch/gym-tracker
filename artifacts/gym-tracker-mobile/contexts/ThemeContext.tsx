import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPreferences, savePreferences } from "@/lib/trainingData";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: "light",
  setThemeMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    getPreferences().then((prefs) => {
      setThemeModeState(prefs.themeMode);
    });
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await savePreferences({ themeMode: mode });
  }, []);

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

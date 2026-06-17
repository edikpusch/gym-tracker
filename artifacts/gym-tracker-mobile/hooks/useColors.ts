import { useTheme } from "@/contexts/ThemeContext";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 * Reads from ThemeContext so the user's stored dark-mode preference
 * (persisted in AsyncStorage under gym-tracker-app-preferences) is
 * applied rather than the OS-level appearance setting.
 */
export function useColors() {
  const { themeMode } = useTheme();
  const palette =
    themeMode === "dark" && "dark" in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}

export type SplitThemeKey =
  | "push"
  | "pull"
  | "legs"
  | "mixed"
  | "warmup"
  | "stretch";

export type SplitTheme = {
  primary: string;
  soft: string;
  dark: string;
  glow: string;
};

export type WorkoutTheme = {
  screenBadge: string;
  badgeBackground: string;
  accent: string;
  border: string;
  shadow: string;
  progressTrack: string;
  progressFill: string;
  restFill: string;
  background: string;
};

export const splitThemes: Record<SplitThemeKey, SplitTheme> = {
  push: {
    primary: "#E52B2E",
    soft: "#FEECEC",
    dark: "#101827",
    glow: "rgba(229, 43, 46, 0.22)",
  },
  pull: {
    primary: "#2563EB",
    soft: "#EFF5FF",
    dark: "#101827",
    glow: "rgba(37, 99, 235, 0.22)",
  },
  legs: {
    primary: "#16A34A",
    soft: "#ECFDF3",
    dark: "#101827",
    glow: "rgba(22, 163, 74, 0.22)",
  },
  mixed: {
    primary: "#16A34A",
    soft: "#ECFDF3",
    dark: "#101827",
    glow: "rgba(22, 163, 74, 0.22)",
  },
  warmup: {
    primary: "#F97316",
    soft: "#FFF4E8",
    dark: "#101827",
    glow: "rgba(249, 115, 22, 0.22)",
  },
  stretch: {
    primary: "#10B981",
    soft: "#ECFDF5",
    dark: "#101827",
    glow: "rgba(16, 185, 129, 0.22)",
  },
};

export const appPalette = {
  backgroundTop: "rgb(var(--app-background-top-rgb))",
  backgroundMid: "rgb(var(--app-background-mid-rgb))",
  backgroundBase: "rgb(var(--app-background-base-rgb))",
  textStrong: "rgb(var(--app-text-strong-rgb))",
  textDefault: "rgb(var(--app-text-default-rgb))",
  textMuted: "rgb(var(--app-text-muted-rgb))",
  textSoft: "rgb(var(--app-text-soft-rgb))",
  borderSoft: "rgb(var(--app-border-soft-rgb))",
  borderDefault: "rgb(var(--app-border-default-rgb))",
  surface: "rgb(var(--app-surface-rgb))",
  surfaceSoft: "rgb(var(--app-surface-soft-rgb))",
  surfaceMuted: "rgb(var(--app-surface-muted-rgb))",
  surfaceDark: "rgb(var(--app-surface-dark-rgb))",
  danger: "rgb(var(--app-danger-rgb))",
  success: "rgb(var(--app-success-rgb))",
  warning: "rgb(var(--app-warning-rgb))",
};

export const appChromeBackground = `linear-gradient(180deg, ${appPalette.backgroundTop} 0px, ${appPalette.backgroundTop} 56px, ${appPalette.backgroundMid} 56px, ${appPalette.surfaceMuted} 136px, ${appPalette.backgroundBase} 100%)`;

export const uiTheme = {
  spacing: {
    micro: 4,
    small: 8,
    base: 16,
    large: 24,
    section: 32,
    hero: 48,
  },
  radius: {
    small: 14,
    medium: 20,
    large: 28,
    hero: 32,
    pill: 999,
  },
  touch: {
    compact: 48,
    comfortable: 56,
  },
  shadow: {
    soft: "0 12px 24px rgba(15, 23, 42, 0.08)",
    medium: "0 18px 36px rgba(15, 23, 42, 0.12)",
    strong: "0 24px 60px rgba(15, 23, 42, 0.16)",
    drawer: "0 30px 70px rgba(15, 23, 42, 0.18)",
  },
  motion: {
    quick: "160ms ease",
    smooth: "220ms ease",
    spring: "260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
} as const;

export const pageBackground = `linear-gradient(180deg, ${appPalette.surfaceSoft} 0%, ${appPalette.surface} 24%, ${appPalette.backgroundBase} 100%)`;

export function getSplitTheme(theme: SplitThemeKey) {
  return splitThemes[theme];
}

export function hexToRgb(color: string): [number, number, number] | null {
  const value = color.replace("#", "");
  if (value.length !== 6) {
    return null;
  }

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  if ([r, g, b].some((part) => Number.isNaN(part))) {
    return null;
  }

  return [r, g, b];
}

export function withAlpha(color: string, alpha: number) {
  const cssVarRgbMatch = color.match(/^rgb\(var\((--[^)]+)\)\)$/);
  if (cssVarRgbMatch) {
    return `rgba(var(${cssVarRgbMatch[1]}), ${alpha})`;
  }

  const rgb = hexToRgb(color);
  if (!rgb) {
    return color;
  }

  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function lighten(color: string, amount: number) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const [r, g, b] = rgb.map((part) =>
    Math.round(part + (255 - part) * amount)
  );

  return rgbToHex(r, g, b);
}

export function darken(color: string, amount: number) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const [r, g, b] = rgb.map((part) => Math.round(part * (1 - amount)));
  return rgbToHex(r, g, b);
}

export function createWorkoutTheme(
  color: string,
  fallback: WorkoutTheme
): WorkoutTheme {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return fallback;
  }

  return {
    ...fallback,
    screenBadge: darken(color, 0.2),
    badgeBackground: withAlpha(color, 0.1),
    accent: color,
    border: withAlpha(color, 0.18),
    shadow: `0 24px 60px ${withAlpha(color, 0.14)}`,
    progressTrack: withAlpha(color, 0.16),
    progressFill: `linear-gradient(90deg, ${lighten(color, 0.18)} 0%, ${color} 100%)`,
    restFill: `linear-gradient(90deg, ${lighten(color, 0.26)} 0%, ${color} 100%)`,
    background: `radial-gradient(circle at top, ${withAlpha(color, 0.16)} 0%, ${withAlpha(color, 0.07)} 36%, ${appPalette.backgroundBase} 100%)`,
  };
}

export function createSplitWorkoutTheme(themeKey: SplitThemeKey): WorkoutTheme {
  const theme = getSplitTheme(themeKey);

  return {
    screenBadge: darken(theme.primary, 0.18),
    badgeBackground: theme.soft,
    accent: darken(theme.primary, 0.14),
    border: withAlpha(theme.primary, 0.16),
    shadow: `0 24px 60px ${withAlpha(theme.primary, 0.12)}`,
    progressTrack: withAlpha(theme.primary, 0.16),
    progressFill: `linear-gradient(90deg, ${lighten(theme.primary, 0.16)} 0%, ${theme.primary} 100%)`,
    restFill: `linear-gradient(90deg, ${lighten(theme.primary, 0.24)} 0%, ${theme.primary} 100%)`,
    background: `radial-gradient(circle at top, ${withAlpha(theme.primary, 0.16)} 0%, ${theme.soft} 36%, ${appPalette.backgroundBase} 100%)`,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

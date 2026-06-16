

import { useState, type ReactNode } from "react";

import { SideMenu, type SideMenuItem } from "@/components/SideMenu";
import { getAppPreferences, type MenuSide } from "@/lib/appPreferences";
import { appChromeBackground, appPalette, uiTheme } from "@/lib/theme";

type AppPageFrameProps = {
  activeKey:
    | "training"
    | "plans"
    | "exercises"
    | "history"
    | "stats"
    | "progress"
    | "weight"
    | "settings"
    | "support";
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

const menuItems: Array<Omit<SideMenuItem, "active">> = [
  { key: "training", label: "Training", icon: "🏋️", section: "Training", href: "" },
  { key: "plans", label: "Pläne", icon: "📋", section: "Training", href: "?sheet=plans" },
  { key: "exercises", label: "Übungen", icon: "💪", section: "Training", href: "/exercise" },
  { key: "history", label: "Verlauf", icon: "🕘", section: "Analyse", href: "/history" },
  { key: "stats", label: "Statistiken", icon: "◔", section: "Analyse", href: "/statistics" },
  { key: "progress", label: "Fortschritte", icon: "📈", section: "Analyse", href: "/progress" },
  { key: "weight", label: "Gewicht", icon: "⚖️", section: "Analyse", href: "/weight" },
  { key: "settings", label: "Einstellungen", icon: "⚙️", section: "System", href: "/settings" },
  { key: "support", label: "Hilfe & Support", icon: "❔", section: "System", href: "/support" },
];

export function AppPageFrame({
  activeKey,
  eyebrow,
  title,
  subtitle,
  children,
  actions,
}: AppPageFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSide] = useState<MenuSide>(() => getAppPreferences().menuSide);

  return (
    <div style={screen}>
      <SideMenu
        open={menuOpen}
        onToggle={() => setMenuOpen((current) => !current)}
        onClose={() => setMenuOpen(false)}
        side={menuSide}
        items={menuItems.map((item) => ({
          ...item,
          active: item.key === activeKey,
        }))}
      />

      <main style={shell}>
        <div style={headerRow}>
          <div style={brandPill}>Gym Tracker</div>
          {actions ? <div style={headerActions}>{actions}</div> : null}
        </div>

        <div style={hero}>
          <div style={heroEyebrow}>{eyebrow}</div>
          <h1 style={heroTitle}>{title}</h1>
          {subtitle ? <p style={heroSubtitle}>{subtitle}</p> : null}
        </div>

        <div style={content}>{children}</div>
      </main>
    </div>
  );
}

const screen = {
  minHeight: "var(--app-viewport-height, 100dvh)",
  background: appChromeBackground,
  boxSizing: "border-box" as const,
};

const shell = {
  width: "100%",
  maxWidth: 440,
  minHeight:
    "calc(var(--app-viewport-height, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
  margin: "0 auto",
  padding: `calc(${uiTheme.spacing.small}px + env(safe-area-inset-top)) ${uiTheme.spacing.small + 4}px calc(98px + var(--app-bottom-inset))`,
  display: "flex",
  flexDirection: "column" as const,
  gap: uiTheme.spacing.small - 2,
  boxSizing: "border-box" as const,
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: uiTheme.spacing.base - 4,
  flexShrink: 0,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: uiTheme.touch.compact,
  padding: `0 ${uiTheme.spacing.base - 2}px`,
  borderRadius: uiTheme.radius.pill,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  fontSize: 14,
  fontWeight: 800,
  boxShadow: uiTheme.shadow.medium,
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  gap: uiTheme.spacing.small,
};

const hero = {
  display: "grid",
  gap: uiTheme.spacing.micro - 1,
  padding: "2px 2px 0",
  flexShrink: 0,
};

const heroEyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  fontWeight: 800,
  color: appPalette.textSoft,
};

const heroTitle = {
  fontSize: 30,
  lineHeight: 1.02,
  color: appPalette.textStrong,
  fontWeight: 800,
  margin: 0,
};

const heroSubtitle = {
  fontSize: 13,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  margin: 0,
};

const content = {
  display: "flex",
  flexDirection: "column" as const,
  flex: 1,
  minHeight: 0,
  gap: uiTheme.spacing.small + 2,
};

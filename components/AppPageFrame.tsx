"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SideMenu, type SideMenuItem } from "@/components/SideMenu";
import { getAppPreferences, type MenuSide } from "@/lib/appPreferences";

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
  { key: "training", label: "Training", icon: "🏋️", href: "/index.html" },
  { key: "plans", label: "Pläne", icon: "📋", href: "/index.html?sheet=plans" },
  { key: "exercises", label: "Übungen", icon: "💪", href: "/index.html?sheet=exercises" },
  { key: "history", label: "Verlauf", icon: "🕘", href: "/history/index.html" },
  { key: "stats", label: "Statistiken", icon: "◔", href: "/statistics/index.html" },
  { key: "progress", label: "Fortschritte", icon: "📈", href: "/progress/index.html" },
  { key: "weight", label: "Gewicht", icon: "⚖️", href: "/weight/index.html" },
  { key: "settings", label: "Einstellungen", icon: "⚙️", href: "/settings/index.html" },
  { key: "support", label: "Hilfe & Support", icon: "❔", href: "/support/index.html" },
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
  const [menuSide, setMenuSide] = useState<MenuSide>("left");

  useEffect(() => {
    setMenuSide(getAppPreferences().menuSide);
  }, []);

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
  minHeight: "100%",
  background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 24%, #f8fafc 100%)",
  boxSizing: "border-box" as const,
};

const shell = {
  width: "100%",
  maxWidth: 440,
  margin: "0 auto",
  padding: "12px 12px calc(92px + env(safe-area-inset-bottom))",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const brandPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  background: "#111827",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  boxShadow: "0 16px 30px rgba(15, 23, 42, 0.14)",
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const hero = {
  display: "grid",
  gap: 3,
  padding: "2px 2px 2px",
};

const heroEyebrow = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  fontWeight: 800,
  color: "#94a3b8",
};

const heroTitle = {
  fontSize: 30,
  lineHeight: 1.02,
  color: "#0f172a",
  fontWeight: 800,
  margin: 0,
};

const heroSubtitle = {
  fontSize: 13,
  lineHeight: 1.35,
  color: "#64748b",
  margin: 0,
};

const content = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

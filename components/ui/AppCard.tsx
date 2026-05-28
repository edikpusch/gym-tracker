"use client";

import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

type CardVariant = "default" | "active" | "soft" | "dark" | "theme";

type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: CardVariant;
  accentColor?: string;
  interactive?: boolean;
  style?: CSSProperties;
};

export function AppCard({
  children,
  variant = "default",
  accentColor,
  interactive = false,
  style,
  ...rest
}: AppCardProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        ...baseCard,
        ...variantStyles[variant],
        ...(variant === "theme" && accentColor ? themedCard(accentColor) : null),
        ...(interactive ? interactiveStyle : null),
        ...(interactive && pressed ? interactivePressedStyle : null),
        ...style,
      }}
      onPointerDown={interactive ? () => setPressed(true) : undefined}
      onPointerUp={interactive ? () => setPressed(false) : undefined}
      onPointerCancel={interactive ? () => setPressed(false) : undefined}
      onPointerLeave={interactive ? () => setPressed(false) : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

const baseCard = {
  borderRadius: uiTheme.radius.large,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: uiTheme.shadow.soft,
};

const variantStyles = {
  default: {},
  active: {
    borderColor: withAlpha(appPalette.surfaceDark, 0.14),
    boxShadow: uiTheme.shadow.medium,
  },
  soft: {
    background: appPalette.surfaceSoft,
  },
  dark: {
    background: appPalette.surfaceDark,
    color: appPalette.surface,
    borderColor: withAlpha(appPalette.surfaceDark, 0.4),
    boxShadow: uiTheme.shadow.strong,
  },
  theme: {},
} as const;

function themedCard(color: string) {
  return {
    borderColor: withAlpha(color, 0.16),
    background: `linear-gradient(180deg, ${withAlpha(color, 0.08)} 0%, ${withAlpha(appPalette.surface, 0.98)} 100%)`,
    boxShadow: `0 18px 36px ${withAlpha(color, 0.12)}`,
  };
}

const interactiveStyle = {
  cursor: "pointer",
  transition: `transform ${uiTheme.motion.quick}, box-shadow ${uiTheme.motion.quick}, border-color ${uiTheme.motion.quick}`,
};

const interactivePressedStyle = {
  transform: "scale(0.988)",
  boxShadow: uiTheme.shadow.medium,
};

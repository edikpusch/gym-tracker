"use client";

import type { CSSProperties, ReactNode } from "react";

import { appPalette, getSplitTheme, uiTheme, withAlpha } from "@/lib/theme";

type BadgeVariant =
  | "active"
  | "template"
  | "custom"
  | "exercise"
  | "warmup"
  | "stretch"
  | "pause"
  | "note"
  | "new"
  | "better"
  | "equal"
  | "worse";

type AppBadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: CSSProperties;
};

export function AppBadge({ children, variant = "custom", style }: AppBadgeProps) {
  return (
    <span
      style={{
        ...baseBadge,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const baseBadge = {
  minHeight: 34,
  padding: "0 14px",
  borderRadius: uiTheme.radius.pill,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1,
};

const pull = getSplitTheme("pull");
const warmup = getSplitTheme("warmup");
const stretch = getSplitTheme("stretch");

const variantStyles = {
  active: {
    background: appPalette.surfaceDark,
    color: appPalette.surface,
  },
  template: {
    background: withAlpha(pull.primary, 0.1),
    color: pull.primary,
  },
  custom: {
    background: withAlpha(appPalette.danger, 0.1),
    color: appPalette.danger,
  },
  exercise: {
    background: withAlpha(pull.primary, 0.1),
    color: pull.primary,
  },
  warmup: {
    background: withAlpha(warmup.primary, 0.1),
    color: warmup.primary,
  },
  stretch: {
    background: withAlpha(stretch.primary, 0.1),
    color: stretch.primary,
  },
  pause: {
    background: appPalette.surfaceMuted,
    color: appPalette.textDefault,
  },
  note: {
    background: withAlpha("#6366f1", 0.14),
    color: "#6366f1",
  },
  new: {
    background: withAlpha(pull.primary, 0.12),
    color: pull.primary,
  },
  better: {
    background: withAlpha(appPalette.success, 0.14),
    color: appPalette.success,
  },
  equal: {
    background: appPalette.surfaceMuted,
    color: appPalette.textDefault,
  },
  worse: {
    background: withAlpha(appPalette.danger, 0.12),
    color: appPalette.danger,
  },
} as const;

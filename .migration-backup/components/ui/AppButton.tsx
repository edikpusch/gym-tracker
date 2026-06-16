"use client";

import { useState } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "compact" | "comfortable";

type CommonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  style?: CSSProperties;
};

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type LinkProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

export function AppButton(props: ButtonProps | LinkProps) {
  const {
    children,
    variant = "secondary",
    size = "comfortable",
    block = false,
    style,
    ...rest
  } = props;
  const [pressed, setPressed] = useState(false);

  const mergedStyle = {
    ...baseButton,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(block ? blockStyle : null),
    ...(pressed ? pressedStyle : null),
    ...style,
  };

  if ("href" in props && props.href) {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        href={href}
        style={mergedStyle}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        {...anchorRest}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      style={mergedStyle}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}

const baseButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 18px",
  borderRadius: uiTheme.radius.pill,
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1,
  textDecoration: "none",
  cursor: "pointer",
  userSelect: "none" as const,
  transition: `transform ${uiTheme.motion.quick}, box-shadow ${uiTheme.motion.quick}, background ${uiTheme.motion.quick}, border-color ${uiTheme.motion.quick}, color ${uiTheme.motion.quick}`,
  transform: "scale(1)",
};

const sizeStyles = {
  compact: {
    minHeight: uiTheme.touch.compact,
  },
  comfortable: {
    minHeight: uiTheme.touch.comfortable,
  },
} as const;

const variantStyles = {
  primary: {
    border: `1px solid ${appPalette.surfaceDark}`,
    background: appPalette.surfaceDark,
    color: appPalette.surface,
    boxShadow: uiTheme.shadow.medium,
  },
  secondary: {
    border: `1px solid ${appPalette.borderDefault}`,
    background: appPalette.surface,
    color: appPalette.textStrong,
    boxShadow: uiTheme.shadow.soft,
  },
  ghost: {
    border: `1px solid ${withAlpha(appPalette.borderDefault, 0.32)}`,
    background: "transparent",
    color: appPalette.textDefault,
    boxShadow: "none",
  },
  danger: {
    border: `1px solid ${appPalette.danger}`,
    background: appPalette.danger,
    color: appPalette.surface,
    boxShadow: `0 14px 28px ${withAlpha(appPalette.danger, 0.2)}`,
  },
} as const;

const blockStyle = {
  width: "100%",
};

const pressedStyle = {
  transform: "scale(0.97)",
  filter: "saturate(1.02)",
};

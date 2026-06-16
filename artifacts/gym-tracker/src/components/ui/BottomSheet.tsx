

import type { CSSProperties, ReactNode } from "react";

import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: CSSProperties;
};

export function BottomSheet({ open, onClose, children, style }: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...sheet, ...style }} onClick={(event) => event.stopPropagation()}>
        <div style={handle} />
        {children}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: withAlpha(appPalette.surfaceDark, 0.38),
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "max(12px, env(safe-area-inset-top)) 0 0 0",
  zIndex: 80,
  animation: "codex-fade-in 180ms ease",
};

const sheet = {
  width: "100%",
  maxWidth: 440,
  maxHeight:
    "calc(var(--app-viewport-height, 100dvh) - max(12px, env(safe-area-inset-top)))",
  borderRadius: `${uiTheme.radius.large}px ${uiTheme.radius.large}px 0 0`,
  background: withAlpha(appPalette.surface, 0.98),
  border: `1px solid ${withAlpha(appPalette.borderDefault, 0.7)}`,
  boxShadow: uiTheme.shadow.drawer,
  padding: `14px ${uiTheme.spacing.base}px calc(${uiTheme.spacing.large}px + var(--app-bottom-inset))`,
  overflowY: "auto" as const,
  overscrollBehavior: "contain" as const,
  WebkitOverflowScrolling: "touch" as const,
  animation: "codex-sheet-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
};

const handle = {
  width: 42,
  height: 5,
  borderRadius: uiTheme.radius.pill,
  background: appPalette.borderDefault,
  margin: "0 auto 12px",
};



import type { ReactNode } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette, withAlpha } from "@/lib/theme";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  extraActions?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  body,
  onCancel,
  onConfirm,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  confirmVariant = "danger",
  extraActions,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const titleId = "confirm-dialog-title";
  const bodyId = "confirm-dialog-body";

  return (
    <div style={overlay} onClick={onCancel}>
      <AppCard
        variant="active"
        style={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(event) => event.stopPropagation()}
      >
        <div id={titleId} style={titleStyle}>{title}</div>
        <div id={bodyId} style={bodyStyle}>{body}</div>
        {extraActions}
        <div style={actionRow}>
          <AppButton variant="secondary" block onClick={onCancel}>
            {cancelLabel}
          </AppButton>
          <AppButton variant={confirmVariant} block onClick={onConfirm} autoFocus>
            {confirmLabel}
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
}

const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: withAlpha(appPalette.surfaceDark, 0.42),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 80,
};

const dialog = {
  width: "100%",
  maxWidth: 360,
  padding: "24px 20px 20px",
  display: "grid",
  gap: 14,
};

const titleStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: appPalette.textStrong,
  lineHeight: 1.05,
};

const bodyStyle = {
  fontSize: 15,
  lineHeight: 1.55,
  color: appPalette.textDefault,
};

const actionRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 4,
};

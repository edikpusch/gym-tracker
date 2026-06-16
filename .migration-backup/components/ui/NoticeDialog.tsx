"use client";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette, withAlpha } from "@/lib/theme";

type NoticeDialogProps = {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
  buttonLabel?: string;
};

export function NoticeDialog({
  open,
  title,
  body,
  onClose,
  buttonLabel = "OK",
}: NoticeDialogProps) {
  if (!open) {
    return null;
  }

  const titleId = "notice-dialog-title";
  const bodyId = "notice-dialog-body";

  return (
    <div style={overlay} onClick={onClose}>
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
        <AppButton variant="primary" block onClick={onClose} autoFocus>
          {buttonLabel}
        </AppButton>
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

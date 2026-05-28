"use client";

import type { CSSProperties } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette, withAlpha } from "@/lib/theme";

type TextPromptDialogProps = {
  open: boolean;
  title: string;
  body?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  readOnly?: boolean;
  multiline?: boolean;
  confirmDisabled?: boolean;
};

export function TextPromptDialog({
  open,
  title,
  body,
  label,
  value,
  onChange,
  onCancel,
  onConfirm,
  confirmLabel = "Speichern",
  cancelLabel = "Abbrechen",
  placeholder,
  readOnly = false,
  multiline = false,
  confirmDisabled = false,
}: TextPromptDialogProps) {
  if (!open) {
    return null;
  }

  const InputTag = multiline ? "textarea" : "input";
  const titleId = "text-prompt-dialog-title";
  const bodyId = body ? "text-prompt-dialog-body" : undefined;

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
        {body ? <div id={bodyId} style={bodyStyle}>{body}</div> : null}
        <label style={fieldStack}>
          <span style={labelStyle}>{label}</span>
          <InputTag
            value={value}
            placeholder={placeholder}
            readOnly={readOnly}
            autoFocus
            rows={multiline ? 6 : undefined}
            onChange={(event) => onChange(event.currentTarget.value)}
            style={{
              ...inputStyle,
              ...(multiline ? multilineStyle : null),
              ...(readOnly ? readOnlyStyle : null),
            }}
          />
        </label>
        <div style={actionRow}>
          <AppButton variant="secondary" block onClick={onCancel}>
            {cancelLabel}
          </AppButton>
          <AppButton
            variant="primary"
            block
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
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
  maxWidth: 400,
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

const fieldStack = {
  display: "grid",
  gap: 8,
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 18,
  border: `1px solid ${appPalette.borderDefault}`,
  padding: "14px 16px",
  fontSize: 16,
  color: appPalette.textStrong,
  background: appPalette.surface,
};

const multilineStyle: CSSProperties = {
  minHeight: 132,
  resize: "vertical",
  fontFamily: "inherit",
};

const readOnlyStyle: CSSProperties = {
  background: appPalette.surfaceMuted,
};

const actionRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 4,
};

"use client";

type ConfirmDeleteDialogProps = {
  open: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  title,
  body,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={dialog} onClick={(event) => event.stopPropagation()}>
        <div style={titleStyle}>{title}</div>
        <div style={bodyStyle}>{body}</div>
        <div style={actionRow}>
          <button type="button" style={cancelButton} onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" style={confirmButton} onClick={onConfirm}>
            Loeschen
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(15, 23, 42, 0.42)",
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
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 28px 60px rgba(15, 23, 42, 0.18)",
  display: "grid",
  gap: 14,
};

const titleStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: "#111827",
  lineHeight: 1.05,
};

const bodyStyle = {
  fontSize: 15,
  lineHeight: 1.55,
  color: "#475569",
};

const actionRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 4,
};

const cancelButton = {
  minHeight: 50,
  borderRadius: 999,
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  fontWeight: 800,
  border: "1px solid #d7e1ef",
  cursor: "pointer",
};

const confirmButton = {
  minHeight: 50,
  borderRadius: 999,
  background: "#dc2626",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  border: "1px solid #dc2626",
  boxShadow: "0 14px 28px rgba(220, 38, 38, 0.2)",
  cursor: "pointer",
};

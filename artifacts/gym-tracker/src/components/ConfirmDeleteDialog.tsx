

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  return (
    <ConfirmDialog
      open={open}
      title={title}
      body={body}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Löschen"
      cancelLabel="Abbrechen"
      confirmVariant="danger"
    />
  );
}

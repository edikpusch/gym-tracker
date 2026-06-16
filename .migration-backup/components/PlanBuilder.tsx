"use client";

import { useState } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette } from "@/lib/theme";
import type { TrainingPlanBlock } from "@/lib/trainingModel";
import { getDayPlanQuality } from "@/lib/trainingPlans";

import { PlanBlockCard } from "./PlanBlockCard";

type PlanBuilderProps = {
  dayName: string;
  dayBlocks: TrainingPlanBlock[];
  canEdit?: boolean;
  onEditBlock: (block: TrainingPlanBlock) => void;
  onDeleteBlock: (block: TrainingPlanBlock) => void;
  onMoveBlock: (block: TrainingPlanBlock, direction: "up" | "down") => void;
  onReorderBlock?: (
    block: TrainingPlanBlock,
    targetBlock: TrainingPlanBlock,
    position: "before" | "after"
  ) => void;
  onAddBlock?: () => void;
  onAddAfterBlock?: (block: TrainingPlanBlock) => void;
  onEditDay?: () => void;
};

export function PlanBuilder({
  dayName,
  dayBlocks,
  canEdit = false,
  onEditBlock,
  onDeleteBlock,
  onMoveBlock,
  onReorderBlock,
  onAddBlock,
  onAddAfterBlock,
  onEditDay,
}: PlanBuilderProps) {
  const summary = buildSummary(dayBlocks);
  const quality = getDayPlanQuality(dayBlocks);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    blockId: string;
    position: "before" | "after";
  } | null>(null);

  function clearDragState() {
    setDraggingBlockId(null);
    setDropTarget(null);
  }

  return (
    <div style={builderStack}>
      <AppCard style={headerCard}>
        <div style={headerTitle}>{dayName}</div>
        <div style={headerMeta}>{summary.meta}</div>
        {summary.duration ? <div style={headerDuration}>ca. {summary.duration} Min</div> : null}
        <div style={toolbarRow}>
          <span style={toolbarPrimary}>Übersicht</span>
          {canEdit && onEditDay ? (
            <AppButton variant="secondary" size="compact" style={headerButton} onClick={onEditDay}>
              Tag bearbeiten
            </AppButton>
          ) : null}
        </div>
        <div style={qualitySummaryRow}>
          <span
            style={{
              ...qualityPill,
              ...(quality.level === "balanced"
                ? qualityPillGood
                : quality.level === "dense"
                  ? qualityPillWarn
                  : qualityPillInfo),
            }}
          >
            {quality.summary}
          </span>
        </div>
        {quality.hints.length > 0 ? (
          <div style={qualityHintGrid}>
            {quality.hints.map((hint) => (
              <div
                key={`${hint.label}-${hint.detail}`}
                style={{
                  ...qualityHintCard,
                  ...(hint.tone === "good"
                    ? qualityHintGood
                    : hint.tone === "warn"
                      ? qualityHintWarn
                      : qualityHintInfo),
                }}
              >
                <div style={qualityHintLabel}>{hint.label}</div>
                <div style={qualityHintDetail}>{hint.detail}</div>
              </div>
            ))}
          </div>
        ) : null}
      </AppCard>

      {dayBlocks.length > 0 ? (
        <div style={timelineStack}>
          {dayBlocks.map((block, index) => (
            <PlanBlockCard
              key={block.id}
              block={block}
              isFirst={index === 0}
              isLast={index === dayBlocks.length - 1}
              canEdit={canEdit}
              onEdit={() => onEditBlock(block)}
              onDelete={canEdit ? () => onDeleteBlock(block) : undefined}
              onMoveUp={canEdit && index > 0 ? () => onMoveBlock(block, "up") : undefined}
              onMoveDown={
                canEdit && index < dayBlocks.length - 1
                  ? () => onMoveBlock(block, "down")
                  : undefined
              }
              dragState={
                draggingBlockId === block.id
                  ? "dragging"
                  : dropTarget?.blockId === block.id
                    ? dropTarget.position
                    : "idle"
              }
              onDragStart={
                canEdit
                  ? () => {
                      setDraggingBlockId(block.id);
                      setDropTarget(null);
                    }
                  : undefined
              }
              onDragOver={
                canEdit
                  ? (position) => {
                      if (!draggingBlockId || draggingBlockId === block.id) {
                        return;
                      }
                      setDropTarget({ blockId: block.id, position });
                    }
                  : undefined
              }
              onDrop={
                canEdit
                  ? (position) => {
                      if (!draggingBlockId || draggingBlockId === block.id) {
                        clearDragState();
                        return;
                      }
                      const draggingBlock = dayBlocks.find(
                        (entry) => entry.id === draggingBlockId
                      );
                      if (!draggingBlock) {
                        clearDragState();
                        return;
                      }
                      onReorderBlock?.(draggingBlock, block, position);
                      clearDragState();
                    }
                  : undefined
              }
              onDragEnd={canEdit ? clearDragState : undefined}
              onAddAfter={canEdit ? () => onAddAfterBlock?.(block) : undefined}
            />
          ))}
        </div>
      ) : (
        <AppCard style={emptyCard}>
          <div style={emptyKicker}>Direkter Überblick</div>
          <div style={emptyTitle}>Noch kein Trainingsfluss</div>
          <div style={emptyMeta}>
            Starte direkt mit Dehnen, Warm-up, Übung, Pause oder einer Notiz. Jeder neue
            Block erscheint sofort in der Live-Struktur.
          </div>
          {canEdit && onAddBlock ? (
            <AppButton variant="primary" block style={emptyActionButton} onClick={onAddBlock}>
              + Ersten Block hinzufügen
            </AppButton>
          ) : null}
        </AppCard>
      )}

      {canEdit && onAddBlock && dayBlocks.length > 0 ? (
        <AppButton variant="secondary" block style={builderFooterButton} onClick={onAddBlock}>
          + Block hinzufügen
        </AppButton>
      ) : null}
    </div>
  );
}

function buildSummary(dayBlocks: TrainingPlanBlock[]) {
  const counts = {
    exercise: dayBlocks.filter((block) => block.type === "exercise").length,
    warmup: dayBlocks.filter((block) => block.type === "warmup").length,
    stretch: dayBlocks.filter((block) => block.type === "stretch").length,
    pause: dayBlocks.filter((block) => block.type === "pause").length,
  };

  const duration = estimateMinutes(dayBlocks);

  return {
    meta: `${counts.exercise} Übungen · ${counts.warmup} Warm-ups · ${counts.stretch} Dehnen · ${counts.pause} Pausen`,
    duration,
  };
}

function estimateMinutes(dayBlocks: TrainingPlanBlock[]) {
  const seconds = dayBlocks.reduce((total, block) => {
    if (block.type === "exercise") return total + block.sets * (block.restSeconds + 45);
    if (block.type === "warmup") return total + block.rounds * (block.restSeconds + 30);
    if (block.type === "stretch") return total + block.holdSeconds * block.rounds;
    if (block.type === "pause") return total + block.seconds;
    return total + 20;
  }, 0);

  if (seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 60));
}

const builderStack = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const headerCard = {
  padding: "16px 16px 12px",
  display: "grid",
  gap: 6,
};

const headerTitle = {
  fontSize: 28,
  fontWeight: 900,
  color: appPalette.textStrong,
  lineHeight: 1.02,
};

const headerMeta = {
  fontSize: 12,
  lineHeight: 1.4,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const headerDuration = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const toolbarRow = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap" as const,
  alignItems: "center",
  marginTop: 1,
};

const toolbarPrimary = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "7px 14px",
  borderRadius: 999,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  fontSize: 12,
  fontWeight: 800,
};

const headerButton = {
  minHeight: 36,
  whiteSpace: "nowrap" as const,
};

const qualitySummaryRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
  marginTop: 2,
};

const qualityPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const qualityPillGood = {
  background: "rgba(34,197,94,0.12)",
  color: "#15803d",
};

const qualityPillInfo = {
  background: appPalette.surfaceMuted,
  color: appPalette.textStrong,
};

const qualityPillWarn = {
  background: "rgba(245,158,11,0.14)",
  color: "#b45309",
};

const qualityHintGrid = {
  display: "grid",
  gap: 8,
  marginTop: 4,
};

const qualityHintCard = {
  padding: "10px 12px",
  borderRadius: 16,
  border: `1px solid ${appPalette.borderSoft}`,
  display: "grid",
  gap: 4,
};

const qualityHintGood = {
  background: "rgba(34,197,94,0.08)",
};

const qualityHintInfo = {
  background: appPalette.surface,
};

const qualityHintWarn = {
  background: "rgba(245,158,11,0.08)",
};

const qualityHintLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const qualityHintDetail = {
  fontSize: 12,
  lineHeight: 1.45,
  color: appPalette.textDefault,
};

const timelineStack = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const emptyCard = {
  padding: "18px 16px 16px",
  display: "grid",
  gap: 10,
};

const emptyKicker = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  color: appPalette.textMuted,
  fontWeight: 800,
};

const emptyTitle = {
  fontSize: 20,
  fontWeight: 900,
  color: appPalette.textStrong,
};

const emptyMeta = {
  fontSize: 14,
  lineHeight: 1.45,
  color: appPalette.textDefault,
};

const emptyActionButton = {
  minHeight: 52,
  fontSize: 17,
  fontWeight: 800,
};

const builderFooterButton = {
  minHeight: 48,
  fontSize: 16,
  fontWeight: 800,
};

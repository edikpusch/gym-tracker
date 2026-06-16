"use client";

import type { DragEvent, MouseEvent } from "react";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { appPalette, getSplitTheme, splitThemes, uiTheme, withAlpha } from "@/lib/theme";
import type { TrainingPlanBlock } from "@/lib/trainingModel";

type PlanBlockCardProps = {
  block: TrainingPlanBlock;
  isFirst?: boolean;
  isLast?: boolean;
  canEdit?: boolean;
  dragState?: "idle" | "dragging" | "before" | "after";
  onEdit: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: () => void;
  onDragOver?: (position: "before" | "after") => void;
  onDrop?: (position: "before" | "after") => void;
  onDragEnd?: () => void;
  onAddAfter?: () => void;
};

export function PlanBlockCard({
  block,
  isFirst = false,
  isLast = false,
  canEdit = false,
  dragState = "idle",
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAddAfter,
}: PlanBlockCardProps) {
  const tone = getBlockTone(block.type);

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  function getDropPosition(event: DragEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
  }

  return (
    <div style={rowWrap}>
      {!isFirst ? <div style={timelineLine} /> : null}
      <div style={timelineNodeWrap}>
        <div style={{ ...timelineNode, background: tone.primary }} />
      </div>
      <div style={contentWrap}>
        <AppCard
          interactive
          style={{
            ...card,
            ...(dragState === "dragging" ? draggingCard : null),
            ...(dragState === "before" ? dropBeforeCard : null),
            ...(dragState === "after" ? dropAfterCard : null),
            borderColor: withAlpha(tone.primary, 0.18),
            background: `linear-gradient(180deg, ${withAlpha(tone.primary, 0.1)} 0%, ${withAlpha(appPalette.surface, 0.98)} 100%)`,
            boxShadow: `0 14px 30px ${withAlpha(tone.primary, 0.1)}`,
          }}
          onDragOver={(event) => {
            if (!onDragOver) return;
            event.preventDefault();
            onDragOver(getDropPosition(event));
          }}
          onDrop={(event) => {
            if (!onDrop) return;
            event.preventDefault();
            onDrop(getDropPosition(event));
          }}
          onClick={onEdit}
        >
          <div style={cardTop}>
            <div style={cardMain}>
              <div
                style={{
                  ...iconWrap,
                  background: withAlpha(tone.primary, 0.12),
                  color: tone.primary,
                }}
              >
                {getBlockIcon(block.type)}
              </div>
              <div style={textWrap}>
                <AppBadge variant={getBadgeVariant(block.type)} style={badgeStyle}>
                  {getBadgeLabel(block.type)}
                </AppBadge>
                <div style={title}>{block.label}</div>
                <div style={meta}>{getBlockMeta(block)}</div>
              </div>
            </div>
            {canEdit ? (
              <div style={headerActions}>
                <button
                  style={{ ...dragHandle, color: tone.primary }}
                  draggable
                  onClick={stop}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", block.id);
                    onDragStart?.();
                  }}
                  onDragEnd={(event) => {
                    event.stopPropagation();
                    onDragEnd?.();
                  }}
                  aria-label="Block verschieben"
                  title="Block verschieben"
                >
                  ⋮⋮
                </button>
                <div style={{ ...menuDots, color: tone.primary }} aria-hidden>
                  •••
                </div>
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <div style={actionRow}>
              <AppButton
                variant="primary"
                size="compact"
                style={primaryAction}
                onClick={(event) => {
                  stop(event);
                  onAddAfter?.();
                }}
                disabled={!onAddAfter}
              >
                + Danach
              </AppButton>
              <div style={secondaryActions}>
                <AppButton
                  variant="ghost"
                  size="compact"
                  style={miniAction}
                  onClick={(event) => {
                    stop(event);
                    onMoveUp?.();
                  }}
                  disabled={!onMoveUp}
                >
                  Hoch
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="compact"
                  style={miniAction}
                  onClick={(event) => {
                    stop(event);
                    onMoveDown?.();
                  }}
                  disabled={!onMoveDown}
                >
                  Runter
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="compact"
                  style={miniAction}
                  onClick={(event) => {
                    stop(event);
                    onEdit();
                  }}
                >
                  Bearbeiten
                </AppButton>
                <AppButton
                  variant="danger"
                  size="compact"
                  style={miniAction}
                  onClick={(event) => {
                    stop(event);
                    onDelete?.();
                  }}
                  disabled={!onDelete}
                >
                  Löschen
                </AppButton>
              </div>
            </div>
          ) : null}
        </AppCard>
      </div>
      {!isLast ? <div style={rowTail} /> : null}
    </div>
  );
}

function getBlockMeta(block: TrainingPlanBlock) {
  if (block.type === "exercise") {
    return `${block.sets} × ${block.minReps}-${block.maxReps} · ${formatRest(block.restSeconds)}`;
  }
  if (block.type === "warmup") {
    return `${block.rounds} Sätze · ${formatRest(block.restSeconds)}`;
  }
  if (block.type === "stretch") {
    return `${block.holdSeconds} Sek · ${block.rounds} Runden`;
  }
  if (block.type === "note") {
    const preview = block.notes.trim().replace(/\s+/g, " ");
    return preview.length > 72 ? `${preview.slice(0, 69)}...` : preview;
  }
  return `${formatRest(block.seconds)} · ${
    block.scope === "workout" ? "Workout-Pause" : "Übungspause"
  }`;
}

function getBadgeLabel(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return "Übung";
  if (type === "warmup") return "Warm-up";
  if (type === "stretch") return "Dehnen";
  if (type === "pause") return "Pause";
  return "Notiz";
}

function getBadgeVariant(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return "exercise" as const;
  if (type === "warmup") return "warmup" as const;
  if (type === "stretch") return "stretch" as const;
  if (type === "pause") return "template" as const;
  return "note" as const;
}

function getBlockIcon(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return "🏋️";
  if (type === "warmup") return "🔥";
  if (type === "stretch") return "🧘";
  if (type === "pause") return "⏱️";
  return "📝";
}

function getBlockTone(type: TrainingPlanBlock["type"]) {
  if (type === "exercise") return getSplitTheme("push");
  if (type === "warmup") return getSplitTheme("warmup");
  if (type === "stretch") return getSplitTheme("stretch");
  if (type === "pause") return getSplitTheme("pull");
  return {
    primary: splitThemes.pull.primary,
    soft: withAlpha(splitThemes.pull.primary, 0.08),
    dark: appPalette.surfaceDark,
    glow: withAlpha(splitThemes.pull.primary, 0.18),
  };
}

function formatRest(seconds: number) {
  if (seconds % 60 === 0) return `${seconds / 60} Min`;
  return `${seconds} Sek`;
}

const rowWrap = {
  position: "relative" as const,
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  columnGap: 12,
};

const rowTail = {
  position: "absolute" as const,
  top: 30,
  bottom: -10,
  left: 8,
  width: 2,
  background: appPalette.borderSoft,
};

const timelineLine = {
  position: "absolute" as const,
};

const timelineNodeWrap = {
  display: "flex",
  justifyContent: "center",
  paddingTop: 20,
};

const timelineNode = {
  width: 14,
  height: 14,
  borderRadius: 999,
  boxShadow: `0 0 0 4px ${withAlpha(appPalette.surface, 0.96)}`,
};

const contentWrap = {
  minWidth: 0,
};

const card = {
  padding: "12px 12px 10px",
  display: "grid",
  gap: 8,
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const draggingCard = {
  transform: "scale(1.01)",
  opacity: 0.9,
};

const dropBeforeCard = {
  boxShadow: `inset 0 4px 0 ${appPalette.surfaceDark}`,
};

const dropAfterCard = {
  boxShadow: `inset 0 -4px 0 ${appPalette.surfaceDark}`,
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const cardMain = {
  display: "flex",
  gap: 10,
  minWidth: 0,
  flex: 1,
};

const iconWrap = {
  width: 36,
  minWidth: 36,
  height: 36,
  borderRadius: uiTheme.radius.medium,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  boxShadow: uiTheme.shadow.soft,
};

const textWrap = {
  display: "grid",
  gap: 4,
  minWidth: 0,
  flex: 1,
};

const badgeStyle = {
  alignSelf: "flex-start",
  minHeight: 22,
  padding: "0 10px",
  fontSize: 10,
};

const title = {
  fontSize: 17,
  fontWeight: 900,
  color: appPalette.textStrong,
  lineHeight: 1.14,
  wordBreak: "break-word" as const,
};

const meta = {
  fontSize: 12,
  lineHeight: 1.35,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const dragHandle = {
  width: 34,
  minWidth: 34,
  height: 34,
  borderRadius: 12,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 900,
  cursor: "grab",
  boxShadow: `0 8px 18px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
};

const menuDots = {
  minWidth: 24,
  fontSize: 15,
  lineHeight: 1,
  letterSpacing: 1,
  textAlign: "right" as const,
  fontWeight: 800,
};

const actionRow = {
  display: "grid",
  gap: 7,
};

const primaryAction = {
  minHeight: 40,
  fontSize: 14,
};

const secondaryActions = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 6,
};

const miniAction = {
  minHeight: 36,
  fontSize: 11,
  padding: "0 8px",
};

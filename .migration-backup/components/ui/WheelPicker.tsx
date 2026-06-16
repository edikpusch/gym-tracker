"use client";

import { useEffect, useMemo, useRef } from "react";

import { appPalette, withAlpha } from "@/lib/theme";

type WheelPickerItem = {
  value: number;
  label: string;
};

type WheelPickerProps = {
  items: WheelPickerItem[];
  selectedValue: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  itemHeight?: number;
  visibleRows?: number;
};

export function WheelPicker({
  items,
  selectedValue,
  onChange,
  ariaLabel,
  itemHeight = 48,
  visibleRows = 5,
}: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const selectedIndex = useMemo(() => {
    const foundIndex = items.findIndex((item) => item.value === selectedValue);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [items, selectedValue]);
  const sideRows = Math.floor(visibleRows / 2);
  const wheelHeight = itemHeight * visibleRows;
  const centerOffset = itemHeight * sideRows;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const targetTop = selectedIndex * itemHeight;
    if (Math.abs(container.scrollTop - targetTop) > 1) {
      container.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
    }
  }, [itemHeight, selectedIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  function snapToClosest() {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rawIndex = Math.round(container.scrollTop / itemHeight);
    const nextIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
    const nextItem = items[nextIndex];

    container.scrollTo({
      top: nextIndex * itemHeight,
      behavior: "smooth",
    });

    if (nextItem && nextItem.value !== selectedValue) {
      onChange(nextItem.value);
    }
  }

  function handleScroll() {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      snapToClosest();
    }, 80);
  }

  return (
    <div style={wrapper}>
      <div style={{ ...selectionBand, top: centerOffset, height: itemHeight }} />
      <div
        ref={containerRef}
        aria-label={ariaLabel}
        role="listbox"
        tabIndex={0}
        onScroll={handleScroll}
        onBlur={snapToClosest}
        style={{
          ...wheel,
          height: wheelHeight,
          paddingTop: centerOffset,
          paddingBottom: centerOffset,
        }}
      >
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;

          return (
            <div
              key={`${ariaLabel}-${item.value}-${index}`}
              role="option"
              aria-selected={isSelected}
              style={{
                ...wheelItem,
                height: itemHeight,
                color: isSelected ? appPalette.textStrong : appPalette.textSoft,
                fontWeight: isSelected ? 800 : 600,
                transform: isSelected ? "scale(1.02)" : "scale(0.96)",
                opacity: isSelected ? 1 : 0.78,
              }}
              onClick={() => onChange(item.value)}
            >
              {item.label}
            </div>
          );
        })}
      </div>
      <div style={fadeTop} />
      <div style={fadeBottom} />
    </div>
  );
}

const wrapper = {
  position: "relative" as const,
  borderRadius: 24,
  border: `1px solid ${appPalette.borderDefault}`,
  background: `linear-gradient(180deg, ${appPalette.surfaceMuted} 0%, ${appPalette.surface} 100%)`,
  overflow: "hidden" as const,
};

const wheel = {
  overflowY: "auto" as const,
  overscrollBehavior: "contain" as const,
  scrollSnapType: "y mandatory" as const,
  scrollbarWidth: "none" as const,
  msOverflowStyle: "none" as const,
};

const wheelItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  scrollSnapAlign: "center" as const,
  fontSize: 28,
  lineHeight: 1,
  letterSpacing: -0.4,
  transition: "transform 140ms ease, opacity 140ms ease, color 140ms ease",
  cursor: "pointer",
  userSelect: "none" as const,
};

const selectionBand = {
  position: "absolute" as const,
  left: 10,
  right: 10,
  borderRadius: 18,
  background: withAlpha(appPalette.surface, 0.9),
  border: `1px solid ${withAlpha(appPalette.surfaceDark, 0.08)}`,
  boxShadow: `0 10px 20px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
  pointerEvents: "none" as const,
  zIndex: 2,
};

const fadeTop = {
  position: "absolute" as const,
  inset: "0 0 auto 0",
  height: 34,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surfaceMuted, 0.98)} 0%, ${withAlpha(appPalette.surfaceMuted, 0)} 100%)`,
  pointerEvents: "none" as const,
  zIndex: 3,
};

const fadeBottom = {
  position: "absolute" as const,
  inset: "auto 0 0 0",
  height: 34,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surfaceMuted, 0)} 0%, ${withAlpha(appPalette.surfaceMuted, 0.98)} 100%)`,
  pointerEvents: "none" as const,
  zIndex: 3,
};

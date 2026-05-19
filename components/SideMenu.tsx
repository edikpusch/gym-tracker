"use client";

import { useEffect } from "react";

type SideMenuItem = {
  key: string;
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
};

export type { SideMenuItem };

type SideMenuProps = {
  open: boolean;
  hidden?: boolean;
  side?: "left" | "right";
  onToggle: () => void;
  onClose: () => void;
  items: SideMenuItem[];
};

export function SideMenu({
  open,
  hidden = false,
  side = "left",
  onToggle,
  onClose,
  items,
}: SideMenuProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        style={{
          ...floatingToggle,
          ...(side === "right" ? floatingToggleRight : null),
          ...(hidden ? floatingToggleHidden : null),
          ...(open ? floatingToggleOpen : null),
        }}
        onClick={onToggle}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
      >
        <span style={hamburgerIcon}>☰</span>
      </button>

      <div
        style={{
          ...drawerOverlay,
          ...(open ? drawerOverlayOpen : null),
        }}
        onClick={onClose}
        aria-hidden={!open}
      >
        <aside
          style={{
            ...drawer,
            ...(side === "right" ? drawerRight : null),
            ...(open ? drawerOpen : null),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={drawerHandle} />

          <div style={drawerHeader}>
            <div>
              <div style={drawerEyebrow}>Navigation</div>
              <div style={drawerTitle}>Gym Tracker</div>
            </div>
            <button
              type="button"
              style={closeButton}
              onClick={onClose}
              aria-label="Menü schließen"
            >
              ×
            </button>
          </div>

          <nav style={drawerList} aria-label="Hauptnavigation">
            {items.map((item) => {
              const sharedStyle = {
                ...drawerItem,
                ...(item.active ? drawerItemActive : null),
                ...(item.disabled ? drawerItemDisabled : null),
              };

              const content = (
                <>
                  <span style={drawerIcon}>{item.icon}</span>
                  <span style={drawerLabel}>{item.label}</span>
                </>
              );

              if (item.href && !item.disabled) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    style={sharedStyle}
                    onClick={onClose}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  style={sharedStyle}
                  onClick={
                    item.disabled
                      ? undefined
                      : () => {
                          item.onClick?.();
                          onClose();
                        }
                  }
                  disabled={item.disabled}
                >
                  {content}
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
}

const floatingToggle = {
  position: "fixed" as const,
  left: 14,
  bottom: "calc(18px + env(safe-area-inset-bottom))",
  width: 56,
  height: 56,
  borderRadius: 20,
  border: "1px solid rgba(214, 223, 235, 0.96)",
  background: "rgba(255,255,255,0.98)",
  color: "#111827",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.16)",
  cursor: "pointer",
  zIndex: 56,
  transition:
    "transform 220ms ease, box-shadow 220ms ease, background 220ms ease, opacity 220ms ease",
  backdropFilter: "blur(18px)",
};

const floatingToggleRight = {
  left: "auto",
  right: 14,
};

const floatingToggleOpen = {
  transform: "translateX(4px) scale(0.98)",
  boxShadow: "0 12px 26px rgba(15, 23, 42, 0.12)",
  background: "#111827",
  color: "#ffffff",
};

const floatingToggleHidden = {
  opacity: 0,
  pointerEvents: "none" as const,
  transform: "translateY(10px)",
};

const hamburgerIcon = {
  fontSize: 20,
  lineHeight: 1,
};

const drawerOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(15, 23, 42, 0)",
  opacity: 0,
  pointerEvents: "none" as const,
  transition: "opacity 240ms ease, background 240ms ease",
  zIndex: 55,
};

const drawerOverlayOpen = {
  opacity: 1,
  pointerEvents: "auto" as const,
  background: "rgba(15, 23, 42, 0.32)",
};

const drawer = {
  position: "absolute" as const,
  left: 0,
  top: 0,
  bottom: 0,
  width: "min(78vw, 336px)",
  maxWidth: "100%",
  padding: "18px 16px calc(24px + env(safe-area-inset-bottom))",
  borderRadius: "0 32px 32px 0",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.99) 100%)",
  borderRight: "1px solid rgba(214, 223, 235, 0.92)",
  boxShadow: "0 30px 70px rgba(15, 23, 42, 0.18)",
  transform: "translateX(-104%)",
  transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

const drawerRight = {
  left: "auto",
  right: 0,
  borderRadius: "32px 0 0 32px",
  borderRight: "none",
  borderLeft: "1px solid rgba(214, 223, 235, 0.92)",
  transform: "translateX(104%)",
};

const drawerOpen = {
  transform: "translateX(0)",
};

const drawerHandle = {
  width: 42,
  height: 5,
  borderRadius: 999,
  background: "#e2e8f0",
  alignSelf: "flex-start",
};

const drawerHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #edf2f7",
};

const drawerEyebrow = {
  fontSize: 11,
  letterSpacing: 1.1,
  textTransform: "uppercase" as const,
  color: "#94a3b8",
  fontWeight: 700,
};

const drawerTitle = {
  marginTop: 6,
  fontSize: 24,
  lineHeight: 1.05,
  color: "#0f172a",
  fontWeight: 800,
};

const closeButton = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "1px solid #dce5f0",
  background: "#ffffff",
  color: "#334155",
  fontSize: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
};

const drawerList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  paddingTop: 4,
};

const drawerItem = {
  width: "100%",
  minHeight: 54,
  padding: "13px 15px",
  borderRadius: 22,
  border: "1px solid transparent",
  background: "transparent",
  color: "#334155",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 14,
  textAlign: "left" as const,
  fontSize: 17,
  fontWeight: 700,
  boxShadow: "0 14px 26px rgba(15, 23, 42, 0)",
};

const drawerItemActive = {
  background: "#0f172a",
  color: "#ffffff",
  boxShadow: "0 24px 44px rgba(15, 23, 42, 0.18)",
};

const drawerItemDisabled = {
  opacity: 0.42,
};

const drawerIcon = {
  width: 28,
  textAlign: "center" as const,
  fontSize: 22,
  flexShrink: 0,
};

const drawerLabel = {
  flex: 1,
};

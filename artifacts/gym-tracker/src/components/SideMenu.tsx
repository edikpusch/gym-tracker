

import { useEffect } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

type SideMenuItem = {
  key: string;
  label: string;
  icon: string;
  section?: string;
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
  const groupedItems = items.reduce<Array<{ label: string; items: SideMenuItem[] }>>(
    (groups, item) => {
      const label = item.section ?? "Navigation";
      const existing = groups.find((group) => group.label === label);

      if (existing) {
        existing.items.push(item);
        return groups;
      }

      groups.push({ label, items: [item] });
      return groups;
    },
    []
  );

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
      <div
        style={{
          ...floatingDock,
          ...(side === "right" ? floatingDockRight : null),
          ...(hidden ? floatingDockHidden : null),
          ...(open ? floatingDockOpen : null),
        }}
      >
        <button
          type="button"
          style={{
            ...floatingToggle,
            ...(open ? floatingToggleOpen : null),
          }}
          onClick={onToggle}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
        >
          <span style={hamburgerIcon}>☰</span>
          <span style={toggleLabel}>{open ? "Schließen" : "Menü"}</span>
        </button>
      </div>

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
            <AppButton
              variant="secondary"
              size="compact"
              style={closeButton}
              onClick={onClose}
              aria-label="Menü schließen"
            >
              ×
            </AppButton>
          </div>

          <nav style={drawerList} aria-label="Hauptnavigation">
            {groupedItems.map((group) => (
              <div key={group.label} style={drawerGroup}>
                <div style={drawerGroupLabel}>{group.label}</div>
                <div style={drawerGroupList}>
                  {group.items.map((item) => {
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
                        <a key={item.key} href={item.href} style={sharedStyle} onClick={onClose}>
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
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}

const floatingDock = {
  position: "fixed" as const,
  left: "calc(16px + env(safe-area-inset-left))",
  bottom: "calc(16px + env(safe-area-inset-bottom))",
  padding: 8,
  borderRadius: 28,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.95)} 0%, ${withAlpha(appPalette.surfaceMuted, 0.93)} 100%)`,
  border: `1px solid ${withAlpha(appPalette.borderSoft, 0.94)}`,
  boxShadow: `0 20px 40px ${withAlpha(appPalette.surfaceDark, 0.12)}`,
  zIndex: 56,
  transition: `transform ${uiTheme.motion.smooth}, box-shadow ${uiTheme.motion.smooth}, opacity ${uiTheme.motion.smooth}, background ${uiTheme.motion.smooth}`,
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

const floatingDockRight = {
  left: "auto",
  right: "calc(16px + env(safe-area-inset-right))",
};

const floatingDockOpen = {
  transform: "translateY(-1px)",
  boxShadow: `0 22px 44px ${withAlpha(appPalette.surfaceDark, 0.16)}`,
};

const floatingDockHidden = {
  opacity: 0,
  pointerEvents: "none" as const,
  transform: "translateY(10px)",
};

const floatingToggle = {
  minWidth: 136,
  height: 52,
  padding: "0 18px",
  borderRadius: 20,
  border: `1px solid ${withAlpha(appPalette.borderSoft, 0.82)}`,
  background: withAlpha(appPalette.surface, 0.94),
  color: appPalette.surfaceDark,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  boxShadow: `0 14px 24px ${withAlpha(appPalette.surfaceDark, 0.1)}`,
  cursor: "pointer",
  transition: `transform ${uiTheme.motion.smooth}, box-shadow ${uiTheme.motion.smooth}, background ${uiTheme.motion.smooth}, border-color ${uiTheme.motion.smooth}`,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const floatingToggleOpen = {
  transform: "scale(0.985)",
  boxShadow: `0 10px 18px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
  background: appPalette.surfaceDark,
  borderColor: withAlpha(appPalette.surfaceDark, 0.3),
  color: appPalette.surface,
};

const hamburgerIcon = {
  fontSize: 21,
  lineHeight: 1,
};

const toggleLabel = {
  fontSize: 15,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const drawerOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: withAlpha(appPalette.surfaceDark, 0),
  opacity: 0,
  pointerEvents: "none" as const,
  transition: `opacity ${uiTheme.motion.smooth}, background ${uiTheme.motion.smooth}`,
  zIndex: 55,
};

const drawerOverlayOpen = {
  opacity: 1,
  pointerEvents: "auto" as const,
  background: withAlpha(appPalette.surfaceDark, 0.32),
};

const drawer = {
  position: "absolute" as const,
  left: 0,
  top: 0,
  bottom: 0,
  width: "min(78vw, 336px)",
  maxWidth: "100%",
  paddingTop: `calc(${uiTheme.spacing.base + 2}px + env(safe-area-inset-top))`,
  paddingRight: `${uiTheme.spacing.base}px`,
  paddingBottom: `calc(${uiTheme.spacing.large}px + env(safe-area-inset-bottom))`,
  paddingLeft: `${uiTheme.spacing.base}px`,
  borderRadius: `0 ${uiTheme.radius.hero}px ${uiTheme.radius.hero}px 0`,
  background: `linear-gradient(180deg, ${withAlpha(appPalette.surface, 0.99)} 0%, ${withAlpha(appPalette.surfaceMuted, 0.99)} 100%)`,
  borderRight: `1px solid ${withAlpha(appPalette.borderSoft, 0.92)}`,
  boxShadow: uiTheme.shadow.drawer,
  transform: "translateX(-104%)",
  transition: `transform ${uiTheme.motion.spring}`,
  display: "flex",
  flexDirection: "column" as const,
  gap: uiTheme.spacing.base - 2,
};

const drawerRight = {
  left: "auto",
  right: 0,
  borderRadius: `${uiTheme.radius.hero}px 0 0 ${uiTheme.radius.hero}px`,
  borderRight: "none",
  borderLeft: `1px solid ${withAlpha(appPalette.borderSoft, 0.92)}`,
  transform: "translateX(104%)",
};

const drawerOpen = {
  transform: "translateX(0)",
};

const drawerHandle = {
  width: 42,
  height: 5,
  borderRadius: uiTheme.radius.pill,
  background: appPalette.borderDefault,
  alignSelf: "flex-start",
};

const drawerHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 10,
  borderBottom: `1px solid ${appPalette.borderSoft}`,
};

const drawerEyebrow = {
  fontSize: 11,
  letterSpacing: 1.1,
  textTransform: "uppercase" as const,
  color: appPalette.textSoft,
  fontWeight: 700,
};

const drawerTitle = {
  marginTop: 6,
  fontSize: 24,
  lineHeight: 1.05,
  color: appPalette.textStrong,
  fontWeight: 800,
};

const closeButton = {
  width: 44,
  minWidth: 44,
  padding: 0,
  fontSize: 20,
  lineHeight: 1,
};

const drawerList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: uiTheme.spacing.base - 4,
  paddingTop: 2,
  overflowY: "auto" as const,
  WebkitOverflowScrolling: "touch" as const,
  flex: 1,
  minHeight: 0,
};

const drawerGroup = {
  display: "flex",
  flexDirection: "column" as const,
  gap: uiTheme.spacing.small - 2,
};

const drawerGroupLabel = {
  padding: "0 6px",
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: "uppercase" as const,
  color: appPalette.textSoft,
};

const drawerGroupList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const drawerItem = {
  width: "100%",
  minHeight: uiTheme.touch.comfortable,
  padding: "12px 14px",
  borderRadius: uiTheme.radius.medium + 2,
  border: "1px solid transparent",
  background: "transparent",
  color: appPalette.textDefault,
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "left" as const,
  fontSize: 16,
  fontWeight: 700,
  transition: `transform ${uiTheme.motion.quick}, background ${uiTheme.motion.quick}, box-shadow ${uiTheme.motion.quick}, border-color ${uiTheme.motion.quick}, color ${uiTheme.motion.quick}`,
};

const drawerItemActive = {
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  borderColor: withAlpha(appPalette.surfaceDark, 0.32),
  boxShadow: uiTheme.shadow.medium,
};

const drawerItemDisabled = {
  opacity: 0.42,
  cursor: "not-allowed",
};

const drawerIcon = {
  width: 22,
  minWidth: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  lineHeight: 1,
};

const drawerLabel = {
  flex: 1,
  minWidth: 0,
};

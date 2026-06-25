"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  match?: (path: string) => boolean;
};

const HomeIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={filled ? 0 : 1.8} stroke={filled ? "none" : "currentColor"}>
    {filled ? (
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" fill="currentColor" />
    ) : (
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
    )}
  </svg>
);

const DumbbellIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 6.5h1v11h-1m-3-8h4m9-3h1v11h-1m-3-8h4M9.5 9.5h5v5h-5z" opacity={filled ? 1 : 0.85} strokeWidth={filled ? 2.2 : 1.8} />
  </svg>
);

const ChartIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
    <rect x="4" y="13" width="4" height="7" rx="1" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} />
    <rect x="10" y="9" width="4" height="11" rx="1" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} />
    <rect x="16" y="5" width="4" height="15" rx="1" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} />
  </svg>
);

const ClockIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
    <circle cx="12" cy="12" r="9" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} />
    {filled ? (
      <path d="M12 7v5l3 3" stroke="white" strokeWidth={1.8} strokeLinecap="round" />
    ) : (
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    )}
  </svg>
);

const GearIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} />
    <path strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: <HomeIcon />,
    activeIcon: <HomeIcon filled />,
    match: (p) => p === "/",
  },
  {
    href: "/workout",
    label: "Workout",
    icon: <DumbbellIcon />,
    activeIcon: <DumbbellIcon filled />,
    match: (p) => p.startsWith("/workout"),
  },
  {
    href: "/statistics",
    label: "Stats",
    icon: <ChartIcon />,
    activeIcon: <ChartIcon filled />,
    match: (p) => p.startsWith("/statistics"),
  },
  {
    href: "/history",
    label: "Verlauf",
    icon: <ClockIcon />,
    activeIcon: <ClockIcon filled />,
    match: (p) => p.startsWith("/history"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <GearIcon />,
    activeIcon: <GearIcon filled />,
    match: (p) => p.startsWith("/settings"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(var(--c-tab-height) + var(--safe-area-bottom))",
        paddingBottom: "var(--safe-area-bottom)",
        background: "rgba(11,17,32,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "0.5px solid var(--c-border)",
        display: "flex",
        alignItems: "stretch",
        zIndex: 50,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: active ? "var(--c-accent)" : "var(--c-text-3)",
              textDecoration: "none",
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              letterSpacing: 0.3,
              transition: "color 0.15s",
              paddingTop: 4,
            }}
          >
            {active ? (item.activeIcon ?? item.icon) : item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

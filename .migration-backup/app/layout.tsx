import { AppStorageBootstrap } from "@/components/app-storage-bootstrap";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PlanVersionGuard } from "@/components/plan-version-guard";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { ThemeController } from "@/components/theme-controller";
import { ViewportMetricsController } from "@/components/viewport-metrics-controller";
import { appChromeBackground } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Gym Tracker",
  description: "Track your workouts",
  applicationName: "Gym Tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gym Tracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body style={bodyStyle}>
        <AppStorageBootstrap>
          <ViewportMetricsController />
          <ThemeController />
          <ServiceWorkerRegistration />
          <PlanVersionGuard />
          <div style={appWrapper}>{children}</div>
        </AppStorageBootstrap>
      </body>
    </html>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  minHeight: "var(--app-viewport-height, 100dvh)",
  background: appChromeBackground,
  color: "rgb(var(--app-text-strong-rgb))",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  overflowX: "hidden",
};

const appWrapper: React.CSSProperties = {
  minHeight: "var(--app-viewport-height, 100dvh)",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  background: appChromeBackground,
  paddingRight: "env(safe-area-inset-right)",
  paddingLeft: "env(safe-area-inset-left)",
};

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PlanVersionGuard } from "@/components/plan-version-guard";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body style={bodyStyle}>
        <ServiceWorkerRegistration />
        <PlanVersionGuard />
        <div style={appWrapper}>{children}</div>
      </body>
    </html>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  background: "#fff",
  color: "#000",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
};

const appWrapper: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  paddingRight: "env(safe-area-inset-right)",
  paddingLeft: "env(safe-area-inset-left)",
};

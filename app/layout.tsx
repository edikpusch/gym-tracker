import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ViewportMetricsController } from "@/components/viewport-metrics-controller";
import { WorkoutDomainBootstrap } from "@/components/workout-domain-bootstrap";
import { RestSignalMonitor } from "@/components/rest-signal-monitor";
import { PwaProvider } from "@/components/pwa-provider";

export const metadata: Metadata = {
  title: "Gym Tracker",
  description: "Track your workouts",
  applicationName: "Gym Tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gym Tracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1120",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body style={{ background: "var(--c-bg)" }}>
        <PwaProvider>
          <ViewportMetricsController />
          <WorkoutDomainBootstrap />
          <RestSignalMonitor />
          {children}
        </PwaProvider>
      </body>
    </html>
  );
}

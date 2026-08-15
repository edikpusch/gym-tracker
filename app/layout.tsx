import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ViewportMetricsController } from "@/components/viewport-metrics-controller";
import { WorkoutDomainBootstrap } from "@/components/workout-domain-bootstrap";
import { RestSignalMonitor } from "@/components/rest-signal-monitor";
import { PwaProvider } from "@/components/pwa-provider";
import { ScrollLockGuard } from "@/components/scroll-lock-guard";

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
  // Zoom war gesperrt, bei Schriftgrößen von 9 bis 13px. Wer eine Lesebrille
  // braucht, konnte die App damit nicht benutzen (WCAG 1.4.4). Der Schutz vor
  // versehentlichem Doppeltipp-Zoom beim schnellen +/−-Tippen sitzt jetzt als
  // `touch-action: manipulation` auf den Schaltflächen selbst.
  maximumScale: 5,
  userScalable: true,
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
          <ScrollLockGuard />
          <ViewportMetricsController />
          <WorkoutDomainBootstrap />
          <RestSignalMonitor />
          {children}
        </PwaProvider>
      </body>
    </html>
  );
}

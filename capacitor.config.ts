import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.edikp.gymtracker",
  appName: "Gym Tracker",
  webDir: "out",
  ios: {
    // Muss `true` bleiben. Der frühere Kommentar behauptete, die App verwalte
    // ihre Scroll-Container selbst — das stimmt aber nur für den Workout-Screen.
    // Verlauf, Statistik, Einstellungen, Pläne und der Plan-Editor scrollen über
    // das Dokument. Mit `scrollEnabled: false` wären sie auf dem iPhone
    // vollständig eingefroren, alles unterhalb des ersten Bildschirms
    // unerreichbar.
    scrollEnabled: true,
    // Let Capacitor derive safe-area insets from the WKWebView's layout guides
    // so env(safe-area-inset-*) values are correct for Notch / Dynamic Island.
    contentInset: "automatic",
    // Match the app chrome background so the launch screen has no white flash.
    backgroundColor: "#111827",
  },
  plugins: {
    LocalNotifications: {
      sound: "rest_chime.wav",
    },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;

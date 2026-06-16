import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.edikp.gymtracker",
  appName: "Gym Tracker",
  webDir: "out",
  ios: {
    // Prevent WKWebView from scrolling natively — the app manages its own scroll containers.
    // Without this, both the WKWebView and the app's inner scrollers respond to swipes,
    // causing a double-scroll / rubber-band effect on iPhone.
    scrollEnabled: false,
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

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.edikp.gymtracker",
  appName: "Gym Tracker",
  webDir: "out",
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

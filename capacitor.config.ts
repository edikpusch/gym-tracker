import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.edikp.gymtracker",
  appName: "Gym Tracker",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;

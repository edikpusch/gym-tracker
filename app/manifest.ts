import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym Tracker",
    short_name: "GymTracker",
    description:
      "Offline-fähiger Gym Tracker für dein Training im Fitnessstudio.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    orientation: "portrait",
    lang: "de-DE",
    categories: ["fitness", "health", "productivity"],
    shortcuts: [
      {
        name: "Workout starten",
        short_name: "Workout",
        description: "Workout-Auswahl öffnen",
        url: "/workout",
      },
      {
        name: "Trainingsverlauf",
        short_name: "Verlauf",
        description: "Abgeschlossene Workouts ansehen",
        url: "/history",
      },
    ],
    icons: [
      {
        src: "/apple-icon",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

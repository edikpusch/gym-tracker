import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

// package.json ist die einzige Quelle der Versionsnummer. Alles andere leitet
// sich daraus ab: die Anzeige in der App über NEXT_PUBLIC_APP_VERSION, der
// Android-Build über JsonSlurper in android/app/build.gradle.
const appVersion = (
  JSON.parse(readFileSync("./package.json", "utf8")) as { version: string }
).version;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.2.35"],
  output: isCapacitorBuild ? "export" : undefined,
  trailingSlash: isCapacitorBuild,
  env: {
    NEXT_PUBLIC_BUILD_TARGET: process.env.BUILD_TARGET ?? "",
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: isCapacitorBuild,
  },
  async headers() {
    if (isCapacitorBuild) {
      return [];
    }

    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

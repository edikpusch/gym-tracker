import type { NextConfig } from "next";

const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.2.35"],
  output: isCapacitorBuild ? "export" : undefined,
  trailingSlash: isCapacitorBuild,
  env: {
    NEXT_PUBLIC_BUILD_TARGET: process.env.BUILD_TARGET ?? "",
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

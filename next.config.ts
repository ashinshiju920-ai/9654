import type { NextConfig } from "next";

const isVinextBuild = process.env.npm_lifecycle_event?.includes("vinext") || process.env.VINEXT_BUILD === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isVinextBuild ? {} : { output: "standalone" }),
  poweredByHeader: false,
};

export default nextConfig;

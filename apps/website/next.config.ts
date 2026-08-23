import type { NextConfig } from "next";

const nextConfig: NextConfig =
  process.env.VERCEL_STATIC_EXPORT === "true"
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {};

export default nextConfig;

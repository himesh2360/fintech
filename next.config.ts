import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so Next.js doesn't pick up stray lockfiles
    // (e.g. C:\Users\aggar\package-lock.json) and mis-detect the root.
    root: __dirname,
  },
};

export default nextConfig;

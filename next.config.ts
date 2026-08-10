import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not externalize @x402/* — Node ESM fails on its `next/server` import without bundler resolution.
  serverExternalPackages: ["pdf-parse", "xlsx", "algosdk"],
  turbopack: {
    // Pin the workspace root so Next.js doesn't pick up stray lockfiles
    // (e.g. C:\Users\aggar\package-lock.json) and mis-detect the root.
    root: __dirname,
  },
};

export default nextConfig;

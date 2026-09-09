import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "jsdom", "pdf-parse"],
};

export default nextConfig;

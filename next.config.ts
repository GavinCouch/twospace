import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-auth", "sharp"],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;

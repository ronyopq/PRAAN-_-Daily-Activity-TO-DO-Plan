import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` must stay outside the bundler: it is a native-ish Node package that
  // Turbopack/webpack otherwise tries to shim, which breaks pooled connections.
  serverExternalPackages: ["pg"],
};

export default nextConfig;

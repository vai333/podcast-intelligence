import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Neon serverless driver needs the real `ws` module at runtime (bundling it breaks the WebSocket handshake).
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
};

export default nextConfig;

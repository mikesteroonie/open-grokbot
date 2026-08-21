import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The agentmail SDK dynamically imports "@x402/fetch" for its optional
  // payments integration. We don't use payments, but the bundler still
  // tries to resolve the import at build time — keeping the package
  // external defers resolution to runtime.
  serverExternalPackages: ["agentmail"],
};

export default nextConfig;

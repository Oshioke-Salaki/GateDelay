import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  // Prevent Turbopack from bundling Particle/AWS SDK into the client graph.
  // These packages use node:fs and must only be loaded at runtime via dynamic
  // import with ssr:false — they should never appear in the client bundle.
  serverExternalPackages: [
    "@particle-network/auth-core",
    "@particle-network/auth-connectors",
    "@particle-network/connectkit",
    "@aws-sdk/credential-provider-sso",
    "@aws-sdk/credential-providers",
  ],

  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

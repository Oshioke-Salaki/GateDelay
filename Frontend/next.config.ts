import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Emits `.next/standalone` with a self-contained `server.js` and only the
  // node_modules actually traced from the build. The Dockerfile's runtime stage
  // copies that instead of the full dependency tree, which is what keeps the
  // image from carrying the whole devDependency set.
  // Harmless outside Docker: `next dev` and `next start` are unaffected.
  output: "standalone",

  // Pin Turbopack to this package so the monorepo parent lockfile is not treated
  // as the workspace root. No Node built-in aliases — client code must not pull
  // server-only modules into the browser bundle.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

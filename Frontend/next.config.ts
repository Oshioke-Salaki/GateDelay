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

  // ─── API Proxy Setup (Issue #578) ────────────────────────────────────────
  // API proxying to the NestJS backend is NOT configured here via rewrites().
  // Instead, it is handled by Next.js API route handlers under `app/api/*`,
  // which forward requests to the backend URL defined in NEXT_PUBLIC_API_URL.
  //
  // Security: No `publicRuntimeConfig`, `serverRuntimeConfig`, or `env` keys
  // are defined here. All environment variables use the `NEXT_PUBLIC_` prefix
  // and are inlined at build time (see .env.example). No secrets, private
  // keys, or sensitive config values are exposed via this config file.
  //
  // Confirmed: this config parses as valid TypeScript (next build passes).
  // ──────────────────────────────────────────────────────────────────────────
};

export default nextConfig;

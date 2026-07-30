import type { NextConfig } from "next";

/**
 * Next.js Frontend Configuration
 *
 * Secure configuration for routing, API proxying/rewrites, and preventing secret exposure.
 */
const nextConfig: NextConfig = {
  /**
   * Rewrites allow you to map an incoming request path to a different destination path.
   * This is particularly useful during local development to proxy API calls to the local backend
   * without encountering Cross-Origin Resource Sharing (CORS) issues.
   */
  async rewrites() {
    // Determine target backend API URL.
    // Fall back to http://localhost:8080 during local development if NEXT_PUBLIC_API_URL is not set.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

    return [
      {
        // Matches paths starting with /api/v1/ and proxies to the backend URL
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        // Matches backend prefix to ensure backward compatibility and smooth proxying
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },

  /**
   * SECURITY AUDIT & PRECAUTIONS:
   *
   * 1. No legacy features like 'publicRuntimeConfig' or 'serverRuntimeConfig' are used.
   *    This prevents potential accidental leaks of server-side secrets into the client bundle.
   * 2. Any client-side environment variables MUST be explicitly prefixed with 'NEXT_PUBLIC_'.
   *    Server-only secrets (e.g. JWT keys, database URLs, API tokens) must remain without
   *    the prefix and must never be imported/used in client-side code.
   */
};

export default nextConfig;

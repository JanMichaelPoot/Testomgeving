import type { NextConfig } from "next";

// The Content-Security-Policy itself is set per-request in src/proxy.ts
// instead (it needs a fresh nonce for Next.js's own inline hydration
// scripts) — setting it here too would layer a second, nonce-less CSP on
// every response, and browsers enforce the *intersection* of multiple CSP
// headers, so that second policy would silently block the app again. These
// headers don't need per-request values, so they're fine here.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

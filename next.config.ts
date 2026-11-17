import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 *
 * Written against what this site actually loads, which is very little: no
 * third-party scripts, no analytics, no embeds, no remote fonts, no images
 * from anywhere but this origin. That makes a tight policy cheap, so the
 * directives below are deny-by-default and each exception is justified.
 *
 * `'unsafe-inline'` on script-src is the one real concession, and it is not
 * laziness: Next's App Router streams RSC payloads and bootstrap code through
 * inline <script> tags on every page. Removing it needs a per-request nonce,
 * which needs a middleware that reads the request — and under
 * `cacheComponents` that would make every route dynamic and discard the
 * prerendering the whole site is built on. The honest trade is to say so, and
 * to close the injection paths instead, which is what the JSON-LD escaping
 * and the href scheme allowlist do.
 *
 * `'unsafe-eval'` is dev-only: the Turbopack dev runtime needs it, production
 * does not get it.
 */
const CSP = [
  "default-src 'self'",
  // static.cloudflareinsights.com is the analytics beacon, and nothing
  // else is allowed in. Without this line the browser blocks it silently
  // and the dashboard shows zero visitors with no error to explain why.
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind injects a <style> element; styled-jsx and Next do too.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The only fetch the browser makes is to this origin's own /api/ask.
  // The beacon POSTs its measurement here. Same reasoning as above.
  `connect-src 'self' https://cloudflareinsights.com${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // The modern replacement for X-Frame-Options, and strictly more capable.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * HSTS is sent in production only.
 *
 * Sending it from a dev server would pin `localhost` to HTTPS in the
 * developer's browser for two years, which breaks every other local project
 * on that machine and is painful to undo. `preload` is deliberately omitted:
 * submitting to the preload list is a one-way door that should be a conscious
 * decision made against a real domain, not a default shipped in a config.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy belt-and-braces for frame-ancestors, for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  /**
   * `/api/ask` reads data/embeddings.json with `node:fs` at request time.
   * Next traces imported modules, not paths built at runtime from
   * `process.cwd()`, so without this the file is left out of the serverless
   * bundle and retrieval silently falls back to BM25 alone in production.
   */
  outputFileTracingIncludes: {
    "/api/ask": ["./data/embeddings.json", "./data/repos.json", "./data/discovered.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      // /hidden-gems was the Stage 2 route; /gems is the real page.
      { source: "/hidden-gems", destination: "/gems", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

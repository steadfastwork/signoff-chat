/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";
const soketiWsHost = process.env.NEXT_PUBLIC_SOKETI_HOST
  ? `wss://${process.env.NEXT_PUBLIC_SOKETI_HOST}`
  : null;

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------

const csp = [
  "default-src 'self'",
  // Next.js App Router requires unsafe-inline for its hydration scripts.
  // unsafe-eval is only needed in development (fast refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://challenges.cloudflare.com`,
  // Tailwind and Next.js inject inline styles; Google Fonts stylesheet
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Images from UploadThing CDN + Giphy CDN + data URIs for avatars
  "img-src 'self' data: blob: https://utfs.io https://*.ufs.sh https://uploadthing.com https://*.giphy.com",
  // Soketi WebSocket (local: ws://localhost:6001, prod: wss://), Stripe, UploadThing, Giphy
  [
    "connect-src 'self'",
    ...(isDev ? ["ws://localhost:6001", "wss://localhost:6001"] : []),
    ...(soketiWsHost ? [soketiWsHost] : []),
    "wss://*.pusher.com",
    "https://*.pusher.com",
    "https://sockjs-mt1.pusher.com",
    "https://api.stripe.com",
    "https://q.stripe.com",
    "https://uploadthing.com",
    "https://utfs.io",
    "https://*.ufs.sh",
    "https://*.ingest.uploadthing.com",
    "https://api.giphy.com",
    "https://challenges.cloudflare.com",
  ].join(" "),
  // Audio files served from public/sounds/
  "media-src 'self'",
  // Stripe Elements iframe + Cloudflare Turnstile
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  // Prevent this page being embedded in iframes anywhere
  "frame-ancestors 'none'",
  // Restrict base tag hijacking
  "base-uri 'self'",
  // Only allow form submissions to same origin
  "form-action 'self'",
  // Upgrade plain HTTP subresources to HTTPS in production
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// ---------------------------------------------------------------------------
// Security headers applied to every route
// ---------------------------------------------------------------------------

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block this page from being embedded in iframes
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak full URL in Referer header to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature access
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Enable DNS prefetching for faster page loads
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Content Security Policy
  { key: "Content-Security-Policy", value: csp },
  // HSTS — only in production (avoids breaking localhost HTTP)
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig = {
  output: "standalone",

  // Suppress lint/type errors during builds (pre-existing issues; run tsc separately)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },


  transpilePackages: [
    "@signoff/types",
    "@signoff/validators",
    "@signoff/config",
    "@signoff/api-client",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
    ],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

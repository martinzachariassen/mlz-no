// This process sits behind Railway's edge and serves the Vite build output
// (dist/), so it must never crash on input and should shed load rather than fall
// over. Volumetric (network-layer) DDoS still has to be absorbed at the edge —
// front the Railway domain with Cloudflare. This is the last line of defence.

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "hono-rate-limiter";

const port = Number(process.env.PORT ?? 4173);
const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 10_000);
const rateLimit = Number(process.env.RATE_LIMIT_MAX ?? 120);

const app = new Hono();

// Registered before the rate limiter and method allowlist so a flood can never
// throttle Railway's deploy probe into a false "unhealthy" and stall a rollout.
app.get("/health", (c) => c.text("ok"));

// The CSP is scoped to exactly what the built page loads — the bundled JS/CSS
// (self), Google Fonts, and Umami. Keep it in sync with index.html. The Vite
// build ships no inline scripts (modulePreload polyfill is disabled) and no
// inline styles, so script-src / style-src stay free of 'unsafe-inline'.
app.use(
  "*",
  secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    referrerPolicy: "strict-origin-when-cross-origin",
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    // Empty arrays serialize to `feature=()` (disabled for all) — the
    // spec-correct form; a boolean `false` would emit the non-standard `=none`.
    permissionsPolicy: { geolocation: [], microphone: [], camera: [] },
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["https://fonts.gstatic.com"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://cloud.umami.is"],
      connectSrc: ["'self'", "https://cloud.umami.is"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
  }),
);

// Behind Railway's edge the TCP peer is the proxy, so the real client is the
// left-most X-Forwarded-For entry. It is spoofable, but a genuine volumetric
// flood is the edge's job, not the app's.
app.use(
  "*",
  rateLimiter({
    windowMs: rateWindowMs,
    limit: rateLimit,
    standardHeaders: "draft-7",
    keyGenerator: (c) =>
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
  }),
);

app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    return c.text("Method not allowed", 405, { Allow: "GET, HEAD" });
  }
  await next();
});

// serveStatic resolves requests within dist/ and blocks path traversal by
// construction — only files that exist on disk are reachable.
app.use("*", serveStatic({ root: "./dist" }));

app.notFound((c) => c.text("Not found", 404));

// Turn a thrown handler into a generic 500 rather than leaking internals or
// taking the process down.
app.onError((_err, c) => c.text("Internal server error", 500));

console.log(
  JSON.stringify({
    level: "info",
    msg: "listening",
    port,
    rateLimit: `${rateLimit}/${rateWindowMs}ms`,
  }),
);

export default {
  port,
  // Dual-stack so Railway's edge can reach the container over IPv4 or IPv6.
  hostname: process.env.HOST || "::",
  // Blunt slow / idle connections (slowloris). Bun caps this at 255 seconds.
  idleTimeout: 30,
  // GET-only site — there is no reason to accept a large request body.
  maxRequestBodySize: 1024 * 16,
  fetch: app.fetch,
};

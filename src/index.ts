// Hardened Bun + Hono server for the static site in public/.
//
// Threat model: this process sits behind Railway's edge and serves a fixed set
// of static files. It must never crash on input, make junk requests cheap, and
// shed load rather than fall over. The hardening leans on well-maintained,
// mostly first-party middleware rather than hand-rolled code:
//   - secureHeaders  (hono/secure-headers) — CSP, HSTS, X-Frame-Options, ...
//   - rateLimiter    (hono-rate-limiter)   — per-client fixed-window limit
//   - serveStatic    (hono/bun)            — safe path resolution, no traversal
// Volumetric (network-layer) DDoS still has to be absorbed at the edge — front
// the Railway domain with Cloudflare. This is the last line of defence.

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "hono-rate-limiter";

const port = Number(process.env.PORT ?? 4173);
// Fixed-window per-client rate limit (env-overridable).
const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 10_000);
const rateLimit = Number(process.env.RATE_LIMIT_MAX ?? 120);

const app = new Hono();

// --- Security headers on every response -------------------------------------
// The CSP is scoped to exactly what public/index.html loads: Google Fonts
// (styles from googleapis, font files from gstatic) and Umami analytics.
// Everything else is same-origin. Keep this in sync with the markup.
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

// --- Per-client rate limiting -----------------------------------------------
// Behind Railway's edge the TCP peer is the proxy, so the real client is the
// left-most X-Forwarded-For entry. It is spoofable, but a genuine volumetric
// flood is the edge's job (see the note above), not the app's. The default
// in-memory store resets each window and is fine for a single instance.
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

// --- Method allowlist -------------------------------------------------------
// A static host only needs GET/HEAD; reject everything else cheaply.
app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    return c.text("Method not allowed", 405, { Allow: "GET, HEAD" });
  }
  await next();
});

// --- Static files -----------------------------------------------------------
// serveStatic resolves requests within public/ and blocks path traversal by
// construction — only files that exist on disk are reachable. Directory
// requests ("/") resolve to index.html.
app.use("*", serveStatic({ root: "./public" }));

// Anything not matched by a real file is a 404.
app.notFound((c) => c.text("Not found", 404));

// A thrown handler becomes a generic 500 instead of leaking internals or
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

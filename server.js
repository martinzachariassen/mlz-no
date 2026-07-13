'use strict';

// Single-file static server for the public/ directory, hardened to stay up
// under hostile traffic (malformed URIs, path-probing scanners, slowloris,
// request floods). It has no runtime dependencies by design.
//
// Threat model: this process sits behind Railway's edge and serves a fixed set
// of static files. It must never crash on input, must make junk requests as
// cheap as possible, and must shed load rather than fall over. Volumetric DDoS
// still has to be absorbed at the edge (see README) — this is the last line of
// defence, not the only one.

const { createReadStream, readdirSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join } = require('node:path');

const root = join(__dirname, 'public');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);

// --- Tunables (env-overridable) --------------------------------------------

// Fixed-window per-client rate limit. Set RATE_LIMIT_MAX <= 0 to disable.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
// Hard cap on tracked clients so a spoofed-IP flood can't exhaust memory.
const RATE_LIMIT_MAX_CLIENTS = Number(process.env.RATE_LIMIT_MAX_CLIENTS || 20_000);
// Ceiling on concurrent sockets — refuses new connections past this.
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 512);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// Security headers sent on every response. The CSP is tailored to exactly what
// index.html loads: Google Fonts (styles + gstatic font files) and Umami
// analytics; everything else is same-origin. Keep it in sync with the markup.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "img-src 'self' data:",
    'font-src https://fonts.gstatic.com',
    "style-src 'self' https://fonts.googleapis.com",
    "script-src 'self' https://cloud.umami.is",
    "connect-src 'self' https://cloud.umami.is",
    "manifest-src 'self'",
    'upgrade-insecure-requests'
  ].join('; ')
};

// --- Startup manifest -------------------------------------------------------
// Enumerate public/ once. Every servable URL path is precomputed, so request
// handling never touches the filesystem to decide *what* to serve and can only
// ever return a file that existed at boot — path traversal is impossible by
// construction. The tradeoff: files added to public/ require a restart, which
// is fine since every deploy starts a fresh process.

const manifest = new Map(); // url path -> { absPath, size, contentType }

function register(urlPath, absPath, size) {
  manifest.set(urlPath, {
    absPath,
    size,
    contentType: contentTypes[extname(absPath)] || 'application/octet-stream'
  });
}

function buildManifest(dir, urlPrefix) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      buildManifest(abs, `${urlPrefix}${name}/`);
    } else if (stat.isFile()) {
      register(`${urlPrefix}${name}`, abs, stat.size);
      // Directory index: map /dir/ and /dir to the folder's index.html.
      if (name === 'index.html') {
        register(urlPrefix, abs, stat.size);
        if (urlPrefix.length > 1) register(urlPrefix.slice(0, -1), abs, stat.size);
      }
    }
  }
}

buildManifest(root, '/');

// --- Rate limiter (fixed window, bounded, fail-open) ------------------------

const hits = new Map(); // clientKey -> { count, windowStart }

function rateLimited(key, now) {
  if (RATE_LIMIT_MAX <= 0) return false;
  const rec = hits.get(key);
  if (!rec || now - rec.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // New window. When the table is full, stop tracking new clients rather than
    // grow unbounded — availability over strictness for legitimate traffic.
    if (!rec && hits.size >= RATE_LIMIT_MAX_CLIENTS) return false;
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT_MAX;
}

// Drop expired windows periodically so idle clients don't accumulate. unref()
// keeps this timer from holding the process open on its own.
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of hits) {
    if (now - rec.windowStart >= RATE_LIMIT_WINDOW_MS) hits.delete(key);
  }
}, 60_000).unref();

function clientKey(request) {
  // Behind Railway's proxy the TCP peer is the edge, so the real client is the
  // left-most X-Forwarded-For entry. It's spoofable, but the bounded table
  // above caps the blast radius of a spoofing flood.
  const xff = request.headers['x-forwarded-for'];
  if (xff) {
    const raw = Array.isArray(xff) ? xff[0] : xff;
    const first = raw.split(',')[0].trim();
    if (first) return first;
  }
  return request.socket.remoteAddress || 'unknown';
}

// --- Observability (throttled; never per-request) ---------------------------
// Per-request logging is itself an amplification vector under a flood, so we
// only emit a compact summary once a minute and only when something happened.

const stats = { served: 0, notFound: 0, badRequest: 0, methodBlocked: 0, rateBlocked: 0 };

setInterval(() => {
  const total = stats.served + stats.notFound + stats.badRequest + stats.methodBlocked + stats.rateBlocked;
  if (total === 0) return;
  console.log(JSON.stringify({ level: 'info', msg: 'traffic', windowSec: 60, ...stats }));
  for (const k of Object.keys(stats)) stats[k] = 0;
}, 60_000).unref();

// --- Request handling -------------------------------------------------------

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...securityHeaders
  });
  response.end(body);
}

function resolvePathname(url) {
  // Both new URL() and decodeURIComponent() throw on malformed input; a thrown
  // error here previously took the whole process down. Returning null instead
  // turns every "malformed URI" attack into a cheap 400.
  try {
    return decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
}

const server = createServer((request, response) => {
  try {
    if (rateLimited(clientKey(request), Date.now())) {
      stats.rateBlocked += 1;
      response.writeHead(429, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        'Cache-Control': 'no-store',
        ...securityHeaders
      });
      response.end('Too many requests');
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      stats.methodBlocked += 1;
      response.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Allow': 'GET, HEAD',
        'Cache-Control': 'no-store',
        ...securityHeaders
      });
      response.end('Method not allowed');
      return;
    }

    const pathname = resolvePathname(request.url);
    if (pathname === null) {
      stats.badRequest += 1;
      send(response, 400, 'Bad request');
      return;
    }

    const entry = manifest.get(pathname);
    if (!entry) {
      stats.notFound += 1;
      send(response, 404, 'Not found');
      return;
    }

    stats.served += 1;
    const headers = {
      'Content-Type': entry.contentType,
      'Content-Length': entry.size,
      'Cache-Control': 'no-store',
      ...securityHeaders
    };

    if (request.method === 'HEAD') {
      response.writeHead(200, headers);
      response.end();
      return;
    }

    const stream = createReadStream(entry.absPath);
    // A read error after headers are sent can't be turned into an error status —
    // just tear down the socket so a half-written response can't hang.
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    response.writeHead(200, headers);
    stream.pipe(response);
  } catch {
    // Belt-and-braces: no input should reach here, but if it does we answer 500
    // instead of letting the handler throw into the event loop.
    if (!response.headersSent) send(response, 500, 'Internal server error');
    else response.destroy();
  }
});

// --- Connection / timeout hardening -----------------------------------------

server.maxConnections = MAX_CONNECTIONS;
server.headersTimeout = 10_000;   // header trickle (slowloris) budget
server.requestTimeout = 15_000;   // whole-request budget, incl. slow bodies
server.keepAliveTimeout = 5_000;  // idle keep-alive before close
server.timeout = 20_000;          // overall socket inactivity

// Malformed HTTP at the protocol level surfaces here; reply once and close the
// socket without letting the error propagate.
server.on('clientError', (err, socket) => {
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  const status = err && err.code === 'HPE_HEADER_OVERFLOW' ? 431 : 400;
  socket.end(`HTTP/1.1 ${status} Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
});

// Absolute last resort. A static file server holds no mutable shared state, so
// swallowing a stray exception and staying up beats crash-looping under attack.
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'uncaughtException', err: String(err && err.stack || err) }));
});
process.on('unhandledRejection', (err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'unhandledRejection', err: String(err && err.stack || err) }));
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: 'info',
    msg: 'listening',
    port,
    files: manifest.size,
    rateLimit: RATE_LIMIT_MAX > 0 ? `${RATE_LIMIT_MAX}/${RATE_LIMIT_WINDOW_MS}ms` : 'off',
    maxConnections: MAX_CONNECTIONS
  }));
});

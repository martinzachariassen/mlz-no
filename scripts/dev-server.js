#!/usr/bin/env bun
// Local-only static server with live reload, for fast styling iteration.
// Deliberately separate from `bun run dev` (the Firebase Hosting emulator):
// that one enforces the production CSP, which has no 'unsafe-inline' and
// would block the reload snippet's own <script> tag. This server sends no
// CSP at all, so it must never be used to check headers, cleanUrls or
// anything `scripts/smoke.sh` covers — only pixels.

import { watch } from "node:fs";
import { extname, join } from "node:path";

const ROOT = join(import.meta.dir, "..", "public");
const CONTENT = join(import.meta.dir, "..", "content");
const PORT = 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/vnd.microsoft.icon",
};

const RELOAD_SNIPPET = `<script>
  new EventSource("/__reload").onmessage = () => location.reload();
</script>
</body>`;

const clients = new Set();

function broadcast() {
  for (const controller of clients) {
    try {
      controller.enqueue("data: reload\n\n");
    } catch {
      clients.delete(controller);
    }
  }
}

async function resolveFile(pathname) {
  const candidates =
    pathname === "/"
      ? ["index.html"]
      : [pathname, `${pathname}.html`, join(pathname, "index.html")];

  for (const candidate of candidates) {
    const path = join(ROOT, candidate);
    const file = Bun.file(path);
    if (await file.exists()) return path;
  }
  return null;
}

async function respond(path, status = 200) {
  const type = MIME[extname(path)] ?? "application/octet-stream";
  if (extname(path) === ".html") {
    const body = (await Bun.file(path).text()).replace(
      "</body>",
      RELOAD_SNIPPET,
    );
    return new Response(body, { status, headers: { "content-type": type } });
  }
  return new Response(Bun.file(path), {
    status,
    headers: { "content-type": type },
  });
}

let isRebuilding = false;
let rebuildPending = false;

function rebuildContent() {
  if (isRebuilding) {
    // A change arrived mid-build: note it instead of dropping it, so its
    // output isn't left stale once the in-flight build finishes.
    rebuildPending = true;
    return;
  }
  isRebuilding = true;
  Bun.spawn(["bun", "scripts/generator/build-content.js"], {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
  })
    .exited.catch(() => {})
    .finally(() => {
      isRebuilding = false;
      broadcast();
      if (rebuildPending) {
        rebuildPending = false;
        rebuildContent();
      }
    });
}

// One timer per kind of change, not one shared between both watchers: a
// public/ event arriving inside a pending rebuild's 80ms window used to clear
// that rebuild's timer and reschedule itself as a plain reload, so the
// content/ edit was never built and the browser reloaded the stale output.
const debounce = { rebuild: null, reload: null };

function onChange(rebuild) {
  // The rebuild's own writes into public/ re-trigger the ROOT watcher below;
  // without this it would broadcast a second, redundant reload on top of the
  // one rebuildContent() already sends when the build finishes.
  if (!rebuild && isRebuilding) return;
  const kind = rebuild ? "rebuild" : "reload";
  clearTimeout(debounce[kind]);
  debounce[kind] = setTimeout(
    () => (rebuild ? rebuildContent() : broadcast()),
    80,
  );
}

watch(ROOT, { recursive: true }, () => onChange(false));
watch(CONTENT, { recursive: true }, () => onChange(true));

Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname === "/__reload") {
      let controller;
      const stream = new ReadableStream({
        start(c) {
          controller = c;
          clients.add(c);
        },
        cancel() {
          clients.delete(controller);
        },
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    }

    const path = await resolveFile(pathname);
    if (!path) return respond(join(ROOT, "404.html"), 404);
    return respond(path);
  },
});

console.log(`dev server (hot reload, no CSP) → http://localhost:${PORT}`);

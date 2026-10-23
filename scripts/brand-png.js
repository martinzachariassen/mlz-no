// Renders the logo PNGs in public/brand/logo/png/ from tools/brand/logo.html
// with headless Chrome, then runs the brand generator so brand.json lists
// them. macOS only (Chrome path, `sips` for cropping); the PNGs are
// committed, so this only needs to run when the mark or colours change.
//
//   bun run brand:png

import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "public/brand/logo/png");
const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MARK_SIZES = [64, 256, 512, 1024];
const VARIANTS = ["dark", "light"];
const LOCKUP_SCALE = 2;

// Serve the repo root, like the social-card recipe in the README.
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req) {
    const file = Bun.file(
      join(ROOT, decodeURIComponent(new URL(req.url).pathname)),
    );
    return (await file.exists())
      ? new Response(file)
      : new Response("Not found", { status: 404 });
  },
});
const base = `http://127.0.0.1:${server.port}/tools/brand/logo.html`;

// Async on purpose: spawnSync would block the event loop, and with it the
// server Chrome is fetching from.
async function run(cmd) {
  const proc = Bun.spawn({ cmd, stderr: "pipe", stdout: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`${cmd[0]} failed:\n${err}`);
  return out;
}

const chrome = (args, query) =>
  run([
    CHROME,
    "--headless",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    "--virtual-time-budget=4000",
    ...args,
    `${base}?${new URLSearchParams(query)}`,
  ]);

// Chrome's window can't be smaller than ~500px, so render the logo centred
// in a larger viewport and crop the middle out with sips.
async function render(query, { width, height, scale, viewport }, file) {
  const shot = join(tmpdir(), `mlz-logo-${process.pid}.png`);
  await chrome(
    [
      `--window-size=${viewport},${viewport}`,
      `--force-device-scale-factor=${scale}`,
      `--screenshot=${shot}`,
    ],
    query,
  );
  await run([
    "sips",
    "--cropToHeightWidth",
    String(height * scale),
    String(width * scale),
    shot,
    "--out",
    file,
  ]);
  rmSync(shot, { force: true });
  console.log(`  ${file.slice(ROOT.length + 1)}`);
}

// Rounded up to an even number of CSS px, so the centred box sits on whole
// device pixels and the crop is symmetric.
const even = (n) => 2 * Math.ceil(n / 2);

try {
  mkdirSync(OUT, { recursive: true });

  for (const variant of VARIANTS) {
    for (const size of MARK_SIZES) {
      await render(
        { kind: "mark", variant, size },
        { width: size, height: size, scale: 1, viewport: Math.max(size, 600) },
        join(OUT, `mark-${variant}-${size}.png`),
      );
    }

    const query = { kind: "lockup", variant };
    const dom = await chrome(["--window-size=600,600", "--dump-dom"], query);
    const match = dom.match(/<title>([\d.]+)x([\d.]+)<\/title>/);
    if (!match) throw new Error("Couldn't read the lockup size from logo.html");
    await render(
      query,
      {
        width: even(Number(match[1])),
        height: even(Number(match[2])),
        scale: LOCKUP_SCALE,
        viewport: 600,
      },
      join(OUT, `lockup-${variant}@${LOCKUP_SCALE}x.png`),
    );
  }
} finally {
  server.stop(true);
}

// Refresh brand.json's logo list.
await run(["bun", join(ROOT, "scripts/brand.js")]);
